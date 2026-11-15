/**
 * Domain & environment profiles (development / staging / production) — validation and derived URLs.
 * Pure logic, unit-tested in tests/emailSystem.test.ts.
 *
 * Only absolute https origins (http://localhost for development) and safe relative paths are accepted, so a
 * saved value can never become an open redirect, a javascript: URL or a script source.
 */

export const PROFILES = ['development', 'staging', 'production'] as const;
export type Profile = (typeof PROFILES)[number];
export const APP_SCHEME = 'edufyacademy';

export interface DomainProfile { siteUrl: string; apiUrl: string; adminUrl: string; extraRedirects: string[] }
export interface DomainSettings {
  activeProfile: Profile;
  profiles: Record<Profile, DomainProfile>;
  paths: { dashboard: string; login: string; register: string; resetPassword: string; authCallback: string };
}

export const DEFAULT_PATHS = { dashboard: '/student', login: '/login', register: '/register', resetPassword: '/reset-password', authCallback: '/auth/callback' };
const emptyProfile = (): DomainProfile => ({ siteUrl: '', apiUrl: '', adminUrl: '', extraRedirects: [] });
export const DEFAULT_DOMAIN: DomainSettings = {
  activeProfile: 'production',
  profiles: { development: emptyProfile(), staging: emptyProfile(), production: emptyProfile() },
  paths: { ...DEFAULT_PATHS },
};

const PRIVATE_HOST = /^(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|\[::1\]|.*\.local)$/i;

/** Normalised origin (+ optional base path) or an error message. */
export function checkBaseUrl(raw: string, profile: Profile, label: string): { ok: true; value: string } | { ok: false; error: string } {
  const v = String(raw || '').trim().replace(/\/+$/, '');
  if (!v) return { ok: true, value: '' };
  let u: URL;
  try {
    u = new URL(v);
  } catch {
    return { ok: false, error: `${label} is not a valid URL.` };
  }
  if (u.username || u.password) return { ok: false, error: `${label} must not contain a username or password.` };
  if (u.search || u.hash) return { ok: false, error: `${label} must not contain ? or # parts.` };
  const local = PRIVATE_HOST.test(u.hostname);
  if (profile === 'development') {
    if (!(u.protocol === 'https:' || (u.protocol === 'http:' && local))) return { ok: false, error: `${label}: use https://, or http:// only for localhost/LAN addresses in development.` };
  } else {
    if (u.protocol !== 'https:') return { ok: false, error: `${label} must use https:// in ${profile}.` };
    if (local) return { ok: false, error: `${label} cannot be localhost or a private network address in ${profile}.` };
  }
  return { ok: true, value: `${u.protocol}//${u.host}${u.pathname.replace(/\/+$/, '')}` };
}

const PATH_RE = /^\/[A-Za-z0-9._~\-/]*$/;
export const isSafePath = (p: string) => PATH_RE.test(p) && !p.includes('//') && !p.includes('..');

