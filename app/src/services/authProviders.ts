import { useEffect, useState } from 'react';
import { config } from '@/lib/config';
import { fetchWithTimeout } from '@/lib/fetchWithTimeout';
import { AuthProviders, parseAuthProviders } from '@/logic/authProviders';

let cache: { at: number; value: AuthProviders } | null = null;

/** Public Supabase Auth settings (which providers are switched on). Cached for 5 minutes. */
export async function fetchAuthProviders(): Promise<AuthProviders> {
  if (cache && Date.now() - cache.at < 5 * 60_000) return cache.value;
  if (!config.supabaseUrl || !config.supabaseKey) return { google: null, email: null };
  try {
    const res = await fetchWithTimeout(`${config.supabaseUrl}/auth/v1/settings`, { headers: { apikey: config.supabaseKey } }, 8000);
    if (!res.ok) return { google: null, email: null };
    const value = parseAuthProviders(await res.json());
    cache = { at: Date.now(), value };
    return value;
  } catch {
    return { google: null, email: null };
  }
}

export function useAuthProviders(): AuthProviders {
  const [p, setP] = useState<AuthProviders>(cache?.value || { google: null, email: null });
  useEffect(() => {
    let alive = true;
    fetchAuthProviders().then((v) => alive && setP(v));
    return () => {
      alive = false;
    };
  }, []);
  return p;
}
