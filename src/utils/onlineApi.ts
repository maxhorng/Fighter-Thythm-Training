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
  authorId?: string;
  createdAt: number;
  approvedAt?: number;
  status: 'pending' | 'approved' | 'rejected';
  rejectReason?: string;
  videoUrl?: string;
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
  author?: string;
  sort: OnlineSort;
  q?: string;
  page: number;
  includePending?: boolean;
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

function clearLegacyLocalToken() {
  try {
    localStorage.removeItem(STORAGE_KEY_ONLINE_TOKEN);
  } catch {
    // ignore
  }
}

export async function getStoredToken(): Promise<string | null> {
  if (window.electronAPI?.getOnlineToken) {
    try {
      const encryptedToken = await window.electronAPI.getOnlineToken();
      if (encryptedToken) {
        clearLegacyLocalToken();
        return encryptedToken;
      }
      // One-time migration from legacy plaintext localStorage token to DPAPI safeStorage
      const legacy = localStorage.getItem(STORAGE_KEY_ONLINE_TOKEN);
      if (legacy) {
        clearLegacyLocalToken();
        if (window.electronAPI.setOnlineToken) {
          await window.electronAPI.setOnlineToken(legacy);
        }
        return legacy;
      }
      return null;
    } catch {
      return null;
    }
  }
  try {
    return localStorage.getItem(STORAGE_KEY_ONLINE_TOKEN);
  } catch {
    return null;
  }
}

export async function setStoredToken(token: string | null): Promise<void> {
  if (window.electronAPI?.setOnlineToken && window.electronAPI?.clearOnlineToken) {
    clearLegacyLocalToken();
    try {
      if (token) await window.electronAPI.setOnlineToken(token);
      else await window.electronAPI.clearOnlineToken();
    } catch {
      // ignore
    }
    return;
  }
  try {
    if (token) localStorage.setItem(STORAGE_KEY_ONLINE_TOKEN, token);
    else localStorage.removeItem(STORAGE_KEY_ONLINE_TOKEN);
  } catch {
    // ignore
  }
}

type RequestKind = 'upload' | 'download' | 'browse';

function parseRetryAfter(res: Response, data: Record<string, unknown>): number | undefined {
  if (typeof data.retryAfterSec === 'number' && Number.isFinite(data.retryAfterSec) && data.retryAfterSec > 0) {
    return Math.ceil(data.retryAfterSec);
  }
  const header = res.headers.get('Retry-After');
  if (!header) return undefined;
  const asNum = Number(header);
  if (Number.isFinite(asNum) && asNum > 0) return Math.ceil(asNum);
  const asDate = Date.parse(header);
  if (Number.isFinite(asDate)) {
    const diff = Math.ceil((asDate - Date.now()) / 1000);
    if (diff > 0) return diff;
  }
  return undefined;
}

function classifyLimitError(
  res: Response,
  data: Record<string, unknown>,
  rawText: string,
  kind: RequestKind
): OnlineApiError | null {
  const errCode = String(data.error ?? '');
  const msg = String(data.message ?? '');
  const combined = `${errCode} ${msg} ${rawText}`;
  const retryAfterSec = parseRetryAfter(res, data);

  if (
    res.status === 507 ||
    errCode === 'quota_exceeded' ||
    /1027|daily\s+limit|quota\s+exceeded|exceeded\s+.*(limit|quota)|d1.*limit|storage\s+limit/i.test(combined)
  ) {
    return new OnlineApiError(res.status, 'quota_exceeded', msg || 'Server daily quota exceeded', [], retryAfterSec);
  }

  if (res.status === 429) {
    const isUploadLimit =
      kind === 'upload' ||
      errCode === 'upload_limit_hour' ||
      errCode === 'upload_limit_day' ||
      errCode === 'upload_limit_ip';
    return new OnlineApiError(
      429,
      isUploadLimit ? 'rate_limit_upload' : 'rate_limit_download',
      msg || 'Rate limit reached',
      [],
      retryAfterSec
    );
  }

  if (res.status === 503) {
    return new OnlineApiError(503, 'service_busy', msg || 'Service temporarily busy', [], retryAfterSec);
  }

  return null;
}

