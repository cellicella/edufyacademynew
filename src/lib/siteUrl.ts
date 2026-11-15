/**
 * Public address of THIS website, used for links that Supabase puts in emails
 * (sign-up confirmation, password reset).
 *
 * Priority:
 *  1. Admin → Settings → Domain & Environment (active profile's website URL, validated by the server:
 *     https only in production/staging), loaded with the public settings, else
 *  2. window.EDUFY_CONFIG.siteUrl (/config.js) or VITE_SITE_URL (production builds default to
 *     https://edufyacademy.com, see vite.config.ts), else
 *  3. the origin the visitor is actually using (window.location.origin).
 *
 * A localhost / 127.0.0.1 address is only ever used while the page itself is opened on this computer,
 * so a development value can never send real visitors to localhost.
 *
 * Supabase only honours a redirect that is listed under Authentication → URL Configuration →
 * Redirect URLs; otherwise it falls back to the "Site URL" setting.
 */
const LOCAL_URL = /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;
const HTTPS_URL = /^https:\/\/[^\s/"'<>]+(\/[^\s"'<>]*)?$/;

/** true only when the page is opened on this computer (local development / preview). */
export const isLocalPage = () => typeof window !== 'undefined' && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);

/** https addresses always; http://localhost only on a local page. Returns '' for anything else. */
export function acceptSiteUrl(raw: unknown, localPage = isLocalPage()): string {
  const v = String(raw || '').trim().replace(/\/+$/, '');
  if (HTTPS_URL.test(v)) return v;
  if (localPage && LOCAL_URL.test(v)) return v;
  return '';
}

let adminSiteUrl = '';
/** Called by SettingsContext when the public settings load. */
export function setConfiguredSiteUrl(url: string | null | undefined) {
  adminSiteUrl = acceptSiteUrl(url);
}

export function siteUrl(): string {
  if (adminSiteUrl) return adminSiteUrl;
  const runtime = typeof window !== 'undefined' ? String((window as { EDUFY_CONFIG?: { siteUrl?: string } }).EDUFY_CONFIG?.siteUrl || '') : '';
  const configured = acceptSiteUrl(runtime) || acceptSiteUrl(import.meta.env.VITE_SITE_URL);
  if (configured) return configured;
  return typeof window !== 'undefined' ? window.location.origin : '';
}

/** Where the "Confirm your email" link should land. */
export const authCallbackUrl = (next?: string | null) => {
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '';
  return `${siteUrl()}/auth/callback${safeNext ? `?next=${encodeURIComponent(safeNext)}` : ''}`;
};
