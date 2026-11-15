/**
 * Email service: SMTP (or Resend / Brevo API) transport, template composition and a durable outbox.
 *
 * Every transactional email is written to public.email_outbox first (idempotent per event_key), then sent by
 * a background worker with retries and backoff. Payment verification and enrollment never wait for email:
 * if the provider is down, the email stays queued and is retried. Credentials come from the encrypted
 * credential store (Admin → Settings → SMTP & Email) or the server environment, and are never logged.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CredentialStore } from './credentials';
import { isEmail } from './settingsSchema';
import { SmtpError, SmtpSecurity, sendMail, type SmtpStage } from './smtp';
import { TEMPLATE_IDS, TEMPLATE_MAP, type TemplateId, htmlToText, layout, missingRequired, render } from './emailTemplates';
import type { ActiveUrls } from './domain';

export type EmailProvider = 'smtp' | 'resend' | 'brevo';
export const EMAIL_PROVIDERS: EmailProvider[] = ['smtp', 'resend', 'brevo'];

export interface TransportConfig {
  provider: EmailProvider;
  source: 'admin' | 'env';
  host?: string; port?: number; security?: SmtpSecurity; username?: string; password?: string;
  apiKey?: string;
}

export interface OutgoingMessage { fromName: string; fromEmail: string; replyTo?: string; to: string; subject: string; html: string; text: string }
export interface SendOutcome { ok: boolean; temporary: boolean; response: string; messageId?: string; stages?: SmtpStage[] }

const BACKOFF_SECONDS = [60, 300, 900, 3600, 10800];
export const backoffSeconds = (attempts: number) => BACKOFF_SECONDS[Math.min(Math.max(attempts, 1), BACKOFF_SECONDS.length) - 1];

/** Never let a secret reach a log line or the database. */
export function redact(text: string, secrets: (string | undefined)[]): string {
  let out = String(text || '');
  for (const s of secrets) if (s && s.length >= 4) out = out.split(s).join('[redacted]');
  return out.slice(0, 500);
}

