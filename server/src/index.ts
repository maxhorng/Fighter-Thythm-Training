/**
 * Frame Beat Trainer - Online Combo Library API (Cloudflare Worker)
 *
 * Storage (Cloudflare Free Tier, no R2 / no credit card required):
 *   - D1 (DB): users, sessions, combo index + validated JSON body, likes, rate-limit attempts, download dedupe
 *   - Edge Cache (`caches.default`): caches /api/combos list responses (60s) and approved /files/<id>.json downloads (300s)
 *
 * Auth: Discord OAuth2 (identify scope). The desktop app opens the system browser to /auth/discord/start
 * with a loopback port; after login the Worker redirects the browser to http://127.0.0.1:<port>/callback
 * with a session token. Only the SHA-256 of the token is stored.
 *
 * Upload limits (per authenticated attempt): 3 / hour / account, 10 / day / account, 20 / day / IP.
 */
import {
  COMBO_LIMITS,
  COMBO_SCHEMA_VERSION,
  SF6_CHARACTER_IDS,
  SF6_CHARACTER_NAMES,
  sanitizeForUpload,
  utf8Bytes,
  validateCombo,
} from '../../src/schema/comboSchema';

interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
  DB: D1Database;
  READ_LIMITER?: RateLimiter;
  WRITE_LIMITER?: RateLimiter;
  DISCORD_CLIENT_ID: string;
  DISCORD_CLIENT_SECRET: string;
  DISCORD_REDIRECT_URI: string;
  SESSION_SECRET: string;
  ADMIN_TOKEN: string;
  ADMIN_DISCORD_IDS?: string;
  AUTO_APPROVE?: string;
  MIN_ACCOUNT_AGE_DAYS?: string;
  DISCORD_WEBHOOK_URL?: string;
}

const UPLOAD_LIMITS = {
  perUserHour: 3,
  perUserDay: 10,
  perIpDay: 20,
};
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const SESSION_TTL_MS = 30 * DAY_MS;
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const OAUTH_CODE_TTL_MS = 60 * 1000;
const LIST_PAGE_SIZE = 20;
const LIST_CACHE_SECONDS = 60;
const FILE_CACHE_SECONDS = 300;
const DISCORD_EPOCH = 1420070400000n;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age': '86400',
};

class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public extra: Record<string, unknown> = {}
  ) {
    super(message);
  }
}

function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS, ...headers },
  });
}

function errorResponse(err: HttpError): Response {
  const headers: Record<string, string> = {};
  if (typeof err.extra.retryAfterSec === 'number') headers['Retry-After'] = String(err.extra.retryAfterSec);
  return json({ error: err.code, message: err.message, ...err.extra }, err.status, headers);
}

const enc = new TextEncoder();

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function b64url(bytes: Uint8Array): string {
  let s = '';
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s: string): string {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
}

async function sha256Hex(s: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data))));
}

