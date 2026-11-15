/**
 * Transactional email templates: definitions, defaults, placeholder validation and safe rendering.
 * Templates are plain HTML with {{placeholders}}. There is no code execution of any kind: placeholders are
 * looked up in a fixed list and every value is HTML-escaped (except server-built lists such as course_list).
 * Unit-tested in tests/emailSystem.test.ts.
 */

export const TEMPLATE_IDS = [
  'welcome', 'email_verification', 'password_reset', 'magic_link', 'email_change', 'admin_invite', 'verification_code',
  'course_purchase', 'bundle_purchase', 'enrollment', 'certificate', 'course_completion', 'announcement', 'refund',
] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

/** Available in every template (filled by the server). */
export const GLOBAL_VARS = ['student_name', 'student_email', 'website_name', 'website_url', 'login_url', 'dashboard_url', 'support_email', 'support_phone', 'year'] as const;
/** Values that are already-safe HTML built by the server (never from user input directly). */
export const RAW_HTML_VARS = new Set(['course_list', 'announcement_body']);

export interface TemplateDef {
  id: TemplateId;
  label: string;
  group: 'Account' | 'Purchases & learning' | 'Communication';
  trigger: string;
  /** template-specific placeholders */
  vars: string[];
  /** must be present (non-empty) to send */
  required: string[];
  /** sent through the Supabase "Send Email" auth hook */
  authHook?: boolean;
  subject: string;
  html: string;
}

const btn = (url: string, label: string) =>
  `<p style="margin:24px 0;text-align:center"><a href="{{${url}}}" class="btn" style="display:inline-block;padding:13px 28px;background:{{brand_color}};color:#ffffff;text-decoration:none;font-weight:700;border-radius:999px">${label}</a></p>`;
const fallbackLink = (url: string) => `<p style="font-size:13px;color:#64748B">If the button doesn’t work, copy this link into your browser:<br><a href="{{${url}}}" style="color:#004AAD;word-break:break-all">{{${url}}}</a></p>`;

