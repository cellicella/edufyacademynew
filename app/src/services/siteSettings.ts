import { supabase } from '@/lib/supabase';
import { config } from '@/lib/config';
import { fetchWithTimeout } from '@/lib/fetchWithTimeout';
import { settingsCache } from '@/lib/secureStorage';
import { AppSiteSettings, mergeAppSettings } from '@/logic/siteSettings';

const CACHE_KEY = 'site_settings_v1';

/**
 * Public settings from the Edufy server (GET /api/settings/public). If the server can't be reached,
 * the public get_public_settings() database function is used. Never returns secrets.
 */
export async function fetchSiteSettings(signal?: AbortSignal): Promise<AppSiteSettings> {
  let raw: unknown = null;
  if (config.apiUrl) {
    try {
      const res = await fetchWithTimeout(`${config.apiUrl}/api/settings/public`, { headers: { accept: 'application/json' }, signal }, 10000);
      if (res.ok && (res.headers.get('content-type') || '').includes('json')) raw = (await res.json())?.settings;
    } catch {
      /* fall back to the database function */
    }
  }
  if (!raw) {
    let q = supabase.rpc('get_public_settings');
    if (signal) q = q.abortSignal(signal);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    raw = (data as any)?.settings;
  }
  settingsCache.setItem(CACHE_KEY, JSON.stringify(raw ?? {})).catch(() => undefined);
  return mergeAppSettings(raw);
}

/** Last settings stored on this phone (used instantly at start-up and when offline). */
export async function cachedSiteSettings(): Promise<AppSiteSettings | null> {
  try {
    const raw = await settingsCache.getItem(CACHE_KEY);
    return raw ? mergeAppSettings(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}
