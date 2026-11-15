/**
 * Edufy Academy — push notifications (Expo Push Service).
 *
 * • Admin API under /api/admin/push/* (admins only, rate limited, validated).
 * • A background worker in this Express process sends due campaigns, sends per-student
 *   notifications created by database triggers (course completion), checks Expo receipts and
 *   removes invalid device tokens.
 * • Every write uses the service-role client; the mobile app never sees provider credentials.
 *   EXPO_ACCESS_TOKEN (optional, only needed if "enhanced push security" is turned on in Expo)
 *   is read from the server environment.
 */
import type { Express, Request, Response } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import {
  AUDIENCES, CATEGORIES, EXPO_BATCH, RECEIPT_BATCH, chunk, cleanText, defaultActionUrl, expoMessage, finalStatus,
  isRetryableStatus, readTicket, validateCampaign,
} from './pushLogic';

const EXPO_SEND_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';
const WORKER_INTERVAL_MS = 20_000;
const RECEIPT_INTERVAL_MS = 5 * 60_000;
const PAGE = 1000;

interface Deps {
  db: SupabaseClient | null;
  /** true only when the client was created with the service-role key */
  serviceRole: boolean;
  getAuthUserProfile: (req: Request) => Promise<{ user: { id: string }; profile: any } | null>;
  expoAccessToken?: string;
  workerEnabled?: boolean;
  /** Admin → Settings → Notifications (global switch + per-category switches) */
  getNotificationSettings?: () => Promise<{ pushEnabled?: boolean; promotionalEnabled?: boolean; offersEnabled?: boolean } | null>;
}

