/**
 * Optional Supabase Management API access (project-level Auth settings that are NOT stored in the database:
 * Site URL, redirect allow-list, Google provider, Send Email hook).
 *
 * Needs SUPABASE_MANAGEMENT_TOKEN (a personal access token from supabase.com/dashboard/account/tokens) in the
 * server environment. Without it, the admin panel shows the exact values to set manually in the dashboard.
 * Secret fields returned by the API are never passed on.
 */

export const projectRefFromUrl = (supabaseUrl: string): string | null => supabaseUrl.match(/^https:\/\/([a-z0-9]{20})\.supabase\.co\/?$/)?.[1] || null;

/** Non-secret Auth config fields the admin panel may display. */
const READ_FIELDS = [
  'site_url', 'uri_allow_list', 'external_google_enabled', 'external_google_client_id', 'external_email_enabled',
  'mailer_autoconfirm', 'hook_send_email_enabled', 'hook_send_email_uri',
] as const;

export type AuthConfigView = Partial<Record<(typeof READ_FIELDS)[number], any>>;

export function createManagementClient(token: string | undefined, supabaseUrl: string, fetchImpl: typeof fetch = fetch) {
  const ref = projectRefFromUrl(supabaseUrl);
  const enabled = !!(token && ref);
  const base = ref ? `https://api.supabase.com/v1/projects/${ref}/config/auth` : '';

  async function call(method: 'GET' | 'PATCH', body?: unknown) {
    if (!enabled) throw new Error('SUPABASE_MANAGEMENT_TOKEN is not set on the server.');
    const res = await fetchImpl(base, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', accept: 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      /* not JSON */
    }
    if (!res.ok) throw new Error(`Supabase Management API ${res.status}: ${json?.message || json?.error || text.slice(0, 200)}`);
    return json;
  }

  return {
    enabled,
    ref,
    async getAuthConfig(): Promise<AuthConfigView> {
      const all = await call('GET');
      const out: AuthConfigView = {};
      for (const k of READ_FIELDS) if (all && k in all) out[k] = all[k];
      return out;
    },
    /** PATCH with only the given keys. Returns the non-secret view afterwards. */
    async patchAuthConfig(patch: Record<string, unknown>): Promise<AuthConfigView> {
      const all = await call('PATCH', patch);
      const out: AuthConfigView = {};
      for (const k of READ_FIELDS) if (all && k in all) out[k] = all[k];
      return out;
    },
  };
}

export type ManagementClient = ReturnType<typeof createManagementClient>;

/** Comma-separated allow-list ⇄ array. */
export const parseAllowList = (v: unknown): string[] => String(v || '').split(',').map((s) => s.trim()).filter(Boolean);
export const mergeAllowList = (existing: unknown, required: string[]): string => [...new Set([...parseAllowList(existing), ...required])].join(',');
