import { config } from './config';
import { supabase } from './supabase';
import { fetchWithTimeout } from './fetchWithTimeout';
import { AppError, friendlyMessage, messageForStatus } from '@/logic/apiErrors';

export { AppError as ApiError } from '@/logic/apiErrors';

interface ApiOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  /** Attach the student's access token (default true). */
  auth?: boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
}

async function accessToken(forceRefresh = false): Promise<string | null> {
  if (forceRefresh) {
    const { data } = await supabase.auth.refreshSession();
    return data.session?.access_token || null;
  }
  // getSession() refreshes an expired access token automatically
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || null;
}

/**
 * Centralised client for the existing Edufy Express API.
 * - Timeout on every request; honours React Query's AbortSignal.
 * - Never retries by itself. The ONLY repeat is a single retry after a 401 once the token has been
 *   refreshed — the server rejected the first attempt, so nothing was processed (safe for POST).
 * - Friendly, status-specific messages; server details of 5xx errors are not shown.
 */
export async function api<T = any>(path: string, opts: ApiOptions = {}): Promise<T> {
  if (!config.apiUrl) throw new AppError(0, 'The app is missing EXPO_PUBLIC_API_URL.');
  const method = opts.method || (opts.body !== undefined ? 'POST' : 'GET');

  const send = async (token: string | null) => {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;
    try {
      return await fetchWithTimeout(
        `${config.apiUrl}/api${path}`,
        { method, headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined, signal: opts.signal },
        opts.timeoutMs || config.timeouts.api
      );
    } catch (e: any) {
      if (opts.signal?.aborted) throw e; // cancelled by the caller — propagate silently
      throw new AppError(e?.status === 408 ? 408 : 0, friendlyMessage(e));
    }
  };

  const useAuth = opts.auth !== false;
  let res = await send(useAuth ? await accessToken() : null);
  if (res.status === 401 && useAuth) {
    const fresh = await accessToken(true).catch(() => null);
    if (fresh) res = await send(fresh);
  }

  const text = await res.text();
  let data: any = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      // A proxy / HTML error page instead of the API (wrong EXPO_PUBLIC_API_URL or server down)
      throw new AppError(res.ok ? 502 : res.status, res.ok ? 'Unexpected response from the Edufy server. Check the API address.' : messageForStatus(res.status));
    }
  }
  if (!res.ok) throw new AppError(res.status, messageForStatus(res.status, data?.error));
  return data as T;
}

export const errorMessage = (e: unknown, fallback?: string) => friendlyMessage(e, fallback);