async function request<T>(path: string, init: RequestInit & { auth?: boolean; kind?: RequestKind } = {}): Promise<T> {
  const { auth, kind = 'browse', ...fetchInit } = init;
  const headers = new Headers(fetchInit.headers);
  if (auth) {
    const token = await getStoredToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }
  let res: Response;
  try {
    res = await fetch(`${getOnlineApiBase()}${path}`, { ...fetchInit, headers });
  } catch {
    throw new OnlineApiError(0, 'network', 'Network error');
  }
  const rawText = await res.text().catch(() => '');
  let data: Record<string, unknown> = {};
  if (rawText) {
    try {
      const parsed = JSON.parse(rawText);
      if (parsed && typeof parsed === 'object') data = parsed as Record<string, unknown>;
    } catch {
      // non-JSON (e.g. Cloudflare HTML/text error page)
    }
  }
  if (!res.ok) {
    if (res.status === 401 && auth) await setStoredToken(null);
    const limitErr = classifyLimitError(res, data, rawText, kind);
    if (limitErr) throw limitErr;
    throw new OnlineApiError(
      res.status,
      String(data.error ?? 'http_error'),
      String(data.message ?? `HTTP ${res.status}`),
      Array.isArray(data.details) ? (data.details as string[]) : [],
      parseRetryAfter(res, data)
    );
  }
  return data as T;
}

export async function loginWithDiscord(): Promise<OnlineUser> {
  if (!window.electronAPI?.discordLogin) throw new OnlineApiError(0, 'browser_only', 'Desktop app required');
  const result = await window.electronAPI.discordLogin(getOnlineApiBase());
  if (!result.ok || !result.token) throw new OnlineApiError(0, result.error ?? 'login_failed', result.error ?? 'Login failed');
  await setStoredToken(result.token);
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
    await setStoredToken(null);
  }
}

export function listOnlineCombos(q: OnlineListQuery): Promise<{ items: OnlineComboItem[]; page: number; hasMore: boolean }> {
  const params = new URLSearchParams();
  if (q.character) params.set('character', q.character);
  if (q.difficulty) params.set('difficulty', q.difficulty);
  if (q.mode) params.set('mode', q.mode);
  if (q.position) params.set('position', q.position);
  if (q.author) params.set('author', q.author);
  if (q.q) params.set('q', q.q);
  if (q.includePending) params.set('includePending', '1');
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
export async function uploadCombo(combo: ComboData, videoUrl?: string): Promise<{ id: string; status: 'pending' | 'approved' }> {
  const clean = sanitizeForUpload(combo);
  const check = validateCombo(clean);
  if (!check.ok) throw new OnlineApiError(422, 'invalid_format', 'Invalid format', check.errors);
  const payload = videoUrl?.trim() ? { ...clean, videoUrl: videoUrl.trim() } : clean;
  const body = JSON.stringify(payload);
  if (utf8Bytes(body) > COMBO_LIMITS.maxJsonBytes) throw new OnlineApiError(413, 'too_large', 'Combo too large');
  return request('/api/combos', {
    method: 'POST',
    auth: true,
    kind: 'upload',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
}

export async function updateComboVideoUrl(id: string, videoUrl: string): Promise<{ ok: boolean; videoUrl?: string }> {
  return request(`/api/combos/${encodeURIComponent(id)}/video`, {
    method: 'PATCH',
    auth: true,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ videoUrl: videoUrl.trim() }),
  });
}

/**
 * Downloads an approved combo's JSON from the Worker, re-validates it, and returns a
 * ComboData ready to be stored as a local custom combo (only optional fields are added).
 */
export async function downloadOnlineCombo(item: OnlineComboItem): Promise<ComboData> {
  let res: Response;
  try {
    res = await fetch(`${getOnlineApiBase()}/files/${encodeURIComponent(item.id)}.json`);
  } catch {
    throw new OnlineApiError(0, 'network', 'Network error');
  }
  const text = await res.text().catch(() => '');
  if (!res.ok) {
    let data: Record<string, unknown> = {};
    try {
      const p = JSON.parse(text);
      if (p && typeof p === 'object') data = p as Record<string, unknown>;
    } catch {
      // non-JSON
    }
    const limitErr = classifyLimitError(res, data, text, 'download');
    if (limitErr) throw limitErr;
    throw new OnlineApiError(res.status, 'not_found', 'Combo not found');
  }
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
    videoUrl: item.videoUrl,
  };
}