function randomToken(bytes = 32): string {
  return b64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

function randomId(): string {
  return `oc-${randomToken(9)}`;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function ipHash(req: Request, env: Env): Promise<string> {
  const ip = req.headers.get('CF-Connecting-IP') ?? '0.0.0.0';
  return (await sha256Hex(`${env.SESSION_SECRET}|ip|${ip}`)).slice(0, 32);
}

async function rateLimit(limiter: RateLimiter | undefined, key: string) {
  if (!limiter) return;
  const { success } = await limiter.limit({ key });
  if (!success) throw new HttpError(429, 'rate_limited', 'Too many requests, slow down.', { retryAfterSec: 60 });
}

interface SessionUser {
  id: string;
  username: string;
  display_name: string;
  avatar: string | null;
  banned: number;
}

async function getUser(req: Request, env: Env): Promise<SessionUser | null> {
  const auth = req.headers.get('Authorization') ?? '';
  const m = /^Bearer ([A-Za-z0-9_-]{20,128})$/.exec(auth);
  if (!m) return null;
  const tokenHash = await sha256Hex(m[1]);
  const row = await env.DB.prepare(
    `SELECT u.id, u.username, u.display_name, u.avatar, u.banned
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > ?`
  )
    .bind(tokenHash, Date.now())
    .first<SessionUser>();
  return row ?? null;
}

async function requireUser(req: Request, env: Env): Promise<SessionUser> {
  const user = await getUser(req, env);
  if (!user) throw new HttpError(401, 'unauthorized', 'Please log in with Discord first.');
  if (user.banned) throw new HttpError(403, 'banned', 'This account has been suspended.');
  return user;
}

function requireAdmin(req: Request, env: Env) {
  const auth = req.headers.get('Authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!env.ADMIN_TOKEN || env.ADMIN_TOKEN.length < 16 || !timingSafeEqual(token, env.ADMIN_TOKEN)) {
    throw new HttpError(401, 'unauthorized', 'Admin token required.');
  }
}

function isValidComboId(id: string): boolean {
  return /^oc-[A-Za-z0-9_-]{8,24}$/.test(id);
}

// ---------------------------------------------------------------------------
// Discord OAuth
// ---------------------------------------------------------------------------

async function authStart(url: URL, env: Env): Promise<Response> {
  const port = Number(url.searchParams.get('port'));
  const appState = url.searchParams.get('state') ?? '';
  if (!Number.isInteger(port) || port < 1024 || port > 65535 || !/^[A-Za-z0-9_-]{16,64}$/.test(appState)) {
    throw new HttpError(400, 'bad_request', 'Invalid login request.');
  }
  const payload = b64url(enc.encode(JSON.stringify({ p: port, s: appState, e: Date.now() + OAUTH_STATE_TTL_MS })));
  const sig = await hmac(env.SESSION_SECRET, payload);
  const authorize = new URL('https://discord.com/oauth2/authorize');
  authorize.searchParams.set('client_id', env.DISCORD_CLIENT_ID);
  authorize.searchParams.set('response_type', 'code');
  authorize.searchParams.set('redirect_uri', env.DISCORD_REDIRECT_URI);
  authorize.searchParams.set('scope', 'identify');
  authorize.searchParams.set('state', `${payload}.${sig}`);
  return Response.redirect(authorize.toString(), 302);
}

async function authCallback(url: URL, env: Env): Promise<Response> {
  const rawState = url.searchParams.get('state') ?? '';
  const [payload, sig] = rawState.split('.');
  if (!payload || !sig || !timingSafeEqual(await hmac(env.SESSION_SECRET, payload), sig)) {
    throw new HttpError(400, 'bad_state', 'Invalid login state.');
  }
  const st = JSON.parse(b64urlDecode(payload)) as { p: number; s: string; e: number };
  if (Date.now() > st.e) throw new HttpError(400, 'expired', 'Login link expired, please try again.');

  const back = (params: Record<string, string>) => {
    const target = new URL(`http://127.0.0.1:${st.p}/callback`);
    target.searchParams.set('state', st.s);
    for (const [k, v] of Object.entries(params)) target.searchParams.set(k, v);
    return Response.redirect(target.toString(), 302);
  };

  const code = url.searchParams.get('code');
  if (!code) return back({ error: url.searchParams.get('error') ?? 'access_denied' });

  const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID,
      client_secret: env.DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: env.DISCORD_REDIRECT_URI,
    }),
  });
  if (!tokenRes.ok) return back({ error: 'token_exchange_failed' });
  const tok = (await tokenRes.json()) as { access_token: string };

  const meRes = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${tok.access_token}` },
  });
  if (!meRes.ok) return back({ error: 'profile_failed' });
  const me = (await meRes.json()) as { id: string; username: string; global_name?: string | null; avatar?: string | null };
  if (!/^\d{5,25}$/.test(me.id)) return back({ error: 'profile_failed' });

  const minAgeDays = Number(env.MIN_ACCOUNT_AGE_DAYS ?? '7') || 0;
  const createdMs = Number((BigInt(me.id) >> 22n) + DISCORD_EPOCH);
  if (Date.now() - createdMs < minAgeDays * DAY_MS) return back({ error: 'account_too_new' });

  const now = Date.now();
  const displayName = (me.global_name || me.username).slice(0, 40);
  await env.DB.prepare(
    `INSERT INTO users (id, username, display_name, avatar, banned, created_at, last_login_at)
     VALUES (?, ?, ?, ?, 0, ?, ?)
     ON CONFLICT(id) DO UPDATE SET username = excluded.username, display_name = excluded.display_name,
       avatar = excluded.avatar, last_login_at = excluded.last_login_at`
  )
    .bind(me.id, me.username.slice(0, 40), displayName, me.avatar ?? null, now, now)
    .run();

  const banned = await env.DB.prepare('SELECT banned FROM users WHERE id = ?').bind(me.id).first<{ banned: number }>();
  if (banned?.banned) return back({ error: 'banned' });

  const exchangeCode = randomToken(32);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM oauth_codes WHERE expires_at < ?').bind(now),
    env.DB.prepare('INSERT INTO oauth_codes (code_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').bind(
      await sha256Hex(exchangeCode),
      me.id,
      now,
      now + OAUTH_CODE_TTL_MS
    ),
  ]);
  return back({ code: exchangeCode });
}

async function authExchange(req: Request, env: Env): Promise<Response> {
  await rateLimit(env.WRITE_LIMITER, `exchange:${await ipHash(req, env)}`);
  let code = '';
  try {
    const body = (await req.json()) as { code?: unknown };
    if (typeof body.code === 'string') code = body.code;
  } catch {
    throw new HttpError(400, 'bad_request', 'Invalid JSON body.');
  }
  if (!/^[A-Za-z0-9_-]{20,128}$/.test(code)) {
    throw new HttpError(400, 'invalid_code', 'Invalid exchange code.');
  }

  const now = Date.now();
  const codeHash = await sha256Hex(code);
  const row = await env.DB.prepare(
    `SELECT c.expires_at, u.id, u.username, u.display_name, u.avatar, u.banned
       FROM oauth_codes c JOIN users u ON u.id = c.user_id
      WHERE c.code_hash = ?`
  )
    .bind(codeHash)
    .first<SessionUser & { expires_at: number }>();

  // Delete immediately (single-use) and verify we actually consumed it (prevents concurrent replay)
  const del = await env.DB.prepare('DELETE FROM oauth_codes WHERE code_hash = ?').bind(codeHash).run();
  if (!row || del.meta.changes === 0 || row.expires_at <= now) {
    throw new HttpError(400, 'invalid_code', 'Exchange code is invalid or expired.');
  }
  if (row.banned) {
    throw new HttpError(403, 'banned', 'This account has been suspended.');
  }

  const token = randomToken(32);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND expires_at < ?').bind(row.id, now),
    env.DB.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').bind(
      await sha256Hex(token),
      row.id,
      now,
      now + SESSION_TTL_MS
    ),
  ]);

  return json({
    token,
    user: {
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      avatar: row.avatar,
    },
  });
}

async function authLogout(req: Request, env: Env): Promise<Response> {
  const auth = req.headers.get('Authorization') ?? '';
  const m = /^Bearer ([A-Za-z0-9_-]{20,128})$/.exec(auth);
  if (m) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256Hex(m[1])).run();
  return json({ ok: true });
}

// ---------------------------------------------------------------------------
// Combos
// ---------------------------------------------------------------------------

interface ComboRow {
  id: string;
  character_id: string;
  mode: string;
  difficulty: string;
  position: string | null;
  title: string;
  title_en: string | null;
  tags_json: string;
  note_count: number;
  total_frames: number;
  likes: number;
  downloads: number;
  created_at: number;
  approved_at: number | null;
  status: string;
  reject_reason: string | null;
  author: string;
}

function toListItem(r: ComboRow) {
  return {
    id: r.id,
    characterId: r.character_id,
    characterName: SF6_CHARACTER_NAMES[r.character_id] ?? r.character_id,
    mode: r.mode,
    difficulty: r.difficulty,
    position: r.position ?? undefined,
    title: r.title,
    titleEn: r.title_en ?? undefined,
    tags: JSON.parse(r.tags_json) as string[],
    noteCount: r.note_count,
    totalFrames: r.total_frames,
    likes: r.likes,
    downloads: r.downloads,
    author: r.author,
    createdAt: r.created_at,
    approvedAt: r.approved_at ?? undefined,
    status: r.status,
    rejectReason: r.reject_reason ?? undefined,
  };
}

const LIST_COLUMNS = `c.id, c.character_id, c.mode, c.difficulty, c.position, c.title, c.title_en, c.tags_json,
  c.note_count, c.total_frames, c.likes, c.downloads, c.created_at, c.approved_at, c.status, c.reject_reason,
  u.display_name AS author`;

async function listCombos(req: Request, url: URL, env: Env, ctx: ExecutionContext): Promise<Response> {
  await rateLimit(env.READ_LIMITER, `read:${await ipHash(req, env)}`);

  // Normalize query so the edge cache key is canonical
  const character = url.searchParams.get('character') ?? '';
  const difficulty = url.searchParams.get('difficulty') ?? '';
  const mode = url.searchParams.get('mode') ?? '';
  const position = url.searchParams.get('position') ?? '';
  const sort = url.searchParams.get('sort') ?? 'likes';
  const q = (url.searchParams.get('q') ?? '').trim().slice(0, 40);
  const page = Math.max(0, Math.min(500, Number(url.searchParams.get('page') ?? '0') || 0));
  const includePending = url.searchParams.get('includePending') === '1';

  if (character && !SF6_CHARACTER_IDS.has(character)) throw new HttpError(400, 'bad_request', 'Unknown character.');
  if (difficulty && !['Beginner', 'Intermediate', 'Advanced', 'Ultra Hard'].includes(difficulty)) {
    throw new HttpError(400, 'bad_request', 'Unknown difficulty.');
  }
  if (mode && !['classic', 'modern'].includes(mode)) throw new HttpError(400, 'bad_request', 'Unknown mode.');
  if (position && !['midscreen', 'corner'].includes(position)) throw new HttpError(400, 'bad_request', 'Unknown position.');
  if (!['likes', 'downloads', 'new'].includes(sort)) throw new HttpError(400, 'bad_request', 'Unknown sort.');

  const canonical = new URL(url.origin + '/api/combos');
  Object.entries({
    character,
    difficulty,
    mode,
    position,
    sort,
    q,
    page: String(page),
    includePending: includePending ? '1' : '',
  }).forEach(([k, v]) => {
    if (v) canonical.searchParams.set(k, v);
  });
  const cacheKey = new Request(canonical.toString(), { method: 'GET' });
  const cache = caches.default;
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const where: string[] = [includePending ? `c.status IN ('approved', 'pending')` : `c.status = 'approved'`];
  const binds: unknown[] = [];
  if (character) (where.push('c.character_id = ?'), binds.push(character));
  if (difficulty) (where.push('c.difficulty = ?'), binds.push(difficulty));
  if (mode) (where.push('c.mode = ?'), binds.push(mode));
  if (position) (where.push('c.position = ?'), binds.push(position));
  if (q) {
    where.push(`(c.title LIKE ? ESCAPE '\\' OR c.title_en LIKE ? ESCAPE '\\' OR c.tags_json LIKE ? ESCAPE '\\')`);
    const like = `%${q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
    binds.push(like, like, like);
  }
  const orderBy =
    sort === 'downloads'
      ? 'c.downloads DESC, c.likes DESC, COALESCE(c.approved_at, c.created_at) DESC'
      : sort === 'new'
      ? 'COALESCE(c.approved_at, c.created_at) DESC'
      : 'c.likes DESC, c.downloads DESC, COALESCE(c.approved_at, c.created_at) DESC';

  const { results } = await env.DB.prepare(
    `SELECT ${LIST_COLUMNS} FROM combos c JOIN users u ON u.id = c.user_id
      WHERE ${where.join(' AND ')} ORDER BY ${orderBy} LIMIT ? OFFSET ?`
  )
    .bind(...binds, LIST_PAGE_SIZE + 1, page * LIST_PAGE_SIZE)
    .all<ComboRow>();

  const items = results.slice(0, LIST_PAGE_SIZE).map(toListItem);
  const res = json(
    { items, page, hasMore: results.length > LIST_PAGE_SIZE, schemaVersion: COMBO_SCHEMA_VERSION },
    200,
    { 'Cache-Control': `public, max-age=${LIST_CACHE_SECONDS}` }
  );
  ctx.waitUntil(cache.put(cacheKey, res.clone()));
  return res;
}

