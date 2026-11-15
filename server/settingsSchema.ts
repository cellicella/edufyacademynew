/**
 * Edufy Academy settings: section definitions, defaults and validation (pure, no I/O).
 * The server is the only writer of public.site_settings, and everything goes through validateSection().
 * Secrets are NEVER part of a section; they live in secure_credentials (see credentials.ts).
 * Unit-tested in tests/settings.test.ts.
 */

import { TEMPLATE_DEFS, TEMPLATE_IDS, TEMPLATE_MAP, type TemplateId, unknownPlaceholders } from './emailTemplates';
import { DEFAULT_DOMAIN, activeUrls, validateDomain, withDomainDefaults } from './domain';

export type FieldKind =
  | 'text' | 'longtext' | 'html' | 'url' | 'image' | 'email' | 'phone' | 'countryCode' | 'bool'
  | 'version' | 'datetime' | 'enum' | 'gaId' | 'gscToken' | 'keywords' | 'color';

export interface FieldSpec {
  kind: FieldKind;
  max?: number;
  options?: readonly string[];
  required?: boolean;
  label?: string;
}

export type SectionId =
  | 'general' | 'branding' | 'contact' | 'social' | 'payment' | 'whatsapp' | 'email'
  | 'seo' | 'app' | 'notifications' | 'maintenance' | 'auth' | 'domain';

export const SOCIAL_PLATFORMS = ['facebook', 'instagram', 'youtube', 'linkedin', 'x', 'reddit', 'pinterest', 'telegram', 'whatsapp', 'custom'] as const;
export const EMAIL_TEMPLATES = TEMPLATE_IDS;

const t = (max = 120, label?: string): FieldSpec => ({ kind: 'text', max, label });
const img = (label?: string): FieldSpec => ({ kind: 'image', max: 500, label });

