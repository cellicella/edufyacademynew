/**
 * Supabase Auth "Send Email" hook (HTTPS). When enabled in Supabase (Authentication → Hooks), Supabase stops
 * sending its own emails and calls POST /api/auth/email-hook for sign-up confirmation, password reset,
 * magic link, invite, email change and re-authentication codes. We verify the Standard Webhooks signature,
 * build the link on the configured domain, and queue the email (sent by the outbox worker via SMTP).
 */
import crypto from 'crypto';
import type { Express, Request, Response } from 'express';
import type { EmailService } from './email';
import type { CredentialStore } from './credentials';
import type { TemplateId } from './emailTemplates';
import { activeUrls, isAllowedRedirect, type DomainSettings } from './domain';

/** Verifies a Standard Webhooks signature. `secrets` may contain several "v1,whsec_…" values separated by "|". */
export function verifyStandardWebhook(secrets: string, headers: Record<string, any>, rawBody: string, nowSec = Math.floor(Date.now() / 1000)): boolean {
  const id = String(headers['webhook-id'] || '');
  const ts = String(headers['webhook-timestamp'] || '');
  const sigHeader = String(headers['webhook-signature'] || '');
  if (!id || !/^\d{1,12}$/.test(ts) || !sigHeader) return false;
  if (Math.abs(nowSec - Number(ts)) > 300) return false; // replay protection: 5 minutes
  const provided = sigHeader.split(' ').map((s) => s.trim()).filter((s) => s.startsWith('v1,')).map((s) => s.slice(3));
  for (const raw of secrets.split('|').map((s) => s.trim()).filter(Boolean)) {
    const b64 = raw.replace(/^v1,/, '').replace(/^whsec_/, '');
    let key: Buffer;
    try {
      key = Buffer.from(b64, 'base64');
    } catch {
      continue;
    }
    if (!key.length) continue;
    const expected = crypto.createHmac('sha256', key).update(`${id}.${ts}.${rawBody}`).digest();
    for (const p of provided) {
      let got: Buffer;
      try {
        got = Buffer.from(p, 'base64');
      } catch {
        continue;
      }
      if (got.length === expected.length && crypto.timingSafeEqual(got, expected)) return true;
    }
  }
  return false;
}

export const isHookSecret = (v: string) => /^v1,whsec_[A-Za-z0-9+/=]{32,88}$/.test(v);
export const generateHookSecret = () => `v1,whsec_${crypto.randomBytes(32).toString('base64')}`;

interface HookEmail { template: TemplateId; to: string; vars: Record<string, string>; key: string }

/**
 * Maps a hook payload to the emails to queue. Links point to Supabase's verify endpoint with a redirect that
 * is checked against the configured domains (never localhost in production).
 */