async function serveFile(id: string, req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  if (!isValidComboId(id)) throw new HttpError(404, 'not_found', 'Combo not found.');
  const cache = caches.default;
  const cacheKey = new Request(new URL(req.url).toString(), { method: 'GET' });
  const cached = await cache.match(cacheKey);
  if (cached) return cached;
  const row = await env.DB.prepare(`SELECT body FROM combos WHERE id = ? AND status IN ('approved', 'pending')`)
    .bind(id)
    .first<{ body: string }>();
  if (!row) throw new HttpError(404, 'not_found', 'Combo not found.');
  const res = new Response(row.body, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': `public, max-age=${FILE_CACHE_SECONDS}`,
      ...CORS_HEADERS,
    },
  });
  ctx.waitUntil(cache.put(cacheKey, res.clone()));
  return res;
}

async function evictFileCache(id: string, origin: string) {
  await caches.default.delete(new Request(`${origin}/files/${id}.json`));
}

async function checkUploadLimits(env: Env, userId: string, ip: string) {
  const now = Date.now();
  const row = await env.DB.prepare(
    `SELECT
       (SELECT COUNT(*) FROM upload_attempts WHERE user_id = ?1 AND created_at > ?2) AS user_hour,
       (SELECT MIN(created_at) FROM upload_attempts WHERE user_id = ?1 AND created_at > ?2) AS user_hour_oldest,
       (SELECT COUNT(*) FROM upload_attempts WHERE user_id = ?1 AND created_at > ?3) AS user_day,
       (SELECT MIN(created_at) FROM upload_attempts WHERE user_id = ?1 AND created_at > ?3) AS user_day_oldest,
       (SELECT COUNT(*) FROM upload_attempts WHERE ip_hash = ?4 AND created_at > ?3) AS ip_day,
       (SELECT MIN(created_at) FROM upload_attempts WHERE ip_hash = ?4 AND created_at > ?3) AS ip_day_oldest`
  )
    .bind(userId, now - HOUR_MS, now - DAY_MS, ip)
    .first<{
      user_hour: number;
      user_hour_oldest: number | null;
      user_day: number;
      user_day_oldest: number | null;
      ip_day: number;
      ip_day_oldest: number | null;
    }>();
  if (!row) return;
  const retry = (oldest: number | null, windowMs: number) =>
    Math.max(1, Math.ceil(((oldest ?? now) + windowMs - now) / 1000));
  if (row.user_hour >= UPLOAD_LIMITS.perUserHour) {
    throw new HttpError(429, 'upload_limit_hour', `Upload limit reached (${UPLOAD_LIMITS.perUserHour} per hour).`, {
      retryAfterSec: retry(row.user_hour_oldest, HOUR_MS),
    });
  }
  if (row.user_day >= UPLOAD_LIMITS.perUserDay) {
    throw new HttpError(429, 'upload_limit_day', `Upload limit reached (${UPLOAD_LIMITS.perUserDay} per day).`, {
      retryAfterSec: retry(row.user_day_oldest, DAY_MS),
    });
  }
  if (row.ip_day >= UPLOAD_LIMITS.perIpDay) {
    throw new HttpError(429, 'upload_limit_ip', `Upload limit reached for this network (${UPLOAD_LIMITS.perIpDay} per day).`, {
      retryAfterSec: retry(row.ip_day_oldest, DAY_MS),
    });
  }
}

