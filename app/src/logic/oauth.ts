/**
 * Google sign-in in the app (browser-based OAuth with PKCE through Supabase). Pure helpers, unit-tested.
 * The browser returns to edufyacademy://auth/callback?code=… (or #error=… when cancelled/denied).
 */
export interface OAuthCallback { code: string | null; error: string | null }

export function parseOAuthCallback(url: string): OAuthCallback {
  let query = '';
  let hash = '';
  const h = url.indexOf('#');
  const base = h >= 0 ? url.slice(0, h) : url;
  if (h >= 0) hash = url.slice(h + 1);
  const q = base.indexOf('?');
  if (q >= 0) query = base.slice(q + 1);
  const qp = new URLSearchParams(query);
  const hp = new URLSearchParams(hash);
  const errorCode = qp.get('error_code') || hp.get('error_code') || qp.get('error') || hp.get('error');
  const desc = qp.get('error_description') || hp.get('error_description');
  if (errorCode) return { code: null, error: friendlyOAuthError(`${errorCode} ${desc || ''}`) };
  const code = qp.get('code');
  return { code: code && /^[A-Za-z0-9._~-]{6,512}$/.test(code) ? code : null, error: code ? null : 'Google sign-in did not return to the app correctly. Please try again.' };
}

export function friendlyOAuthError(raw: string): string {
  const m = String(raw || '').replace(/\+/g, ' ');
  if (/access_denied|cancel/i.test(m)) return 'Google sign-in was cancelled.';
  if (/provider is not enabled|unsupported provider|validation_failed/i.test(m)) return 'Google sign-in is not switched on yet. Please sign in with email and password.';
  if (/redirect/i.test(m)) return 'This app version is not allowed to finish Google sign-in yet (redirect URL not approved). Please sign in with email.';
  if (/network|fetch|timeout/i.test(m)) return 'No connection. Check your internet and try again.';
  return 'Google sign-in failed. Please try again or sign in with email.';
}