/** Flat sections (social, email and domain have nested structures and their own validators). */
export const SECTION_FIELDS: Record<Exclude<SectionId, 'social' | 'email' | 'domain'>, Record<string, FieldSpec>> = {
  auth: {
    googleEnabled: { kind: 'bool', label: 'Google Sign-In' },
    oneTapEnabled: { kind: 'bool', label: 'Google One Tap (website)' },
    emailPasswordEnabled: { kind: 'bool', label: 'Email and password login' },
    magicLinkEnabled: { kind: 'bool', label: 'Email magic-link login' },
    preferredMethod: { kind: 'enum', options: ['google', 'email'], label: 'Preferred login method' },
    googleButtonText: { kind: 'enum', options: ['continue_with', 'signin_with', 'signup_with'], label: 'Google button text' },
    googleClientId: { kind: 'text', max: 200, label: 'Google Web Client ID' },
  },
  general: {
    siteName: { kind: 'text', max: 60, required: true, label: 'Website name' },
    appName: { kind: 'text', max: 40, required: true, label: 'App name' },
    siteUrl: { kind: 'url', max: 200, label: 'Website URL' },
    companyName: t(120, 'Company name'),
    companyAddress: { kind: 'longtext', max: 300, label: 'Company address' },
    tagline: t(60, 'Tagline'),
    description: { kind: 'longtext', max: 300, label: 'Website description' },
    copyright: t(160, 'Footer copyright text'),
    defaultCountryCode: { kind: 'countryCode', max: 5, label: 'Default country code' },
  },
  branding: {
    logoMain: img('Main logo'),
    logoLight: img('Logo for light backgrounds'),
    logoDark: img('Logo for dark backgrounds'),
    appLogo: img('Mobile app logo'),
    splashLogo: img('Splash screen logo'),
    favicon: img('Favicon'),
    loginLogo: img('Login page logo'),
    emailLogo: img('Email header logo'),
  },
  contact: {
    primaryPhone: { kind: 'phone', max: 24, label: 'Primary phone' },
    secondaryPhone: { kind: 'phone', max: 24, label: 'Secondary phone' },
    supportEmail: { kind: 'email', max: 120, label: 'Support email' },
    salesEmail: { kind: 'email', max: 120, label: 'Sales email' },
    address: { kind: 'longtext', max: 300, label: 'Office address' },
    mapsUrl: { kind: 'url', max: 500, label: 'Google Maps URL' },
    businessHours: t(120, 'Business hours'),
    pageTitle: t(80, 'Contact page title'),
    pageIntro: { kind: 'longtext', max: 400, label: 'Contact page introduction' },
  },
  payment: {
    enabled: { kind: 'bool', label: 'Online payments enabled' },
    displayName: t(60, 'Payment gateway display name'),
    instructions: { kind: 'longtext', max: 400, label: 'Payment instructions' },
    currency: { kind: 'enum', options: ['INR'], label: 'Currency' },
  },
  whatsapp: {
    enabled: { kind: 'bool', label: 'WhatsApp button enabled' },
    number: { kind: 'phone', max: 24, label: 'WhatsApp Business number' },
    buttonText: t(60, 'Floating button text'),
    welcomeMessage: { kind: 'longtext', max: 300, label: 'Default welcome message' },
    supportMessage: { kind: 'longtext', max: 300, label: 'Support message' },
  },
  seo: {
    title: t(70, 'Website title'),
    description: { kind: 'longtext', max: 170, label: 'Meta description' },
    keywords: { kind: 'keywords', max: 300, label: 'Default keywords' },
    ogImage: img('Social sharing image'),
    robots: { kind: 'enum', options: ['index,follow', 'noindex,nofollow'], label: 'Search engine indexing' },
    gaId: { kind: 'gaId', max: 20, label: 'Google Analytics ID' },
    gscVerification: { kind: 'gscToken', max: 100, label: 'Google Search Console verification code' },
  },
  app: {
    supportPhone: { kind: 'phone', max: 24, label: 'App support phone' },
    supportEmail: { kind: 'email', max: 120, label: 'App support email' },
    whatsappNumber: { kind: 'phone', max: 24, label: 'App WhatsApp number' },
    helpUrl: { kind: 'url', max: 300, label: 'Help URL' },
    supportUrl: { kind: 'url', max: 300, label: 'Support URL' },
    showSocialLinks: { kind: 'bool', label: 'Show social links in the app' },
    showFeaturedCourses: { kind: 'bool', label: 'Show featured courses' },
    showOffers: { kind: 'bool', label: 'Show offers' },
    showBundles: { kind: 'bool', label: 'Show bundles' },
    showBlog: { kind: 'bool', label: 'Show blog' },
    noticeEnabled: { kind: 'bool', label: 'Show app notice' },
    noticeText: { kind: 'longtext', max: 240, label: 'App notice text' },
    minVersion: { kind: 'version', max: 20, label: 'Minimum supported version' },
    latestVersion: { kind: 'version', max: 20, label: 'Latest version' },
    forceUpdateMessage: { kind: 'longtext', max: 240, label: 'Force update message' },
    androidStoreUrl: { kind: 'url', max: 300, label: 'Google Play URL' },
    iosStoreUrl: { kind: 'url', max: 300, label: 'App Store URL' },
  },
  notifications: {
    pushEnabled: { kind: 'bool', label: 'Push notifications enabled' },
    promotionalEnabled: { kind: 'bool', label: 'Promotional notifications' },
    offersEnabled: { kind: 'bool', label: 'Offer notifications' },
    maintenanceAnnouncements: { kind: 'bool', label: 'Maintenance announcements' },
    defaultTitle: t(65, 'Default notification title'),
    defaultBody: { kind: 'longtext', max: 240, label: 'Default notification content' },
  },
  maintenance: {
    websiteEnabled: { kind: 'bool', label: 'Website maintenance mode' },
    appEnabled: { kind: 'bool', label: 'App maintenance announcement' },
    title: t(80, 'Maintenance title'),
    message: { kind: 'longtext', max: 500, label: 'Maintenance message' },
    startsAt: { kind: 'datetime', label: 'Starts at' },
    endsAt: { kind: 'datetime', label: 'Ends at' },
    showContact: { kind: 'bool', label: 'Show support contact details' },
  },
};