function isAdminDiscordUser(userId: string, env: Env): boolean {
  if (!env.ADMIN_DISCORD_IDS) return false;
  return env.ADMIN_DISCORD_IDS.split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(userId);
}

async function uploadCombo(req: Request, url: URL, env: Env, ctx: ExecutionContext): Promise<Response> {
  const user = await requireUser(req, env);
  const ip = await ipHash(req, env);
  const isAdminUser = isAdminDiscordUser(user.id, env);
  if (!isAdminUser) {
    await rateLimit(env.WRITE_LIMITER, `write:${ip}`);
    await checkUploadLimits(env, user.id, ip);

    // Every authenticated attempt counts (even invalid ones) so the limit cannot be probed for free
    await env.DB.prepare('INSERT INTO upload_attempts (user_id, ip_hash, created_at) VALUES (?, ?, ?)')
      .bind(user.id, ip, Date.now())
      .run();
  }

  const declared = Number(req.headers.get('Content-Length') ?? '0');
  if (declared > COMBO_LIMITS.maxJsonBytes) {
    throw new HttpError(413, 'too_large', `Combo JSON must be under ${COMBO_LIMITS.maxJsonBytes} bytes.`);
  }
  const text = await req.text();
  if (utf8Bytes(text) > COMBO_LIMITS.maxJsonBytes) {
    throw new HttpError(413, 'too_large', `Combo JSON must be under ${COMBO_LIMITS.maxJsonBytes} bytes.`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new HttpError(400, 'invalid_json', 'Body is not valid JSON.');
  }
  const result = validateCombo(parsed);
  if (!result.ok || !result.combo) {
    throw new HttpError(422, 'invalid_format', 'Combo does not match the required format.', { details: result.errors });
  }

  const combo = sanitizeForUpload(result.combo);
  const id = randomId();
  combo.id = id;
  combo.characterName = SF6_CHARACTER_NAMES[combo.characterId] ?? combo.characterName;
  const body = JSON.stringify(combo);
  const contentHash = await sha256Hex(
    JSON.stringify({ c: combo.characterId, m: combo.mode, n: combo.notes.map((n) => [n.frame, n.buttons, n.motion ?? '', n.holdFrames ?? 0]) })
  );

  const dup = await env.DB.prepare('SELECT id FROM combos WHERE content_hash = ?').bind(contentHash).first<{ id: string }>();
  if (dup) throw new HttpError(409, 'duplicate', 'An identical combo has already been uploaded.', { existingId: dup.id });

  const autoApprove = env.AUTO_APPROVE === 'true' || isAdminUser;
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO combos (id, user_id, character_id, mode, difficulty, position, title, title_en, tags_json,
       note_count, total_frames, body, content_hash, status, created_at, approved_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      user.id,
      combo.characterId,
      combo.mode,
      combo.difficulty,
      combo.position ?? null,
      combo.title,
      combo.titleEn ?? null,
      JSON.stringify(combo.tags),
      combo.notes.length,
      Math.round(combo.notes[combo.notes.length - 1].frame),
      body,
      contentHash,
      autoApprove ? 'approved' : 'pending',
      now,
      autoApprove ? now : null
    )
    .run();

  if (env.DISCORD_WEBHOOK_URL) {
    ctx.waitUntil(
      fetch(env.DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `[FBT] New ${autoApprove ? 'published' : 'pending'} combo ${id} by ${user.display_name}: ${combo.characterName} / ${combo.mode} / ${combo.difficulty} - ${combo.title}`,
          allowed_mentions: { parse: [] },
        }),
      }).catch(() => undefined)
    );
  }

  return json({ id, status: autoApprove ? 'approved' : 'pending' }, 201);
}

