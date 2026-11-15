/**
 * Public site settings for the app (Admin → Settings & Configuration). Pure logic, unit-tested.
 * The app never reads privileged tables: it uses GET /api/settings/public, with the public
 * get_public_settings() database function as a fallback. Secrets are never part of this payload.
 */
import { SOCIAL_PROFILES } from './social';

export interface AppSocialLink { id: string; platform: string; label: string; url: string; icon: string }

export interface AppSiteSettings {
  general: { siteName: string; appName: string; siteUrl: string; companyName: string; tagline: string; copyright: string };
  branding: { appLogo: string; splashLogo: string; logoMain: string };
  contact: { primaryPhone: string; supportEmail: string; businessHours: string };
  whatsapp: { enabled: boolean; number: string; supportMessage: string; welcomeMessage: string };
  social: { links: AppSocialLink[] };
  payment: { enabled: boolean; displayName: string; instructions: string };
  app: {
    supportPhone: string; supportEmail: string; whatsappNumber: string; helpUrl: string; supportUrl: string;
    showSocialLinks: boolean; showFeaturedCourses: boolean; showOffers: boolean; showBundles: boolean; showBlog: boolean;
    noticeEnabled: boolean; noticeText: string; minVersion: string; latestVersion: string; forceUpdateMessage: string;
    androidStoreUrl: string; iosStoreUrl: string;
  };
  maintenance: { appEnabled: boolean; title: string; message: string; startsAt: string; endsAt: string; showContact: boolean };
  /** Login methods (Settings → Authentication & Login Methods). */
  auth: { googleEnabled: boolean; emailPasswordEnabled: boolean; magicLinkEnabled: boolean; preferredMethod: string; googleButtonText: string };
}

export const DEFAULT_APP_SETTINGS: AppSiteSettings = {
  general: { siteName: 'Edufy Academy', appName: 'Edufy Academy', siteUrl: '', companyName: 'Educurist Learning Solutions Private Limited', tagline: 'Excellence in Learning', copyright: '' },
  branding: { appLogo: '', splashLogo: '', logoMain: '' },
  contact: { primaryPhone: '+91 99169 58480', supportEmail: '', businessHours: '' },
  whatsapp: { enabled: true, number: '+91 99169 58480', supportMessage: 'Hi Edufy Academy, I need help with my account.', welcomeMessage: '' },
  social: { links: SOCIAL_PROFILES.map((s) => ({ id: s.id, platform: s.id, label: s.label, url: s.url, icon: '' })) },
  payment: { enabled: true, displayName: 'Razorpay', instructions: '' },
  app: {
    supportPhone: '', supportEmail: '', whatsappNumber: '', helpUrl: '', supportUrl: '',
    showSocialLinks: true, showFeaturedCourses: true, showOffers: true, showBundles: true, showBlog: true,
    noticeEnabled: false, noticeText: '', minVersion: '', latestVersion: '',
    forceUpdateMessage: 'A new version of Edufy Academy is available. Please update to continue.', androidStoreUrl: '', iosStoreUrl: '',
  },
  maintenance: { appEnabled: false, title: 'We’ll be back soon', message: '', startsAt: '', endsAt: '', showContact: true },
  auth: { googleEnabled: true, emailPasswordEnabled: true, magicLinkEnabled: false, preferredMethod: 'google', googleButtonText: 'continue_with' },
};

const isObj = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
export const isHttps = (v: unknown): v is string => typeof v === 'string' && /^https:\/\/[^\s]+$/i.test(v);
const str = (v: unknown, fallback: string) => (typeof v === 'string' ? v : fallback);
const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);

