/**
 * Public site settings (managed in Admin → Settings & Configuration, served by GET /api/settings/public).
 * These defaults are the fallback used until the live settings load (and if they can't be reached),
 * so the website always renders. Keep them in step with server/settingsSchema.ts DEFAULTS.
 */
import { SOCIAL_LINKS } from './social';

export interface SocialLinkSetting { id: string; platform: string; label: string; url: string; icon: string; enabled: boolean; position: number }

export interface PublicSettings {
  general: { siteName: string; appName: string; siteUrl: string; companyName: string; companyAddress: string; tagline: string; description: string; copyright: string; defaultCountryCode: string };
  branding: { logoMain: string; logoLight: string; logoDark: string; appLogo: string; splashLogo: string; favicon: string; loginLogo: string; emailLogo: string };
  contact: { primaryPhone: string; secondaryPhone: string; supportEmail: string; salesEmail: string; address: string; mapsUrl: string; businessHours: string; pageTitle: string; pageIntro: string };
  social: { links: SocialLinkSetting[] };
  payment: { enabled: boolean; displayName: string; instructions: string; currency: string };
  whatsapp: { enabled: boolean; number: string; buttonText: string; welcomeMessage: string; supportMessage: string };
  seo: { title: string; description: string; keywords: string; ogImage: string; robots: string; gaId: string; gscVerification: string };
  app: Record<string, any>;
  notifications: Record<string, any>;
  maintenance: { websiteEnabled: boolean; appEnabled: boolean; title: string; message: string; startsAt: string; endsAt: string; showContact: boolean };
  /** Login methods (Settings → Authentication & Login Methods). The Google Client ID is public by design; the secret never leaves the server. */
  auth: { googleEnabled: boolean; oneTapEnabled: boolean; emailPasswordEnabled: boolean; magicLinkEnabled: boolean; preferredMethod: 'google' | 'email'; googleButtonText: 'continue_with' | 'signin_with' | 'signup_with'; googleClientId: string };
  /** Active environment's public addresses (Settings → Domain & Environment). Empty until configured. */
  domain: { environment: string; siteUrl: string; apiUrl: string; loginUrl: string; registerUrl: string; dashboardUrl: string; resetPasswordUrl: string; authCallbackUrl: string };
}

export const DEFAULT_SETTINGS: PublicSettings = {
  general: {
    siteName: 'Edufy Academy', appName: 'Edufy Academy', siteUrl: '', companyName: 'Educurist Learning Solutions Private Limited', companyAddress: '',
    tagline: 'Excellence in Learning', description: 'An online academy for technology and professional skills, with certificates anyone can verify.',
    copyright: '© {year} Educurist Learning Solutions Private Limited. All rights reserved.', defaultCountryCode: '+91',
  },
  branding: { logoMain: '', logoLight: '', logoDark: '', appLogo: '', splashLogo: '', favicon: '', loginLogo: '', emailLogo: '' },
  contact: {
    primaryPhone: '+91 99169 58480', secondaryPhone: '', supportEmail: '', salesEmail: '', address: '', mapsUrl: '', businessHours: '',
    pageTitle: 'Contact Edufy Academy', pageIntro: 'Have questions about our courses, team licences or teaching on Edufy? Our student support team is here to help.',
  },
  social: { links: SOCIAL_LINKS.map((l, i) => ({ id: l.id, platform: l.id, label: l.label, url: l.url, icon: '', enabled: true, position: i })) },
  payment: { enabled: true, displayName: 'Razorpay', instructions: 'Pay securely with UPI, cards, net banking or wallets.', currency: 'INR' },
  whatsapp: {
    enabled: true, number: '+91 99169 58480', buttonText: 'Chat with us on WhatsApp',
    welcomeMessage: 'Hi Edufy Academy, I have a question about your courses.', supportMessage: 'Hi Edufy Academy, I need help with my account.',
  },
  seo: { title: 'Edufy Academy', description: '', keywords: '', ogImage: '', robots: 'index,follow', gaId: '', gscVerification: '' },
  app: {},
  notifications: {},
  maintenance: { websiteEnabled: false, appEnabled: false, title: 'We’ll be back soon', message: 'Edufy Academy is undergoing scheduled maintenance. Your courses and progress are safe.', startsAt: '', endsAt: '', showContact: true },
  auth: { googleEnabled: true, oneTapEnabled: false, emailPasswordEnabled: true, magicLinkEnabled: false, preferredMethod: 'google', googleButtonText: 'continue_with', googleClientId: '' },
  domain: { environment: 'production', siteUrl: '', apiUrl: '', loginUrl: '', registerUrl: '', dashboardUrl: '', resetPasswordUrl: '', authCallbackUrl: '' },
};

const isObj = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
export const isHttps = (v: unknown): v is string => typeof v === 'string' && /^https:\/\/[^\s]+$/i.test(v);

/** Live settings merged over defaults, section by section (bad or missing values fall back). */
export function mergeSettings(raw: unknown): PublicSettings {
  const src = isObj(raw) ? raw : {};
  const out: any = {};
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof PublicSettings)[]) {
    const def: any = DEFAULT_SETTINGS[key];
    const val = src[key];
    if (key === 'social') {
      const links = Array.isArray(val?.links) ? val.links.filter((l: any) => l && l.enabled !== false && isHttps(l.url)) : null;
      out.social = { links: links ? [...links].sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0)) : def.links };
    } else if (key === 'auth') {
      const a = { ...def, ...(isObj(val) ? val : {}) };
      // Never let a bad payload hide every sign-in method: email/password stays available unless Google is on
      if (!a.googleEnabled && !a.magicLinkEnabled) a.emailPasswordEnabled = true;
      if (!/^[0-9]{6,}-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(String(a.googleClientId || ''))) a.googleClientId = '';
      out.auth = a;
    } else if (key === 'domain') {
      const d = { ...def, ...(isObj(val) ? val : {}) };
      for (const k of Object.keys(def)) if (k !== 'environment' && d[k] && !/^https?:\/\/[^\s"'<>]+$/.test(String(d[k]))) d[k] = '';
      out.domain = d;
    } else {
      out[key] = { ...def, ...(isObj(val) ? val : {}) };
    }
  }
  return out as PublicSettings;
}

export const phoneDigits = (v: string) => (v || '').replace(/\D/g, '');
export const telHref = (v: string) => (phoneDigits(v) ? `tel:+${phoneDigits(v)}` : '');
export const waHref = (number: string, message?: string) =>
  phoneDigits(number) ? `https://wa.me/${phoneDigits(number)}${message ? `?text=${encodeURIComponent(message)}` : ''}` : '';
export const copyrightText = (s: PublicSettings) => (s.general.copyright || '').replace('{year}', String(new Date().getFullYear()));

export function maintenanceActive(m: PublicSettings['maintenance'], target: 'website' | 'app', now = Date.now()): boolean {
  const on = target === 'website' ? m.websiteEnabled : m.appEnabled;
  if (!on) return false;
  if (m.startsAt && Date.parse(m.startsAt) > now) return false;
  if (m.endsAt && Date.parse(m.endsAt) <= now) return false;
  return true;
}