export const ALL_SECTIONS: SectionId[] = ['general', 'branding', 'contact', 'social', 'payment', 'whatsapp', 'email', 'seo', 'app', 'notifications', 'maintenance', 'auth', 'domain'];
/** Sections that must never be returned by the public endpoint. */
export const PRIVATE_SECTIONS: SectionId[] = ['email', 'domain'];

export interface SocialLinkSetting {
  id: string;
  platform: (typeof SOCIAL_PLATFORMS)[number];
  label: string;
  url: string;
  icon: string;
  enabled: boolean;
  position: number;
}

export interface EmailTemplateSetting { enabled: boolean; subject: string; html: string }

const year = '{year}';
export const DEFAULTS: Record<SectionId, any> = {
  general: {
    siteName: 'Edufy Academy', appName: 'Edufy Academy', siteUrl: '',
    companyName: 'Educurist Learning Solutions Private Limited', companyAddress: '', tagline: 'Excellence in Learning',
    description: 'An online academy for technology and professional skills, with certificates anyone can verify.',
    copyright: `© ${year} Educurist Learning Solutions Private Limited. All rights reserved.`, defaultCountryCode: '+91',
  },
  branding: { logoMain: '', logoLight: '', logoDark: '', appLogo: '', splashLogo: '', favicon: '', loginLogo: '', emailLogo: '' },
  contact: {
    primaryPhone: '+91 99169 58480', secondaryPhone: '', supportEmail: '', salesEmail: '', address: '', mapsUrl: '', businessHours: '',
    pageTitle: 'Contact Edufy Academy',
    pageIntro: 'Have questions about our courses, team licences or teaching on Edufy? Our student support team is here to help.',
  },
  social: {
    links: [
      { id: 'facebook', platform: 'facebook', label: 'Facebook', url: 'https://www.facebook.com/edufyacademy360/', icon: '', enabled: true, position: 0 },
      { id: 'instagram', platform: 'instagram', label: 'Instagram', url: 'https://www.instagram.com/edufyacademy_learning/', icon: '', enabled: true, position: 1 },
      { id: 'youtube', platform: 'youtube', label: 'YouTube', url: '', icon: '', enabled: false, position: 2 },
      { id: 'linkedin', platform: 'linkedin', label: 'LinkedIn', url: 'https://www.linkedin.com/company/edufyacademy360/', icon: '', enabled: true, position: 3 },
      { id: 'x', platform: 'x', label: 'X (Twitter)', url: 'https://x.com/edufyacademy247', icon: '', enabled: true, position: 4 },
      { id: 'reddit', platform: 'reddit', label: 'Reddit', url: 'https://www.reddit.com/user/edufyAcademy/', icon: '', enabled: true, position: 5 },
      { id: 'pinterest', platform: 'pinterest', label: 'Pinterest', url: 'https://in.pinterest.com/elseduacademy/', icon: '', enabled: true, position: 6 },
      { id: 'telegram', platform: 'telegram', label: 'Telegram', url: '', icon: '', enabled: false, position: 7 },
      { id: 'whatsapp', platform: 'whatsapp', label: 'WhatsApp', url: 'https://wa.me/919916958480', icon: '', enabled: false, position: 8 },
    ] as SocialLinkSetting[],
  },
  payment: { enabled: true, displayName: 'Razorpay', instructions: 'Pay securely with UPI, cards, net banking or wallets.', currency: 'INR' },
  whatsapp: {
    enabled: true, number: '+91 99169 58480', buttonText: 'Chat with us on WhatsApp',
    welcomeMessage: 'Hi Edufy Academy, I have a question about your courses.',
    supportMessage: 'Hi Edufy Academy, I need help with my account.',
  },
  email: {
    enabled: true, senderName: 'Edufy Academy', senderEmail: '', replyTo: '', supportEmail: '',
    footerText: '© {year} Educurist Learning Solutions Private Limited · Edufy Academy', brandColor: '#004AAD',
    templates: Object.fromEntries(TEMPLATE_DEFS.map((t) => [t.id, { enabled: true, subject: t.subject, html: t.html }])) as Record<TemplateId, EmailTemplateSetting>,
  },
  auth: {
    googleEnabled: true, oneTapEnabled: false, emailPasswordEnabled: true, magicLinkEnabled: false,
    preferredMethod: 'google', googleButtonText: 'continue_with', googleClientId: '',
  },
  domain: DEFAULT_DOMAIN,
  seo: {
    title: 'Edufy Academy', description: 'Premium online learning: practical courses with video lessons, quizzes and verifiable certificates.',
    keywords: 'online courses, e-learning, certificates, IT skills, office productivity', ogImage: '', robots: 'index,follow', gaId: '', gscVerification: '',
  },
  app: {
    supportPhone: '', supportEmail: '', whatsappNumber: '', helpUrl: '', supportUrl: '',
    showSocialLinks: true, showFeaturedCourses: true, showOffers: true, showBundles: true, showBlog: true,
    noticeEnabled: false, noticeText: '', minVersion: '', latestVersion: '',
    forceUpdateMessage: 'A new version of Edufy Academy is available. Please update to continue.', androidStoreUrl: '', iosStoreUrl: '',
  },
  notifications: {
    pushEnabled: true, promotionalEnabled: true, offersEnabled: true, maintenanceAnnouncements: true,
    defaultTitle: 'Edufy Academy', defaultBody: '',
  },
  maintenance: {
    websiteEnabled: false, appEnabled: false, title: 'We’ll be back soon',
    message: 'Edufy Academy is undergoing scheduled maintenance. Your courses and progress are safe.',
    startsAt: '', endsAt: '', showContact: true,
  },
};

