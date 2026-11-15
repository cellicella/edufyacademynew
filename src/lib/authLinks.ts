/**
 * Helpers for links in Supabase auth emails (sign-up confirmation, password reset, magic link).
 * Pure functions (no React, no Supabase client) so they can be unit-tested.
 */

/** Paths that handle auth email links themselves. */
export const AUTH_LINK_PAGES = ['/auth/callback', '/reset-password'] as const;

const EMAIL_LINK_TYPES = ['signup', 'invite', 'magiclink', 'email', 'email_change', 'recovery'];

/**
 * Where an auth email link that landed on the wrong page should go, or null to leave it alone.
 *
 * Supabase sends a visitor to its "Site URL" (the home page) instead of the requested page when the
 * requested address is not on its Redirect URLs list. This rescues those visits:
 *  • a password-reset link → /reset-password
 *  • a confirmation / magic link, an app-started (PKCE) ?code=, or an expired-link error → /auth/callback
 * Only the home page is checked, so links on other pages are never rerouted.
 */
export function misdirectedAuthLink(pathname: string, search: string, hash: string): string | null {
  if (pathname !== '/' && pathname !== '') return null;
  const q = new URLSearchParams(search.replace(/^\?/, ''));
  const h = new URLSearchParams(hash.replace(/^#/, ''));
  const type = h.get('type') || q.get('type') || '';
  const suffix = `${search && search !== '?' ? (search.startsWith('?') ? search : `?${search}`) : ''}${hash && hash !== '#' ? (hash.startsWith('#') ? hash : `#${hash}`) : ''}`;
  if (type === 'recovery') return `/reset-password${suffix}`;
  const hasError = !!(h.get('error_code') || q.get('error_code') || h.get('error_description') || q.get('error_description'));
  const hasToken = !!(h.get('access_token') || q.get('token_hash') || q.get('code'));
  if (hasError || (hasToken && (!type || EMAIL_LINK_TYPES.includes(type)))) return `/auth/callback${suffix}`;
  return null;
}

/**
 * True when Supabase could not finish a PKCE sign-in because the link was opened in a different
 * browser or app than the one that asked for it (for example: signed up in the mobile app, then
 * tapped the confirmation link in the phone's mail app, which opens the website).
 * Supabase has already confirmed the email address before redirecting, so for a confirmation link
 * this means "verified, please sign in", not a failure.
 */
export function isMissingPkceVerifier(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { name?: unknown; code?: unknown; message?: unknown };
  if (e.name === 'AuthPKCECodeVerifierMissingError' || e.code === 'pkce_code_verifier_not_found') return true;
  return /code verifier|code_verifier/i.test(String(e.message || ''));
}