export async function deliver(cfg: TransportConfig, msg: OutgoingMessage, opts: { rejectUnauthorized?: boolean } = {}): Promise<SendOutcome> {
  const secrets = [cfg.password, cfg.apiKey];
  if (cfg.provider === 'smtp') {
    try {
      const r = await sendMail(
        { host: cfg.host!, port: cfg.port!, security: cfg.security || 'starttls', username: cfg.username, password: cfg.password, rejectUnauthorized: opts.rejectUnauthorized },
        msg
      );
      return { ok: true, temporary: false, response: redact(r.response, secrets), messageId: r.messageId, stages: r.stages };
    } catch (e: any) {
      const se = e instanceof SmtpError ? e : new SmtpError(String(e?.message || e), 'connect', null, true);
      return { ok: false, temporary: se.temporary, response: redact(`${se.stage}: ${se.message}`, secrets), stages: [] };
    }
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    let res: globalThis.Response;
    if (cfg.provider === 'resend') {
      res = await fetch('https://api.resend.com/emails', {
        method: 'POST', signal: ctrl.signal,
        headers: { Authorization: `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: `${msg.fromName} <${msg.fromEmail}>`, to: [msg.to], subject: msg.subject, html: msg.html, text: msg.text, ...(msg.replyTo ? { reply_to: msg.replyTo } : {}) }),
      });
    } else {
      res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST', signal: ctrl.signal,
        headers: { 'api-key': cfg.apiKey || '', 'Content-Type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ sender: { name: msg.fromName, email: msg.fromEmail }, to: [{ email: msg.to }], subject: msg.subject, htmlContent: msg.html, textContent: msg.text, ...(msg.replyTo ? { replyTo: { email: msg.replyTo } } : {}) }),
      });
    }
    const body = await res.text().catch(() => '');
    let id: string | undefined;
    let detail = body.slice(0, 200);
    try {
      const j = JSON.parse(body);
      id = j?.id || j?.messageId;
      detail = j?.message || j?.error?.message || j?.name || detail;
    } catch {
      /* not JSON */
    }
    if (!res.ok) return { ok: false, temporary: res.status === 429 || res.status >= 500, response: redact(`${cfg.provider} HTTP ${res.status}: ${detail}`, secrets) };
    return { ok: true, temporary: false, response: `${cfg.provider} HTTP ${res.status}${id ? ` id=${id}` : ''}`, messageId: id };
  } catch (e: any) {
    return { ok: false, temporary: true, response: redact(`${cfg.provider}: ${e?.name === 'AbortError' ? 'timeout' : e?.message || e}`, secrets) };
  } finally {
    clearTimeout(timer);
  }
}

/** Derived links from ids stored with the event (course page, certificate verification). */
/** Turns a test-send outcome into the step list the admin panel shows (connection → TLS → auth → sender → recipient → accepted). */
export function smtpTestSteps(r: { ok: boolean; response: string; provider: string; security?: string | null; auth?: boolean }) {
  if (r.provider !== 'smtp') return [{ id: 'send', label: `Send via ${r.provider}`, status: r.ok ? 'pass' : 'fail', detail: r.ok ? `Accepted: ${r.response}. Check the inbox (and spam folder).` : r.response }];
  const rows: { id: string; label: string; skip?: string }[] = [
    { id: 'connect', label: 'SMTP connection' },
    { id: 'tls', label: 'Encryption (TLS)', skip: r.security === 'none' ? 'Not encrypted (local relay only)' : undefined },
    { id: 'auth', label: 'Authentication', skip: r.auth ? undefined : 'No username set: not required' },
    { id: 'sender', label: 'Sender address accepted' },
    { id: 'recipient', label: 'Recipient accepted' },
    { id: 'accepted', label: 'Message accepted for delivery' },
  ];
  const stageRow: Record<string, string> = { connect: 'connect', greeting: 'connect', ehlo: 'connect', tls: 'tls', starttls: 'tls', auth: 'auth', sender: 'sender', recipient: 'recipient', data: 'accepted' };
  const failedRow = r.ok ? '' : stageRow[r.response.split(':')[0]] || 'connect';
  const failIdx = rows.findIndex((x) => x.id === failedRow);
  return rows.map((x, i) => {
    if (!r.ok && i === failIdx) return { id: x.id, label: x.label, status: 'fail', detail: r.response.replace(/^[a-z]+: /, '') };
    if (!r.ok && i > failIdx) return { id: x.id, label: x.label, status: 'manual', detail: 'Not reached' };
    if (x.skip) return { id: x.id, label: x.label, status: 'manual', detail: x.skip };
    return { id: x.id, label: x.label, status: 'pass', detail: x.id === 'accepted' ? `Server reply: ${r.response}. Check the inbox (and spam folder).` : 'OK' };
  });
}

export function enrichVars(vars: Record<string, unknown>, siteUrl: string): Record<string, unknown> {
  const out: Record<string, unknown> = { ...vars };
  const site = (siteUrl || '').replace(/\/+$/, '');
  if (!site) return out;
  const cid = typeof vars.course_id === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(vars.course_id) ? vars.course_id : '';
  if (cid && !out.course_url) out.course_url = `${site}/learn/${cid}`;
  if (cid && !out.certificate_url && !vars.certificate_code) out.certificate_url = `${site}/student/certificates`;
  if (typeof vars.certificate_code === 'string' && vars.certificate_code && !out.certificate_url) out.certificate_url = `${site}/verify-certificate?code=${encodeURIComponent(vars.certificate_code)}`;
  if (!out.course_url && (vars.course_list || vars.bundle_name)) out.course_url = `${site}/student/courses`;
  return out;
}

export interface EnqueueInput {
  to: string | null | undefined;
  userId?: string | null;
  /** Idempotency key: the same key is only ever queued once (e.g. purchase:<order_id>). */
  eventKey: string;
  vars?: Record<string, unknown>;
  priority?: number;
}

export function createEmailService(deps: {
  db: SupabaseClient | null;
  credentials: CredentialStore;
  env: { provider?: string; apiKey?: string; smtpHost?: string; smtpPort?: string; smtpSecurity?: string; smtpUsername?: string; smtpPassword?: string };
  getSettings: () => Promise<Record<string, any>>;
  getUrls: () => Promise<ActiveUrls>;
  workerEnabled?: boolean;
  /** tests only */
  rejectUnauthorized?: boolean;
}) {
  const { db } = deps;

  async function transport(slot: 'active' | 'pending' = 'active'): Promise<TransportConfig | null> {
    const rec = await deps.credentials.load('email', slot);
    const p = rec?.publicConfig?.provider as EmailProvider | undefined;
    if (rec && p === 'smtp' && rec.publicConfig.host) {
      return { provider: 'smtp', source: 'admin', host: rec.publicConfig.host, port: Number(rec.publicConfig.port) || 587, security: (rec.publicConfig.security as SmtpSecurity) || 'starttls', username: rec.publicConfig.username || undefined, password: rec.secrets.password };
    }
    if (rec && (p === 'resend' || p === 'brevo') && rec.secrets.apiKey) return { provider: p, source: 'admin', apiKey: rec.secrets.apiKey };
    if (slot === 'pending') return null;
    const e = deps.env;
    if (e.smtpHost) {
      return { provider: 'smtp', source: 'env', host: e.smtpHost, port: Number(e.smtpPort) || 587, security: (['ssl', 'starttls', 'none'].includes(String(e.smtpSecurity)) ? e.smtpSecurity : Number(e.smtpPort) === 465 ? 'ssl' : 'starttls') as SmtpSecurity, username: e.smtpUsername || undefined, password: e.smtpPassword };
    }
    const ep = String(e.provider || '').toLowerCase();
    if ((ep === 'resend' || ep === 'brevo') && e.apiKey) return { provider: ep, source: 'env', apiKey: e.apiKey };
    return null;
  }

  /** Global placeholders + layout for a message. */
  async function context() {
    const s = await deps.getSettings();
    const u = await deps.getUrls();
    const email = s.email || {};
    const supportEmail = email.supportEmail || s.contact?.supportEmail || email.replyTo || '';
    const year = String(new Date().getFullYear());
    return {
      settings: s,
      enabled: email.enabled !== false,
      sender: { fromName: email.senderName || s.general?.siteName || 'Edufy Academy', fromEmail: email.senderEmail || '', replyTo: email.replyTo || supportEmail || undefined },
      globals: {
        website_name: s.general?.siteName || 'Edufy Academy', website_url: u.siteUrl, login_url: u.loginUrl, dashboard_url: u.dashboardUrl,
        support_email: supportEmail, support_phone: s.contact?.primaryPhone || '', year, brand_color: email.brandColor || '#004AAD',
      } as Record<string, string>,
      layout: {
        siteName: s.general?.siteName || 'Edufy Academy', logoUrl: s.branding?.emailLogo || s.branding?.logoMain || '', brandColor: email.brandColor || '#004AAD',
        footerText: String(email.footerText || '').replace('{year}', year), supportEmail, supportPhone: s.contact?.primaryPhone || '', websiteUrl: u.siteUrl,
      },
    };
  }

  /** Builds the email for a template. `override` lets the admin preview unsaved edits. */
  async function compose(templateId: TemplateId, vars: Record<string, unknown>, override?: { subject: string; html: string }) {
    const ctx = await context();
    const tpl = override ? { enabled: true, ...override } : ctx.settings.email?.templates?.[templateId];
    const all: Record<string, unknown> = { ...ctx.globals, student_name: 'there', ...enrichVars(vars, ctx.globals.website_url) };
    const subject = render(tpl?.subject || '', all, 'text').replace(/[\r\n]+/g, ' ').slice(0, 150);
    const body = render(tpl?.html || '', all, 'html');
    const html = layout(body, ctx.layout, subject);
    return { enabled: ctx.enabled && tpl?.enabled !== false, subject, html, text: htmlToText(body), sender: ctx.sender, missing: missingRequired(templateId, all) };
  }

  async function enqueue(templateId: TemplateId, input: EnqueueInput): Promise<{ queued: boolean; reason?: string }> {
    if (!db) return { queued: false, reason: 'database unavailable' };
    if (!TEMPLATE_IDS.includes(templateId)) return { queued: false, reason: 'unknown template' };
    const to = String(input.to || '').trim().toLowerCase();
    if (!isEmail(to)) return { queued: false, reason: 'invalid recipient' };
    const { error } = await db.from('email_outbox').insert({
      event_key: input.eventKey.slice(0, 200), template: templateId, to_email: to, user_id: input.userId || null, vars: input.vars || {},
      status: 'queued', priority: input.priority ?? (TEMPLATE_MAP[templateId].authHook ? 0 : 5), next_attempt_at: new Date().toISOString(),
    });
    if (error) {
      if (/duplicate|unique/i.test(error.message)) return { queued: false, reason: 'already queued' };
      console.error(`[Email] enqueue ${templateId} failed: ${error.message}`);
      return { queued: false, reason: error.message };
    }
    kick();
    return { queued: true };
  }

  async function claim(limit: number): Promise<any[]> {
    if (!db) return [];
    const { data, error } = await db.rpc('claim_email_outbox', { p_limit: limit });
    if (error) {
      if (!/does not exist|schema cache/i.test(error.message)) console.warn('[Email] claim failed:', error.message);
      return [];
    }
    return (data || []) as any[];
  }

  async function finish(id: string, patch: Record<string, unknown>) {
    await db!.from('email_outbox').update({ ...patch, locked_at: null, updated_at: new Date().toISOString() }).eq('id', id);
  }

  /** Sends one claimed row (attempts already incremented by the claim). */
  async function processRow(row: any) {
    const id = row.template as TemplateId;
    if (!TEMPLATE_IDS.includes(id)) return finish(row.id, { status: 'failed', last_error: `Unknown template "${row.template}".` });
    const m = await compose(id, { student_email: row.to_email, ...(row.vars || {}) });
    if (!m.enabled) return finish(row.id, { status: 'skipped', last_error: 'Email sending or this template is turned off in Settings.' });
    if (m.missing.length) return finish(row.id, { status: 'failed', last_error: `Missing values: ${m.missing.join(', ')}. Check Domain & Environment / the event data.` });
    if (!m.sender.fromEmail) return finish(row.id, { status: 'failed', last_error: 'Sender email is not set (Settings → SMTP & Email).' });
    const cfg = await transport('active');
    if (!cfg) return finish(row.id, { status: 'skipped', last_error: 'No email provider configured (Settings → SMTP & Email).' });
    const r = await deliver(cfg, { ...m.sender, to: row.to_email, subject: m.subject, html: m.html, text: m.text }, { rejectUnauthorized: deps.rejectUnauthorized });
    if (r.ok) return finish(row.id, { status: 'sent', sent_at: new Date().toISOString(), provider: cfg.provider, provider_response: r.response, message_id: r.messageId || null, last_error: null });
    const attempts = Number(row.attempts) || 1;
    const maxAttempts = Number(row.max_attempts) || 5;
    if (r.temporary && attempts < maxAttempts) {
      return finish(row.id, { status: 'queued', provider: cfg.provider, provider_response: r.response, last_error: r.response, next_attempt_at: new Date(Date.now() + backoffSeconds(attempts) * 1000).toISOString() });
    }
    return finish(row.id, { status: 'failed', provider: cfg.provider, provider_response: r.response, last_error: r.response });
  }

  let current: Promise<void> | null = null;
  let again = false;
  let kickTimer: NodeJS.Timeout | null = null;
  const state = { lastRunAt: null as string | null, lastError: null as string | null };

  async function runOnce() {
    try {
      for (let round = 0; round < 5; round++) {
        const rows = await claim(10);
        if (!rows.length) break;
        for (const row of rows) {
          try {
            await processRow(row);
          } catch (e: any) {
            await finish(row.id, { status: 'queued', last_error: String(e?.message || e).slice(0, 300), next_attempt_at: new Date(Date.now() + 60_000).toISOString() }).catch(() => undefined);
          }
        }
      }
      state.lastRunAt = new Date().toISOString();
      state.lastError = null;
    } catch (e: any) {
      state.lastError = String(e?.message || e).slice(0, 300);
    }
  }

  /** Processes due emails. Concurrent calls share the running pass (which repeats if more work arrived meanwhile). */
  function tick(): Promise<void> {
    if (!db) return Promise.resolve();
    if (current) {
      again = true;
      return current;
    }
    current = (async () => {
      do {
        again = false;
        await runOnce();
      } while (again);
    })().finally(() => {
      current = null;
    });
    return current;
  }
  function kick() {
    if (kickTimer) return;
    kickTimer = setTimeout(() => {
      kickTimer = null;
      void tick();
    }, 300);
    kickTimer.unref?.();
  }
  if (deps.workerEnabled !== false && db) {
    setInterval(() => void tick(), 15_000).unref();
    setTimeout(() => void tick(), 4_000).unref();
  }

  return {
    transport,
    compose,
    enqueue,
    tick,
    state,

    /** Admin: send a test message with the active or pending provider; reports each SMTP stage. */
    async sendTest(to: string, slot: 'active' | 'pending' = 'active') {
      if (!isEmail(to)) throw new Error('Enter a valid email address to send the test to.');
      const cfg = await transport(slot);
      if (!cfg) throw new Error(slot === 'pending' ? 'Save the new email settings first.' : 'No email provider is configured.');
      const ctx = await context();
      if (!ctx.sender.fromEmail) throw new Error('Set the sender email first (it must be allowed to send from your SMTP account / provider).');
      const body = `<h1>Test email</h1><p>This is a test from the ${ctx.layout.siteName} admin panel. If you can read this, your email settings work.</p><p style="font-size:13px;color:#64748B">Provider: ${cfg.provider.toUpperCase()}${cfg.host ? ` · ${cfg.host}:${cfg.port} (${cfg.security})` : ''}</p>`;
      const r = await deliver(cfg, { ...ctx.sender, to, subject: `${ctx.layout.siteName}: test email`, html: layout(body, ctx.layout, 'Test email'), text: htmlToText(body) }, { rejectUnauthorized: deps.rejectUnauthorized });
      return { ...r, provider: cfg.provider, source: cfg.source, security: cfg.security || null, auth: !!cfg.username };
    },
  };
}

export type EmailService = ReturnType<typeof createEmailService>;