/** Merges a raw payload over the defaults with type checks (bad values never crash the app). */
export function mergeAppSettings(raw: unknown): AppSiteSettings {
  const r = isObj(raw) ? raw : {};
  const d = DEFAULT_APP_SETTINGS;
  const pick = <K extends keyof AppSiteSettings>(k: K): any => {
    const src = isObj(r[k]) ? r[k] : {};
    const def: any = d[k];
    const out: any = {};
    for (const [key, dv] of Object.entries(def)) out[key] = typeof dv === 'boolean' ? bool(src[key], dv) : typeof dv === 'string' ? str(src[key], dv) : dv;
    return out;
  };
  const linksRaw = Array.isArray(r.social?.links) ? r.social.links : null;
  const links: AppSocialLink[] = linksRaw
    ? linksRaw
        .filter((l: any) => l && l.enabled !== false && isHttps(l.url))
        .sort((a: any, b: any) => (Number(a.position) || 0) - (Number(b.position) || 0))
        .map((l: any) => ({ id: String(l.id || l.platform), platform: String(l.platform || 'custom'), label: String(l.label || l.platform || 'Link'), url: l.url, icon: isHttps(l.icon) ? l.icon : '' }))
    : d.social.links;
  return {
    general: pick('general'), branding: pick('branding'), contact: pick('contact'), whatsapp: pick('whatsapp'),
    social: { links }, payment: pick('payment'), app: pick('app'), maintenance: pick('maintenance'), auth: safeAuth(pick('auth')),
  };
}

/** Never hide every sign-in method: email & password stays unless Google is available. */
function safeAuth(a: AppSiteSettings['auth']): AppSiteSettings['auth'] {
  const out = { ...a };
  if (!out.googleEnabled) out.emailPasswordEnabled = true;
  if (out.preferredMethod !== 'email') out.preferredMethod = 'google';
  return out;
}

export const googleButtonLabel = (t: string) => (t === 'signin_with' ? 'Sign in with Google' : t === 'signup_with' ? 'Sign up with Google' : 'Continue with Google');

export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0) ? 1 : -1;
  return 0;
}

const VERSION = /^\d{1,3}\.\d{1,3}\.\d{1,4}$/;

/** 'force' when below the minimum supported version, 'soft' when a newer version exists. */
export function updateState(current: string, app: Pick<AppSiteSettings['app'], 'minVersion' | 'latestVersion'>): 'force' | 'soft' | 'none' {
  if (!VERSION.test(current)) return 'none';
  if (VERSION.test(app.minVersion) && compareVersions(current, app.minVersion) < 0) return 'force';
  if (VERSION.test(app.latestVersion) && compareVersions(current, app.latestVersion) < 0) return 'soft';
  return 'none';
}

export function appMaintenanceActive(m: AppSiteSettings['maintenance'], now = Date.now()): boolean {
  if (!m.appEnabled) return false;
  if (m.startsAt && Date.parse(m.startsAt) > now) return false;
  if (m.endsAt && Date.parse(m.endsAt) <= now) return false;
  return true;
}

export const digits = (v: string) => (v || '').replace(/\D/g, '');
export const waUrl = (number: string, message?: string) => (digits(number).length >= 8 ? `https://wa.me/${digits(number)}${message ? `?text=${encodeURIComponent(message)}` : ''}` : null);
export const telUrl = (number: string) => (digits(number).length >= 8 ? `tel:+${digits(number)}` : null);

/** Support contacts for the app: App Configuration values first, then Contact / WhatsApp settings. */
export function supportContacts(s: AppSiteSettings, webUrl: string) {
  const phone = s.app.supportPhone || s.contact.primaryPhone;
  const email = s.app.supportEmail || s.contact.supportEmail;
  const wa = s.whatsapp.enabled ? s.app.whatsappNumber || s.whatsapp.number : s.app.whatsappNumber;
  return {
    phone: telUrl(phone) ? phone : '',
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '',
    whatsappUrl: waUrl(wa, s.whatsapp.supportMessage),
    helpUrl: isHttps(s.app.helpUrl) ? s.app.helpUrl : webUrl ? `${webUrl}/faq` : '',
    supportUrl: isHttps(s.app.supportUrl) ? s.app.supportUrl : '',
  };
}