async function deleteOwnCombo(id: string, req: Request, url: URL, env: Env): Promise<Response> {
  const user = await requireUser(req, env);
  if (!isValidComboId(id)) throw new HttpError(404, 'not_found', 'Combo not found.');
  const row = await env.DB.prepare('SELECT user_id FROM combos WHERE id = ?').bind(id).first<{ user_id: string }>();
  if (!row || row.user_id !== user.id) throw new HttpError(404, 'not_found', 'Combo not found.');
  await env.DB.prepare('DELETE FROM combos WHERE id = ?').bind(id).run();
  await evictFileCache(id, url.origin);
  return json({ ok: true });
}

async function toggleLike(id: string, req: Request, env: Env): Promise<Response> {
  const user = await requireUser(req, env);
  await rateLimit(env.WRITE_LIMITER, `like:${user.id}`);
  if (!isValidComboId(id)) throw new HttpError(404, 'not_found', 'Combo not found.');
  const combo = await env.DB.prepare(`SELECT id FROM combos WHERE id = ? AND status IN ('approved', 'pending')`).bind(id).first();
  if (!combo) throw new HttpError(404, 'not_found', 'Combo not found.');

  const ins = await env.DB.prepare('INSERT OR IGNORE INTO likes (user_id, combo_id, created_at) VALUES (?, ?, ?)')
    .bind(user.id, id, Date.now())
    .run();
  let liked: boolean;
  if (ins.meta.changes > 0) {
    liked = true;
    await env.DB.prepare('UPDATE combos SET likes = likes + 1 WHERE id = ?').bind(id).run();
  } else {
    liked = false;
    await env.DB.batch([
      env.DB.prepare('DELETE FROM likes WHERE user_id = ? AND combo_id = ?').bind(user.id, id),
      env.DB.prepare('UPDATE combos SET likes = MAX(0, likes - 1) WHERE id = ?').bind(id),
    ]);
  }
  const row = await env.DB.prepare('SELECT likes FROM combos WHERE id = ?').bind(id).first<{ likes: number }>();
  return json({ liked, likes: row?.likes ?? 0 });
}

async function countDownload(id: string, req: Request, env: Env): Promise<Response> {
  const ip = await ipHash(req, env);
  await rateLimit(env.WRITE_LIMITER, `dl:${ip}`);
  if (!isValidComboId(id)) throw new HttpError(404, 'not_found', 'Combo not found.');
  const day = new Date().toISOString().slice(0, 10);
  const ins = await env.DB.prepare(
    `INSERT OR IGNORE INTO download_events (combo_id, ip_hash, day)
     SELECT id, ?, ? FROM combos WHERE id = ? AND status IN ('approved', 'pending')`
  )
    .bind(ip, day, id)
    .run();
  if (ins.meta.changes > 0) {
    await env.DB.prepare('UPDATE combos SET downloads = downloads + 1 WHERE id = ?').bind(id).run();
  }
  return json({ ok: true, counted: ins.meta.changes > 0 });
}

async function myLikes(req: Request, env: Env): Promise<Response> {
  const user = await requireUser(req, env);
  const { results } = await env.DB.prepare('SELECT combo_id FROM likes WHERE user_id = ? ORDER BY created_at DESC LIMIT 2000')
    .bind(user.id)
    .all<{ combo_id: string }>();
  return json({ ids: results.map((r) => r.combo_id) });
}

async function myCombos(req: Request, env: Env): Promise<Response> {
  const user = await requireUser(req, env);
  const { results } = await env.DB.prepare(
    `SELECT ${LIST_COLUMNS} FROM combos c JOIN users u ON u.id = c.user_id
      WHERE c.user_id = ? ORDER BY c.created_at DESC LIMIT 200`
  )
    .bind(user.id)
    .all<ComboRow>();
  return json({ items: results.map(toListItem) });
}

// ---------------------------------------------------------------------------
// Admin (Authorization: Bearer <ADMIN_TOKEN>)
// ---------------------------------------------------------------------------

async function adminPending(req: Request, env: Env): Promise<Response> {
  requireAdmin(req, env);
  const { results } = await env.DB.prepare(
    `SELECT ${LIST_COLUMNS}, c.user_id, c.body FROM combos c JOIN users u ON u.id = c.user_id
      WHERE c.status = 'pending' ORDER BY c.created_at ASC LIMIT 100`
  ).all<ComboRow & { user_id: string; body: string }>();
  return json({
    items: results.map((r) => ({ ...toListItem(r), userId: r.user_id, body: JSON.parse(r.body) })),
  });
}

async function adminApprove(id: string, req: Request, env: Env): Promise<Response> {
  requireAdmin(req, env);
  const res = await env.DB.prepare(`UPDATE combos SET status = 'approved', approved_at = ?, reject_reason = NULL WHERE id = ?`)
    .bind(Date.now(), id)
    .run();
  if (res.meta.changes === 0) throw new HttpError(404, 'not_found', 'Combo not found.');
  return json({ ok: true, id, status: 'approved' });
}

