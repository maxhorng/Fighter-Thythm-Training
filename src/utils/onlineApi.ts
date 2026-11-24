import type { ComboData } from '../types/combo';
import { getOnlineApiBase, STORAGE_KEY_ONLINE_TOKEN } from '../config/online';
import { COMBO_LIMITS, sanitizeForUpload, utf8Bytes, validateCombo } from '../schema/comboSchema';

export type OnlineSort = 'likes' | 'downloads' | 'new';

export interface OnlineComboItem {
  id: string;
  characterId: string;
  characterName: string;
  mode: 'classic' | 'modern';
  difficulty: ComboData['difficulty'];
  position?: 'midscreen' | 'corner';
  title: string;
  titleEn?: string;
  tags: string[];
  noteCount: number;
  totalFrames: number;
  likes: number;
  downloads: number;
  author: string;
  createdAt: number;
  approvedAt?: number;
  status: 'pending' | 'approved' | 'rejected';
  rejectReason?: string;
}

export interface OnlineUser {
  id: string;
  username: string;
  displayName: string;
  avatar: string | null;
}

export interface OnlineListQuery {
  character?: string;
  difficulty?: string;
  mode?: string;
  position?: string;
  sort: OnlineSort;
  q?: string;
  page: number;
}

export class OnlineApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details: string[] = [],
    public retryAfterSec?: number
  ) {
    super(message);
  }
}

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY_ONLINE_TOKEN);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null) {
  try {
    if (token) localStorage.setItem(STORAGE_KEY_ONLINE_TOKEN, token);
    else localStorage.removeItem(STORAGE_KEY_ONLINE_TOKEN);
  } catch {
    // ignore
  }
}

async function request<T>(path: string, init: RequestInit & { auth?: boolean } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.auth) {
    const token = getStoredToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }
  let res: Response;
  try {
    res = await fetch(`${getOnlineApiBase()}${path}`, { ...init, headers });
  } catch {
    throw new OnlineApiError(0, 'network', 'Network error');
  }
  let data: Record<string, unknown> = {};
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    // non-JSON
  }
  if (!res.ok) {
    if (res.status === 401 && init.auth) setStoredToken(null);
    throw new OnlineApiError(
      res.status,
      String(data.error ?? 'http_error'),
      String(data.message ?? `HTTP ${res.status}`),
      Array.isArray(data.details) ? (data.details as string[]) : [],
      typeof data.retryAfterSec === 'number' ? data.retryAfterSec : undefined
    );
  }
  return data as T;
}

export async function loginWithDiscord(): Promise<OnlineUser> {
  if (!window.electronAPI?.discordLogin) throw new OnlineApiError(0, 'browser_only', 'Desktop app required');
  const result = await window.electronAPI.discordLogin(getOnlineApiBase());
  if (!result.ok || !result.token) throw new OnlineApiError(0, result.error ?? 'login_failed', result.error ?? 'Login failed');
  setStoredToken(result.token);
  return fetchMe();
}

export async function cancelDiscordLogin() {
  await window.electronAPI?.cancelDiscordLogin?.();
}

export function fetchMe(): Promise<OnlineUser> {
  return request<OnlineUser>('/api/me', { auth: true });
}

export async function logout() {
  try {
    await request('/auth/logout', { method: 'POST', auth: true });
  } finally {
    setStoredToken(null);
  }
}

export function listOnlineCombos(q: OnlineListQuery): Promise<{ items: OnlineComboItem[]; page: number; hasMore: boolean }> {
  const params = new URLSearchParams();
  if (q.character) params.set('character', q.character);
  if (q.difficulty) params.set('difficulty', q.difficulty);
  if (q.mode) params.set('mode', q.mode);
  if (q.position) params.set('position', q.position);
  if (q.q) params.set('q', q.q);
  params.set('sort', q.sort);
  params.set('page', String(q.page));
  return request(`/api/combos?${params.toString()}`);
}

export async function fetchMyLikes(): Promise<string[]> {
  const res = await request<{ ids: string[] }>('/api/me/likes', { auth: true });
  return res.ids;
}

export async function fetchMyCombos(): Promise<OnlineComboItem[]> {
  const res = await request<{ items: OnlineComboItem[] }>('/api/me/combos', { auth: true });
  return res.items;
}

export function toggleLike(id: string): Promise<{ liked: boolean; likes: number }> {
  return request(`/api/combos/${encodeURIComponent(id)}/like`, { method: 'POST', auth: true });
}

export function deleteMyCombo(id: string): Promise<{ ok: boolean }> {
  return request(`/api/combos/${encodeURIComponent(id)}`, { method: 'DELETE', auth: true });
}

/** Validates locally, then uploads only the shareable ComboData fields. */
export async function uploadCombo(combo: ComboData): Promise<{ id: string; status: 'pending' | 'approved' }> {
  const clean = sanitizeForUpload(combo);
  const check = validateCombo(clean);
  if (!check.ok) throw new OnlineApiError(422, 'invalid_format', 'Invalid format', check.errors);
  const body = JSON.stringify(clean);
  if (utf8Bytes(body) > COMBO_LIMITS.maxJsonBytes) throw new OnlineApiError(413, 'too_large', 'Combo too large');
  return request('/api/combos', {
    method: 'POST',
    auth: true,
    headers: { 'Content-Type': 'application/json' },
    body,
  });
}

/**
 * Downloads an approved combo's static JSON from the CDN, re-validates it, and returns a
 * ComboData ready to be stored as a local custom combo (only optional fields are added).
 */
export async function downloadOnlineCombo(item: OnlineComboItem): Promise<ComboData> {
  let res: Response;
  try {
    res = await fetch(`${getOnlineApiBase()}/files/${encodeURIComponent(item.id)}.json`);
  } catch {
    throw new OnlineApiError(0, 'network', 'Network error');
  }
  if (!res.ok) throw new OnlineApiError(res.status, 'not_found', 'Combo not found');
  const text = await res.text();
  if (utf8Bytes(text) > COMBO_LIMITS.maxJsonBytes) throw new OnlineApiError(413, 'too_large', 'Combo too large');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new OnlineApiError(422, 'invalid_format', 'Invalid JSON');
  }
  const check = validateCombo(parsed);
  if (!check.ok || !check.combo) throw new OnlineApiError(422, 'invalid_format', 'Invalid format', check.errors);
  const clean = sanitizeForUpload(check.combo);

  // Fire-and-forget download counter (deduped per IP per day on the server)
  fetch(`${getOnlineApiBase()}/api/combos/${encodeURIComponent(item.id)}/download`, { method: 'POST' }).catch(() => undefined);

  return {
    ...clean,
    id: `online-${item.id}`,
    source: 'online',
    onlineId: item.id,
    author: item.author.slice(0, 64),
  };
}
