/**
 * Centralized settings: public API, protected admin API, encrypted credentials, media library,
 * permissions and audit log.
 *
 *   GET    /api/settings/public                         public, non-sensitive (website + app), cached + ETag
 *   GET    /api/admin/settings                          everything the signed-in admin may manage
 *   PUT    /api/admin/settings/:section                 validate → save → audit → invalidate caches
 *   GET    /api/admin/settings/audit                    audit log
 *   GET    /api/admin/settings/credentials/:provider    masked view (razorpay | email | emovur)
 *   POST   /api/admin/settings/credentials/:provider    save as *pending* (never used until tested + activated)
 *   POST   /api/admin/settings/credentials/:provider/test
 *   POST   /api/admin/settings/credentials/:provider/activate
 *   DELETE /api/admin/settings/credentials/:provider    discard pending / revert active to environment keys
 *   POST   /api/admin/settings/email/test | /email/preview
 *   GET|POST|PUT|DELETE /api/admin/media                media library (Supabase Storage bucket "site-assets")
 *   GET|PUT|DELETE /api/admin/settings/permissions      super admins only
 *   POST   /api/email/welcome                           signed-in user, sends the welcome email once
 */
import crypto from 'crypto';
import type { Express, Request, Response } from 'express';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  ALL_SECTIONS, DEFAULTS, EMAIL_TEMPLATES, SectionId, diffSettings, publicSettings, sanitizeEmailHtml, validateSection, withDefaults, isHttpsUrl, cleanString,
} from './settingsSchema';
import type { CredentialStore, Provider } from './credentials';
import { KEY_ID_RE, modeOf, testRazorpayCredentials, type PaymentGateway } from './paymentGateway';
import { EMAIL_PROVIDERS, smtpTestSteps, type EmailService } from './email';
import { TEMPLATE_DEFS, TEMPLATE_IDS, TEMPLATE_MAP, type TemplateId, courseListHtml, paragraphsHtml } from './emailTemplates';
import { activeUrls, requiredRedirects, type DomainSettings } from './domain';
import { mergeAllowList, parseAllowList, type ManagementClient } from './supabaseManagement';
import { generateHookSecret, isHookSecret } from './authHook';
import { ASSET_TYPES, AssetType, safeFileStem, validateUpload } from './mediaLogic';
import type { ImageService } from './images';

export const PERMISSION_SECTIONS = ['general', 'branding', 'banners', 'media', 'contact', 'social', 'payment', 'whatsapp', 'email', 'seo', 'app', 'notifications', 'maintenance', 'audit'] as const;
export type PermissionSection = (typeof PERMISSION_SECTIONS)[number];

export class SettingsHttpError extends Error {
  constructor(public status: number, message: string, public extra?: Record<string, unknown>) {
    super(message);
  }
}