async function adminReject(id: string, req: Request, url: URL, env: Env): Promise<Response> {
  requireAdmin(req, env);
  let reason = '';
  try {
    reason = String(((await req.json()) as { reason?: string }).reason ?? '').slice(0, 200);
  } catch {
    // no body
  }
  const res = await env.DB.prepare(`UPDATE combos SET status = 'rejected', reject_reason = ?, approved_at = NULL WHERE id = ?`)
    .bind(reason || null, id)
    .run();
  if (res.meta.changes === 0) throw new HttpError(404, 'not_found', 'Combo not found.');
  await evictFileCache(id, url.origin);
  return json({ ok: true, id, status: 'rejected' });
}

async function adminDelete(id: string, req: Request, url: URL, env: Env): Promise<Response> {
  requireAdmin(req, env);
  await env.DB.prepare('DELETE FROM combos WHERE id = ?').bind(id).run();
  await evictFileCache(id, url.origin);
  return json({ ok: true });
}

async function adminBan(userId: string, req: Request, env: Env, banned: boolean): Promise<Response> {
  requireAdmin(req, env);
  await env.DB.batch([
    env.DB.prepare('UPDATE users SET banned = ? WHERE id = ?').bind(banned ? 1 : 0, userId),
    ...(banned ? [env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId)] : []),
  ]);
  return json({ ok: true, userId, banned });
}