class PushHttpError extends Error {
  constructor(public status: number, message: string, public extra?: Record<string, unknown>) {
    super(message);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function registerPushNotifications(app: Express, deps: Deps) {
  const { db } = deps;
  const workerState = { lastRunAt: null as string | null, lastError: null as string | null, lastReceiptsAt: null as string | null, running: false, paused: false };

  /* ------------------------------------------------------------------ Expo calls */
  async function expoPost(url: string, body: unknown): Promise<any> {
    let lastErr: Error | null = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            accept: 'application/json',
            'accept-encoding': 'gzip, deflate',
            'content-type': 'application/json',
            ...(deps.expoAccessToken ? { authorization: `Bearer ${deps.expoAccessToken}` } : {}),
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(20_000),
        });
        const json: any = await res.json().catch(() => null);
        if (res.ok) return json;
        const msg = json?.errors?.[0]?.message || `Expo Push Service returned HTTP ${res.status}`;
        if (!isRetryableStatus(res.status)) throw Object.assign(new Error(msg), { final: true });
        lastErr = new Error(msg);
      } catch (e: any) {
        if (e?.final) throw e;
        lastErr = e instanceof Error ? e : new Error(String(e));
      }
      await sleep(1000 * 2 ** attempt); // 1s, 2s, 4s, 8s
    }
    throw lastErr || new Error('Expo Push Service unavailable.');
  }

  async function removeInvalidTokens(tokens: string[], reason: string) {
    if (!db || !tokens.length) return;
    for (const part of chunk([...new Set(tokens)], 200)) {
      await db.from('push_devices').delete().in('token', part);
    }
    console.log(`[Push] removed ${tokens.length} invalid device token(s): ${reason}`);
  }

  /**
   * Sends one notification to a list of devices. Pending ticket rows are written BEFORE the request,
   * so a crash can never cause the same device to be pushed twice for the same notification.
   */
  async function sendToDevices(
    devices: { id: string; user_id: string; token: string }[],
    content: Parameters<typeof expoMessage>[1],
    owner: { push_notification_id?: string; user_notification_id?: string }
  ): Promise<{ ok: number; failed: number; lastError: string | null }> {
    let ok = 0;
    let failed = 0;
    let lastError: string | null = null;
    if (!db || !devices.length) return { ok, failed, lastError };
    const ownerKey = owner.push_notification_id ? 'push_notification_id,token' : 'user_notification_id,token';

    for (const candidates of chunk(devices, EXPO_BATCH)) {
      // Reserve each (notification, device) pair. Only pairs inserted now are sent — pairs that
      // already exist (earlier attempt, resumed send, second worker) are skipped.
      const { data: fresh, error: preErr } = await db
        .from('push_tickets')
        .upsert(candidates.map((d) => ({ ...owner, user_id: d.user_id, device_id: d.id, token: d.token, status: 'pending' })), { onConflict: ownerKey, ignoreDuplicates: true })
        .select('token');
      if (preErr) throw new Error(`Could not record push attempts: ${preErr.message}`);
      const reserved = new Set((fresh || []).map((r: any) => r.token));
      const batch = candidates.filter((d) => reserved.has(d.token));
      if (!batch.length) continue;
      const base = batch.map((d) => ({ ...owner, user_id: d.user_id, device_id: d.id, token: d.token }));

      let tickets: any[] = [];
      let batchError: string | null = null;
      try {
        const json = await expoPost(EXPO_SEND_URL, batch.map((d) => expoMessage(d.token, content)));
        tickets = Array.isArray(json?.data) ? json.data : json?.data ? [json.data] : [];
      } catch (e: any) {
        batchError = String(e?.message || e).slice(0, 300);
      }

      const invalid: string[] = [];
      const rows = batch.map((d, i) => {
        if (batchError) return { ...base[i], status: 'error', error: batchError, updated_at: new Date().toISOString() };
        const t = readTicket(tickets[i]);
        if (t.status === 'ok') return { ...base[i], status: 'ok', ticket_id: t.id, error: null, updated_at: new Date().toISOString() };
        if (t.invalidToken) invalid.push(d.token);
        return { ...base[i], status: 'error', error: t.error, updated_at: new Date().toISOString() };
      });
      rows.forEach((r) => (r.status === 'ok' ? ok++ : failed++));
      const errRow = rows.find((r) => r.status === 'error');
      if (errRow) lastError = (errRow as any).error;
      await db.from('push_tickets').upsert(rows, { onConflict: ownerKey });
      await removeInvalidTokens(invalid, 'DeviceNotRegistered (ticket)');
    }
    return { ok, failed, lastError };
  }

  async function devicesFor(userIds: string[]) {
    const out: { id: string; user_id: string; token: string }[] = [];
    if (!db) return out;
    for (const part of chunk(userIds, 200)) {
      const { data, error } = await db.from('push_devices').select('id, user_id, token').in('user_id', part).is('invalidated_at', null);
      if (error) throw new Error(error.message);
      out.push(...(data || []));
    }
    return out;
  }

  async function audienceIds(c: { audience: string; audience_course_id: string | null; audience_bundle_id: string | null; category: string }) {
    const ids: string[] = [];
    if (!db) return ids;
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await db
        .rpc('push_audience', { p_audience: c.audience, p_course_id: c.audience_course_id, p_bundle_id: c.audience_bundle_id, p_category: c.category })
        .range(from, from + PAGE - 1);
      if (error) throw new Error(error.message);
      const rows = (data || []) as { user_id: string }[];
      ids.push(...rows.map((r) => r.user_id));
      if (rows.length < PAGE) break;
    }
    return [...new Set(ids)];
  }

  /** Is the linked course/bundle/offer still valid to announce? */
  async function stillRelevant(c: any): Promise<string | null> {
    if (!db) return 'Database unavailable.';
    if (c.source === 'auto_course' && c.course_id) {
      const { data } = await db.from('courses').select('is_published').eq('id', c.course_id).maybeSingle();
      if (!data?.is_published) return 'The course is no longer published.';
    }
    if (c.source === 'auto_bundle' && c.bundle_id) {
      const { data } = await db.from('bundles').select('is_published').eq('id', c.bundle_id).maybeSingle();
      if (!data?.is_published) return 'The bundle is no longer published.';
    }
    if (c.offer_id) {
      const { data } = await db.from('offers').select('is_active, starts_at, ends_at').eq('id', c.offer_id).maybeSingle();
      if (!data || !data.is_active) return 'The offer is disabled or was deleted.';
      if (data.ends_at && new Date(data.ends_at).getTime() <= Date.now()) return 'The offer ended before it could be sent.';
    }
    return null;
  }

  /** A category switched off in Settings → Notifications cancels the campaign (with a clear reason). */
  async function disabledByAdmin(c: any): Promise<string | null> {
    const n = deps.getNotificationSettings ? await deps.getNotificationSettings().catch(() => null) : null;
    if (!n) return null;
    if ((c.category === 'offer' || c.category === 'discount') && n.offersEnabled === false) return 'Offer notifications are turned off in Settings → Notifications.';
    if (c.category === 'custom' && n.promotionalEnabled === false) return 'Promotional notifications are turned off in Settings → Notifications.';
    return null;
  }

  async function processCampaign(c: any) {
    if (!db) return;
    const update = (patch: Record<string, unknown>) =>
      db.from('push_notifications').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', c.id);
    try {
      const irrelevant = (await disabledByAdmin(c)) || (await stillRelevant(c));
      if (irrelevant) {
        await update({ status: 'cancelled', cancelled_at: new Date().toISOString(), last_error: irrelevant, locked_at: null });
        return;
      }

      const userIds = await audienceIds(c);
      const url = defaultActionUrl(c);

      // 1. Notification centre records (idempotent per student)
      for (const part of chunk(userIds, 500)) {
        const { error } = await db.from('user_notifications').upsert(
          part.map((user_id) => ({
            user_id, push_notification_id: c.id, dedupe_key: `push:${c.id}`, title: c.title, body: c.body,
            image_url: c.image_url, action_url: url, category: c.category, course_id: c.course_id, bundle_id: c.bundle_id, offer_id: c.offer_id,
          })),
          { onConflict: 'user_id,dedupe_key', ignoreDuplicates: true }
        );
        if (error) throw new Error(`Saving to notification centres failed: ${error.message}`);
      }
      const { count: inboxCount } = await db.from('user_notifications').select('id', { count: 'exact', head: true }).eq('dedupe_key', `push:${c.id}`);

      // 2. Push to every registered device (devices already attempted for this notification are skipped)
      const devices = await devicesFor(userIds);
      const result = await sendToDevices(
        devices,
        { title: c.title, body: c.body, image_url: c.image_url, category: c.category, url, data: { notificationId: c.id, ...(c.course_id ? { courseId: c.course_id } : {}), ...(c.bundle_id ? { bundleId: c.bundle_id } : {}), ...(c.offer_id ? { offerId: c.offer_id } : {}) } },
        { push_notification_id: c.id }
      );

      // 3. Totals from the ticket log (accurate across resumed sends)
      const [{ count: okCount }, { count: errCount }, { count: devCount }] = await Promise.all([
        db.from('push_tickets').select('id', { count: 'exact', head: true }).eq('push_notification_id', c.id).eq('status', 'ok'),
        db.from('push_tickets').select('id', { count: 'exact', head: true }).eq('push_notification_id', c.id).eq('status', 'error'),
        db.from('push_tickets').select('id', { count: 'exact', head: true }).eq('push_notification_id', c.id),
      ]);
      const fin = finalStatus({ devices: devCount || 0, ticketsOk: okCount || 0 });
      await update({
        status: fin.status, sent_at: new Date().toISOString(), locked_at: null,
        target_count: userIds.length, inbox_count: inboxCount || 0, device_count: devCount || 0,
        tickets_ok: okCount || 0, tickets_failed: errCount || 0,
        last_error: fin.note || ((errCount || 0) > 0 ? result.lastError : null),
      });
      console.log(`[Push] "${c.title}" → ${userIds.length} students, ${devCount || 0} devices, ${okCount || 0} accepted by Expo, ${errCount || 0} failed`);
    } catch (e: any) {
      const message = String(e?.message || e).slice(0, 300);
      console.error('[Push] campaign failed:', message);
      // Stay in 'sending' with the lock: requeue_stuck_push_notifications() retries it later (max 3 attempts)
      await update({ last_error: message });
    }
  }

  /** Per-student notifications created by database triggers (e.g. course completed). */
  async function processDirect() {
    if (!db) return;
    const { data: rows } = await db
      .from('user_notifications')
      .select('id, user_id, title, body, image_url, action_url, category, course_id, bundle_id, offer_id')
      .eq('push_status', 'pending')
      .order('created_at')
      .limit(100);
    for (const n of rows || []) {
      // Claim first so two workers never send the same one
      const { data: claimed } = await db.from('user_notifications').update({ push_status: 'sent' }).eq('id', n.id).eq('push_status', 'pending').select('id');
      if (!claimed?.length) continue;
      try {
        const devices = await devicesFor([n.user_id]);
        const r = await sendToDevices(
          devices,
          { title: n.title, body: n.body, image_url: n.image_url, category: n.category, url: n.action_url, data: { inboxId: n.id, ...(n.course_id ? { courseId: n.course_id } : {}) } },
          { user_notification_id: n.id }
        );
        if (devices.length && r.ok === 0) await db.from('user_notifications').update({ push_status: 'failed' }).eq('id', n.id);
        if (!devices.length) await db.from('user_notifications').update({ push_status: 'skipped' }).eq('id', n.id);
      } catch (e: any) {
        console.error('[Push] direct notification failed:', e?.message || e);
        await db.from('user_notifications').update({ push_status: 'failed' }).eq('id', n.id);
      }
    }
  }

  /** Expo receipts: confirm hand-off to FCM/APNs and clean up tokens that are no longer valid. */
  async function checkReceipts() {
    if (!db) return;
    const now = Date.now();
    const { data: pending } = await db
      .from('push_tickets')
      .select('id, ticket_id, token, push_notification_id')
      .eq('status', 'ok')
      .is('receipt_status', null)
      .lt('created_at', new Date(now - 15 * 60_000).toISOString())
      .gt('created_at', new Date(now - 24 * 3600_000).toISOString())
      .limit(RECEIPT_BATCH);
    if (!pending?.length) return;
    const json = await expoPost(EXPO_RECEIPTS_URL, { ids: pending.map((t: any) => t.ticket_id) });
    const receipts = json?.data || {};
    const okIds: string[] = [];
    const invalid: string[] = [];
    const campaigns = new Set<string>();
    for (const t of pending as any[]) {
      const r = receipts[t.ticket_id];
      if (!r) continue; // not ready yet
      if (t.push_notification_id) campaigns.add(t.push_notification_id);
      if (r.status === 'ok') okIds.push(t.ticket_id);
      else {
        const code = r.details?.error || 'Unknown';
        if (code === 'DeviceNotRegistered') invalid.push(t.token);
        await db.from('push_tickets').update({ receipt_status: 'error', receipt_error: String(r.message || code).slice(0, 300), receipt_checked_at: new Date().toISOString() }).eq('id', t.id);
        if (code === 'InvalidCredentials' || code === 'MismatchSenderId') workerState.lastError = `Expo receipt: ${code} — check the FCM V1 credentials uploaded to EAS.`;
      }
    }
    for (const part of chunk(okIds, 200)) {
      await db.from('push_tickets').update({ receipt_status: 'ok', receipt_checked_at: new Date().toISOString() }).in('ticket_id', part);
    }
    await removeInvalidTokens(invalid, 'DeviceNotRegistered (receipt)');
    for (const id of campaigns) {
      const [{ count: rOk }, { count: rErr }] = await Promise.all([
        db.from('push_tickets').select('id', { count: 'exact', head: true }).eq('push_notification_id', id).eq('receipt_status', 'ok'),
        db.from('push_tickets').select('id', { count: 'exact', head: true }).eq('push_notification_id', id).eq('receipt_status', 'error'),
      ]);
      await db.from('push_notifications').update({ receipts_ok: rOk || 0, receipts_failed: rErr || 0 }).eq('id', id);
    }
    workerState.lastReceiptsAt = new Date().toISOString();
  }

  /* ------------------------------------------------------------------ worker */
  let lastReceipts = 0;
  let kickTimer: NodeJS.Timeout | null = null;
  async function tick() {
    if (!db || !deps.serviceRole || workerState.running) return;
    // Global switch (Settings → Notifications): nothing is sent; queued notifications wait until it is back on
    const n = deps.getNotificationSettings ? await deps.getNotificationSettings().catch(() => null) : null;
    workerState.paused = n?.pushEnabled === false;
    if (workerState.paused) return;
    workerState.running = true;
    try {
      await db.rpc('requeue_stuck_push_notifications', { p_minutes: 10 });
      const { data: due, error } = await db.rpc('claim_due_push_notifications', { p_limit: 3 });
      if (error) throw new Error(error.message);
      for (const c of (due || []) as any[]) await processCampaign(c);
      await processDirect();
      if (Date.now() - lastReceipts > RECEIPT_INTERVAL_MS) {
        lastReceipts = Date.now();
        await checkReceipts().catch((e) => console.warn('[Push] receipts check failed:', e?.message || e));
      }
      workerState.lastRunAt = new Date().toISOString();
      if (workerState.lastError && !workerState.lastError.startsWith('Expo receipt')) workerState.lastError = null;
    } catch (e: any) {
      workerState.lastError = String(e?.message || e).slice(0, 300);
      if (!/relation .* does not exist|schema cache/i.test(workerState.lastError)) console.warn('[Push] worker:', workerState.lastError);
    } finally {
      workerState.running = false;
    }
  }
  const kick = () => {
    if (kickTimer) return;
    kickTimer = setTimeout(() => {
      kickTimer = null;
      tick();
    }, 500);
  };

  if (deps.workerEnabled !== false && db && deps.serviceRole) {
    setInterval(tick, WORKER_INTERVAL_MS).unref();
    setTimeout(tick, 5_000).unref();
    console.log('[Push] notification worker started (every 20 s).');
  } else {
    console.warn('[Push] notification worker NOT started — SUPABASE_SERVICE_ROLE_KEY is required on the server.');
  }

  /* ------------------------------------------------------------------ admin API */
  const writes = new Map<string, number[]>();
  function rateLimit(userId: string, max = 30, windowMs = 60_000) {
    const now = Date.now();
    const list = (writes.get(userId) || []).filter((t) => now - t < windowMs);
    if (list.length >= max) throw new PushHttpError(429, 'Too many requests. Please wait a minute and try again.');
    list.push(now);
    writes.set(userId, list);
  }

  async function requireAdmin(req: Request) {
    if (!db || !deps.serviceRole) throw new PushHttpError(503, 'Push notifications need SUPABASE_SERVICE_ROLE_KEY on the server.');
    const auth = await deps.getAuthUserProfile(req);
    if (!auth?.user) throw new PushHttpError(401, 'Authentication required.');
    if (auth.profile?.role !== 'admin') throw new PushHttpError(403, 'Only administrators can manage notifications.');
    return auth.user;
  }

  const handle = (fn: (req: Request, res: Response) => Promise<unknown>) => async (req: Request, res: Response) => {
    try {
      await fn(req, res);
    } catch (e: any) {
      const status = e instanceof PushHttpError ? e.status : 500;
      if (!(e instanceof PushHttpError)) console.error('[Push] admin API error:', e?.message || e);
      res.status(status).json({ error: e instanceof PushHttpError ? e.message : 'Request failed. Please try again.', ...(e?.extra || {}) });
    }
  };

  const CAMPAIGN_COLUMNS =
    'id, title, body, image_url, action_url, category, course_id, bundle_id, offer_id, audience, audience_course_id, audience_bundle_id, status, scheduled_at, source, created_at, updated_at, sent_at, cancelled_at, target_count, inbox_count, device_count, tickets_ok, tickets_failed, receipts_ok, receipts_failed, last_error, attempts';
  const isUuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v);

  async function loadCampaign(id: string) {
    if (!isUuid(id)) throw new PushHttpError(404, 'Notification not found.');
    const { data } = await db!.from('push_notifications').select(CAMPAIGN_COLUMNS).eq('id', id).maybeSingle();
    if (!data) throw new PushHttpError(404, 'Notification not found.');
    return data as any;
  }

  /** Checks that referenced course/bundle/offer exist (so an admin can't target something invalid). */
  async function checkReferences(v: { course_id: string | null; bundle_id: string | null; offer_id: string | null; audience_course_id: string | null; audience_bundle_id: string | null }) {
    const errors: Record<string, string> = {};
    const exists = async (table: string, id: string | null, field: string, label: string) => {
      if (!id) return;
      const { data } = await db!.from(table).select('id').eq('id', id).maybeSingle();
      if (!data) errors[field] = `That ${label} no longer exists.`;
    };
    await Promise.all([
      exists('courses', v.course_id, 'courseId', 'course'),
      exists('bundles', v.bundle_id, 'bundleId', 'bundle'),
      exists('offers', v.offer_id, 'offerId', 'offer'),
      exists('courses', v.audience_course_id, 'audienceCourseId', 'course'),
      exists('bundles', v.audience_bundle_id, 'audienceBundleId', 'bundle'),
    ]);
    if (Object.keys(errors).length) throw new PushHttpError(400, 'Please fix the highlighted fields.', { fieldErrors: errors });
  }

  function parseSchedule(v: unknown): string {
    const d = new Date(String(v || ''));
    if (Number.isNaN(d.getTime())) throw new PushHttpError(400, 'Choose a valid date and time.', { fieldErrors: { scheduledAt: 'Choose a valid date and time.' } });
    if (d.getTime() < Date.now() - 60_000) throw new PushHttpError(400, 'The scheduled time is in the past.', { fieldErrors: { scheduledAt: 'The scheduled time is in the past.' } });
    if (d.getTime() > Date.now() + 365 * 24 * 3600_000) throw new PushHttpError(400, 'Schedule within the next 12 months.', { fieldErrors: { scheduledAt: 'Schedule within the next 12 months.' } });
    return d.toISOString();
  }

  const needsConfirmation = (audience: string, confirmed: unknown) => audience === 'all_students' && confirmed !== true;

  // Overview: counts, history, settings, worker health
  app.get('/api/admin/push/overview', handle(async (req, res) => {
    await requireAdmin(req);
    const statuses = ['draft', 'pending_review', 'scheduled', 'sending', 'sent', 'failed', 'cancelled'];
    const counts: Record<string, number> = {};
    await Promise.all(statuses.map(async (s) => {
      const { count } = await db!.from('push_notifications').select('id', { count: 'exact', head: true }).eq('status', s);
      counts[s] = count || 0;
    }));
    const [{ data: list }, { count: devices }, { data: settingsRow }, { data: sums }] = await Promise.all([
      db!.from('push_notifications').select(CAMPAIGN_COLUMNS).order('created_at', { ascending: false }).limit(200),
      db!.from('push_devices').select('id', { count: 'exact', head: true }).is('invalidated_at', null),
      db!.from('platform_settings').select('value').eq('key', 'push_notifications').maybeSingle(),
      db!.from('push_notifications').select('target_count, tickets_ok, tickets_failed, receipts_ok, receipts_failed').in('status', ['sent', 'failed']).limit(10000),
    ]);
    const totals = (sums || []).reduce(
      (t: any, r: any) => ({
        targeted: t.targeted + (r.target_count || 0), accepted: t.accepted + (r.tickets_ok || 0), rejected: t.rejected + (r.tickets_failed || 0),
        delivered: t.delivered + (r.receipts_ok || 0), receiptErrors: t.receiptErrors + (r.receipts_failed || 0),
      }),
      { targeted: 0, accepted: 0, rejected: 0, delivered: 0, receiptErrors: 0 }
    );
    res.json({
      counts, total: Object.values(counts).reduce((a, b) => a + b, 0), totals, devices: devices || 0,
      notifications: list || [], settings: settingsRow?.value || {},
      worker: { ...workerState, accessTokenConfigured: !!deps.expoAccessToken },
    });
  }));

  app.get('/api/admin/push/notifications/:id', handle(async (req, res) => {
    await requireAdmin(req);
    const c = await loadCampaign(req.params.id);
    const { data: errs } = await db!.from('push_tickets').select('error, receipt_error').eq('push_notification_id', c.id).or('status.eq.error,receipt_status.eq.error').limit(500);
    const reasons: Record<string, number> = {};
    for (const e of errs || []) {
      const k = (e as any).error || (e as any).receipt_error || 'Unknown';
      reasons[k] = (reasons[k] || 0) + 1;
    }
    const { count: opened } = await db!.from('user_notifications').select('id', { count: 'exact', head: true }).eq('dedupe_key', `push:${c.id}`).not('read_at', 'is', null);
    res.json({ notification: c, failureReasons: reasons, readInApp: opened || 0 });
  }));

  app.post('/api/admin/push/audience-preview', handle(async (req, res) => {
    await requireAdmin(req);
    const audience = AUDIENCES.includes(req.body?.audience) ? req.body.audience : 'all_students';
    const category = CATEGORIES.includes(req.body?.category) ? req.body.category : 'announcement';
    const ids = await audienceIds({ audience, audience_course_id: req.body?.audienceCourseId || null, audience_bundle_id: req.body?.audienceBundleId || null, category });
    const devices = ids.length ? await devicesFor(ids) : [];
    res.json({ students: ids.length, devices: devices.length, studentsWithDevices: new Set(devices.map((d) => d.user_id)).size });
  }));

  // Create: draft | schedule | now
  app.post('/api/admin/push/notifications', handle(async (req, res) => {
    const user = await requireAdmin(req);
    rateLimit(user.id);
    const v = validateCampaign(req.body);
    if (!v.ok) throw new PushHttpError(400, 'Please fix the highlighted fields.', { fieldErrors: v.errors });
    await checkReferences(v.value);
    const mode = ['draft', 'schedule', 'now'].includes(req.body?.mode) ? req.body.mode : 'draft';
    if (mode !== 'draft' && needsConfirmation(v.value.audience, req.body?.confirmed)) {
      throw new PushHttpError(400, 'Please confirm sending to all students.', { needsConfirmation: true });
    }
    const key = typeof req.body?.idempotencyKey === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(req.body.idempotencyKey) ? req.body.idempotencyKey : crypto.randomUUID();
    const row = {
      ...v.value,
      status: mode === 'draft' ? 'draft' : 'scheduled',
      scheduled_at: mode === 'now' ? new Date().toISOString() : mode === 'schedule' ? parseSchedule(req.body?.scheduledAt) : null,
      source: req.body?.source === 'offer' && v.value.offer_id ? 'offer' : 'manual',
      source_key: `manual:${key}`,
      created_by: user.id,
    };
    const { data, error } = await db!.from('push_notifications').insert(row).select(CAMPAIGN_COLUMNS).single();
    if (error) {
      if ((error as any).code === '23505') {
        // Same form submitted twice (double click / retry): return the original
        const { data: existing } = await db!.from('push_notifications').select(CAMPAIGN_COLUMNS).eq('source_key', `manual:${key}`).maybeSingle();
        return res.json({ notification: existing, duplicate: true });
      }
      throw new PushHttpError(400, `Could not save the notification: ${error.message}`);
    }
    if (mode === 'now') kick();
    res.status(201).json({ notification: data });
  }));

  // Edit a draft / pending / not-yet-sent scheduled notification
  app.patch('/api/admin/push/notifications/:id', handle(async (req, res) => {
    const user = await requireAdmin(req);
    rateLimit(user.id);
    const c = await loadCampaign(req.params.id);
    if (!['draft', 'pending_review', 'scheduled'].includes(c.status)) throw new PushHttpError(409, 'Only drafts and unsent notifications can be edited.');
    const v = validateCampaign(req.body);
    if (!v.ok) throw new PushHttpError(400, 'Please fix the highlighted fields.', { fieldErrors: v.errors });
    await checkReferences(v.value);
    const patch: Record<string, unknown> = { ...v.value, updated_at: new Date().toISOString() };
    if (c.status === 'scheduled' && req.body?.scheduledAt) patch.scheduled_at = parseSchedule(req.body.scheduledAt);
    const { data, error } = await db!.from('push_notifications').update(patch).eq('id', c.id).in('status', ['draft', 'pending_review', 'scheduled']).select(CAMPAIGN_COLUMNS).maybeSingle();
    if (error) throw new PushHttpError(400, error.message);
    if (!data) throw new PushHttpError(409, 'This notification started sending and can no longer be edited.');
    res.json({ notification: data });
  }));

  // Send now (drafts, items waiting for review, scheduled items)
  app.post('/api/admin/push/notifications/:id/send', handle(async (req, res) => {
    const user = await requireAdmin(req);
    rateLimit(user.id);
    const c = await loadCampaign(req.params.id);
    if (!['draft', 'pending_review', 'scheduled'].includes(c.status)) throw new PushHttpError(409, `This notification is ${c.status.replace('_', ' ')} and cannot be sent again.`);
    if (needsConfirmation(c.audience, req.body?.confirmed)) throw new PushHttpError(400, 'Please confirm sending to all students.', { needsConfirmation: true });
    const { data } = await db!.from('push_notifications')
      .update({ status: 'scheduled', scheduled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', c.id).in('status', ['draft', 'pending_review', 'scheduled']).select(CAMPAIGN_COLUMNS).maybeSingle();
    if (!data) throw new PushHttpError(409, 'This notification is already being sent.');
    kick();
    res.json({ notification: data });
  }));

  app.post('/api/admin/push/notifications/:id/schedule', handle(async (req, res) => {
    const user = await requireAdmin(req);
    rateLimit(user.id);
    const c = await loadCampaign(req.params.id);
    if (!['draft', 'pending_review', 'scheduled'].includes(c.status)) throw new PushHttpError(409, 'Only drafts and unsent notifications can be scheduled.');
    if (needsConfirmation(c.audience, req.body?.confirmed)) throw new PushHttpError(400, 'Please confirm sending to all students.', { needsConfirmation: true });
    const at = parseSchedule(req.body?.scheduledAt);
    const { data } = await db!.from('push_notifications')
      .update({ status: 'scheduled', scheduled_at: at, updated_at: new Date().toISOString() })
      .eq('id', c.id).in('status', ['draft', 'pending_review', 'scheduled']).select(CAMPAIGN_COLUMNS).maybeSingle();
    if (!data) throw new PushHttpError(409, 'This notification is already being sent.');
    res.json({ notification: data });
  }));

  app.post('/api/admin/push/notifications/:id/cancel', handle(async (req, res) => {
    const user = await requireAdmin(req);
    rateLimit(user.id);
    const c = await loadCampaign(req.params.id);
    const { data } = await db!.from('push_notifications')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString(), last_error: 'Cancelled by an administrator.' })
      .eq('id', c.id).in('status', ['draft', 'pending_review', 'scheduled']).select(CAMPAIGN_COLUMNS).maybeSingle();
    if (!data) throw new PushHttpError(409, 'This notification has already been sent (or is sending) and cannot be cancelled.');
    res.json({ notification: data });
  }));

  app.delete('/api/admin/push/notifications/:id', handle(async (req, res) => {
    const user = await requireAdmin(req);
    rateLimit(user.id);
    const c = await loadCampaign(req.params.id);
    if (!['draft', 'cancelled'].includes(c.status)) throw new PushHttpError(409, 'Only drafts and cancelled notifications can be deleted. Sent notifications stay in the history.');
    await db!.from('push_notifications').delete().eq('id', c.id).in('status', ['draft', 'cancelled']);
    res.json({ success: true });
  }));

  app.put('/api/admin/push/settings', handle(async (req, res) => {
    const user = await requireAdmin(req);
    rateLimit(user.id);
    const b = req.body || {};
    const value = {
      auto_course_enabled: b.auto_course_enabled !== false,
      auto_bundle_enabled: b.auto_bundle_enabled !== false,
      auto_requires_review: b.auto_requires_review === true,
      auto_audience: b.auto_audience === 'enrolled_students' ? 'enrolled_students' : 'all_students',
      auto_delay_minutes: Math.max(0, Math.min(1440, Math.round(Number(b.auto_delay_minutes) || 0))),
    };
    const { error } = await db!.from('platform_settings').upsert({ key: 'push_notifications', value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) throw new PushHttpError(400, error.message);
    res.json({ settings: value });
  }));

  // Test push to the administrator's own signed-in devices (nothing is sent to students)
  app.post('/api/admin/push/test', handle(async (req, res) => {
    const user = await requireAdmin(req);
    rateLimit(user.id, 5);
    const title = cleanText(req.body?.title, 65) || 'Edufy test notification';
    const body = cleanText(req.body?.body, 240) || 'Push notifications are working on this device.';
    const devices = await devicesFor([user.id]);
    if (!devices.length) throw new PushHttpError(400, 'No device is registered for your account. Sign in to the Edufy app (development or production build) with this admin account and allow notifications first.');
    const testId = crypto.randomUUID();
    const r = await sendToDevices(devices, { title, body, category: 'announcement', url: '/notifications', image_url: null, data: { test: '1' } }, { user_notification_id: testId });
    res.json({ devices: devices.length, accepted: r.ok, failed: r.failed, error: r.lastError });
  }));

  return { kick, tick };
}
