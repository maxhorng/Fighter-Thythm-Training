/**
 * Online Combo Library configuration.
 *
 * Set ONLINE_API_BASE_DEFAULT to your deployed Worker URL after `wrangler deploy`
 * (e.g. https://fbt-combos.<subdomain>.workers.dev). It can be overridden at build time with
 * VITE_FBT_API_BASE, or at runtime (for local testing) via localStorage key `fbt_online_api_base`.
 */
const ONLINE_API_BASE_DEFAULT = 'https://fbt-combos.REPLACE.workers.dev';

export const STORAGE_KEY_ONLINE_API_BASE = 'fbt_online_api_base';
export const STORAGE_KEY_ONLINE_TOKEN = 'fbt_online_token_v1';

export function getOnlineApiBase(): string {
  try {
    const override = localStorage.getItem(STORAGE_KEY_ONLINE_API_BASE);
    if (override) return override.replace(/\/+$/, '');
  } catch {
    // ignore
  }
  const envBase = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_FBT_API_BASE;
  return (envBase || ONLINE_API_BASE_DEFAULT).replace(/\/+$/, '');
}

export function isOnlineConfigured(): boolean {
  return !getOnlineApiBase().includes('REPLACE');
}