function serveAdminPage(): Response {
  const html = `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>FBT Admin Moderation</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; background: #090d16; color: #e2e8f0; min-height: 100vh; }
  .wrap { max-width: 980px; margin: 0 auto; padding: 24px 16px 48px; }
  header { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; padding-bottom: 16px; border-bottom: 1px solid rgba(148,163,184,0.2); margin-bottom: 20px; }
  h1 { margin: 0; font-size: 20px; color: #f8fafc; letter-spacing: 0.02em; }
  .sub { font-size: 12.5px; color: #94a3b8; margin-top: 3px; }
  .row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  input[type=password], input[type=text] { background: #0f172a; color: #f8fafc; border: 1px solid rgba(148,163,184,0.35); border-radius: 8px; padding: 8px 12px; font-size: 13.5px; outline: none; }
  input:focus { border-color: #38bdf8; }
  button { cursor: pointer; border-radius: 8px; border: 1px solid rgba(148,163,184,0.35); background: rgba(30,41,59,0.85); color: #e2e8f0; padding: 7px 13px; font-size: 13px; font-weight: 700; transition: opacity .12s; }
  button:hover:not(:disabled) { filter: brightness(1.15); }
  button:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-primary { background: rgba(56,189,248,0.22); border-color: #38bdf8; color: #e0f2fe; }
  .btn-approve { background: rgba(34,197,94,0.2); border-color: rgba(74,222,128,0.65); color: #86efac; }
  .btn-reject { background: rgba(245,158,11,0.2); border-color: rgba(251,191,36,0.65); color: #fde047; }
  .btn-ban { background: rgba(244,63,94,0.2); border-color: rgba(251,113,133,0.65); color: #fda4af; }
  .card { background: rgba(15,23,42,0.85); border: 1px solid rgba(148,163,184,0.22); border-radius: 12px; padding: 14px 16px; margin-bottom: 12px; }
  .login-box { max-width: 440px; margin: 64px auto; }
  .pill { display: inline-block; font-size: 11px; font-weight: 800; padding: 2px 8px; border-radius: 999px; background: rgba(56,189,248,0.16); color: #bae6fd; border: 1px solid rgba(56,189,248,0.4); }
  .pill-mode { background: rgba(168,85,247,0.2); color: #e9d5ff; border-color: rgba(192,132,252,0.5); }
  .pill-pos { background: rgba(45,212,191,0.16); color: #5eead4; border-color: rgba(45,212,191,0.45); }
  .pill-diff { background: rgba(250,204,21,0.16); color: #fde047; border-color: rgba(250,204,21,0.45); }
  .pill-tag { background: rgba(148,163,184,0.14); color: #cbd5e1; border-color: rgba(148,163,184,0.3); font-weight: 600; }
  .title { font-size: 15.5px; font-weight: 800; color: #f8fafc; margin: 8px 0 6px; }
  .meta { font-size: 12px; color: #94a3b8; display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 10px; }
  .moves { margin-top: 10px; padding: 10px 12px; border-radius: 8px; background: rgba(2,6,23,0.75); border: 1px solid rgba(148,163,184,0.18); display: none; }
  .moves.open { display: block; }
  .move-chip { display: inline-flex; align-items: baseline; gap: 4px; padding: 3px 7px; margin: 3px 4px 3px 0; border-radius: 6px; background: rgba(30,41,59,0.9); border: 1px solid rgba(148,163,184,0.25); font-size: 12px; }
  .move-chip small { color: #94a3b8; font-size: 10.5px; }
  .desc { font-size: 12.5px; color: #cbd5e1; margin-bottom: 8px; white-space: pre-wrap; }
  .banner { padding: 10px 14px; border-radius: 8px; font-size: 13px; margin-bottom: 14px; display: none; }
  .banner.err { display: block; background: rgba(244,63,94,0.18); border: 1px solid rgba(251,113,133,0.55); color: #fecdd3; }
  .banner.ok { display: block; background: rgba(34,197,94,0.16); border: 1px solid rgba(74,222,128,0.55); color: #bbf7d0; }
  .empty { text-align: center; padding: 40px 16px; color: #94a3b8; border: 1px dashed rgba(148,163,184,0.25); border-radius: 12px; }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div>
      <h1>Frame Beat Trainer - Admin Moderation</h1>
      <div class="sub" id="statusLine">待審核連段管理後台</div>
    </div>
    <div class="row" id="headerActions" style="display:none">
      <button type="button" class="btn-primary" id="refreshBtn">重新整理 / Refresh</button>
      <button type="button" id="logoutBtn">登出 / Logout</button>
    </div>
  </header>

  <div id="banner" class="banner" role="alert"></div>

  <section id="loginView" class="card login-box">
    <div class="title" style="margin-top:0">管理員驗證 / Admin Login</div>
    <div class="sub" style="margin-bottom:12px">Token 僅儲存在此分頁的 sessionStorage，關閉分頁即自動清除。</div>
    <form id="loginForm" class="row">
      <input type="password" id="tokenInput" placeholder="輸入 ADMIN_TOKEN" autocomplete="off" style="flex:1;min-width:200px" required />
      <button type="submit" class="btn-primary">登入</button>
    </form>
  </section>

  <main id="appView" style="display:none">
    <div id="listRoot"></div>
  </main>
</div>

<script>
(function() {
  const STORAGE_KEY = 'fbt_admin_token';
  const loginView = document.getElementById('loginView');
  const appView = document.getElementById('appView');
  const headerActions = document.getElementById('headerActions');
  const statusLine = document.getElementById('statusLine');
  const banner = document.getElementById('banner');
  const listRoot = document.getElementById('listRoot');
  const tokenInput = document.getElementById('tokenInput');

  function getToken() { return sessionStorage.getItem(STORAGE_KEY) || ''; }
  function setToken(t) { if (t) sessionStorage.setItem(STORAGE_KEY, t); else sessionStorage.removeItem(STORAGE_KEY); }
  function showBanner(kind, text) {
    banner.className = 'banner ' + kind;
    banner.textContent = text;
  }
  function clearBanner() {
    banner.className = 'banner';
    banner.textContent = '';
  }
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  async function api(path, opts) {
    const res = await fetch(path, {
      ...opts,
      headers: {
        'Authorization': 'Bearer ' + getToken(),
        ...(opts && opts.headers ? opts.headers : {}),
      },
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      setToken('');
      showLogin('驗證失敗或 Token 無效，請重新輸入 ADMIN_TOKEN。');
      throw new Error('unauthorized');
    }
    if (!res.ok) throw new Error(data.message || ('HTTP ' + res.status));
    return data;
  }

  function showLogin(errMsg) {
    loginView.style.display = 'block';
    appView.style.display = 'none';
    headerActions.style.display = 'none';
    statusLine.textContent = '待審核連段管理後台';
    if (errMsg) showBanner('err', errMsg);
  }

  function renderPending(items) {
    listRoot.replaceChildren();
    statusLine.textContent = '目前待審核：' + items.length + ' 筆';
    if (!items.length) {
      listRoot.appendChild(el('div', 'empty', '目前沒有待審核的連段。'));
      return;
    }

    for (const item of items) {
      const card = el('article', 'card');

      const pills = el('div', 'row');
      pills.appendChild(el('span', 'pill', item.characterName || item.characterId));
      pills.appendChild(el('span', 'pill pill-mode', item.mode === 'modern' ? 'Modern' : 'Classic'));
      pills.appendChild(el('span', 'pill pill-diff', item.difficulty));
      if (item.position) {
        pills.appendChild(el('span', 'pill pill-pos', item.position === 'corner' ? 'Corner / 角落' : 'Midscreen / 非角落'));
      }
      if (Array.isArray(item.tags)) {
        for (const tg of item.tags) pills.appendChild(el('span', 'pill pill-tag', '#' + tg));
      }
      card.appendChild(pills);

      card.appendChild(el('div', 'title', item.title + (item.titleEn ? ' / ' + item.titleEn : '')));

      const meta = el('div', 'meta');
      meta.appendChild(el('span', '', '作者: ' + item.author + (item.userId ? ' (ID: ' + item.userId + ')' : '')));
      meta.appendChild(el('span', '', 'ID: ' + item.id));
      meta.appendChild(el('span', '', item.noteCount + ' 擊 · ' + item.totalFrames + 'f'));
      if (item.createdAt) {
        meta.appendChild(el('span', '', new Date(item.createdAt).toLocaleString()));
      }
      card.appendChild(meta);

      const movesBox = el('div', 'moves');
      if (item.body && item.body.description) {
        movesBox.appendChild(el('div', 'desc', item.body.description));
      }
      const notes = (item.body && Array.isArray(item.body.notes)) ? item.body.notes : [];
      for (const n of notes) {
        const chip = el('span', 'move-chip');
        chip.appendChild(el('strong', '', n.notation || ''));
        chip.appendChild(el('small', '', String(n.frame) + 'f'));
        if (n.moveName) chip.appendChild(el('small', '', '(' + n.moveName + ')'));
        movesBox.appendChild(chip);
      }

      const actions = el('div', 'row');
      const inspectBtn = el('button', '', '檢視指令 (' + notes.length + ')');
      inspectBtn.type = 'button';
      inspectBtn.addEventListener('click', () => {
        movesBox.classList.toggle('open');
      });

      const approveBtn = el('button', 'btn-approve', '通過 (Approve)');
      approveBtn.type = 'button';
      approveBtn.addEventListener('click', async () => {
        approveBtn.disabled = true;
        try {
          await api('/api/admin/combos/' + encodeURIComponent(item.id) + '/approve', { method: 'POST' });
          card.remove();
          showBanner('ok', '已通過並公開：' + item.title);
          loadPending();
        } catch (e) {
          approveBtn.disabled = false;
          if (e.message !== 'unauthorized') showBanner('err', '操作失敗：' + e.message);
        }
      });

      const rejectBtn = el('button', 'btn-reject', '退回 (Reject)');
      rejectBtn.type = 'button';
      rejectBtn.addEventListener('click', async () => {
        const reason = window.prompt('退回原因（選填，留空亦可）：', '');
        if (reason === null) return;
        rejectBtn.disabled = true;
        try {
          await api('/api/admin/combos/' + encodeURIComponent(item.id) + '/reject', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason }),
          });
          card.remove();
          showBanner('ok', '已退回：' + item.title);
          loadPending();
        } catch (e) {
          rejectBtn.disabled = false;
          if (e.message !== 'unauthorized') showBanner('err', '操作失敗：' + e.message);
        }
      });

      actions.appendChild(inspectBtn);
      actions.appendChild(approveBtn);
      actions.appendChild(rejectBtn);

      if (item.userId) {
        const banBtn = el('button', 'btn-ban', '封鎖作者 (Ban User)');
        banBtn.type = 'button';
        banBtn.addEventListener('click', async () => {
          if (!window.confirm('確定要封鎖作者 ' + item.author + ' (Discord ID: ' + item.userId + ')？')) return;
          banBtn.disabled = true;
          try {
            await api('/api/admin/users/' + encodeURIComponent(item.userId) + '/ban', { method: 'POST' });
            showBanner('ok', '已封鎖使用者：' + item.author + ' (' + item.userId + ')');
          } catch (e) {
            banBtn.disabled = false;
            if (e.message !== 'unauthorized') showBanner('err', '封鎖失敗：' + e.message);
          }
        });
        actions.appendChild(banBtn);
      }

      card.appendChild(actions);
      card.appendChild(movesBox);
      listRoot.appendChild(card);
    }
  }

  async function loadPending() {
    try {
      const data = await api('/api/admin/pending');
      loginView.style.display = 'none';
      appView.style.display = 'block';
      headerActions.style.display = 'flex';
      renderPending(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      if (e.message !== 'unauthorized') showBanner('err', '載入失敗：' + e.message);
    }
  }

  document.getElementById('loginForm').addEventListener('submit', (ev) => {
    ev.preventDefault();
    clearBanner();
    const val = tokenInput.value.trim();
    if (!val) return;
    setToken(val);
    tokenInput.value = '';
    loadPending();
  });

  document.getElementById('refreshBtn').addEventListener('click', () => {
    clearBanner();
    loadPending();
  });

  document.getElementById('logoutBtn').addEventListener('click', () => {
    setToken('');
    clearBanner();
    showLogin();
  });

  if (getToken()) loadPending();
})();
</script>
</body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    },
  });
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

async function route(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const method = req.method.toUpperCase();

  if (method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });

  if (method === 'GET' && path === '/health') return json({ ok: true, schemaVersion: COMBO_SCHEMA_VERSION });
  if (method === 'GET' && path === '/admin') return serveAdminPage();
  if (method === 'GET' && path === '/auth/discord/start') return authStart(url, env);
  if (method === 'GET' && path === '/auth/discord/callback') return authCallback(url, env);
  if (method === 'POST' && path === '/auth/exchange') return authExchange(req, env);
  if (method === 'POST' && path === '/auth/logout') return authLogout(req, env);

  if (method === 'GET' && path === '/api/me') {
    const user = await requireUser(req, env);
    return json({ id: user.id, username: user.username, displayName: user.display_name, avatar: user.avatar, limits: UPLOAD_LIMITS });
  }
  if (method === 'GET' && path === '/api/me/likes') return myLikes(req, env);
  if (method === 'GET' && path === '/api/me/combos') return myCombos(req, env);

  if (path === '/api/combos') {
    if (method === 'GET') return listCombos(req, url, env, ctx);
    if (method === 'POST') return uploadCombo(req, url, env, ctx);
  }

  let m: RegExpExecArray | null;
  if (method === 'GET' && (m = /^\/files\/([A-Za-z0-9_-]+)\.json$/.exec(path))) return serveFile(m[1], req, env, ctx);
  if ((m = /^\/api\/combos\/([A-Za-z0-9_-]+)$/.exec(path)) && method === 'DELETE') return deleteOwnCombo(m[1], req, url, env);
  if ((m = /^\/api\/combos\/([A-Za-z0-9_-]+)\/like$/.exec(path)) && method === 'POST') return toggleLike(m[1], req, env);
  if ((m = /^\/api\/combos\/([A-Za-z0-9_-]+)\/download$/.exec(path)) && method === 'POST') return countDownload(m[1], req, env);

  if (method === 'GET' && path === '/api/admin/pending') return adminPending(req, env);
  if ((m = /^\/api\/admin\/combos\/([A-Za-z0-9_-]+)\/approve$/.exec(path)) && method === 'POST') return adminApprove(m[1], req, env);
  if ((m = /^\/api\/admin\/combos\/([A-Za-z0-9_-]+)\/reject$/.exec(path)) && method === 'POST') return adminReject(m[1], req, url, env);
  if ((m = /^\/api\/admin\/combos\/([A-Za-z0-9_-]+)$/.exec(path)) && method === 'DELETE') return adminDelete(m[1], req, url, env);
  if ((m = /^\/api\/admin\/users\/(\d+)\/(ban|unban)$/.exec(path)) && method === 'POST') return adminBan(m[1], req, env, m[2] === 'ban');

  throw new HttpError(404, 'not_found', 'Route not found.');
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      return await route(req, env, ctx);
    } catch (err) {
      if (err instanceof HttpError) return errorResponse(err);
      console.error(err);
      return json({ error: 'internal', message: 'Internal server error.' }, 500);
    }
  },
};