// ------------------------------------------------------------------ settings service (cache + persistence)
export function createSettingsService(db: SupabaseClient | null) {
  let cache: { at: number; rows: Record<string, { value: any; is_public: boolean; updated_at: string; version: number }> } | null = null;
  let publicCache: { body: string; etag: string; at: number } | null = null;
  const listeners = new Set<(section: string) => void>();
  const TTL = 30_000;
  let missingTable = false;

  async function rows(fresh = false) {
    if (!fresh && cache && Date.now() - cache.at < TTL) return cache.rows;
    const out: Record<string, any> = {};
    if (db) {
      const { data, error } = await db.from('site_settings').select('section, value, is_public, updated_at, version');
      if (error) {
        missingTable = /does not exist|schema cache/i.test(error.message);
        if (!missingTable) console.error('[Settings] load failed:', error.message);
        if (cache) return cache.rows; // keep serving the last good copy
      } else {
        missingTable = false;
        for (const r of data || []) out[r.section] = r;
      }
    }
    cache = { at: Date.now(), rows: out };
    return out;
  }

  const storedValues = async (fresh = false) => Object.fromEntries(Object.entries(await rows(fresh)).map(([k, r]) => [k, r.value]));

  function invalidate(section?: string) {
    cache = null;
    publicCache = null;
    for (const l of listeners) l(section || '*');
  }

  return {
    get migrationMissing() {
      return missingTable;
    },
    rows,
    async getAll() {
      return withDefaults(await storedValues());
    },
    async getPublic() {
      if (publicCache && Date.now() - publicCache.at < TTL) return publicCache;
      const r = await rows();
      const pub = publicSettings(Object.fromEntries(Object.entries(r).filter(([, v]) => v.is_public !== false).map(([k, v]) => [k, v.value])));
      const updatedAt = Object.values(r).reduce((m, v) => (v.updated_at > m ? v.updated_at : m), '1970-01-01T00:00:00Z');
      const body = JSON.stringify({ settings: pub, updatedAt, source: 'api' });
      publicCache = { body, etag: `"${crypto.createHash('sha1').update(body).digest('hex').slice(0, 20)}"`, at: Date.now() };
      return publicCache;
    },
    async save(section: SectionId, value: any, userId: string | null) {
      if (!db) throw new SettingsHttpError(503, 'Database unavailable.');
      const current = (await rows(true))[section];
      const { error } = await db.from('site_settings').upsert(
        { section, value, is_public: section !== 'email', version: (current?.version || 0) + 1, updated_at: new Date().toISOString(), updated_by: userId },
        { onConflict: 'section' }
      );
      if (error) {
        if (/does not exist|schema cache/i.test(error.message)) throw new SettingsHttpError(503, 'Run the settings database migration (supabase/RUN_IN_SQL_EDITOR.sql) first.');
        throw new SettingsHttpError(400, error.message);
      }
      invalidate(section);
    },
    invalidate,
    onChange(fn: (section: string) => void) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
export type SettingsService = ReturnType<typeof createSettingsService>;

// ------------------------------------------------------------------ routes
interface Deps {
  /** Cloudinary image service; when configured, media library images are stored there. */
  images?: ImageService;
  db: SupabaseClient | null;
  serviceRole: boolean;
  getAuthUserProfile: (req: Request) => Promise<{ user: any; profile: any } | null>;
  settings: SettingsService;
  credentials: CredentialStore;
  gateway: PaymentGateway;
  email: EmailService;
  management: ManagementClient;
  supabaseUrl: string;
  supabaseAnonKey: string;
  env: { razorpayKeyId: string; razorpayConfigured: boolean; razorpayWebhookConfigured: boolean; emailProvider: string; emailConfigured: boolean; hookSecretFromEnv: boolean; corsOrigins: string[] };
}

interface Access { superAdmin: boolean; sections: Set<string> }

const MEDIA_BUCKET = 'site-assets';

/** Cloudinary folder for each media library type. */
const KIND_OF_ASSET: Record<AssetType, string> = {
  website_banner: 'banner', app_banner: 'banner', course_thumbnail: 'course', bundle_image: 'bundle', blog_image: 'blog',
  category_image: 'category', promo: 'offer', logo: 'site', seo: 'site', other: 'other',
};

export function registerSettingsRoutes(app: Express, deps: Deps) {
  const { db, settings, credentials } = deps;

  const handle = (fn: (req: Request, res: Response) => Promise<unknown>) => async (req: Request, res: Response) => {
    try {
      await fn(req, res);
    } catch (e: any) {
      const known = e instanceof SettingsHttpError;
      if (!known) console.error('[Settings] API error:', e?.message || e);
      res.status(known ? e.status : 500).json({ error: known ? e.message : 'Request failed. Please try again.', ...(e?.extra || {}) });
    }
  };

  // ---------------------------------------------------------------- rate limit + auth
  const hits = new Map<string, number[]>();
  function rateLimit(key: string, max: number, windowMs = 60_000) {
    const now = Date.now();
    const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (list.length >= max) throw new SettingsHttpError(429, 'Too many requests. Wait a minute and try again.');
    list.push(now);
    hits.set(key, list);
  }

  async function accessFor(userId: string, role: string): Promise<Access> {
    if (role !== 'admin' && role !== 'instructor') return { superAdmin: false, sections: new Set() };
    let row: any = null;
    if (db) {
      const { data, error } = await db.from('admin_permissions').select('is_super_admin, sections').eq('user_id', userId).maybeSingle();
      if (!error) row = data;
    }
    if (role === 'admin') {
      if (!row || row.is_super_admin) return { superAdmin: true, sections: new Set(PERMISSION_SECTIONS) };
      return { superAdmin: false, sections: new Set(row.sections || []) };
    }
    // instructors: only what a super admin explicitly granted, never payment
    return { superAdmin: false, sections: new Set((row?.sections || []).filter((s: string) => s !== 'payment')) };
  }

  async function requireUser(req: Request) {
    if (!db || !deps.serviceRole) throw new SettingsHttpError(503, 'Settings need SUPABASE_SERVICE_ROLE_KEY on the server.');
    const auth = await deps.getAuthUserProfile(req);
    if (!auth?.user) throw new SettingsHttpError(401, 'Authentication required.');
    const access = await accessFor(auth.user.id, auth.profile?.role || 'student');
    return { user: auth.user, profile: auth.profile, access };
  }

  async function requireSection(req: Request, section: PermissionSection | 'super') {
    const ctx = await requireUser(req);
    if (section === 'super' ? !ctx.access.superAdmin : !ctx.access.sections.has(section)) {
      throw new SettingsHttpError(403, section === 'super' ? 'Only a super administrator can do this.' : 'You do not have permission to manage this section.');
    }
    rateLimit(`u:${ctx.user.id}`, 60);
    return ctx;
  }

  async function audit(e: { section: string; action: string; changes?: unknown; actor?: any; status?: 'success' | 'failure'; error?: string | null }) {
    if (!db) return;
    const { error } = await db.from('settings_audit_log').insert({
      section: e.section, action: e.action, changes: e.changes ?? {}, actor_id: e.actor?.id || null, actor_email: e.actor?.email || null,
      status: e.status || 'success', error: e.error ? String(e.error).slice(0, 500) : null,
    });
    if (error && !/does not exist|schema cache/i.test(error.message)) console.error('[Settings] audit write failed:', error.message);
  }

  /** Re-authentication for sensitive changes: checks the admin's own password with Supabase Auth. */
  async function verifyPassword(user: any, password: unknown) {
    if (typeof password !== 'string' || !password) throw new SettingsHttpError(401, 'Enter your password to confirm this change.', { reauth: true });
    if (!deps.supabaseUrl || !deps.supabaseAnonKey) throw new SettingsHttpError(503, 'Re-authentication needs SUPABASE_URL and SUPABASE_ANON_KEY on the server.');
    rateLimit(`pw:${user.id}`, 5);
    const c = createClient(deps.supabaseUrl, deps.supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await c.auth.signInWithPassword({ email: user.email, password });
    if (error || data.user?.id !== user.id) throw new SettingsHttpError(401, 'The password is incorrect.', { reauth: true });
    await c.auth.signOut({ scope: 'local' }).catch(() => undefined);
  }

  // ---------------------------------------------------------------- public
  app.get('/api/settings/public', handle(async (req, res) => {
    const p = await settings.getPublic();
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.setHeader('ETag', p.etag);
    if (req.headers['if-none-match'] === p.etag) return res.status(304).end();
    res.type('application/json').send(p.body);
  }));

  // ---------------------------------------------------------------- admin: read
  async function credentialView(provider: Provider) {
    const d = await credentials.describe(provider);
    if (provider === 'razorpay') {
      const cfg = await deps.gateway.current();
      return {
        ...d,
        inUse: cfg ? { source: cfg.source, keyId: cfg.keyId, mode: cfg.mode, webhook: !!cfg.webhookSecret } : null,
        env: { configured: deps.env.razorpayConfigured, keyId: deps.env.razorpayKeyId ? `${deps.env.razorpayKeyId.slice(0, 13)}…` : null, webhook: deps.env.razorpayWebhookConfigured },
      };
    }
    if (provider === 'email') {
      const cfg = await deps.email.transport('active');
      return {
        ...d,
        inUse: cfg ? { source: cfg.source, provider: cfg.provider, ...(cfg.provider === 'smtp' ? { host: cfg.host, port: cfg.port, security: cfg.security, username: cfg.username || '(none)' } : {}) } : null,
        env: { configured: deps.env.emailConfigured, provider: deps.env.emailProvider || null },
      };
    }
    if (provider === 'auth_hook') return { ...d, inUse: d.active ? { source: 'admin' } : deps.env.hookSecretFromEnv ? { source: 'env' } : null, env: { configured: deps.env.hookSecretFromEnv } };
    return { ...d, inUse: d.active ? { source: 'admin' } : null, env: { configured: false } };
  }

  app.get('/api/admin/settings', handle(async (req, res) => {
    const { access } = await requireUser(req);
    if (!access.sections.size) throw new SettingsHttpError(403, 'You do not have access to settings.');
    const all = await settings.getAll();
    const rows = await settings.rows(true);
    const visible = Object.fromEntries(ALL_SECTIONS.filter((s) => (s === 'auth' || s === 'domain' ? access.superAdmin : access.sections.has(s))).map((s) => [s, all[s]]));
    const meta = Object.fromEntries(ALL_SECTIONS.map((s) => [s, rows[s] ? { updatedAt: rows[s].updated_at, version: rows[s].version } : null]));
    const creds: Record<string, unknown> = {};
    if (access.sections.has('payment')) creds.razorpay = await credentialView('razorpay');
    if (access.sections.has('email')) creds.email = await credentialView('email');
    if (access.sections.has('whatsapp')) creds.emovur = await credentialView('emovur');
    if (access.superAdmin) {
      creds.google = await credentialView('google');
      creds.auth_hook = await credentialView('auth_hook');
    }
    let lastWebhook: unknown = null;
    if (access.sections.has('payment') && db) {
      const { data } = await db.from('platform_settings').select('value').eq('key', 'razorpay_webhook_last').maybeSingle();
      lastWebhook = data?.value || null;
    }
    res.json({
      settings: visible, defaults: DEFAULTS, meta,
      access: { superAdmin: access.superAdmin, sections: [...access.sections] },
      credentials: creds, canEncrypt: credentials.canEncrypt, migrationMissing: settings.migrationMissing, lastWebhook,
    });
  }));

  app.put('/api/admin/settings/:section', handle(async (req, res) => {
    const section = req.params.section as SectionId;
    if (!(ALL_SECTIONS as string[]).includes(section)) throw new SettingsHttpError(404, 'Unknown settings section.');
    // Login methods, domain/environment and SMTP sender are super-admin settings
    const { user } = await requireSection(req, section === 'auth' || section === 'domain' ? 'super' : (section as PermissionSection));
    const result = validateSection(section, req.body?.value);
    if (!result.ok) {
      await audit({ section, action: 'update', actor: user, status: 'failure', error: Object.values(result.errors).slice(0, 3).join(' ') });
      throw new SettingsHttpError(400, 'Please fix the highlighted fields.', { errors: result.errors });
    }
    const before = (await settings.getAll())[section];
    const changes = diffSettings(before, result.value);
    if (!Object.keys(changes).length) return res.json({ ok: true, unchanged: true, value: result.value });
    try {
      await settings.save(section, result.value, user.id);
    } catch (e: any) {
      await audit({ section, action: 'update', actor: user, status: 'failure', error: e?.message });
      throw e;
    }
    await audit({ section, action: 'update', changes, actor: user });
    res.json({ ok: true, value: result.value, changed: Object.keys(changes) });
  }));

  app.get('/api/admin/settings/audit', handle(async (req, res) => {
    const { access } = await requireUser(req);
    if (!access.superAdmin && !access.sections.has('audit')) throw new SettingsHttpError(403, 'You do not have permission to view the audit log.');
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    let q = db!.from('settings_audit_log').select('id, section, action, changes, actor_email, status, error, created_at').order('id', { ascending: false }).limit(limit);
    if (typeof req.query.section === 'string' && /^[a-z_]{2,40}$/.test(req.query.section)) q = q.eq('section', req.query.section);
    if (req.query.before && Number(req.query.before) > 0) q = q.lt('id', Number(req.query.before));
    const { data, error } = await q;
    if (error) throw new SettingsHttpError(400, error.message);
    res.json({ entries: data || [] });
  }));

  // ---------------------------------------------------------------- credentials
  const providerSection: Record<Provider, PermissionSection | 'super'> = { razorpay: 'super', email: 'super', emovur: 'whatsapp', google: 'super', auth_hook: 'super' };
  const isProvider = (p: string): p is Provider => ['razorpay', 'email', 'emovur', 'google', 'auth_hook'].includes(p);
  const auditSection = (p: Provider) => (p === 'razorpay' ? 'payment' : p === 'emovur' ? 'whatsapp' : p === 'email' ? 'email' : 'auth');

  app.get('/api/admin/settings/credentials/:provider', handle(async (req, res) => {
    const p = req.params.provider;
    if (!isProvider(p)) throw new SettingsHttpError(404, 'Unknown provider.');
    await requireSection(req, p === 'razorpay' ? 'payment' : p === 'email' ? 'email' : providerSection[p]);
    res.json(await credentialView(p));
  }));

  app.post('/api/admin/settings/credentials/:provider', handle(async (req, res) => {
    const p = req.params.provider;
    if (!isProvider(p)) throw new SettingsHttpError(404, 'Unknown provider.');
    const { user } = await requireSection(req, providerSection[p]);
    if (!credentials.canEncrypt) throw new SettingsHttpError(503, 'Saving credentials from the admin panel needs SETTINGS_ENCRYPTION_KEY on the server (see ENVIRONMENT_VARIABLES.md). Until then, keys are read from the server environment.');
    const b = req.body || {};
    let publicConfig: Record<string, string> = {};
    let secrets: Record<string, string> = {};
    const str = (v: unknown, max = 200) => cleanString(v, max);
    if (p === 'razorpay') {
      const keyId = str(b.keyId, 40);
      const mode = b.mode === 'live' ? 'live' : 'test';
      if (!KEY_ID_RE.test(keyId)) throw new SettingsHttpError(400, 'The Key ID must look like rzp_live_XXXX or rzp_test_XXXX.', { errors: { keyId: 'Invalid Key ID.' } });
      if (modeOf(keyId) !== mode) throw new SettingsHttpError(400, `You selected ${mode} mode, but this is a ${modeOf(keyId)} key.`, { errors: { mode: 'Mode does not match the key.' } });
      const keySecret = str(b.keySecret, 100);
      const webhookSecret = str(b.webhookSecret, 200);
      const existing = (await credentials.load('razorpay', 'pending', true)) || (await credentials.load('razorpay', 'active', true));
      if (!keySecret && !existing?.secrets?.keySecret) throw new SettingsHttpError(400, 'Enter the Key Secret.', { errors: { keySecret: 'Required.' } });
      if (mode === 'live') await verifyPassword(user, b.password);
      publicConfig = { keyId, mode };
      secrets = { keySecret, webhookSecret };
    } else if (p === 'email') {
      const provider = String(b.provider || 'smtp');
      if (!EMAIL_PROVIDERS.includes(provider as any)) throw new SettingsHttpError(400, 'Choose SMTP, Resend or Brevo.');
      const existing = (await credentials.load('email', 'pending', true)) || (await credentials.load('email', 'active', true));
      if (provider === 'smtp') {
        const host = str(b.host, 253).toLowerCase();
        const port = Math.round(Number(b.port));
        const security = ['ssl', 'starttls', 'none'].includes(b.security) ? b.security : 'starttls';
        const username = str(b.username, 254);
        const password = typeof b.password === 'string' ? b.password.slice(0, 500) : '';
        const errors: Record<string, string> = {};
        if (!/^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/.test(host)) errors.host = 'Enter the SMTP host name, e.g. smtp.yourprovider.com';
        if (!(port >= 1 && port <= 65535)) errors.port = 'Port must be a number such as 465 or 587.';
        if (security === 'none' && !/^(localhost|127\.0\.0\.1)$/.test(host)) errors.security = 'Use SSL or STARTTLS: passwords must not be sent unencrypted.';
        if (username && !password && !(existing?.publicConfig?.provider === 'smtp' && existing.secrets?.password)) errors.password = 'Enter the SMTP password.';
        if (Object.keys(errors).length) throw new SettingsHttpError(400, 'Please fix the highlighted fields.', { errors });
        publicConfig = { provider, host, port: String(port), security, username };
        secrets = { password };
      } else {
        publicConfig = { provider };
        secrets = { apiKey: str(b.apiKey, 300) };
        if (!secrets.apiKey && !existing?.secrets?.apiKey) throw new SettingsHttpError(400, 'Enter the API key.');
      }
    } else if (p === 'google') {
      const clientId = str(b.clientId, 200);
      const androidClientIds = str(b.androidClientIds, 1000).split(/[\s,]+/).filter(Boolean);
      const idRe = /^[0-9]{6,}-[a-z0-9]+\.apps\.googleusercontent\.com$/;
      if (!idRe.test(clientId)) throw new SettingsHttpError(400, 'The Web Client ID must look like 1234567890-abc.apps.googleusercontent.com.', { errors: { clientId: 'Invalid Client ID.' } });
      if (androidClientIds.some((x) => !idRe.test(x))) throw new SettingsHttpError(400, 'Each Android Client ID must look like 1234567890-abc.apps.googleusercontent.com.', { errors: { androidClientIds: 'Invalid Client ID.' } });
      const clientSecret = str(b.clientSecret, 200);
      const existing = (await credentials.load('google', 'pending', true)) || (await credentials.load('google', 'active', true));
      if (!clientSecret && !existing?.secrets?.clientSecret) throw new SettingsHttpError(400, 'Enter the Client Secret.', { errors: { clientSecret: 'Required.' } });
      await verifyPassword(user, b.password);
      publicConfig = { clientId, androidClientIds: androidClientIds.join(',') };
      secrets = { clientSecret };
    } else if (p === 'auth_hook') {
      const secret = str(b.secret, 200);
      if (!isHookSecret(secret)) throw new SettingsHttpError(400, 'The hook secret must look like v1,whsec_… (copy it from Supabase → Authentication → Hooks).', { errors: { secret: 'Invalid secret.' } });
      await verifyPassword(user, b.password);
      publicConfig = {};
      secrets = { secret };
    } else {
      const apiBaseUrl = str(b.apiBaseUrl, 300);
      if (apiBaseUrl && !isHttpsUrl(apiBaseUrl)) throw new SettingsHttpError(400, 'The Emovur API URL must start with https://');
      publicConfig = { apiBaseUrl, accountId: str(b.accountId, 120) };
      secrets = { apiToken: str(b.apiToken, 500) };
    }
    try {
      const { hints } = await credentials.savePending(p, publicConfig, secrets, user.id);
      await audit({ section: auditSection(p), action: 'credential_saved_pending', changes: { provider: p, ...publicConfig, secretsChanged: Object.keys(secrets).filter((k) => secrets[k]) }, actor: user });
      res.json({ ok: true, hints, next: 'Run "Test configuration", then "Activate".' });
    } catch (e: any) {
      await audit({ section: p, action: 'credential_saved_pending', actor: user, status: 'failure', error: e?.message });
      throw new SettingsHttpError(400, e?.message || 'Could not save credentials.');
    }
  }));

  app.post('/api/admin/settings/credentials/:provider/test', handle(async (req, res) => {
    const p = req.params.provider;
    if (!isProvider(p)) throw new SettingsHttpError(404, 'Unknown provider.');
    const { user } = await requireSection(req, p === 'razorpay' ? 'payment' : p === 'email' ? 'email' : providerSection[p]);
    rateLimit(`test:${user.id}`, 6);
    const slot = req.body?.slot === 'active' ? 'active' : 'pending';
    const rec = await credentials.load(p, slot, true);

    if (p === 'razorpay') {
      let candidate: { keyId: string; keySecret: string; webhookSecret?: string; expectedMode?: 'live' | 'test' } | null = null;
      if (rec?.publicConfig?.keyId && rec.secrets?.keySecret) {
        candidate = { keyId: rec.publicConfig.keyId, keySecret: rec.secrets.keySecret, webhookSecret: rec.secrets.webhookSecret, expectedMode: rec.publicConfig.mode as any };
      } else if (slot === 'active') {
        const cfg = await deps.gateway.current();
        if (cfg) candidate = { keyId: cfg.keyId, keySecret: cfg.keySecret, webhookSecret: cfg.webhookSecret };
      }
      if (!candidate) throw new SettingsHttpError(400, slot === 'pending' ? 'Save new credentials first.' : 'No Razorpay keys are configured (admin panel or server environment).');
      const { data: wh } = await db!.from('platform_settings').select('value').eq('key', 'razorpay_webhook_last').maybeSingle();
      const site = (await settings.getAll()).general?.siteUrl || '';
      const result = await testRazorpayCredentials(candidate, {
        webhookUrl: req.get('host') ? `https://${req.get('host')}/api/payments/webhook` : site ? `${site.replace(/\/+$/, '')}/api/payments/webhook` : null,
        lastWebhookAt: (wh?.value as any)?.at || null,
        enrollmentReady: deps.serviceRole,
      });
      if (rec) await credentials.setStatus('razorpay', slot, result.ok ? 'verified' : 'failed', result.ok ? null : result.steps.find((s) => s.status === 'fail')?.detail || 'Test failed');
      await audit({ section: 'payment', action: 'credential_test', changes: { provider: 'razorpay', slot, keyId: `${candidate.keyId.slice(0, 13)}…`, result: result.steps.map((s) => `${s.id}:${s.status}`) }, actor: user, status: result.ok ? 'success' : 'failure' });
      return res.json(result);
    }

    if (p === 'email') {
      const to = cleanString(req.body?.to, 120) || user.email;
      try {
        const r = await deps.email.sendTest(to, rec ? slot : 'active');
        const steps = smtpTestSteps(r);
        if (rec) await credentials.setStatus('email', slot, r.ok ? 'verified' : 'failed', r.ok ? null : r.response);
        await audit({ section: 'email', action: 'credential_test', changes: { provider: r.provider, slot, to, result: r.ok ? 'accepted' : 'failed', response: r.response }, actor: user, status: r.ok ? 'success' : 'failure' });
        return res.json({ ok: r.ok, steps });
      } catch (e: any) {
        if (rec) await credentials.setStatus('email', slot, 'failed', e?.message || 'failed');
        await audit({ section: 'email', action: 'credential_test', actor: user, status: 'failure', error: e?.message });
        return res.json({ ok: false, steps: [{ id: 'config', label: 'Configuration', status: 'fail', detail: e?.message || 'Sending failed.' }] });
      }
    }

    if (p === 'google' || p === 'auth_hook') {
      const steps: { id: string; label: string; status: string; detail: string }[] = [
        { id: 'stored', label: 'Stored encrypted on the server', status: rec ? 'pass' : 'fail', detail: rec ? 'Never sent to the website or app.' : 'Nothing saved yet.' },
      ];
      if (deps.management.enabled) {
        try {
          const cfg = await deps.management.getAuthConfig();
          if (p === 'google') {
            const ids = parseAllowList(cfg.external_google_client_id);
            steps.push({ id: 'supabase', label: 'Supabase Google provider', status: cfg.external_google_enabled && rec && ids[0] === rec.publicConfig.clientId ? 'pass' : 'warn', detail: cfg.external_google_enabled ? `Enabled in Supabase with client ${ids[0] || '—'}.` : 'Not enabled in Supabase yet: use “Apply to Supabase”.' });
          } else {
            steps.push({ id: 'supabase', label: 'Supabase Send Email hook', status: cfg.hook_send_email_enabled ? 'pass' : 'warn', detail: cfg.hook_send_email_enabled ? `Enabled → ${cfg.hook_send_email_uri}` : 'Not enabled in Supabase yet.' });
          }
        } catch (e: any) {
          steps.push({ id: 'supabase', label: 'Supabase Management API', status: 'fail', detail: e?.message || 'Could not read the Supabase configuration.' });
        }
      } else {
        steps.push({ id: 'supabase', label: 'Supabase configuration', status: 'manual', detail: 'Set SUPABASE_MANAGEMENT_TOKEN on the server to check and apply this automatically, or copy the values into the Supabase dashboard.' });
      }
      if (rec) await credentials.setStatus(p, slot, 'verified', null);
      return res.json({ ok: !steps.some((x) => x.status === 'fail'), steps });
    }

    // Emovur: no API contract is available in this project → we can only confirm the values are stored safely
    return res.json({
      ok: false,
      steps: [
        { id: 'stored', label: 'Credentials stored encrypted', status: rec ? 'pass' : 'fail', detail: rec ? 'Saved server-side; never sent to the website or app.' : 'Nothing saved yet.' },
        { id: 'api', label: 'Emovur API connection', status: 'manual', detail: 'Emovur messaging is not integrated in this codebase yet, so no live connection test is possible. Provide the Emovur API documentation to enable sending.' },
      ],
    });
  }));

  app.post('/api/admin/settings/credentials/:provider/activate', handle(async (req, res) => {
    const p = req.params.provider;
    if (!isProvider(p)) throw new SettingsHttpError(404, 'Unknown provider.');
    const { user } = await requireSection(req, providerSection[p]);
    const pending = await credentials.load(p, 'pending', true);
    if (!pending) throw new SettingsHttpError(400, 'There are no saved credentials waiting for activation.');
    // Re-authentication: live payment keys, the SMTP account all email goes through, Google OAuth and the auth hook
    if ((p === 'razorpay' && pending.publicConfig.mode === 'live') || p === 'email' || p === 'google' || p === 'auth_hook') await verifyPassword(user, req.body?.password);
    if (p === 'emovur' || p === 'google' || p === 'auth_hook') {
      // Nothing can verify Emovur yet; store as active so a future integration can use it.
      await credentials.setStatus(p, 'pending', 'verified', null);
    }
    try {
      await credentials.activatePending(p, user.id);
    } catch (e: any) {
      await audit({ section: p, action: 'credential_activate', actor: user, status: 'failure', error: e?.message });
      throw new SettingsHttpError(400, e?.message || 'Activation failed.');
    }
    await audit({ section: auditSection(p), action: 'credential_activate', changes: { provider: p, ...pending.publicConfig }, actor: user });
    res.json({ ok: true, view: await credentialView(p) });
  }));

  app.delete('/api/admin/settings/credentials/:provider', handle(async (req, res) => {
    const p = req.params.provider;
    if (!isProvider(p)) throw new SettingsHttpError(404, 'Unknown provider.');
    const { user } = await requireSection(req, providerSection[p]);
    const slot = req.query.slot === 'active' ? 'active' : 'pending';
    if (slot === 'active' && ['razorpay', 'google', 'auth_hook', 'email'].includes(p)) await verifyPassword(user, req.body?.password);
    await credentials.discard(p, slot);
    await audit({ section: auditSection(p), action: slot === 'active' ? 'credential_revert_to_env' : 'credential_discard_pending', changes: { provider: p }, actor: user });
    res.json({ ok: true, view: await credentialView(p) });
  }));

  // ---------------------------------------------------------------- email tools
  const SAMPLE_VARS: Record<string, string> = {
    student_name: 'Priya Sharma', student_email: 'priya@example.com', course_name: 'Advanced Excel for Professionals', bundle_name: 'Office Productivity Bundle',
    order_id: 'order_SAMPLE123', amount: '₹1,499', payment_date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
    transaction_id: 'pay_SAMPLE123', refund_id: 'rfnd_SAMPLE123', certificate_code: 'EDU-2026-SAMPLE', verification_url: 'https://example.com/verify', reset_url: 'https://example.com/reset',
    login_link: 'https://example.com/magic', confirm_url: 'https://example.com/confirm', invite_url: 'https://example.com/invite', new_email: 'new@example.com', otp_code: '123456',
    announcement_title: 'New courses this month', course_id: 'sample-course',
  };
  const sampleFor = () => ({
    ...SAMPLE_VARS,
    course_list: courseListHtml([{ title: 'Advanced Excel for Professionals' }, { title: 'PowerPoint Masterclass' }]),
    announcement_body: paragraphsHtml('We have added three new courses.\n\nOpen the app to explore them.'),
  });

  app.post('/api/admin/email/preview', handle(async (req, res) => {
    await requireSection(req, 'email');
    const id = String(req.body?.templateId || '') as TemplateId;
    if (!TEMPLATE_IDS.includes(id)) throw new SettingsHttpError(400, 'Unknown template.');
    const override = req.body?.template ? { subject: cleanString(req.body.template.subject, 150), html: sanitizeEmailHtml(String(req.body.template.html || '')) } : undefined;
    const m = await deps.email.compose(id, sampleFor(), override);
    res.json({ subject: m.subject, html: m.html, text: m.text, missing: m.missing });
  }));
  // (kept for the previous admin UI)
  app.post('/api/admin/settings/email/preview', handle(async (req, res) => {
    await requireSection(req, 'email');
    const id = String(req.body?.templateId || '') as TemplateId;
    if (!TEMPLATE_IDS.includes(id)) throw new SettingsHttpError(400, 'Unknown template.');
    const m = await deps.email.compose(id, sampleFor());
    res.json({ subject: m.subject, html: m.html });
  }));

  app.get('/api/admin/email/templates', handle(async (req, res) => {
    await requireSection(req, 'email');
    res.json({ templates: TEMPLATE_DEFS.map((t) => ({ id: t.id, label: t.label, group: t.group, trigger: t.trigger, vars: t.vars, required: t.required, authHook: !!t.authHook, defaultSubject: t.subject, defaultHtml: t.html })) });
  }));

  app.post('/api/admin/email/templates/:id/restore', handle(async (req, res) => {
    const { user } = await requireSection(req, 'email');
    const id = req.params.id as TemplateId;
    if (!TEMPLATE_IDS.includes(id)) throw new SettingsHttpError(404, 'Unknown template.');
    const current = (await settings.getAll()).email;
    const next = { ...current, templates: { ...current.templates, [id]: { enabled: true, subject: TEMPLATE_MAP[id].subject, html: TEMPLATE_MAP[id].html } } };
    const v = validateSection('email', next);
    if (!v.ok) throw new SettingsHttpError(400, 'Could not restore the template.', { errors: v.errors });
    await settings.save('email', v.value, user.id);
    await audit({ section: 'email', action: 'template_restore_default', changes: { template: id }, actor: user });
    res.json({ ok: true, value: v.value });
  }));

  app.post('/api/admin/email/test', handle(async (req, res) => {
    const { user } = await requireSection(req, 'email');
    rateLimit(`mail:${user.id}`, 5);
    const to = cleanString(req.body?.to, 120);
    try {
      const r = await deps.email.sendTest(to);
      await audit({ section: 'email', action: 'test_email', changes: { to, provider: r.provider, result: r.ok ? 'accepted' : 'failed', response: r.response }, actor: user, status: r.ok ? 'success' : 'failure' });
      res.json({ ok: r.ok, steps: smtpTestSteps(r), message: r.ok ? `Accepted by ${r.provider.toUpperCase()} for delivery to ${to}.` : r.response });
    } catch (e: any) {
      await audit({ section: 'email', action: 'test_email', actor: user, status: 'failure', error: e?.message });
      throw new SettingsHttpError(400, e?.message || 'Sending failed.');
    }
  }));
  app.post('/api/admin/settings/email/test', handle(async (req, res) => {
    const { user } = await requireSection(req, 'email');
    rateLimit(`mail:${user.id}`, 5);
    const r = await deps.email.sendTest(cleanString(req.body?.to, 120) || user.email);
    if (!r.ok) throw new SettingsHttpError(400, r.response);
    res.json({ ok: true, message: `Accepted by ${r.provider.toUpperCase()}.` });
  }));

  app.get('/api/admin/email/logs', handle(async (req, res) => {
    await requireSection(req, 'email');
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    let q = db!.from('email_outbox').select('id, event_key, template, to_email, status, attempts, max_attempts, next_attempt_at, provider, provider_response, last_error, created_at, updated_at, sent_at').order('created_at', { ascending: false }).limit(limit);
    if (typeof req.query.status === 'string' && ['queued', 'sending', 'sent', 'failed', 'skipped', 'cancelled'].includes(req.query.status)) q = q.eq('status', req.query.status);
    if (typeof req.query.template === 'string' && (TEMPLATE_IDS as readonly string[]).includes(req.query.template)) q = q.eq('template', req.query.template);
    const term = cleanString(req.query.q, 120).toLowerCase().replace(/[%_,()]/g, '');
    if (term) q = q.ilike('to_email', `%${term}%`);
    if (typeof req.query.before === 'string' && !Number.isNaN(Date.parse(req.query.before))) q = q.lt('created_at', req.query.before);
    const { data, error } = await q;
    if (error) {
      if (/does not exist|schema cache/i.test(error.message)) throw new SettingsHttpError(503, 'Run the email database migration (supabase/RUN_IN_SQL_EDITOR.sql) first.');
      throw new SettingsHttpError(400, error.message);
    }
    const counts: Record<string, number> = {};
    for (const st of ['queued', 'sending', 'sent', 'failed', 'skipped']) {
      const { count } = await db!.from('email_outbox').select('id', { count: 'exact', head: true }).eq('status', st);
      counts[st] = count || 0;
    }
    res.json({ entries: data || [], counts, worker: deps.email.state, provider: (await deps.email.transport('active'))?.provider || null });
  }));

  app.post('/api/admin/email/logs/:id/retry', handle(async (req, res) => {
    const { user } = await requireSection(req, 'email');
    const { data: row } = await db!.from('email_outbox').select('id, status, template, to_email').eq('id', req.params.id).maybeSingle();
    if (!row) throw new SettingsHttpError(404, 'Email not found.');
    if (!['failed', 'skipped', 'cancelled'].includes(row.status)) throw new SettingsHttpError(409, 'Only failed or skipped emails can be retried.');
    await db!.from('email_outbox').update({ status: 'queued', attempts: 0, next_attempt_at: new Date().toISOString(), last_error: null, updated_at: new Date().toISOString() }).eq('id', row.id);
    await audit({ section: 'email', action: 'email_retry', changes: { template: row.template, to: row.to_email }, actor: user });
    void deps.email.tick();
    res.json({ ok: true });
  }));

  app.post('/api/admin/email/logs/retry-failed', handle(async (req, res) => {
    const { user } = await requireSection(req, 'email');
    const { data } = await db!.from('email_outbox').select('id').eq('status', 'failed').limit(500);
    const ids = (data || []).map((r: any) => r.id);
    if (ids.length) await db!.from('email_outbox').update({ status: 'queued', attempts: 0, next_attempt_at: new Date().toISOString(), last_error: null, updated_at: new Date().toISOString() }).in('id', ids);
    await audit({ section: 'email', action: 'email_retry_all_failed', changes: { count: ids.length }, actor: user });
    void deps.email.tick();
    res.json({ ok: true, count: ids.length });
  }));

  app.post('/api/admin/email/announcement', handle(async (req, res) => {
    const { user } = await requireSection(req, 'email');
    rateLimit(`announce:${user.id}`, 3, 3600_000);
    const title = cleanString(req.body?.title, 120);
    const body = cleanString(req.body?.body, 4000, true);
    if (!title || !body) throw new SettingsHttpError(400, 'Enter a title and a message.');
    const audience = req.body?.audience === 'enrolled' ? 'enrolled' : 'all_students';
    let people: any[] = [];
    if (audience === 'enrolled') {
      const { data } = await db!.from('enrollments').select('user_id, profiles(email, full_name)').eq('status', 'active').limit(20000);
      const seen = new Set<string>();
      for (const r of (data || []) as any[]) if (r.profiles?.email && !seen.has(r.user_id)) { seen.add(r.user_id); people.push({ id: r.user_id, email: r.profiles.email, full_name: r.profiles.full_name }); }
    } else {
      const { data } = await db!.from('profiles').select('id, email, full_name').eq('role', 'student').limit(20000);
      people = data || [];
    }
    if (req.body?.confirm !== true) return res.json({ ok: false, needsConfirmation: true, recipients: people.length });
    const batch = crypto.randomUUID().slice(0, 8);
    let queued = 0;
    for (const pp of people) {
      const r = await deps.email.enqueue('announcement', { to: pp.email, userId: pp.id, eventKey: `announcement:${batch}:${pp.id}`, vars: { student_name: pp.full_name || 'there', announcement_title: title, announcement_body: paragraphsHtml(body) }, priority: 9 });
      if (r.queued) queued++;
    }
    await audit({ section: 'email', action: 'announcement_queued', changes: { title, audience, recipients: queued }, actor: user });
    res.json({ ok: true, queued });
  }));

  // Welcome email is queued automatically by the database when an account is confirmed; this endpoint is
  // idempotent (same event key) and only exists for older website builds.
  app.post('/api/email/welcome', handle(async (req, res) => {
    const auth = await deps.getAuthUserProfile(req);
    if (!auth?.user) throw new SettingsHttpError(401, 'Authentication required.');
    rateLimit(`welcome:${auth.user.id}`, 3);
    if (!auth.user.email_confirmed_at) return res.json({ ok: true, skipped: 'Email not verified yet.' });
    await deps.email.enqueue('welcome', { to: auth.user.email, userId: auth.user.id, eventKey: `welcome:${auth.user.id}`, vars: { student_name: auth.profile?.full_name || auth.user.user_metadata?.full_name || 'there' } });
    res.json({ ok: true });
  }));

  // ---------------------------------------------------------------- authentication, Google & domain (super admins)
  async function domainState() {
    const all = await settings.getAll();
    const domain = all.domain as DomainSettings;
    const urls = activeUrls(domain, all.general?.siteUrl || '');
    const required = requiredRedirects(domain, all.general?.siteUrl || '');
    return { all, domain, urls, required };
  }

  app.get('/api/admin/auth/status', handle(async (req, res) => {
    await requireSection(req, 'super');
    const { all, urls, required } = await domainState();
    const callbackUrl = deps.supabaseUrl ? `${deps.supabaseUrl.replace(/\/+$/, '')}/auth/v1/callback` : '';
    const hookUrl = urls.apiUrl ? `${urls.apiUrl.replace(/\/+$/, '').replace(/\/api$/, '')}/api/auth/email-hook` : '';
    let cfg: any = null;
    let cfgError: string | null = null;
    if (deps.management.enabled) {
      try {
        cfg = await deps.management.getAuthConfig();
      } catch (e: any) {
        cfgError = e?.message || 'Could not read the Supabase configuration.';
      }
    }
    const allow = parseAllowList(cfg?.uri_allow_list);
    const google = await credentials.describe('google');
    type Check = { id: string; label: string; status: 'configured' | 'supabase_manual' | 'google_console' | 'deploy' | 'missing'; detail: string; value?: string };
    const supa = (ok: boolean): Check['status'] => (cfg ? (ok ? 'configured' : 'supabase_manual') : 'supabase_manual');
    const checks: Check[] = [
      { id: 'site_url', label: 'Supabase Site URL', status: urls.siteUrl ? supa(cfg?.site_url === urls.siteUrl) : 'missing', detail: urls.siteUrl ? (cfg ? `Supabase currently: ${cfg.site_url || '—'}` : 'Set it in Supabase → Authentication → URL Configuration.') : 'Set the website URL for the active profile first.', value: urls.siteUrl },
      { id: 'redirects', label: 'Allowed redirect URLs (email confirmation, password reset, app)', status: urls.siteUrl ? supa(required.every((r) => allow.includes(r))) : 'missing', detail: cfg ? `Missing in Supabase: ${required.filter((r) => !allow.includes(r)).join(', ') || 'none'}` : 'Add each value under Redirect URLs.', value: required.join('\n') },
      { id: 'email_redirect', label: 'Email confirmation & password reset links', status: urls.siteUrl ? 'configured' : 'missing', detail: urls.siteUrl ? `Website uses ${urls.authCallbackUrl} and ${urls.resetPasswordUrl} (read at runtime, no rebuild). The app uses edufyacademy://reset-password.` : 'Needs the website URL.' },
      { id: 'google_provider', label: 'Google provider in Supabase', status: !all.auth.googleEnabled || cfg?.external_google_enabled ? 'configured' : google.active ? 'supabase_manual' : 'missing', detail: !all.auth.googleEnabled ? 'Google Sign-In is turned off.' : cfg ? (cfg.external_google_enabled ? `Enabled (client ${parseAllowList(cfg.external_google_client_id)[0] || '—'}).` : 'Not enabled yet: use “Apply to Supabase”.') : 'Enable Google in Supabase → Authentication → Providers with your Client ID and Secret.' },
      { id: 'google_console', label: 'Google Cloud Console', status: 'google_console', detail: `Authorized redirect URI: ${callbackUrl}. Authorized JavaScript origin: ${urls.siteUrl || '(website URL)'}. Android: package com.edufyacademy.student + SHA-1 of your signing key.`, value: callbackUrl },
      { id: 'email_hook', label: 'Supabase Send Email hook (verification & reset emails through your SMTP)', status: cfg?.hook_send_email_enabled && cfg.hook_send_email_uri === hookUrl ? 'configured' : hookUrl ? 'supabase_manual' : 'missing', detail: hookUrl ? `Hook URL: ${hookUrl}` : 'Needs the API URL of the active profile.', value: hookUrl },
      { id: 'cors', label: 'Server CORS allows the website', status: !urls.siteUrl ? 'missing' : deps.env.corsOrigins.length === 0 || deps.env.corsOrigins.includes(new URL(urls.siteUrl).origin) ? 'configured' : 'deploy', detail: deps.env.corsOrigins.length ? `CORS_ORIGINS = ${deps.env.corsOrigins.join(', ')}` : 'CORS_ORIGINS is empty (all origins allowed).' },
      { id: 'app_build', label: 'Mobile app URLs', status: 'deploy', detail: `The app’s API and website addresses are built in (EXPO_PUBLIC_API_URL / EXPO_PUBLIC_WEB_URL). After changing domains, update them in EAS and rebuild. Current active: ${urls.apiUrl || '—'} / ${urls.siteUrl || '—'}.` },
    ];
    res.json({
      environment: urls.environment, urls, callbackUrl, hookUrl, requiredRedirects: required,
      management: { enabled: deps.management.enabled, ref: deps.management.ref, error: cfgError },
      supabase: cfg, checks, nodeEnv: process.env.NODE_ENV || 'development',
    });
  }));

  app.post('/api/admin/auth/apply', handle(async (req, res) => {
    const { user } = await requireSection(req, 'super');
    if (!deps.management.enabled) throw new SettingsHttpError(400, 'Set SUPABASE_MANAGEMENT_TOKEN on the server to apply settings automatically, or copy the values into the Supabase dashboard.');
    await verifyPassword(user, req.body?.password);
    const want = req.body?.apply || {};
    const { all, urls, required } = await domainState();
    const current = await deps.management.getAuthConfig();
    const patch: Record<string, unknown> = {};
    const applied: string[] = [];
    if (want.siteUrl) {
      if (!urls.siteUrl) throw new SettingsHttpError(400, 'Set the website URL for the active profile first.');
      patch.site_url = urls.siteUrl;
      applied.push('site_url');
    }
    if (want.redirects) {
      patch.uri_allow_list = mergeAllowList(current.uri_allow_list, required);
      applied.push('uri_allow_list');
    }
    if (want.google) {
      const g = await credentials.load('google', 'active', true);
      if (!g?.publicConfig?.clientId || !g.secrets?.clientSecret) throw new SettingsHttpError(400, 'Save and activate the Google Client ID and Secret first.');
      const ids = [g.publicConfig.clientId, ...parseAllowList(g.publicConfig.androidClientIds)];
      patch.external_google_enabled = !!all.auth.googleEnabled;
      patch.external_google_client_id = ids.join(',');
      patch.external_google_secret = g.secrets.clientSecret;
      applied.push('google_provider');
    }
    if (want.emailHook) {
      const hookUrl = urls.apiUrl ? `${urls.apiUrl.replace(/\/+$/, '').replace(/\/api$/, '')}/api/auth/email-hook` : '';
      if (!/^https:\/\//.test(hookUrl)) throw new SettingsHttpError(400, 'The active profile needs an https API URL for the email hook.');
      if (!(await deps.email.transport('active'))) throw new SettingsHttpError(400, 'Configure and activate SMTP first; otherwise sign-up emails could not be sent.');
      let secret = (await credentials.load('auth_hook', 'active', true))?.secrets?.secret;
      if (!secret) {
        secret = generateHookSecret();
        await credentials.savePending('auth_hook', {}, { secret }, user.id);
        await credentials.setStatus('auth_hook', 'pending', 'verified', null);
        await credentials.activatePending('auth_hook', user.id);
      }
      patch.hook_send_email_enabled = true;
      patch.hook_send_email_uri = hookUrl;
      patch.hook_send_email_secrets = secret;
      applied.push('send_email_hook');
    }
    if (want.disableEmailHook) {
      patch.hook_send_email_enabled = false;
      applied.push('send_email_hook_off');
    }
    if (!applied.length) throw new SettingsHttpError(400, 'Choose what to apply.');
    try {
      const after = await deps.management.patchAuthConfig(patch);
      await audit({ section: 'auth', action: 'supabase_auth_apply', changes: { applied, site_url: patch.site_url, uri_allow_list: patch.uri_allow_list, google_client: patch.external_google_client_id, hook_uri: patch.hook_send_email_uri }, actor: user });
      res.json({ ok: true, applied, supabase: after });
    } catch (e: any) {
      await audit({ section: 'auth', action: 'supabase_auth_apply', changes: { applied }, actor: user, status: 'failure', error: e?.message });
      throw new SettingsHttpError(502, e?.message || 'Supabase rejected the change.');
    }
  }));

  // ---------------------------------------------------------------- media library
  let refCache: { at: number; urls: Map<string, string[]>; settingsText: string } | null = null;
  const REF_TABLES: { table: string; columns: string[]; label: (r: any) => string }[] = [
    { table: 'banners', columns: ['image_url', 'mobile_image_url'], label: (r) => `Banner “${r.title}”` },
    { table: 'offers', columns: ['image_url'], label: (r) => `Offer “${r.title}”` },
    { table: 'courses', columns: ['thumbnail_url'], label: (r) => `Course “${r.title}”` },
    { table: 'bundles', columns: ['thumbnail_url'], label: (r) => `Bundle “${r.title}”` },
    { table: 'categories', columns: ['image_url'], label: (r) => `Category “${r.name}”` },
    { table: 'blog_posts', columns: ['cover_image_url'], label: (r) => `Blog post “${r.title}”` },
  ];

  async function referenceIndex(fresh = false) {
    if (!fresh && refCache && Date.now() - refCache.at < 60_000) return refCache;
    const urls = new Map<string, string[]>();
    for (const t of REF_TABLES) {
      const nameCol = t.table === 'categories' ? 'name' : 'title';
      const { data, error } = await db!.from(t.table).select([nameCol, ...t.columns].join(', ')).limit(5000);
      if (error) continue;
      for (const r of (data || []) as any[]) {
        for (const c of t.columns) {
          const u = r[c];
          if (typeof u === 'string' && u) urls.set(u, [...(urls.get(u) || []), t.label(r)]);
        }
      }
    }
    const rows = await settings.rows(true);
    refCache = { at: Date.now(), urls, settingsText: JSON.stringify(Object.fromEntries(Object.entries(rows).map(([k, v]) => [k, v.value]))) };
    return refCache;
  }

  async function usagesOf(url: string, fresh = false) {
    const idx = await referenceIndex(fresh);
    const list = [...(idx.urls.get(url) || [])];
    if (idx.settingsText.includes(JSON.stringify(url).slice(1, -1))) {
      const rows = await settings.rows();
      for (const [section, r] of Object.entries(rows)) if (JSON.stringify(r.value).includes(JSON.stringify(url).slice(1, -1))) list.push(`Settings → ${section}`);
    }
    return list;
  }

  /** Points every reference at a replaced image (settings sections + content tables). */
  async function replaceReferences(oldUrl: string, newUrl: string, user: any) {
    const rows = await settings.rows(true);
    const needle = JSON.stringify(oldUrl).slice(1, -1);
    for (const [section, r] of Object.entries(rows)) {
      const text = JSON.stringify(r.value);
      if (!text.includes(needle)) continue;
      const next = JSON.parse(text.split(needle).join(JSON.stringify(newUrl).slice(1, -1)));
      const v = validateSection(section, next);
      if (v.ok) {
        await settings.save(section as SectionId, v.value, user.id);
        await audit({ section, action: 'media_replaced_reference', changes: { from: oldUrl, to: newUrl }, actor: user });
      }
    }
    for (const t of REF_TABLES) {
      for (const c of t.columns) {
        await db!.from(t.table).update({ [c]: newUrl }).eq(c, oldUrl);
      }
    }
    refCache = null;
  }

  // Lets the image migration repoint URLs stored in site settings (same validation as a normal save)
  deps.images?.setSettingsReplacer(async (from, to) => {
    const rows = await settings.rows(true);
    const needle = JSON.stringify(from).slice(1, -1);
    let changed = 0;
    for (const [section, r] of Object.entries(rows)) {
      const text = JSON.stringify(r.value);
      if (!text.includes(needle)) continue;
      const next = JSON.parse(text.split(needle).join(JSON.stringify(to).slice(1, -1)));
      const v = validateSection(section, next);
      if (v.ok) {
        await settings.save(section as SectionId, v.value, null);
        changed++;
      }
    }
    refCache = null;
    return changed;
  });

  const cloudinaryOn = () => !!deps.images?.configured();

  /** Removes the stored file of a media library item (Cloudinary or Supabase Storage). */
  async function removeStoredFile(m: any) {
    if (m.provider === 'cloudinary' && m.public_id) await deps.images!.destroyPublicId(m.public_id).catch((e) => console.error('[Media] Cloudinary delete failed:', e?.message || e));
    else if (m.path && m.bucket !== 'cloudinary') await db!.storage.from(m.bucket || MEDIA_BUCKET).remove([m.path]);
  }

  function decodeUpload(b: any) {
    const raw = typeof b?.fileBase64 === 'string' ? b.fileBase64.replace(/^data:[^;]+;base64,/, '') : '';
    if (!raw) throw new SettingsHttpError(400, 'No file received.');
    if (raw.length > 12_000_000) throw new SettingsHttpError(413, 'The file is too large (max 8 MB).');
    return Buffer.from(raw, 'base64');
  }

  app.get('/api/admin/media', handle(async (req, res) => {
    await requireSection(req, 'media');
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 48));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    let q = db!.from('media_assets').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(offset, offset + limit - 1);
    if (typeof req.query.type === 'string' && (ASSET_TYPES as readonly string[]).includes(req.query.type)) q = q.eq('asset_type', req.query.type);
    const term = cleanString(req.query.q, 60).replace(/[%_,()]/g, ' ').trim();
    if (term) q = q.or(`file_name.ilike.%${term}%,alt_text.ilike.%${term}%`);
    const { data, error, count } = await q;
    if (error) {
      if (/does not exist|schema cache/i.test(error.message)) throw new SettingsHttpError(503, 'Run the settings database migration (supabase/RUN_IN_SQL_EDITOR.sql) first.');
      throw new SettingsHttpError(400, error.message);
    }
    const items: any[] = [];
    for (const m of data || []) items.push({ ...m, usages: await usagesOf(m.url) });
    res.json({ items, total: count || 0 });
  }));

  app.post('/api/admin/media', handle(async (req, res) => {
    const { user, access } = await requireUser(req);
    const assetType = (ASSET_TYPES as readonly string[]).includes(req.body?.assetType) ? (req.body.assetType as AssetType) : 'other';
    // Uploading from the branding/banner screens is allowed for admins of those sections too
    const allowed = access.sections.has('media') || (assetType === 'logo' && access.sections.has('branding')) || (/banner/.test(assetType) && access.sections.has('banners')) || (assetType === 'seo' && access.sections.has('seo'));
    if (!allowed) throw new SettingsHttpError(403, 'You do not have permission to upload images.');
    rateLimit(`up:${user.id}`, 30);
    const buf = decodeUpload(req.body);
    const v = validateUpload(buf, assetType);
    if (!v.ok) {
      await audit({ section: 'media', action: 'media_upload', actor: user, status: 'failure', error: v.error });
      throw new SettingsHttpError(400, v.error);
    }
    let stored: { bucket: string; path: string; url: string; provider: string; public_id: string | null };
    if (cloudinaryOn()) {
      const up = await deps.images!.uploadBuffer(buf, { kind: KIND_OF_ASSET[assetType], source: 'media_library', userId: user.id }).catch((e: any) => {
        throw new SettingsHttpError(e?.status || 500, `Cloudinary upload failed: ${e?.message || e}`);
      });
      stored = { bucket: 'cloudinary', path: up.publicId, url: up.url, provider: 'cloudinary', public_id: up.publicId };
    } else {
      const now = new Date();
      const path = `${assetType}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${crypto.randomUUID().slice(0, 8)}-${safeFileStem(req.body?.fileName)}.${v.info.ext}`;
      const { error: upErr } = await db!.storage.from(MEDIA_BUCKET).upload(path, buf, { contentType: v.info.mime, cacheControl: '31536000', upsert: false });
      if (upErr) throw new SettingsHttpError(500, `Storage upload failed: ${upErr.message}. Make sure the "${MEDIA_BUCKET}" bucket exists (run the settings migration).`);
      stored = { bucket: MEDIA_BUCKET, path, url: db!.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl, provider: 'supabase', public_id: null };
    }
    const url = stored.url;
    const row = {
      ...stored, asset_type: assetType, file_name: cleanString(req.body?.fileName, 200) || null, mime_type: v.info.mime,
      size_bytes: buf.length, width: v.info.width, height: v.info.height, alt_text: cleanString(req.body?.altText, 200) || null, uploaded_by: user.id,
    };
    const { data, error } = await db!.from('media_assets').insert(row).select('*').single();
    if (error) {
      await removeStoredFile(row);
      throw new SettingsHttpError(400, error.message);
    }
    refCache = null;
    await audit({ section: 'media', action: 'media_upload', changes: { file: row.file_name, type: assetType, url, size: buf.length, dims: `${v.info.width}×${v.info.height}` }, actor: user });
    res.json({ item: { ...data, usages: [] } });
  }));

  app.put('/api/admin/media/:id', handle(async (req, res) => {
    const { user } = await requireSection(req, 'media');
    const { data: m, error } = await db!.from('media_assets').select('*').eq('id', req.params.id).maybeSingle();
    if (error || !m) throw new SettingsHttpError(404, 'Image not found.');
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof req.body?.altText === 'string') patch.alt_text = cleanString(req.body.altText, 200) || null;
    if (req.body?.fileBase64) {
      const buf = decodeUpload(req.body);
      const v = validateUpload(buf, m.asset_type);
      if (!v.ok) throw new SettingsHttpError(400, v.error);
      // New object (fresh URL, no stale CDN cache), then repoint every reference and remove the old file
      let stored: { bucket: string; path: string; url: string; provider: string; public_id: string | null };
      if (cloudinaryOn()) {
        const up = await deps.images!.uploadBuffer(buf, { kind: KIND_OF_ASSET[m.asset_type as AssetType] || 'other', source: 'media_library', userId: user.id }).catch((e: any) => {
          throw new SettingsHttpError(e?.status || 500, `Cloudinary upload failed: ${e?.message || e}`);
        });
        stored = { bucket: 'cloudinary', path: up.publicId, url: up.url, provider: 'cloudinary', public_id: up.publicId };
      } else {
        const base = m.bucket === 'cloudinary' ? `${m.asset_type}/replaced/x` : m.path;
        const path = base.replace(/[^/]+$/, `${crypto.randomUUID().slice(0, 8)}-${safeFileStem(req.body?.fileName || m.file_name)}.${v.info.ext}`);
        const { error: upErr } = await db!.storage.from(MEDIA_BUCKET).upload(path, buf, { contentType: v.info.mime, cacheControl: '31536000', upsert: false });
        if (upErr) throw new SettingsHttpError(500, `Storage upload failed: ${upErr.message}`);
        stored = { bucket: MEDIA_BUCKET, path, url: db!.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl, provider: 'supabase', public_id: null };
      }
      const url = stored.url;
      Object.assign(patch, { ...stored, mime_type: v.info.mime, size_bytes: buf.length, width: v.info.width, height: v.info.height, file_name: cleanString(req.body?.fileName, 200) || m.file_name });
      const { error: e2 } = await db!.from('media_assets').update(patch).eq('id', m.id);
      if (e2) {
        await removeStoredFile(stored);
        throw new SettingsHttpError(400, e2.message);
      }
      await replaceReferences(m.url, url, user);
      await removeStoredFile(m);
      await audit({ section: 'media', action: 'media_replace', changes: { file: m.file_name, from: m.url, to: url }, actor: user });
    } else {
      await db!.from('media_assets').update(patch).eq('id', m.id);
    }
    const { data: updated } = await db!.from('media_assets').select('*').eq('id', m.id).single();
    res.json({ item: { ...updated, usages: await usagesOf(updated!.url, true) } });
  }));

  app.delete('/api/admin/media/:id', handle(async (req, res) => {
    const { user } = await requireSection(req, 'media');
    const { data: m } = await db!.from('media_assets').select('*').eq('id', req.params.id).maybeSingle();
    if (!m) throw new SettingsHttpError(404, 'Image not found.');
    const usages = await usagesOf(m.url, true);
    if (usages.length) {
      await audit({ section: 'media', action: 'media_delete', actor: user, status: 'failure', error: `In use: ${usages.slice(0, 3).join(', ')}` });
      throw new SettingsHttpError(409, 'This image is in use and cannot be deleted. Replace or remove it where it is used first.', { usages });
    }
    await removeStoredFile(m);
    await db!.from('media_assets').delete().eq('id', m.id);
    refCache = null;
    await audit({ section: 'media', action: 'media_delete', changes: { file: m.file_name, url: m.url }, actor: user });
    res.json({ ok: true });
  }));

  // ---------------------------------------------------------------- permissions (super admins)
  app.get('/api/admin/settings/permissions', handle(async (req, res) => {
    await requireSection(req, 'super');
    const { data: people, error } = await db!.from('profiles').select('id, full_name, email, role').in('role', ['admin', 'instructor']).order('role').limit(500);
    if (error) throw new SettingsHttpError(400, error.message);
    const { data: rows } = await db!.from('admin_permissions').select('user_id, is_super_admin, sections, updated_at');
    const byUser = new Map<string, any>((rows || []).map((r: any) => [r.user_id, r] as [string, any]));
    res.json({
      sections: PERMISSION_SECTIONS,
      users: (people || []).map((p: any) => {
        const r: any = byUser.get(p.id);
        const effective = p.role === 'admin' ? (!r || r.is_super_admin ? 'super_admin' : 'restricted_admin') : r?.sections?.length ? 'instructor_with_access' : 'no_access';
        return { id: p.id, name: p.full_name, email: p.email, role: p.role, row: r || null, effective };
      }),
    });
  }));

  app.put('/api/admin/settings/permissions/:userId', handle(async (req, res) => {
    const { user } = await requireSection(req, 'super');
    const target = req.params.userId;
    if (!/^[0-9a-f-]{36}$/i.test(target)) throw new SettingsHttpError(400, 'Invalid user.');
    const { data: prof } = await db!.from('profiles').select('id, role, email').eq('id', target).maybeSingle();
    if (!prof || !['admin', 'instructor'].includes(prof.role)) throw new SettingsHttpError(400, 'Permissions can only be set for admins and instructors.');
    const isSuper = req.body?.isSuperAdmin === true && prof.role === 'admin';
    const sections = (Array.isArray(req.body?.sections) ? req.body.sections : []).filter((s: string) => (PERMISSION_SECTIONS as readonly string[]).includes(s) && !(prof.role === 'instructor' && s === 'payment'));
    if (target === user.id && !isSuper) throw new SettingsHttpError(400, 'You cannot remove your own super-admin access. Ask another super admin.');
    const { data: before } = await db!.from('admin_permissions').select('is_super_admin, sections').eq('user_id', target).maybeSingle();
    const { error } = await db!.from('admin_permissions').upsert({ user_id: target, is_super_admin: isSuper, sections, updated_at: new Date().toISOString(), updated_by: user.id }, { onConflict: 'user_id' });
    if (error) throw new SettingsHttpError(400, error.message);
    await audit({ section: 'permissions', action: 'permission_update', changes: { user: prof.email, from: before || 'full access (no restrictions)', to: { isSuperAdmin: isSuper, sections } }, actor: user });
    res.json({ ok: true });
  }));

  app.delete('/api/admin/settings/permissions/:userId', handle(async (req, res) => {
    const { user } = await requireSection(req, 'super');
    const target = req.params.userId;
    const { data: prof } = await db!.from('profiles').select('email, role').eq('id', target).maybeSingle();
    await db!.from('admin_permissions').delete().eq('user_id', target);
    await audit({ section: 'permissions', action: 'permission_reset', changes: { user: prof?.email, now: prof?.role === 'admin' ? 'full access' : 'no settings access' }, actor: user });
    res.json({ ok: true });
  }));
}