// ------------------------------------------------------------------ field validation
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
export const cleanString = (v: unknown, max: number, multiline = false): string => {
  if (typeof v !== 'string') return '';
  let s = v.replace(CONTROL, '');
  s = multiline ? s.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n') : s.replace(/\s+/g, ' ');
  return s.trim().slice(0, max);
};

export const isHttpsUrl = (v: string) => {
  if (!/^https:\/\/[^\s]+$/i.test(v)) return false;
  try {
    const u = new URL(v);
    return u.protocol === 'https:' && !!u.hostname && !u.username && !u.password;
  } catch {
    return false;
  }
};
export const isEmail = (v: string) => /^[^\s@<>"']{1,64}@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(v);
/** International phone: optional +, 8–15 digits, spaces/dashes/brackets allowed. */
export const isPhone = (v: string) => {
  if (!/^\+?[0-9 ()-]{6,24}$/.test(v)) return false;
  const digits = v.replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 15;
};
export const phoneDigits = (v: string) => v.replace(/\D/g, '');
export const isVersion = (v: string) => /^\d{1,3}\.\d{1,3}\.\d{1,4}$/.test(v);

export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0) ? 1 : -1;
  return 0;
}

/** Allows the formatting tags the template editor produces; strips scripts, handlers and unsafe links. */
export function sanitizeEmailHtml(html: string, max = 20000): string {
  return html
    .slice(0, max)
    .replace(/<\s*(script|style|iframe|object|embed|form|input|button|link|meta|base)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|style|iframe|object|embed|form|input|button|link|meta|base)[^>]*\/?>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*("|')\s*(javascript|vbscript|data):[^"']*\2/gi, '$1="#"');
}

function validateField(key: string, spec: FieldSpec, raw: unknown, errors: Record<string, string>): unknown {
  const label = spec.label || key;
  if (spec.kind === 'bool') return raw === true || raw === 'true';
  if (spec.kind === 'html') return sanitizeEmailHtml(typeof raw === 'string' ? raw : '', spec.max || 20000);
  const multiline = spec.kind === 'longtext';
  const v = cleanString(raw, spec.max ?? 200, multiline);
  if (!v) {
    if (spec.required) errors[key] = `${label} is required.`;
    return '';
  }
  switch (spec.kind) {
    case 'url':
    case 'image':
      if (!isHttpsUrl(v)) errors[key] = `${label} must be an https:// link.`;
      break;
    case 'email':
      if (!isEmail(v)) errors[key] = `${label} is not a valid email address.`;
      break;
    case 'phone':
      if (!isPhone(v)) errors[key] = `${label} must be a phone number with country code, e.g. +91 98765 43210.`;
      break;
    case 'countryCode':
      if (!/^\+\d{1,4}$/.test(v)) errors[key] = `${label} must look like +91.`;
      break;
    case 'version':
      if (!isVersion(v)) errors[key] = `${label} must look like 1.2.0.`;
      break;
    case 'datetime':
      if (Number.isNaN(Date.parse(v))) errors[key] = `${label} is not a valid date and time.`;
      else return new Date(v).toISOString();
      break;
    case 'enum':
      if (!spec.options?.includes(v)) errors[key] = `${label}: choose one of ${spec.options?.join(', ')}.`;
      break;
    case 'gaId':
      if (!/^(G-[A-Z0-9]{4,15}|UA-\d{4,10}-\d{1,4})$/.test(v)) errors[key] = `${label} must look like G-XXXXXXXXXX.`;
      break;
    case 'gscToken':
      if (!/^[A-Za-z0-9_-]{10,100}$/.test(v)) errors[key] = `${label}: paste only the content="…" value from Google.`;
      break;
    case 'keywords':
      return v.split(',').map((k) => k.trim()).filter(Boolean).slice(0, 25).join(', ');
    case 'color':
      if (!/^#[0-9a-fA-F]{6}$/.test(v)) errors[key] = `${label} must be a hex colour like #004AAD.`;
      break;
  }
  return v;
}

function validateFlat(section: keyof typeof SECTION_FIELDS, raw: any, errors: Record<string, string>) {
  const out: Record<string, unknown> = {};
  for (const [key, spec] of Object.entries(SECTION_FIELDS[section])) {
    out[key] = validateField(key, spec, raw?.[key] ?? DEFAULTS[section][key], errors);
  }
  return out;
}

function validateSocial(raw: any, errors: Record<string, string>) {
  const list = Array.isArray(raw?.links) ? raw.links : [];
  if (list.length > 20) errors.links = 'At most 20 social links.';
  const seen = new Set<string>();
  const links: SocialLinkSetting[] = [];
  list.slice(0, 20).forEach((l: any, i: number) => {
    const platform = (SOCIAL_PLATFORMS as readonly string[]).includes(l?.platform) ? l.platform : 'custom';
    let id = cleanString(l?.id, 40).toLowerCase().replace(/[^a-z0-9_-]/g, '') || `${platform}-${i}`;
    while (seen.has(id)) id = `${id}-${i}`;
    seen.add(id);
    const label = cleanString(l?.label, 40) || platform;
    const url = cleanString(l?.url, 300);
    const icon = cleanString(l?.icon, 500);
    const enabled = l?.enabled === true;
    if (url && !isHttpsUrl(url)) errors[`links.${i}.url`] = `${label}: the profile URL must start with https://`;
    if (enabled && !url) errors[`links.${i}.url`] = `${label}: add the profile URL or disable it.`;
    if (icon && !isHttpsUrl(icon)) errors[`links.${i}.icon`] = `${label}: the icon must be an https:// image.`;
    links.push({ id, platform: platform as SocialLinkSetting['platform'], label, url, icon, enabled, position: i });
  });
  return { links };
}

function validateEmail(raw: any, errors: Record<string, string>) {
  const senderName = cleanString(raw?.senderName, 60) || 'Edufy Academy';
  const senderEmail = cleanString(raw?.senderEmail, 120);
  const replyTo = cleanString(raw?.replyTo, 120);
  const supportEmail = cleanString(raw?.supportEmail, 120);
  if (senderEmail && !isEmail(senderEmail)) errors.senderEmail = 'Sender email is not a valid email address.';
  if (replyTo && !isEmail(replyTo)) errors.replyTo = 'Reply-to email is not a valid email address.';
  if (supportEmail && !isEmail(supportEmail)) errors.supportEmail = 'Support email is not a valid email address.';
  const brandColor = cleanString(raw?.brandColor, 7) || '#004AAD';
  if (!/^#[0-9a-fA-F]{6}$/.test(brandColor)) errors.brandColor = 'Brand colour must look like #004AAD.';
  const footerText = cleanString(raw?.footerText, 300);
  const templates: Record<string, EmailTemplateSetting> = {};
  for (const id of TEMPLATE_IDS) {
    const r = raw?.templates?.[id] || DEFAULTS.email.templates[id];
    const subject = cleanString(r?.subject, 150);
    const html = sanitizeEmailHtml(typeof r?.html === 'string' ? r.html : '');
    const enabled = r?.enabled !== false;
    if (enabled && (!subject || !html.trim())) errors[`templates.${id}`] = `“${TEMPLATE_MAP[id].label}” needs a subject and a message (or turn it off).`;
    const unknown = unknownPlaceholders(id, subject, html);
    if (unknown.length) errors[`templates.${id}`] = `“${TEMPLATE_MAP[id].label}” uses unknown placeholders: ${unknown.map((u) => `{{${u}}}`).join(', ')}.`;
    templates[id] = { enabled, subject, html };
  }
  return { enabled: raw?.enabled !== false, senderName, senderEmail, replyTo, supportEmail, footerText, brandColor, templates };
}

/** Old (v1) template placeholders → current names, so templates saved before the upgrade keep working. */
const LEGACY_PLACEHOLDERS: Record<string, string> = { name: 'student_name', courseTitle: 'course_name', paymentId: 'transaction_id', orderId: 'order_id', certificateCode: 'certificate_code', siteName: 'website_name', siteUrl: 'website_url' };
export const upgradeLegacyPlaceholders = (s: string) => String(s || '').replace(/\{\{\s*([A-Za-z]+)\s*\}\}/g, (m, k) => (LEGACY_PLACEHOLDERS[k] ? `{{${LEGACY_PLACEHOLDERS[k]}}}` : m));

function validateAuth(value: any, errors: Record<string, string>) {
  if (!value.googleEnabled && !value.emailPasswordEnabled && !value.magicLinkEnabled) errors.emailPasswordEnabled = 'Keep at least one login method enabled.';
  if (!value.emailPasswordEnabled && !value.googleEnabled) errors.emailPasswordEnabled = 'Email and password login can only be turned off while Google Sign-In is on.';
  if (value.preferredMethod === 'google' && !value.googleEnabled) errors.preferredMethod = 'Turn on Google Sign-In or choose email as the preferred method.';
  if (value.preferredMethod === 'email' && !value.emailPasswordEnabled && !value.magicLinkEnabled) errors.preferredMethod = 'Email login is turned off.';
  if (value.googleClientId && !/^[0-9]{6,}-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(value.googleClientId)) errors.googleClientId = 'The Client ID must look like 1234567890-abc123.apps.googleusercontent.com.';
  if (value.oneTapEnabled && (!value.googleEnabled || !value.googleClientId)) errors.oneTapEnabled = 'One Tap needs Google Sign-In on and the Web Client ID filled in.';
}

/** Validates and normalises one section. Unknown keys are dropped. */
export function validateSection(section: string, raw: unknown): { ok: true; value: any } | { ok: false; errors: Record<string, string> } {
  if (!(ALL_SECTIONS as string[]).includes(section)) return { ok: false, errors: { section: 'Unknown settings section.' } };
  const errors: Record<string, string> = {};
  let value: any;
  if (section === 'social') value = validateSocial(raw, errors);
  else if (section === 'email') value = validateEmail(raw, errors);
  else if (section === 'domain') {
    const d = validateDomain(raw, { nodeEnv: process.env.NODE_ENV });
    if (!d.ok) return d;
    value = d.value;
  } else value = validateFlat(section as keyof typeof SECTION_FIELDS, raw, errors);
  if (section === 'auth') validateAuth(value, errors);

  // Cross-field rules
  if (section === 'maintenance' && value.startsAt && value.endsAt && Date.parse(value.endsAt) <= Date.parse(value.startsAt)) {
    errors.endsAt = 'The end time must be after the start time.';
  }
  if (section === 'app' && value.minVersion && value.latestVersion && compareVersions(value.minVersion, value.latestVersion) > 0) {
    errors.minVersion = 'The minimum version cannot be newer than the latest version.';
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value };
}

/** Stored values merged over defaults (missing keys → defaults; unknown sections ignored). */
export function withDefaults(stored: Record<string, any>): Record<SectionId, any> {
  const out = {} as Record<SectionId, any>;
  for (const s of ALL_SECTIONS) {
    const v = stored?.[s];
    if (s === 'social') out[s] = Array.isArray(v?.links) ? { links: v.links } : DEFAULTS.social;
    else if (s === 'email') {
      const stored = (v?.templates || {}) as Record<string, any>;
      const templates = Object.fromEntries(
        TEMPLATE_IDS.map((id) => {
          const t = stored[id];
          const d = DEFAULTS.email.templates[id];
          return [id, t && typeof t === 'object' ? { ...d, ...t, subject: upgradeLegacyPlaceholders(t.subject ?? d.subject), html: upgradeLegacyPlaceholders(t.html ?? d.html) } : d];
        })
      );
      const rest = { ...(v || {}) };
      delete (rest as any).templates;
      out[s] = { ...DEFAULTS.email, ...rest, templates };
    } else if (s === 'domain') out[s] = withDomainDefaults(v);
    else out[s] = { ...DEFAULTS[s], ...(v && typeof v === 'object' ? v : {}) };
  }
  return out;
}

/** Public payload: defaults + stored public sections, private sections removed. */
export function publicSettings(stored: Record<string, any>) {
  const all = withDefaults(stored);
  const urls = activeUrls(all.domain, all.general?.siteUrl || '');
  for (const p of PRIVATE_SECTIONS) delete (all as any)[p];
  // Only the ACTIVE profile's public URLs are published (never staging/development addresses).
  // The "auth" section holds no secret: the Google Web Client ID is public by design (used by One Tap).
  (all as any).domain = urls;
  all.social = { links: (all.social.links as SocialLinkSetting[]).filter((l) => l.enabled && isHttpsUrl(l.url)).sort((a, b) => a.position - b.position) };
  return all;
}

/** Is maintenance active right now for the website/app? */
export function maintenanceActive(m: { websiteEnabled?: boolean; appEnabled?: boolean; startsAt?: string; endsAt?: string }, target: 'website' | 'app', now = Date.now()): boolean {
  const on = target === 'website' ? m.websiteEnabled : m.appEnabled;
  if (!on) return false;
  if (m.startsAt && Date.parse(m.startsAt) > now) return false;
  if (m.endsAt && Date.parse(m.endsAt) <= now) return false;
  return true;
}

// ------------------------------------------------------------------ audit helpers
const shorten = (v: unknown) => {
  if (typeof v === 'string' && v.length > 200) return `${v.slice(0, 197)}…`;
  return v;
};

/** Field-level diff for the audit log (values truncated; HTML templates summarised). */
export function diffSettings(before: any, after: any): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  for (const k of keys) {
    const a = before?.[k];
    const b = after?.[k];
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    if (k === 'templates' || k === 'links') {
      changes[k] = { from: summarise(a), to: summarise(b) };
    } else {
      changes[k] = { from: shorten(a ?? null), to: shorten(b ?? null) };
    }
  }
  return changes;
}
function summarise(v: any) {
  if (Array.isArray(v)) return v.map((l) => `${l.label}${l.enabled ? '' : ' (off)'}: ${l.url || '—'}`);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, t]: any) => [k, `${t?.enabled ? 'on' : 'off'} · ${t?.subject || ''}`]));
  return v ?? null;
}

