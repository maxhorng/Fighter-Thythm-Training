/**
 * Online Combo Library configuration.
 *
 * Set VITE_FBT_API_BASE in `.env.local` (gitignored) or your build environment before running
 * `npm run build` / `npm run dist:win` (e.g. https://fbt-combos.<subdomain>.workers.dev).
 * Runtime override via localStorage (`fbt_online_api_base`) is ONLY permitted in Vite DEV mode.
 */
const ONLINE_API_BASE_DEFAULT = 'https://fbt-combos.REPLACE.workers.dev';

export const STORAGE_KEY_ONLINE_API_BASE = 'fbt_online_api_base';
export const STORAGE_KEY_ONLINE_TOKEN = 'fbt_online_token_v1';

interface ViteEnvLike {
  DEV?: boolean;
  VITE_FBT_API_BASE?: string;
}

export function getOnlineApiBase(): string {
  const env = (import.meta as unknown as { env?: ViteEnvLike }).env;
  if (env?.DEV) {
    try {
      const override = localStorage.getItem(STORAGE_KEY_ONLINE_API_BASE);
      if (override) return override.replace(/\/+$/, '');
    } catch {
      // ignore
    }
  }
  const envBase = typeof env?.VITE_FBT_API_BASE === 'string' ? env.VITE_FBT_API_BASE.trim() : '';
  return (envBase || ONLINE_API_BASE_DEFAULT).replace(/\/+$/, '');
}

export function isOnlineConfigured(): boolean {
  const base = getOnlineApiBase();
  return Boolean(base) && !base.includes('REPLACE');
}