export const TEMPLATE_DEFS: TemplateDef[] = [
  {
    id: 'welcome', label: 'Welcome', group: 'Account', trigger: 'A new student account is confirmed (email sign-up after verification, or first Google sign-in). Sent once per account.',
    vars: [], required: ['student_name', 'login_url'],
    subject: 'Welcome to {{website_name}}, {{student_name}}!',
    html: `<h1>Welcome, {{student_name}}!</h1><p>Your {{website_name}} account is ready. Explore practical courses, learn at your own pace and earn certificates anyone can verify.</p>${btn('login_url', 'Start learning')}<p>Questions? Write to us at <a href="mailto:{{support_email}}">{{support_email}}</a>.</p>`,
  },
  {
    id: 'email_verification', label: 'Email verification', group: 'Account', authHook: true, trigger: 'A student signs up with email and password (Supabase Auth “confirm signup”).',
    vars: ['verification_url', 'otp_code'], required: ['verification_url'],
    subject: 'Confirm your {{website_name}} account',
    html: `<h1>Confirm your email</h1><p>Hi {{student_name}}, tap the button below to verify your email address and activate your account.</p>${btn('verification_url', 'Verify my email')}${fallbackLink('verification_url')}<p style="font-size:13px;color:#64748B">Didn’t create an account? You can ignore this email.</p>`,
  },
  {
    id: 'password_reset', label: 'Password reset', group: 'Account', authHook: true, trigger: 'A user asks to reset their password (website or app).',
    vars: ['reset_url', 'otp_code'], required: ['reset_url'],
    subject: 'Reset your {{website_name}} password',
    html: `<h1>Reset your password</h1><p>Hi {{student_name}}, we received a request to reset your password. The link expires soon.</p>${btn('reset_url', 'Choose a new password')}${fallbackLink('reset_url')}<p style="font-size:13px;color:#64748B">If you didn’t ask for this, ignore this email; your password stays the same.</p>`,
  },
  {
    id: 'magic_link', label: 'Magic sign-in link', group: 'Account', authHook: true, trigger: 'A user signs in with an email link (when magic-link login is enabled).',
    vars: ['login_link', 'otp_code'], required: ['login_link'],
    subject: 'Your {{website_name}} sign-in link',
    html: `<h1>Sign in to {{website_name}}</h1><p>Tap the button to sign in. The link can be used once and expires soon.</p>${btn('login_link', 'Sign in')}${fallbackLink('login_link')}`,
  },
  {
    id: 'email_change', label: 'Email address change', group: 'Account', authHook: true, trigger: 'A user changes the email address on their account.',
    vars: ['confirm_url', 'new_email', 'otp_code'], required: ['confirm_url'],
    subject: 'Confirm your new email address',
    html: `<h1>Confirm the email change</h1><p>Hi {{student_name}}, confirm that you want to use <strong>{{new_email}}</strong> for your {{website_name}} account.</p>${btn('confirm_url', 'Confirm email change')}${fallbackLink('confirm_url')}`,
  },
  {
    id: 'admin_invite', label: 'Account created by an administrator', group: 'Account', authHook: true, trigger: 'An administrator invites / creates an account (Supabase “invite user”).',
    vars: ['invite_url'], required: ['invite_url'],
    subject: 'You’ve been invited to {{website_name}}',
    html: `<h1>Your account is ready</h1><p>An administrator created a {{website_name}} account for {{student_email}}. Accept the invitation to set your password and sign in.</p>${btn('invite_url', 'Accept invitation')}${fallbackLink('invite_url')}`,
  },
  {
    id: 'verification_code', label: 'Security code', group: 'Account', authHook: true, trigger: 'Supabase asks the user to re-authenticate (one-time code).',
    vars: ['otp_code'], required: ['otp_code'],
    subject: 'Your {{website_name}} security code',
    html: `<h1>Your security code</h1><p>Use this code to confirm it’s you. It expires shortly.</p><p style="font-size:28px;font-weight:800;letter-spacing:6px;text-align:center">{{otp_code}}</p>`,
  },
  {
    id: 'course_purchase', label: 'Course purchase confirmation', group: 'Purchases & learning', trigger: 'The server has verified a course payment (includes course access, so no separate enrollment email is sent).',
    vars: ['course_name', 'course_list', 'order_id', 'amount', 'payment_date', 'transaction_id', 'course_url'], required: ['course_name', 'order_id', 'amount'],
    subject: 'Payment received: {{course_name}}',
    html: `<h1>Thank you for your purchase!</h1><p>Hi {{student_name}}, your payment was successful and you now have lifetime access.</p><table role="presentation" class="details" width="100%" cellpadding="0" cellspacing="0"><tr><td>Course</td><td><strong>{{course_name}}</strong></td></tr><tr><td>Amount paid</td><td><strong>{{amount}}</strong></td></tr><tr><td>Order ID</td><td>{{order_id}}</td></tr><tr><td>Transaction ID</td><td>{{transaction_id}}</td></tr><tr><td>Date</td><td>{{payment_date}}</td></tr></table>{{course_list}}${btn('course_url', 'Start learning')}`,
  },
  {
    id: 'bundle_purchase', label: 'Bundle purchase confirmation', group: 'Purchases & learning', trigger: 'The server has verified a bundle payment.',
    vars: ['bundle_name', 'course_list', 'order_id', 'amount', 'payment_date', 'transaction_id', 'course_url'], required: ['bundle_name', 'order_id', 'amount'],
    subject: 'Bundle purchased: {{bundle_name}}',
    html: `<h1>Your bundle is ready</h1><p>Hi {{student_name}}, thank you for purchasing <strong>{{bundle_name}}</strong>.</p><table role="presentation" class="details" width="100%" cellpadding="0" cellspacing="0"><tr><td>Bundle</td><td><strong>{{bundle_name}}</strong></td></tr><tr><td>Amount paid</td><td><strong>{{amount}}</strong></td></tr><tr><td>Order ID</td><td>{{order_id}}</td></tr><tr><td>Transaction ID</td><td>{{transaction_id}}</td></tr><tr><td>Date</td><td>{{payment_date}}</td></tr></table><p><strong>Included courses</strong></p>{{course_list}}${btn('dashboard_url', 'Go to my courses')}`,
  },
  {
    id: 'enrollment', label: 'Course enrollment', group: 'Purchases & learning', trigger: 'A student is enrolled without a payment (free course or enrolled by an admin).',
    vars: ['course_name', 'course_url'], required: ['course_name'],
    subject: 'You’re enrolled: {{course_name}}',
    html: `<h1>You’re enrolled!</h1><p>Hi {{student_name}}, you now have access to <strong>{{course_name}}</strong>.</p>${btn('course_url', 'Open the course')}<p>All your courses are in your <a href="{{dashboard_url}}">learning dashboard</a>.</p>`,
  },
  {
    id: 'certificate', label: 'Certificate issued', group: 'Purchases & learning', trigger: 'A certificate is generated for a student.',
    vars: ['course_name', 'certificate_code', 'certificate_url'], required: ['course_name', 'certificate_code'],
    subject: 'Your certificate for {{course_name}}',
    html: `<h1>Congratulations, {{student_name}}!</h1><p>Your certificate for <strong>{{course_name}}</strong> is ready.</p><p>Certificate code: <strong>{{certificate_code}}</strong></p>${btn('certificate_url', 'View & verify certificate')}`,
  },
  {
    id: 'course_completion', label: 'Course completed', group: 'Purchases & learning', trigger: 'A student completes every lesson of a course.',
    vars: ['course_name', 'certificate_url', 'course_url'], required: ['course_name'],
    subject: 'You completed {{course_name}} 🎉',
    html: `<h1>Well done, {{student_name}}!</h1><p>You finished every lesson of <strong>{{course_name}}</strong>. Claim your certificate now.</p>${btn('certificate_url', 'Claim my certificate')}`,
  },
  {
    id: 'announcement', label: 'Announcement', group: 'Communication', trigger: 'An administrator sends an announcement email from Email Templates.',
    vars: ['announcement_title', 'announcement_body'], required: ['announcement_title', 'announcement_body'],
    subject: '{{announcement_title}}',
    html: `<h1>{{announcement_title}}</h1>{{announcement_body}}${btn('website_url', 'Visit {{website_name}}')}`,
  },
  {
    id: 'refund', label: 'Refund confirmation', group: 'Purchases & learning', trigger: 'Razorpay reports a processed refund (webhook refund.processed).',
    vars: ['amount', 'order_id', 'transaction_id', 'refund_id', 'course_name'], required: ['amount'],
    subject: 'Your refund has been processed',
    html: `<h1>Refund processed</h1><p>Hi {{student_name}}, your refund of <strong>{{amount}}</strong> has been processed and should reach your account within 5–7 working days.</p><table role="presentation" class="details" width="100%" cellpadding="0" cellspacing="0"><tr><td>Course</td><td>{{course_name}}</td></tr><tr><td>Order ID</td><td>{{order_id}}</td></tr><tr><td>Refund ID</td><td>{{refund_id}}</td></tr></table>`,
  },
];