/** Masks a secret for display: "••••••••a1b2". Never returns more than the last 4 characters. */
export function maskSecret(secret: string | null | undefined): string {
  if (!secret) return '';
  const s = String(secret);
  return `${'•'.repeat(8)}${s.length > 8 ? s.slice(-4) : ''}`;
}

// ------------------------------------------------------------------ server-side SEO for index.html
const escAttr = (v: string) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Injects SEO / branding tags into the built index.html (used when the Node server serves the website,
 * so crawlers and Search Console see them without running JavaScript).
 */
export function renderIndexHtml(html: string, s: { seo: any; branding: any; general: any }): string {
  const seo = s.seo || {};
  const title = seo.title || s.general?.siteName || 'Edufy Academy';
  let out = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escAttr(title)}</title>`);
  const setMeta = (attr: 'name' | 'property', key: string, value: string) => {
    if (!value) return;
    const re = new RegExp(`<meta\\s+${attr}="${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>`, 'i');
    const tag = `<meta ${attr}="${key}" content="${escAttr(value)}" />`;
    out = re.test(out) ? out.replace(re, tag) : out.replace(/<\/head>/i, `    ${tag}\n  </head>`);
  };
  setMeta('name', 'description', seo.description || '');
  setMeta('property', 'og:title', title);
  setMeta('property', 'og:description', seo.description || '');
  if (seo.keywords) setMeta('name', 'keywords', seo.keywords);
  if (seo.ogImage && isHttpsUrl(seo.ogImage)) setMeta('property', 'og:image', seo.ogImage);
  if (seo.robots) setMeta('name', 'robots', seo.robots);
  if (seo.gscVerification && /^[A-Za-z0-9_-]{10,100}$/.test(seo.gscVerification)) setMeta('name', 'google-site-verification', seo.gscVerification);
  const fav = s.branding?.favicon;
  if (fav && isHttpsUrl(fav)) {
    out = out.replace(/<link rel="icon"[^>]*>\s*/gi, '').replace(/<\/head>/i, `    <link rel="icon" href="${escAttr(fav)}" />\n  </head>`);
  }
  const ga = seo.gaId;
  if (ga && /^(G-[A-Z0-9]{4,15}|UA-\d{4,10}-\d{1,4})$/.test(ga) && !out.includes('googletagmanager.com/gtag/js')) {
    out = out.replace(
      /<\/head>/i,
      `    <script async src="https://www.googletagmanager.com/gtag/js?id=${ga}"></script>\n    <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${ga}');</script>\n  </head>`
    );
  }
  return out;
}

export function robotsTxt(seo: { robots?: string }): string {
  const allow = seo?.robots !== 'noindex,nofollow';
  const lines = ['User-agent: *', allow ? 'Disallow: /admin' : 'Disallow: /'];
  if (allow) lines.push('Disallow: /student', 'Disallow: /instructor', 'Disallow: /api/');
  return lines.join('\n') + '\n';
}