export function emailsForHook(
  payload: any,
  o: { supabaseUrl: string; domain: DomainSettings; fallbackSiteUrl: string; production: boolean }
): { emails: HookEmail[]; error?: string } {
  const user = payload?.user || {};
  const d = payload?.email_data || {};
  const action = String(d.email_action_type || '');
  const urls = activeUrls(o.domain, o.fallbackSiteUrl);
  const name = String(user.user_metadata?.full_name || user.user_metadata?.name || (user.email || '').split('@')[0] || 'there').slice(0, 80);
  const hashKey = (s: string) => crypto.createHash('sha256').update(s || '').digest('hex').slice(0, 16);

  const safeRedirect = (fallback: string): string | null => {
    const r = String(d.redirect_to || '');
    if (r && isAllowedRedirect(r, o.domain, { production: o.production, fallbackSiteUrl: o.fallbackSiteUrl })) return r;
    if (fallback) return fallback;
    const site = String(d.site_url || '');
    if (site && isAllowedRedirect(site, o.domain, { production: o.production, fallbackSiteUrl: site })) return site;
    return null;
  };
  const verifyUrl = (tokenHash: string, type: string, redirect: string) =>
    `${o.supabaseUrl.replace(/\/+$/, '')}/auth/v1/verify?${new URLSearchParams({ token: tokenHash, type, redirect_to: redirect }).toString()}`;

  const base = { student_name: name, student_email: String(user.email || '') };
  const one = (template: TemplateId, to: string, vars: Record<string, string>, tokenHash: string): HookEmail => ({
    template, to, vars: { ...base, ...vars }, key: `auth:${action}:${user.id || to}:${hashKey(tokenHash || vars.otp_code || '')}`,
  });

  switch (action) {
    case 'signup': {
      const r = safeRedirect(urls.authCallbackUrl);
      if (!r) return { emails: [], error: 'No allowed redirect URL: set the website URL in Settings → Domain & Environment.' };
      return { emails: [one('email_verification', user.email, { verification_url: verifyUrl(d.token_hash, 'signup', r), otp_code: d.token || '' }, d.token_hash)] };
    }
    case 'recovery': {
      const r = safeRedirect(urls.resetPasswordUrl);
      if (!r) return { emails: [], error: 'No allowed redirect URL for password reset.' };
      return { emails: [one('password_reset', user.email, { reset_url: verifyUrl(d.token_hash, 'recovery', r), otp_code: d.token || '' }, d.token_hash)] };
    }
    case 'magiclink': {
      const r = safeRedirect(urls.authCallbackUrl);
      if (!r) return { emails: [], error: 'No allowed redirect URL.' };
      return { emails: [one('magic_link', user.email, { login_link: verifyUrl(d.token_hash, 'magiclink', r), otp_code: d.token || '' }, d.token_hash)] };
    }
    case 'invite': {
      const r = safeRedirect(urls.authCallbackUrl);
      if (!r) return { emails: [], error: 'No allowed redirect URL.' };
      return { emails: [one('admin_invite', user.email, { invite_url: verifyUrl(d.token_hash, 'invite', r) }, d.token_hash)] };
    }
    case 'email_change': {
      const r = safeRedirect(urls.authCallbackUrl);
      if (!r) return { emails: [], error: 'No allowed redirect URL.' };
      const newEmail = String(user.new_email || user.email_new || '');
      const out: HookEmail[] = [];
      // Secure email change: current address confirms with token_hash_new, new address with token_hash (Supabase convention)
      if (d.token_hash_new && user.email) out.push(one('email_change', user.email, { confirm_url: verifyUrl(d.token_hash_new, 'email_change', r), new_email: newEmail }, d.token_hash_new));
      if (d.token_hash && (newEmail || user.email)) out.push(one('email_change', newEmail || user.email, { confirm_url: verifyUrl(d.token_hash, 'email_change', r), new_email: newEmail }, d.token_hash));
      return { emails: out };
    }
    case 'reauthentication':
      return { emails: [one('verification_code', user.email, { otp_code: String(d.token || '') }, String(d.token || ''))] };
    default:
      // Security notifications (password changed, identity linked, …): nothing to send from our side
      return { emails: [] };
  }
}

export function registerAuthEmailHook(app: Express, deps: {
  email: EmailService;
  credentials: CredentialStore;
  envSecret?: string;
  supabaseUrl: string;
  getDomain: () => Promise<{ domain: DomainSettings; fallbackSiteUrl: string }>;
}) {
  app.post('/api/auth/email-hook', async (req: Request, res: Response) => {
    const fail = (status: number, message: string) => res.status(status).json({ error: { http_code: status, message } });
    try {
      const stored = await deps.credentials.load('auth_hook', 'active');
      const secret = stored?.secrets?.secret || deps.envSecret || '';
      if (!secret) return fail(503, 'Email hook secret is not configured on the Edufy server.');
      const raw = (req as any).rawBody ? Buffer.from((req as any).rawBody).toString('utf8') : JSON.stringify(req.body || {});
      if (!verifyStandardWebhook(secret, req.headers as any, raw)) return fail(401, 'Invalid webhook signature.');
      const { domain, fallbackSiteUrl } = await deps.getDomain();
      const production = process.env.NODE_ENV === 'production' || domain.activeProfile === 'production';
      const { emails, error } = emailsForHook(req.body, { supabaseUrl: deps.supabaseUrl, domain, fallbackSiteUrl, production });
      if (error) return fail(500, error);
      if (emails.length && !(await deps.email.transport('active'))) return fail(503, 'No email provider is configured on the Edufy server (Settings → SMTP & Email).');
      for (const e of emails) await deps.email.enqueue(e.template, { to: e.to, userId: req.body?.user?.id || null, eventKey: e.key, vars: e.vars, priority: 0 });
      return res.json({});
    } catch (e: any) {
      console.error('[AuthHook] failed:', e?.message || e);
      return fail(500, 'Email hook failed.');
    }
  });
}
