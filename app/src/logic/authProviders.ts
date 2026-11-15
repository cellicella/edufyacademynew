/**
 * Which sign-in providers are switched on in Supabase Auth (public GET /auth/v1/settings, no secrets).
 * null = unknown (offline / not reachable): the button stays usable and reports a clear error if it fails.
 */
export interface AuthProviders { google: boolean | null; email: boolean | null }

export function parseAuthProviders(json: unknown): AuthProviders {
  const ext = (json as any)?.external;
  if (!ext || typeof ext !== 'object') return { google: null, email: null };
  return { google: typeof ext.google === 'boolean' ? ext.google : null, email: typeof ext.email === 'boolean' ? ext.email : null };
}

export type GoogleAvailability = 'ready' | 'not_configured' | 'disabled_by_admin' | 'unknown';

/** Combines the admin setting with Supabase's real provider status. */
export function googleAvailability(adminEnabled: boolean, providers: AuthProviders): GoogleAvailability {
  if (!adminEnabled) return 'disabled_by_admin';
  if (providers.google === false) return 'not_configured';
  if (providers.google === true) return 'ready';
  return 'unknown';
}