export const TEMPLATE_MAP = Object.fromEntries(TEMPLATE_DEFS.map((t) => [t.id, t])) as Record<TemplateId, TemplateDef>;
/** Layout-only placeholder (from Email settings), allowed everywhere. */
const LAYOUT_VARS = ['brand_color'];

export const allowedVars = (id: TemplateId) => new Set<string>([...GLOBAL_VARS, ...LAYOUT_VARS, ...(TEMPLATE_MAP[id]?.vars || [])]);

/** Placeholders used in a template string. */
export const placeholdersIn = (s: string) => [...new Set([...String(s || '').matchAll(/\{\{\s*([^{}]*?)\s*\}\}/g)].map((m) => m[1]))];

/** Unknown or malformed placeholders (e.g. {{ process.env }}, {{constructor}}). */
export function unknownPlaceholders(id: TemplateId, subject: string, html: string): string[] {
  const ok = allowedVars(id);
  return [...placeholdersIn(subject), ...placeholdersIn(html)].filter((p) => !ok.has(p));
}

const escapeHtml = (v: unknown) =>
  String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/**
 * Renders placeholders. Values come only from the `vars` object (own properties), are HTML-escaped, and
 * unknown placeholders render as empty text. Nothing is evaluated.
 */
export function render(tpl: string, vars: Record<string, unknown>, mode: 'html' | 'text'): string {
  return String(tpl || '').replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_m, key: string) => {
    if (!Object.prototype.hasOwnProperty.call(vars, key)) return '';
    const v = vars[key];
    if (mode === 'text') return String(v ?? '').replace(/<[^>]+>/g, '');
    return RAW_HTML_VARS.has(key) ? String(v ?? '') : escapeHtml(v);
  });
}