/** Extra redirect URLs: https on the profile rules, or the app scheme (edufyacademy://…). */
export function checkRedirect(raw: string, profile: Profile): string | null {
  const v = String(raw || '').trim();
  if (v.startsWith(`${APP_SCHEME}://`)) return /^edufyacademy:\/\/[A-Za-z0-9._~\-/*]*$/.test(v) ? null : 'Invalid app redirect.';
  const base = v.replace(/\/\*\*$/, '');
  const r = checkBaseUrl(base, profile, 'Redirect URL');
  return r.ok ? null : r.error;
}

export function validateDomain(raw: any, opts: { nodeEnv?: string } = {}): { ok: true; value: DomainSettings } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const active = (PROFILES as readonly string[]).includes(raw?.activeProfile) ? (raw.activeProfile as Profile) : 'production';
  if (opts.nodeEnv === 'production' && active === 'development') errors.activeProfile = 'The live server runs in production mode; the development profile cannot be activated here.';
  const profiles = {} as Record<Profile, DomainProfile>;
  for (const p of PROFILES) {
    const src = raw?.profiles?.[p] || {};
    const out = emptyProfile();
    for (const [k, label] of [['siteUrl', 'Website URL'], ['apiUrl', 'API URL'], ['adminUrl', 'Admin URL']] as const) {
      const r = checkBaseUrl(src[k], p, label);
      if (r.ok) out[k] = r.value;
      else errors[`profiles.${p}.${k}`] = r.error;
    }
    const extras = Array.isArray(src.extraRedirects) ? src.extraRedirects : [];
    if (extras.length > 20) errors[`profiles.${p}.extraRedirects`] = 'At most 20 extra redirect URLs.';
    extras.slice(0, 20).forEach((x: unknown, i: number) => {
      const s = String(x || '').trim();
      if (!s) return;
      const e = checkRedirect(s, p);
      if (e) errors[`profiles.${p}.extraRedirects.${i}`] = e;
      else out.extraRedirects.push(s.replace(/\/+$/, ''));
    });
    profiles[p] = out;
  }
  const paths = { ...DEFAULT_PATHS };
  for (const k of Object.keys(DEFAULT_PATHS) as (keyof typeof DEFAULT_PATHS)[]) {
    const v = String(raw?.paths?.[k] ?? DEFAULT_PATHS[k]).trim() || DEFAULT_PATHS[k];
    if (!isSafePath(v)) errors[`paths.${k}`] = 'Use a path that starts with / (letters, numbers, - and / only).';
    else paths[k] = v;
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value: { activeProfile: active, profiles, paths } };
}

export function withDomainDefaults(v: any): DomainSettings {
  const r = validateDomain(v || {});
  if (r.ok) return r.value;
  // Stored data that no longer validates (should not happen): fall back field by field
  return {
    activeProfile: (PROFILES as readonly string[]).includes(v?.activeProfile) ? v.activeProfile : 'production',
    profiles: { ...DEFAULT_DOMAIN.profiles, ...(v?.profiles || {}) },
    paths: { ...DEFAULT_PATHS, ...(v?.paths || {}) },
  };
}

export interface ActiveUrls {
  environment: Profile;
  siteUrl: string;
  apiUrl: string;
  adminUrl: string;
  loginUrl: string;
  registerUrl: string;
  dashboardUrl: string;
  resetPasswordUrl: string;
  authCallbackUrl: string;
}

/** URLs of the active profile (empty strings when the site URL is not set yet). */
export function activeUrls(d: DomainSettings, fallbackSiteUrl = ''): ActiveUrls {
  const prof = d.profiles[d.activeProfile];
  const site = prof.siteUrl || fallbackSiteUrl.replace(/\/+$/, '');
  const at = (p: string) => (site ? `${site}${p}` : '');
  return {
    environment: d.activeProfile,
    siteUrl: site,
    apiUrl: prof.apiUrl || (site ? `${site}` : ''),
    adminUrl: prof.adminUrl || at('/admin'),
    loginUrl: at(d.paths.login),
    registerUrl: at(d.paths.register),
    dashboardUrl: at(d.paths.dashboard),
    resetPasswordUrl: at(d.paths.resetPassword),
    authCallbackUrl: at(d.paths.authCallback),
  };
}

/** Redirect URLs Supabase Auth must allow for the active profile. */
export function requiredRedirects(d: DomainSettings, fallbackSiteUrl = ''): string[] {
  const u = activeUrls(d, fallbackSiteUrl);
  const list = [
    ...(u.siteUrl ? [`${u.siteUrl}/**`] : []),
    `${APP_SCHEME}://**`,
    ...d.profiles[d.activeProfile].extraRedirects,
  ];
  return [...new Set(list)];
}

/** Is a redirect target allowed (used by the auth email hook before putting it in an email)? */
export function isAllowedRedirect(target: string, d: DomainSettings, opts: { production: boolean; fallbackSiteUrl?: string }): boolean {
  if (!target) return false;
  if (target.startsWith(`${APP_SCHEME}://`)) return /^edufyacademy:\/\/[A-Za-z0-9._~\-/?=&%]*$/.test(target);
  let u: URL;
  try {
    u = new URL(target);
  } catch {
    return false;
  }
  if (opts.production && (u.protocol !== 'https:' || PRIVATE_HOST.test(u.hostname))) return false;
  const origins = new Set<string>();
  for (const p of PROFILES) {
    if (opts.production && p === 'development') continue;
    const prof = d.profiles[p];
    for (const x of [prof.siteUrl, prof.adminUrl, ...prof.extraRedirects]) {
      try {
        if (x && !x.startsWith(APP_SCHEME)) origins.add(new URL(x.replace(/\/\*\*$/, '')).origin);
      } catch {
        /* ignore */
      }
    }
  }
  if (opts.fallbackSiteUrl) {
    try {
      origins.add(new URL(opts.fallbackSiteUrl).origin);
    } catch {
      /* ignore */
    }
  }
  return origins.has(u.origin);
}