/** Missing required values for a template (send is refused rather than sending a broken email). */
export function missingRequired(id: TemplateId, vars: Record<string, unknown>): string[] {
  return (TEMPLATE_MAP[id]?.required || []).filter((k) => vars[k] === undefined || vars[k] === null || String(vars[k]).trim() === '');
}

/** Server-built course list (titles escaped, links must be https). */
export function courseListHtml(items: { title: string; url?: string | null }[]): string {
  if (!items.length) return '';
  const li = items
    .map((c) => {
      const t = escapeHtml(c.title);
      return `<li style="margin:4px 0">${c.url && /^https:\/\/[^\s"<>]+$/.test(c.url) ? `<a href="${escapeHtml(c.url)}" style="color:#004AAD">${t}</a>` : t}</li>`;
    })
    .join('');
  return `<ul style="padding-left:20px;margin:12px 0">${li}</ul>`;
}

/** Plain text → safe paragraphs (for announcement bodies). */
export const paragraphsHtml = (text: string) =>
  String(text || '')
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p.trim()).replace(/\n/g, '<br>')}</p>`)
    .join('');

export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href, label) => `${label.replace(/<[^>]+>/g, '')} (${href})`)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|h1|h2|h3|li|tr|table|div)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export interface LayoutOptions { siteName: string; logoUrl?: string; brandColor: string; footerText: string; supportEmail?: string; supportPhone?: string; websiteUrl?: string }

/** Responsive, email-client-safe wrapper (tables + inline styles). */
export function layout(body: string, o: LayoutOptions, preheader = ''): string {
  const color = /^#[0-9a-fA-F]{6}$/.test(o.brandColor) ? o.brandColor : '#004AAD';
  const logo = o.logoUrl && /^https:\/\/[^\s"<>]+$/.test(o.logoUrl) ? `<img src="${escapeHtml(o.logoUrl)}" width="64" height="64" alt="${escapeHtml(o.siteName)}" style="display:block;margin:0 auto 8px;border:0;outline:none">` : '';
  const contact = [o.supportEmail ? `<a href="mailto:${escapeHtml(o.supportEmail)}" style="color:#64748B">${escapeHtml(o.supportEmail)}</a>` : '', o.supportPhone ? escapeHtml(o.supportPhone) : ''].filter(Boolean).join(' · ');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(o.siteName)}</title>
<style>body{margin:0;padding:0;background:#F7F9FC}h1{font-size:22px;line-height:1.3;margin:0 0 12px;color:#111827}p{margin:0 0 14px}table.details td{padding:8px 0;border-bottom:1px solid #EEF2F7;font-size:14px;vertical-align:top}table.details td:first-child{color:#64748B;width:40%}@media (max-width:600px){.container{width:100%!important;border-radius:0!important}.inner{padding:20px!important}}</style></head>
<body style="margin:0;padding:0;background:#F7F9FC"><span style="display:none!important;opacity:0;color:transparent;height:0;width:0;overflow:hidden">${escapeHtml(preheader)}</span>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F7F9FC;padding:24px 0"><tr><td align="center">
<table role="presentation" class="container" width="560" cellspacing="0" cellpadding="0" style="width:560px;max-width:560px;background:#ffffff;border:1px solid #E2E8F0;border-radius:20px;font-family:Inter,Segoe UI,Roboto,Arial,sans-serif;color:#334155;font-size:15px;line-height:1.6">
<tr><td style="padding:28px 32px 8px;text-align:center;border-bottom:4px solid ${color}">${logo}<div style="font-size:19px;font-weight:800;color:${color}">${escapeHtml(o.siteName)}</div></td></tr>
<tr><td class="inner" style="padding:24px 32px 8px">${body}</td></tr>
<tr><td style="padding:18px 32px 26px;font-size:12px;color:#94A3B8;text-align:center;line-height:1.5">${contact ? `${contact}<br>` : ''}${escapeHtml(o.footerText)}</td></tr>
</table></td></tr></table></body></html>`;
}
