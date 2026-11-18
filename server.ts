import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { registerPushNotifications } from './server/push';
import { createSettingsService, registerSettingsRoutes } from './server/settings';
import { createCredentialStore } from './server/credentials';
import { createPaymentGateway } from './server/paymentGateway';
import { createEmailService } from './server/email';
import { courseListHtml } from './server/emailTemplates';
import { activeUrls } from './server/domain';
import { createManagementClient } from './server/supabaseManagement';
import { registerAuthEmailHook } from './server/authHook';
import { createCronHandler } from './server/cron';
import { createImageService, ImageHttpError } from './server/images';
import { createAdiloLibrary, LibraryError } from './server/adiloLibrary';
import { renderIndexHtml, robotsTxt } from './server/settingsSchema';

// .env.local holds public VITE_ values; .env holds server-only secrets. Neither is committed.
// .env.local always wins over .env (so placeholder values copied from .env.example can't override real ones).
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local', override: true });

/** Ignore unfilled placeholder values copied from .env.example. */
const envValue = (...names: string[]): string => {
  for (const n of names) {
    const v = (process.env[n] || '').trim();
    if (v && !/your-project|your[-_]|yourkeyid|placeholder|^sb_publishable_\.\.\.$/i.test(v)) return v;
  }
  return '';
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// `npm run dev` runs server.ts from the project root; production runs the compiled
// server-dist/server.mjs. Either way, PROJECT_ROOT is the folder that holds dist/.
const PROJECT_ROOT = path.basename(__dirname) === 'server-dist' ? path.dirname(__dirname) : __dirname;

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Supabase Configuration
const supabaseUrl = envValue('SUPABASE_URL', 'VITE_SUPABASE_URL');
const supabaseServiceKey = envValue('SUPABASE_SERVICE_ROLE_KEY');
const supabaseAnonKey = envValue('SUPABASE_ANON_KEY', 'VITE_SUPABASE_PUBLISHABLE_KEY', 'VITE_SUPABASE_ANON_KEY');

// Initialize Supabase Admin Client (Server-side privileged client with Service Role Key)
let supabaseAdmin: SupabaseClient | null = null;
if (supabaseUrl && supabaseServiceKey) {
  supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  console.log('[Server] Supabase Service Role client initialized.');
} else if (supabaseUrl && supabaseAnonKey) {
  supabaseAdmin = createClient(supabaseUrl, supabaseAnonKey);
  console.log('[Server] Supabase Anonymous client initialized.');
} else {
  console.warn('[Server] Supabase credentials not found in env. Running in demo fallback mode.');
}

// Razorpay configuration. Keys come from the admin panel (encrypted, verified before activation)
// or, when none were saved there, from RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET / RAZORPAY_WEBHOOK_SECRET.
const razorpayEnv = {
  keyId: envValue('RAZORPAY_KEY_ID'),
  keySecret: envValue('RAZORPAY_KEY_SECRET'),
  webhookSecret: envValue('RAZORPAY_WEBHOOK_SECRET'),
};

// Centralized settings (site_settings), encrypted credentials, payment gateway and email
const settingsService = createSettingsService(supabaseAdmin && supabaseServiceKey ? supabaseAdmin : null);
// Cloudinary image CDN (CLOUDINARY_URL; the API secret never leaves the server). Falls back to Supabase Storage when unset.
const imageService = createImageService({
  db: supabaseAdmin && supabaseServiceKey ? supabaseAdmin : null,
  env: process.env,
  supabaseUrl: supabaseUrl || '',
  getAuthUserProfile: (req) => getAuthUserProfile(req),
});
if (!imageService.configured()) console.warn('[Server] Cloudinary is not configured (CLOUDINARY_URL): images are stored in Supabase Storage.');

const credentialStore = createCredentialStore(supabaseAdmin && supabaseServiceKey ? supabaseAdmin : null, process.env.SETTINGS_ENCRYPTION_KEY);
const paymentGateway = createPaymentGateway(credentialStore, razorpayEnv);
// Transactional email: SMTP (or Resend/Brevo) from Admin → Settings → SMTP & Email (encrypted), with the
// SMTP_* / EMAIL_* environment variables as fallback. Emails go through the durable email_outbox queue.
const emailService = createEmailService({
  db: supabaseAdmin && supabaseServiceKey ? supabaseAdmin : null,
  credentials: credentialStore,
  env: {
    provider: envValue('EMAIL_PROVIDER'), apiKey: envValue('EMAIL_API_KEY'),
    smtpHost: envValue('SMTP_HOST'), smtpPort: envValue('SMTP_PORT'), smtpSecurity: envValue('SMTP_SECURITY'),
    smtpUsername: envValue('SMTP_USERNAME'), smtpPassword: envValue('SMTP_PASSWORD'),
  },
  getSettings: () => settingsService.getAll(),
  getUrls: async () => {
    const all = await settingsService.getAll();
    return activeUrls(all.domain, all.general?.siteUrl || '');
  },
  workerEnabled: process.env.EMAIL_WORKER_ENABLED !== 'false',
});
// Optional: lets super admins apply Site URL / redirect URLs / Google provider / email hook to Supabase Auth
const supabaseManagement = createManagementClient(envValue('SUPABASE_MANAGEMENT_TOKEN') || undefined, supabaseUrl || '');
if (razorpayEnv.keyId && razorpayEnv.keySecret) console.log('[Server] Razorpay keys found in the environment.');
else console.warn('[Server] Razorpay keys not in the environment (they can be added in Admin → Settings → Payment gateway).');
if (!process.env.SETTINGS_ENCRYPTION_KEY) console.warn('[Server] SETTINGS_ENCRYPTION_KEY is not set: credentials can only come from the environment.');

// Behind Hostinger / Nginx / a load balancer: trust the first proxy so req.protocol and req.ip are correct.
app.set('trust proxy', 1);
app.disable('x-powered-by');

// CORS. API calls are authenticated with a Bearer token (no cookies), so cross-site requests can't
// ride on a user's session. Still, in production set CORS_ORIGINS to the website address(es), e.g.
//   CORS_ORIGINS=https://edufyacademy.com,https://www.edufyacademy.com
// When it is empty every origin is allowed (local development / same-origin deployments).
// The mobile app sends no Origin header and is never blocked.
const corsOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim().replace(/\/+$/, ''))
  .filter(Boolean);
app.use(
  cors(
    corsOrigins.length
      ? {
          origin: (origin, cb) => {
            if (!origin || corsOrigins.includes(origin)) return cb(null, true);
            return cb(null, false);
          },
        }
      : undefined
  )
);
if (process.env.NODE_ENV === 'production' && !corsOrigins.length) {
  console.warn('[Server] CORS_ORIGINS is not set — the API accepts requests from any website origin.');
}

// Middleware to capture raw body for webhook verification with 50mb limit for uploads
app.use(
  express.json({
    limit: '50mb',
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

/**
 * Authentication Helper: extracts user from Bearer token
 */
async function getAuthUser(req: Request) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.split(' ')[1];
  if (!token) return null;

  if (supabaseAdmin) {
    try {
      const { data, error } = await supabaseAdmin.auth.getUser(token);
      if (error || !data.user) {
        return null;
      }
      return data.user;
    } catch {
      return null;
    }
  }

  return null;
}

// ============================================================================
// API ROUTES
// ============================================================================

/**
 * Health & Configuration Status
 */
app.get('/api/health', async (req: Request, res: Response) => {
  // Optional live credential check: GET /api/health?check=razorpay (never exposes secrets)
  let razorpayLive: { ok: boolean; mode?: string; error?: string } | undefined;
  if (req.query.check === 'razorpay') {
    const rzp = await paymentGateway.current();
    if (!rzp?.client) {
      razorpayLive = { ok: false, error: 'Razorpay keys not configured' };
    } else {
      try {
        await rzp.client.orders.all({ count: 1 });
        razorpayLive = { ok: true, mode: rzp.mode };
      } catch (err: any) {
        razorpayLive = { ok: false, error: err?.error?.description || err?.message || 'Authentication failed' };
      }
    }
  }
  // Optional live Adilo credential check: GET /api/health?check=adilo (calls GET /v1/projects, never exposes keys)
  let adiloLive: { ok: boolean; projects?: number; error?: string } | undefined;
  if (req.query.check === 'adilo') {
    try {
      const r = await adiloRequest('GET', '/projects?From=1&To=1');
      adiloLive = { ok: true, projects: r?.meta?.total ?? (Array.isArray(r?.payload) ? r.payload.length : undefined) };
    } catch (err: any) {
      adiloLive = { ok: false, error: err?.message || 'Adilo check failed' };
    }
  }
  res.json({
    ...(razorpayLive ? { razorpayLive } : {}),
    ...(adiloLive ? { adiloLive } : {}),
    adilo: { configured: !!(envValue('ADILO_PUBLIC_KEY') && envValue('ADILO_SECRET_KEY')) },
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Edufy Academy Backend API',
    supabase: {
      configured: !!(supabaseUrl && (supabaseServiceKey || supabaseAnonKey)),
      hasServiceRole: !!supabaseServiceKey,
    },
    razorpay: await (async () => {
      const rzp = await paymentGateway.current();
      return { configured: !!rzp, keyId: rzp ? `${rzp.keyId.substring(0, 8)}...` : null, mode: rzp?.mode || null, source: rzp?.source || null };
    })(),
  });
});

/**
 * 1. Create Razorpay Payment Order (single course, cart of courses, or a bundle)
 * POST /api/payments/create-order
 * Body: { courseId } | { courseIds: string[] } | { bundleId }
 * Prices always come from the database — never from the client.
 */
app.post('/api/payments/create-order', async (req: Request, res: Response) => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: Valid authentication token required.' });
    }
    if (!supabaseAdmin) {
      return res.status(503).json({ error: 'Database service is currently unavailable.' });
    }

    const { courseId, courseIds, bundleId } = req.body;
    const currency = 'INR';
    let targetCourseIds: string[] = [];
    let totalPrice = 0;
    let displayTitle = '';
    let bundle: { id: string; title: string; price: number } | null = null;

    if (bundleId) {
      const { data: b } = await supabaseAdmin
        .from('bundles')
        .select('id, title, price, is_published, bundle_courses(course_id, courses(id, is_published))')
        .eq('id', bundleId)
        .single();
      if (!b || !b.is_published) {
        return res.status(404).json({ error: 'Bundle not found or not available.' });
      }
      targetCourseIds = ((b as any).bundle_courses || [])
        .filter((bc: any) => bc.courses?.is_published)
        .map((bc: any) => bc.course_id);
      if (targetCourseIds.length === 0) {
        return res.status(400).json({ error: 'This bundle has no available courses.' });
      }
      bundle = { id: b.id, title: b.title, price: parseFloat(String(b.price)) || 0 };
      totalPrice = bundle.price;
      displayTitle = bundle.title;
    } else {
      const requested: string[] = Array.isArray(courseIds) && courseIds.length > 0 ? courseIds : courseId ? [courseId] : [];
      if (requested.length === 0) {
        return res.status(400).json({ error: 'Missing courseId, courseIds or bundleId.' });
      }
      const { data: coursesData } = await supabaseAdmin
        .from('courses')
        .select('id, price, title, is_published')
        .in('id', requested)
        .eq('is_published', true);
      if (!coursesData || coursesData.length === 0) {
        return res.status(404).json({ error: 'Course(s) not found or not published.' });
      }
      targetCourseIds = coursesData.map((c: any) => c.id);
      totalPrice = coursesData.reduce((sum: number, c: any) => sum + (parseFloat(c.price) || 0), 0);
      displayTitle = coursesData.length === 1 ? coursesData[0].title : `Edufy Learning Bundle (${coursesData.length} Courses)`;
    }

    // Skip courses the learner already owns
    const { data: existingEnrollments } = await supabaseAdmin
      .from('enrollments')
      .select('course_id')
      .eq('user_id', user.id)
      .in('course_id', targetCourseIds)
      .eq('status', 'active');
    const owned = new Set((existingEnrollments || []).map((e: any) => e.course_id));
    const unowned = targetCourseIds.filter((id) => !owned.has(id));
    if (unowned.length === 0) {
      return res.status(400).json({ error: 'Already enrolled: you already have access to the selected course(s).' });
    }

    // Free courses: enrol directly, no payment order
    if (totalPrice <= 0) {
      for (const cId of unowned) {
        await supabaseAdmin.from('enrollments').upsert(
          { user_id: user.id, course_id: cId, bundle_id: bundle?.id || null, status: 'active', enrolled_at: new Date().toISOString() },
          { onConflict: 'user_id,course_id' }
        );
      }
      return res.json({ free: true, courseIds: unowned });
    }

    const amountInSubunits = Math.round(totalPrice * 100);
    const receiptId = `rcpt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    let orderId: string;

    // Admin switch: Settings → Payment gateway → "Online payments enabled"
    const paymentSettings = (await settingsService.getAll()).payment;
    if (paymentSettings?.enabled === false) {
      return res.status(503).json({ error: 'Online payments are temporarily unavailable. Please try again later or contact support.' });
    }
    const rzp = await paymentGateway.current();
    const razorpayClient = rzp?.client || null;

    if (razorpayClient) {
      if (amountInSubunits < 100) {
        return res.status(400).json({ error: 'Razorpay requires a minimum amount of ₹1.' });
      }
      const order = await razorpayClient.orders.create({
        amount: amountInSubunits,
        currency,
        receipt: receiptId,
        notes: {
          userId: user.id,
          bundleId: bundle?.id || '',
          courseIds: unowned.join(','),
          courseTitle: displayTitle,
        },
      });
      orderId = order.id;
    } else if (process.env.NODE_ENV !== 'production') {
      orderId = `order_test_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      console.log(`[Payment] Test order ${orderId} for ${unowned.length} course(s)`);
    } else {
      return res.status(503).json({ error: 'Payments are not configured.' });
    }

    const { error: payErr } = await supabaseAdmin.from('payments').insert({
      user_id: user.id,
      course_id: unowned[0],
      bundle_id: bundle?.id || null,
      razorpay_order_id: orderId,
      amount: totalPrice,
      currency,
      status: 'created',
      receipt: receiptId,
      notes: { courseTitle: displayTitle, courseIds: unowned, bundleId: bundle?.id || null },
    });
    if (payErr) throw payErr;

    return res.json({
      orderId,
      amount: amountInSubunits,
      currency,
      keyId: rzp?.keyId || 'rzp_test_edufy_dummy_key',
      courseTitle: displayTitle,
      courseIds: unowned,
      bundleId: bundle?.id || null,
      user: { name: user.user_metadata?.full_name || 'Edufy Student', email: user.email },
    });
  } catch (error: any) {
    console.error('[Payment Error] create-order failed:', error);
    // Razorpay SDK errors look like { statusCode, error: { code, description } }
    const rzpDescription = error?.error?.description;
    const reason =
      error?.statusCode === 401
        ? 'Razorpay rejected the API key/secret (authentication failed). Check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env.'
        : rzpDescription || error?.message || 'Internal server error';
    return res.status(500).json({ error: `Failed to create payment order: ${reason}`, details: reason });
  }
});

/**
 * Queues the purchase confirmation after a verified payment. Keyed by order id, so the verify endpoint and the
 * webhook (which can both fire) produce exactly one email. Never throws and never blocks the enrollment.
 */
async function queuePurchaseEmail(payment: any, user: any | null) {
  try {
    if (!payment?.user_id || !supabaseAdmin) return;
    let email = user?.email as string | undefined;
    let name = user?.user_metadata?.full_name as string | undefined;
    if (!email || !name) {
      const { data: prof } = await supabaseAdmin.from('profiles').select('email, full_name').eq('id', payment.user_id).maybeSingle();
      email = email || prof?.email;
      name = name || prof?.full_name;
    }
    const courseIds: string[] = Array.isArray(payment?.notes?.courseIds) ? payment.notes.courseIds : payment.course_id ? [payment.course_id] : [];
    const { data: courses } = courseIds.length
      ? await supabaseAdmin.from('courses').select('id, title').in('id', courseIds)
      : { data: [] as any[] };
    const all = await settingsService.getAll();
    const site = activeUrls(all.domain, all.general?.siteUrl || '').siteUrl;
    const list = (courses || []).map((c: any) => ({ title: c.title, url: site ? `${site}/learn/${encodeURIComponent(c.id)}` : '' }));
    const bundleId = payment.bundle_id || payment?.notes?.bundleId || null;
    const paidAt = payment.updated_at || payment.created_at || new Date().toISOString();
    const vars: Record<string, unknown> = {
      student_name: name || 'there',
      course_name: list.length === 1 ? list[0].title : payment?.notes?.courseTitle || 'your courses',
      course_id: list.length === 1 ? courseIds[0] : '',
      course_list: courseListHtml(list),
      bundle_name: bundleId ? payment?.notes?.courseTitle || 'your bundle' : '',
      order_id: payment.razorpay_order_id || '',
      transaction_id: payment.razorpay_payment_id || '',
      amount: `₹${Number(payment.amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`,
      payment_date: new Date(paidAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }),
    };
    await emailService.enqueue(bundleId ? 'bundle_purchase' : 'course_purchase', {
      to: email, userId: payment.user_id, eventKey: `purchase:${payment.razorpay_order_id || payment.id}`, vars,
    });
  } catch (e: any) {
    console.warn('[Email] purchase email not queued:', e?.message || e);
  }
}

/** Grants enrollments for a captured payment row (idempotent). */
async function fulfilPayment(payment: any) {
  if (!supabaseAdmin) return [];
  const courseIds: string[] = Array.isArray(payment?.notes?.courseIds) ? payment.notes.courseIds : [payment.course_id];
  const granted: string[] = [];
  for (const cId of courseIds) {
    const { data: existing } = await supabaseAdmin
      .from('enrollments')
      .select('id, status')
      .eq('user_id', payment.user_id)
      .eq('course_id', cId)
      .maybeSingle();

    await supabaseAdmin.from('enrollments').upsert(
      {
        user_id: payment.user_id,
        course_id: cId,
        payment_id: payment.id,
        bundle_id: payment.bundle_id || null,
        status: 'active',
        enrolled_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,course_id' }
    );

    if (!existing || existing.status !== 'active') {
      const { data: course } = await supabaseAdmin.from('courses').select('enrolled_count').eq('id', cId).single();
      if (course) {
        await supabaseAdmin.from('courses').update({ enrolled_count: (course.enrolled_count || 0) + 1 }).eq('id', cId);
      }
    }
    granted.push(cId);
  }
  return granted;
}

const safeEqualHex = (a: string, b: string) => {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b || '');
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
};

/**
 * 2. Verify Razorpay Payment Signature & Grant Enrollment
 * POST /api/payments/verify-payment
 * The courses granted are read from the server-side payment record, never from the request.
 */
app.post('/api/payments/verify-payment', async (req: Request, res: Response) => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: Valid authentication token required.' });
    }
    if (!supabaseAdmin) {
      return res.status(503).json({ error: 'Database service is currently unavailable.' });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id) {
      return res.status(400).json({ error: 'Missing required payment verification parameters.' });
    }

    const { data: payment } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('razorpay_order_id', razorpay_order_id)
      .eq('user_id', user.id)
      .single();
    if (!payment) {
      return res.status(404).json({ error: 'Payment order not found for this account.' });
    }

    let isValid = false;
    const verifySecrets = await paymentGateway.verificationSecrets();
    if (verifySecrets.length) {
      isValid = verifySecrets.some((secret) =>
        safeEqualHex(crypto.createHmac('sha256', secret).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest('hex'), String(razorpay_signature || ''))
      );
    } else if (process.env.NODE_ENV !== 'production' && String(razorpay_order_id).startsWith('order_test_')) {
      isValid = true; // local development only
    }

    if (!isValid) {
      await supabaseAdmin
        .from('payments')
        .update({ status: 'failed', razorpay_payment_id, razorpay_signature, updated_at: new Date().toISOString() })
        .eq('id', payment.id);
      return res.status(400).json({ success: false, error: 'Payment verification failed: invalid signature.' });
    }

    const { data: captured } = await supabaseAdmin
      .from('payments')
      .update({ status: 'captured', razorpay_payment_id, razorpay_signature, updated_at: new Date().toISOString() })
      .eq('id', payment.id)
      .select('*')
      .single();

    const granted = await fulfilPayment(captured || payment);
    void queuePurchaseEmail(captured || payment, user);

    return res.json({
      success: true,
      message: `Payment verified. Lifetime access activated for ${granted.length} course(s).`,
      courseIds: granted,
      courseId: granted[0],
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
    });
  } catch (error: any) {
    console.error('[Payment Error] verify-payment failed:', error);
    return res.status(500).json({ error: 'Failed to verify payment.', details: error?.message || 'Internal server error' });
  }
});

/**
 * 3. Razorpay Server-to-Server Webhook Handler
 * POST /api/payments/webhook — requires RAZORPAY_WEBHOOK_SECRET and a valid signature.
 */
app.post('/api/payments/webhook', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-razorpay-signature'] as string;
    const webhookSecrets = await paymentGateway.webhookSecrets();
    if (!webhookSecrets.length || !signature) {
      return res.status(400).json({ error: 'Webhook signature required.' });
    }
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);
    const validSignature = webhookSecrets.some((secret) => safeEqualHex(crypto.createHmac('sha256', secret).update(rawBody).digest('hex'), signature));
    if (!validSignature) {
      console.warn('[Webhook] Invalid Razorpay webhook signature received.');
      return res.status(400).json({ error: 'Invalid webhook signature.' });
    }

    const event = req.body.event;
    console.log(`[Webhook] Received Razorpay event: ${event}`);
    // Lets Admin → Settings → Payment gateway show that webhooks are arriving
    if (supabaseAdmin && supabaseServiceKey) {
      void supabaseAdmin
        .from('platform_settings')
        .upsert({ key: 'razorpay_webhook_last', value: { at: new Date().toISOString(), event: String(event || '').slice(0, 40) }, updated_at: new Date().toISOString() }, { onConflict: 'key' })
        .then(() => undefined, () => undefined);
    }

    if ((event === 'payment.captured' || event === 'order.paid') && supabaseAdmin) {
      const paymentEntity = req.body.payload?.payment?.entity;
      const orderId = paymentEntity?.order_id;
      if (orderId) {
        const { data: payment } = await supabaseAdmin
          .from('payments')
          .update({
            status: 'captured',
            razorpay_payment_id: paymentEntity?.id,
            webhook_verified: true,
            updated_at: new Date().toISOString(),
          })
          .eq('razorpay_order_id', orderId)
          .select('*')
          .single();
        if (payment) {
          await fulfilPayment(payment);
          void queuePurchaseEmail(payment, null);
        }
      }
    }

    // Refunds (full or partial) issued from the Razorpay dashboard
    if (event === 'refund.processed' && supabaseAdmin) {
      const refund = req.body.payload?.refund?.entity;
      const paymentId = refund?.payment_id;
      if (paymentId && refund?.id) {
        const { data: pay } = await supabaseAdmin.from('payments').select('*').eq('razorpay_payment_id', paymentId).maybeSingle();
        if (pay) {
          const full = Number(refund.amount || 0) >= Math.round(Number(pay.amount || 0) * 100);
          if (full && pay.status !== 'refunded') {
            await supabaseAdmin.from('payments').update({ status: 'refunded', updated_at: new Date().toISOString() }).eq('id', pay.id);
          }
          const { data: prof } = await supabaseAdmin.from('profiles').select('email, full_name').eq('id', pay.user_id).maybeSingle();
          await emailService.enqueue('refund', {
            to: prof?.email, userId: pay.user_id, eventKey: `refund:${refund.id}`,
            vars: {
              student_name: prof?.full_name || 'there', course_name: pay?.notes?.courseTitle || 'your purchase',
              order_id: pay.razorpay_order_id || '', transaction_id: paymentId, refund_id: refund.id,
              amount: `₹${(Number(refund.amount || 0) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`,
              payment_date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }),
            },
          });
        }
      }
    }

    return res.status(200).json({ status: 'ok', received: true });
  } catch (error: any) {
    console.error('[Webhook Error]:', error);
    return res.status(500).json({ error: 'Webhook processing failed.' });
  }
});

/**
 * 3b. Student Payment & Transaction History Endpoint
 * GET /api/payments/history
 */
app.get('/api/payments/history', async (req: Request, res: Response) => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required.' });
    }

    if (supabaseAdmin) {
      const { data: payments, error } = await supabaseAdmin
        .from('payments')
        .select('*, courses(id, title, thumbnail_url, category)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!error && payments) {
        return res.json({ payments });
      }
    }

    return res.json({ payments: [] });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to retrieve payment history', details: error?.message });
  }
});

/**
 * 4. Claim / Generate Verified Certificate
 * POST /api/certificates/claim
 */
app.post('/api/certificates/claim', async (req: Request, res: Response) => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required.' });
    }

    const { courseId } = req.body;
    if (!courseId) {
      return res.status(400).json({ error: 'courseId is required.' });
    }

    if (!supabaseAdmin) {
      return res.status(503).json({ error: 'Database service is currently unavailable.' });
    }

    // Verify course exists
    const { data: course } = await supabaseAdmin
      .from('courses')
      .select('title, total_lessons, instructor_id, profiles(full_name)')
      .eq('id', courseId)
      .single();

    if (!course) {
      return res.status(404).json({ error: 'Course not found.' });
    }

    // Verify user is enrolled
    const { data: enrollment } = await supabaseAdmin
      .from('enrollments')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('course_id', courseId)
      .maybeSingle();

    if (!enrollment || enrollment.status !== 'active') {
      return res.status(403).json({ error: 'You must be actively enrolled in this course to claim a certificate.' });
    }

    // Check if a certificate was already issued (idempotent: never issue twice)
    const { data: existingCert } = await supabaseAdmin
      .from('certificates')
      .select('*')
      .eq('user_id', user.id)
      .eq('course_id', courseId)
      .maybeSingle();

    if (existingCert) {
      return res.json({ success: true, certificate: existingCert, alreadyIssued: true });
    }

    // Verify completion against the CURRENT curriculum: every lesson of the course must be
    // completed (progress rows for deleted lessons don't count; duplicates count once).
    const { data: courseLessons } = await supabaseAdmin.from('lessons').select('id').eq('course_id', courseId);
    const lessonIds = new Set((courseLessons || []).map((l: any) => l.id));
    const { data: doneRows } = await supabaseAdmin
      .from('lesson_progress')
      .select('lesson_id')
      .eq('user_id', user.id)
      .eq('course_id', courseId)
      .eq('is_completed', true);
    const completedCount = new Set((doneRows || []).map((r: any) => r.lesson_id).filter((id: string) => lessonIds.has(id))).size;
    const totalLessons = lessonIds.size;
    if (totalLessons === 0 || completedCount < totalLessons) {
      return res.status(403).json({
        error: `Complete every lesson to earn this certificate (${completedCount} of ${totalLessons} completed).`,
        completed: completedCount,
        total: totalLessons,
      });
    }
    const progressPercent = 100;

    // Retrieve student name
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();

    const studentName = profile?.full_name || user.user_metadata?.full_name || 'Edufy Graduate';
    const instructorName = (course as any).profiles?.full_name || 'Edufy Master Faculty';
    const certCode = `EDFY-${new Date().getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const verificationHash = crypto
      .createHash('sha256')
      .update(`${certCode}:${user.id}:${courseId}:${studentName}`)
      .digest('hex');

    const { data: newCert, error: certError } = await supabaseAdmin
      .from('certificates')
      .insert({
        certificate_code: certCode,
        user_id: user.id,
        course_id: courseId,
        student_name: studentName,
        course_title: course.title,
        instructor_name: instructorName,
        issue_date: new Date().toISOString().split('T')[0],
        grade_percentage: progressPercent || 100,
        verification_hash: verificationHash,
      })
      .select()
      .single();

    if (certError) {
      // Two simultaneous claims: the unique (user_id, course_id) index rejects the second insert
      if ((certError as any).code === '23505') {
        const { data: raced } = await supabaseAdmin.from('certificates').select('*').eq('user_id', user.id).eq('course_id', courseId).maybeSingle();
        if (raced) return res.json({ success: true, certificate: raced, alreadyIssued: true });
      }
      throw certError;
    }

    // Mark enrollment as completed
    await supabaseAdmin
      .from('enrollments')
      .update({ completed_at: new Date().toISOString() })
      .eq('id', enrollment.id);

    // The certificate email is queued by the database (trigger on public.certificates).
    return res.json({ success: true, certificate: newCert });
  } catch (error: any) {
    console.error('[Certificate Error]:', error);
    return res.status(500).json({ error: 'Failed to claim certificate.', details: error?.message });
  }
});

/**
 * 5. Verify Certificate Publicly by Code
 * GET /api/certificates/verify/:code
 */
app.get('/api/certificates/verify/:code', async (req: Request, res: Response) => {
  try {
    const code = req.params.code.trim().toUpperCase();

    if (supabaseAdmin) {
      // Public endpoint: return only what a verifier needs (no internal user id)
      const { data: cert, error } = await supabaseAdmin
        .from('certificates')
        .select('id, certificate_code, course_id, student_name, course_title, instructor_name, issue_date, grade_percentage, verification_hash, created_at')
        .eq('certificate_code', code)
        .maybeSingle();

      if (error || !cert) {
        return res.status(404).json({
          valid: false,
          error: 'Certificate not found. Please verify the alphanumeric code on your credentials.',
        });
      }

      return res.json({ valid: true, certificate: cert });
    }

    return res.status(404).json({ valid: false, error: 'Certificate credential code not recognized.' });
  } catch (error: any) {
    return res.status(500).json({ error: 'Verification service error.', details: error?.message });
  }
});

/**
 * 6. Generate Protected Supabase Storage Signed URL for Enrolled Learners
 * POST /api/storage/signed-url
 */
app.post('/api/storage/signed-url', async (req: Request, res: Response) => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required.' });
    }

    const { courseId, filePath } = req.body;
    if (!courseId || !filePath) {
      return res.status(400).json({ error: 'courseId and filePath are required.' });
    }

    if (!supabaseAdmin) {
      return res.status(503).json({ error: 'Storage service unavailable.' });
    }

    // The file must belong to this course (a lesson asset or attached resource)
    const { data: courseLessons } = await supabaseAdmin
      .from('lessons')
      .select('storage_asset_path, resources')
      .eq('course_id', courseId);
    const belongsToCourse = (courseLessons || []).some(
      (l: any) =>
        l.storage_asset_path === filePath ||
        (Array.isArray(l.resources) && l.resources.some((r: any) => r?.storagePath === filePath))
    );
    if (!belongsToCourse) {
      return res.status(404).json({ error: 'Resource not found in this course.' });
    }

    // Owner instructor / admin, or an actively enrolled learner
    const { data: requester } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single();
    const { data: courseRow } = await supabaseAdmin.from('courses').select('instructor_id').eq('id', courseId).single();
    const isStaff = requester?.role === 'admin' || courseRow?.instructor_id === user.id;

    const { data: enrollment } = await supabaseAdmin
      .from('enrollments')
      .select('id')
      .eq('user_id', user.id)
      .eq('course_id', courseId)
      .eq('status', 'active')
      .maybeSingle();

    if (!enrollment && !isStaff) {
      return res.status(403).json({ error: 'Access denied: Active course enrollment is required to access private resources.' });
    }

    // Create 1-hour signed URL from 'course-materials' private bucket
    const { data, error } = await supabaseAdmin.storage
      .from('course-materials')
      .createSignedUrl(filePath, 3600);

    if (error) {
      return res.status(500).json({ error: 'Failed to generate signed download URL.', details: error.message });
    }

    return res.json({ signedUrl: data.signedUrl });
  } catch (error: any) {
    return res.status(500).json({ error: 'Storage service failure.', details: error?.message });
  }
});

/**
 * Helper: Get Authenticated User & Profile
 */
/** Course preview video: keep only the link (an <iframe> embed code is reduced to its src). Never store HTML. */
function cleanPreviewVideo(input: any): string | null {
  if (typeof input !== 'string' || !input.trim()) return null;
  let raw = input.trim();
  if (/<\s*iframe/i.test(raw)) {
    raw = (raw.match(/\ssrc\s*=\s*"([^"]+)"/i)?.[1] || raw.match(/\ssrc\s*=\s*'([^']+)'/i)?.[1] || '').replace(/&amp;/gi, '&').trim();
  }
  if (raw.startsWith('//')) raw = `https:${raw}`;
  if (!raw || raw.length > 2000 || /[<>"']/.test(raw)) return null;
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
}

async function getAuthUserProfile(req: Request) {
  const user = await getAuthUser(req);
  if (!user || !supabaseAdmin) return null;
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  return { user, profile };
}

/**
 * 7. Upload Course Media / Assets to Supabase Storage
 * POST /api/upload
 */
app.post('/api/upload', async (req: Request, res: Response) => {
  try {
    const auth = await getAuthUserProfile(req);
    if (!auth || !auth.user) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required.' });
    }

    const role = auth.profile?.role || 'student';
    if (role !== 'instructor' && role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Only instructors and administrators can upload course media.' });
    }

    if (!supabaseAdmin) {
      return res.status(503).json({ error: 'Database service unavailable.' });
    }

    const { fileBase64, fileName, fileType, bucket } = req.body;
    if (!fileBase64 || !fileName || !bucket) {
      return res.status(400).json({ error: 'fileBase64, fileName, and bucket are required.' });
    }

    const allowedBuckets = ['course-thumbnails', 'course-videos', 'course-materials'];
    if (!allowedBuckets.includes(bucket)) {
      return res.status(400).json({ error: `Invalid bucket. Allowed buckets: ${allowedBuckets.join(', ')}` });
    }

    // Strip data URL header if present (e.g. data:image/jpeg;base64,...)
    const base64Data = fileBase64.replace(/^data:([A-Za-z-+\/]+);base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Max size limit check (e.g. 50MB)
    if (buffer.length > 50 * 1024 * 1024) {
      return res.status(413).json({ error: 'File size exceeds 50MB limit.' });
    }

    // Images go to the Cloudinary CDN when it is configured (videos and course materials stay in Supabase Storage)
    if (bucket === 'course-thumbnails' && imageService.configured()) {
      try {
        const up = await imageService.uploadBuffer(buffer, { kind: typeof req.body.context === 'string' ? req.body.context : 'other', source: 'upload', userId: auth.user.id });
        return res.json({ success: true, url: up.url, storageAssetPath: up.publicId, bucket: 'cloudinary', provider: 'cloudinary', fileName, size: buffer.length, width: up.width, height: up.height });
      } catch (e: any) {
        const status = e instanceof ImageHttpError ? e.status : 500;
        console.error('[Upload Error] Cloudinary:', e?.message || e);
        return res.status(status).json({ error: status === 500 ? 'Failed to upload the image.' : e.message, details: e?.message });
      }
    }

    // Generate sanitized, collision-free file path
    const ext = path.extname(fileName) || (fileType?.includes('video') ? '.mp4' : fileType?.includes('pdf') ? '.pdf' : '.jpg');
    const cleanBase = path.basename(fileName, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const storageFilePath = `${auth.user.id}/${Date.now()}-${cleanBase}${ext}`;

    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from(bucket)
      .upload(storageFilePath, buffer, {
        contentType: fileType || 'application/octet-stream',
        upsert: true,
      });

    if (uploadError) {
      console.error('[Upload Error]:', uploadError);
      return res.status(500).json({ error: 'Failed to upload file to storage.', details: uploadError.message });
    }

    let publicUrl = '';
    if (bucket === 'course-thumbnails' || bucket === 'course-videos') {
      const { data: publicData } = supabaseAdmin.storage.from(bucket).getPublicUrl(uploadData.path);
      publicUrl = publicData.publicUrl;
    }

    return res.json({
      success: true,
      url: publicUrl,
      storageAssetPath: uploadData.path,
      bucket,
      fileName,
      size: buffer.length,
    });
  } catch (error: any) {
    console.error('[Upload API Exception]:', error);
    return res.status(500).json({ error: 'Media upload failed.', details: error?.message });
  }
});

/**
 * 8. Save/Upsert Course and Curriculum
 * POST /api/courses/save
 */
app.post('/api/courses/save', async (req: Request, res: Response) => {
  try {
    const auth = await getAuthUserProfile(req);
    if (!auth || !auth.user) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required.' });
    }

    const role = auth.profile?.role || 'student';
    if (role !== 'instructor' && role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Only instructors and administrators can create or edit courses.' });
    }

    if (!supabaseAdmin) {
      return res.status(503).json({ error: 'Database service unavailable.' });
    }

    const { course, curriculum = [], submitForReview = false } = req.body;
    if (!course || !course.title) {
      return res.status(400).json({ error: 'Course title and payload are required.' });
    }

    const existingCourseId = course.id && !course.id.startsWith('temp-') ? course.id : null;
    let instructorId = auth.user.id;
    let wasPublished = false;

    // If updating an existing course, check authorization
    if (existingCourseId) {
      const { data: existingCourse, error: fetchErr } = await supabaseAdmin
        .from('courses')
        .select('id, instructor_id, is_published, prerequisites')
        .eq('id', existingCourseId)
        .single();

      if (fetchErr || !existingCourse) {
        return res.status(404).json({ error: 'Course not found in database.' });
      }

      if (role !== 'admin' && existingCourse.instructor_id && existingCourse.instructor_id !== auth.user.id) {
        return res.status(403).json({ error: 'Unauthorized: You can only edit your own courses.' });
      }

      instructorId = existingCourse.instructor_id || auth.user.id;
      wasPublished = !!existingCourse.is_published;
    }

    // Calculate total lessons and duration hours
    let totalLessons = 0;
    let totalMinutes = 0;
    if (Array.isArray(curriculum)) {
      for (const section of curriculum) {
        if (Array.isArray(section.lessons)) {
          totalLessons += section.lessons.length;
          for (const lesson of section.lessons) {
            totalMinutes += Number(lesson.durationMinutes) || 10;
          }
        }
      }
    }
    const durationHours = Math.max(0.5, Math.round((totalMinutes / 60) * 10) / 10);

    // Unique slug generation
    const baseSlug = (course.title || 'untitled-course')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const uniqueSuffix = crypto.randomBytes(3).toString('hex');
    const slug = existingCourseId && course.slug ? course.slug : `${baseSlug}-${uniqueSuffix}`;

    // Status resolution
    let isPublished = false;
    let targetStatus = course.status || (submitForReview ? 'pending_review' : 'draft');

    if (role === 'admin') {
      if (course.isPublished !== undefined) {
        isPublished = !!course.isPublished;
        targetStatus = isPublished ? 'published' : (course.status || 'draft');
      } else if (course.status === 'published') {
        isPublished = true;
        targetStatus = 'published';
      }
    } else {
      // Instructor flow: cannot directly publish without admin review.
      // Edits to an already-approved (live) course stay live.
      if (wasPublished && !submitForReview) {
        isPublished = true;
        targetStatus = 'published';
      } else if (submitForReview) {
        isPublished = false;
        targetStatus = 'pending_review';
      } else {
        isPublished = false;
        targetStatus = 'draft';
      }
    }

    // Encode status cleanly into prerequisites JSONB array
    let cleanPrereqs = Array.isArray(course.requirements || course.prerequisites)
      ? (course.requirements || course.prerequisites).filter((r: string) => !r.startsWith('__status:'))
      : [];
    if (!isPublished) {
      cleanPrereqs.unshift(`__status:${targetStatus}`);
    }

    const coursePayload: any = {
      title: course.title.trim(),
      slug,
      subtitle: (course.subtitle || 'Mastery curriculum authored on Edufy').trim(),
      description: (course.description || 'Comprehensive learning modules and hands-on exercises.').trim(),
      category: course.category || 'Web Development',
      category_slug: (course.category || 'Web Development').toLowerCase().replace(/\s+/g, '-'),
      level: course.level || 'All Levels',
      language: course.language || 'English',
      price: parseFloat(course.price) || 0.0,
      original_price: parseFloat(course.originalPrice) || (parseFloat(course.price) ? parseFloat(course.price) * 1.5 : 0),
      duration_hours: durationHours,
      total_lessons: Math.max(totalLessons, 1),
      thumbnail_url: course.thumbnail || course.thumbnail_url || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=80',
      banner_url: cleanPreviewVideo(course.bannerUrl || course.previewVideoUrl),
      instructor_id: instructorId,
      learning_outcomes: Array.isArray(course.learningOutcomes) ? course.learningOutcomes : ['Gain real-world practical skills'],
      prerequisites: cleanPrereqs,
      is_published: isPublished,
      // Merchandising flags can only be set by admins
      ...(role === 'admin'
        ? { featured: !!course.featured, bestseller: !!course.bestseller, trending: !!course.trending }
        : {}),
      updated_at: new Date().toISOString(),
    };

    let finalCourseId = existingCourseId;

    if (existingCourseId) {
      const { error: updateErr } = await supabaseAdmin
        .from('courses')
        .update(coursePayload)
        .eq('id', existingCourseId);

      if (updateErr) {
        console.error('[Course Update Error]:', updateErr);
        return res.status(500).json({ error: 'Failed to update course in database.', details: updateErr.message });
      }
    } else {
      finalCourseId = `course-${crypto.randomBytes(4).toString('hex')}`;
      coursePayload.id = finalCourseId;
      coursePayload.rating = 5.0;
      coursePayload.review_count = 0;
      coursePayload.enrolled_count = 0;
      coursePayload.created_at = new Date().toISOString();

      const { error: insertErr } = await supabaseAdmin
        .from('courses')
        .insert(coursePayload);

      if (insertErr) {
        console.error('[Course Insert Error]:', insertErr);
        return res.status(500).json({ error: 'Failed to create course in database.', details: insertErr.message });
      }
    }

    // Sync curriculum: keep existing section/lesson IDs so learner progress survives edits.
    if (Array.isArray(curriculum) && curriculum.length > 0) {
      const { data: existingSections } = await supabaseAdmin.from('course_sections').select('id').eq('course_id', finalCourseId);
      const { data: existingLessons } = await supabaseAdmin.from('lessons').select('id, quiz_id, adilo_file_id').eq('course_id', finalCourseId);
      const existingAdilo = new Map((existingLessons || []).map((l: any) => [l.id, l.adilo_file_id]));
      const existingSectionIds = new Set((existingSections || []).map((s: any) => s.id));
      const existingLessonIds = new Set((existingLessons || []).map((l: any) => l.id));
      const keptSectionIds = new Set<string>();
      const keptLessonIds = new Set<string>();
      const isPersisted = (id: any, set: Set<string>) => typeof id === 'string' && !id.includes('temp') && set.has(id);

      for (let sIdx = 0; sIdx < curriculum.length; sIdx++) {
        const sec = curriculum[sIdx];
        const secId = isPersisted(sec.id, existingSectionIds) ? sec.id : `sec-${crypto.randomBytes(5).toString('hex')}`;
        keptSectionIds.add(secId);

        const { error: secErr } = await supabaseAdmin
          .from('course_sections')
          .upsert({ id: secId, course_id: finalCourseId, title: sec.title || `Section ${sIdx + 1}`, section_order: sIdx + 1 }, { onConflict: 'id' });
        if (secErr) {
          console.error('[Section Save Error]:', secErr);
          continue;
        }

        const lessons = Array.isArray(sec.lessons) ? sec.lessons : [];
        for (let lIdx = 0; lIdx < lessons.length; lIdx++) {
          const les = lessons[lIdx];
          const lesId = isPersisted(les.id, existingLessonIds) ? les.id : `les-${crypto.randomBytes(5).toString('hex')}`;
          keptLessonIds.add(lesId);
          const type = ['video', 'article', 'quiz'].includes(les.type) ? les.type : 'video';

          // Quiz lessons: upsert the quiz and its questions
          let quizId: string | null = les.quizId || null;
          if (type === 'quiz' && les.quiz && Array.isArray(les.quiz.questions)) {
            quizId = quizId && !String(quizId).includes('temp') ? quizId : `quiz-${crypto.randomBytes(5).toString('hex')}`;
            await supabaseAdmin.from('quizzes').upsert(
              {
                id: quizId,
                course_id: finalCourseId,
                title: les.quiz.title || les.title || 'Quiz',
                passing_score_percentage: Math.min(100, Math.max(1, Number(les.quiz.passingScorePercent) || 70)),
              },
              { onConflict: 'id' }
            );
            await supabaseAdmin.from('quiz_questions').delete().eq('quiz_id', quizId);
            const qRows = les.quiz.questions
              .filter((q: any) => q && q.question && Array.isArray(q.options) && q.options.filter(Boolean).length >= 2)
              .map((q: any, qIdx: number) => ({
                id: `q-${crypto.randomBytes(5).toString('hex')}`,
                quiz_id: quizId,
                question: String(q.question),
                options: q.options.map((o: any) => String(o)),
                correct_option_index: Math.max(0, Math.min(q.options.length - 1, Number(q.correctOptionIndex) || 0)),
                explanation: String(q.explanation || ''),
                question_order: qIdx + 1,
              }));
            if (qRows.length) await supabaseAdmin.from('quiz_questions').insert(qRows);
          }

          // Adilo video: only attach files this user uploaded through Edufy (or already on this lesson)
          let adiloFields: Record<string, any> = {};
          const requestedFileId = typeof les.adiloFileId === 'string' && les.adiloFileId.trim() ? les.adiloFileId.trim() : null;
          const currentFileId = existingAdilo.get(lesId) || null;
          if (requestedFileId && requestedFileId === currentFileId) {
            const embed = normaliseAdiloEmbedUrl(les.adiloEmbedUrl);
            adiloFields = embed ? { adilo_embed_url: embed, video_updated_at: new Date().toISOString() } : {};
          } else if (requestedFileId) {
            const { data: upload } = await supabaseAdmin
              .from('adilo_uploads')
              .select('user_id, project_id, filename, duration_seconds, response, status')
              .eq('adilo_file_id', requestedFileId)
              .eq('status', 'uploaded')
              .maybeSingle();
            if (upload && (upload.user_id === auth.user.id || role === 'admin')) {
              const complete = (upload.response as any)?.complete || {};
              adiloFields = {
                adilo_file_id: requestedFileId,
                adilo_project_id: complete.project?.id || upload.project_id,
                adilo_embed_url: normaliseAdiloEmbedUrl(les.adiloEmbedUrl) || findAdiloPlayerUrl(upload.response),
                video_title: complete.title || upload.filename,
                video_duration: upload.duration_seconds,
                video_status: 'uploaded',
                video_metadata: upload.response || {},
                video_created_at: new Date().toISOString(),
                video_updated_at: new Date().toISOString(),
              };
            } else {
              console.warn(`[Course Save] Ignored unverified Adilo file for lesson ${lesId}`);
            }
          } else if (!currentFileId && typeof les.adiloEmbedUrl === 'string' && normaliseAdiloEmbedUrl(les.adiloEmbedUrl)) {
            // Link-only Adilo lesson (e.g. created by the CSV importer): allow editing its player link
            adiloFields = { adilo_embed_url: normaliseAdiloEmbedUrl(les.adiloEmbedUrl), video_updated_at: new Date().toISOString() };
          } else if (currentFileId && les.adiloFileId === null) {
            adiloFields = {
              adilo_file_id: null, adilo_project_id: null, adilo_embed_url: null, video_title: null,
              video_duration: null, video_status: null, video_metadata: {}, video_updated_at: new Date().toISOString(),
            };
          }

          const lessonRow: any = {
              ...adiloFields,
              id: lesId,
              section_id: secId,
              course_id: finalCourseId,
              title: les.title || `Lesson ${lIdx + 1}`,
              duration_minutes: Number(les.durationMinutes) || 10,
              type,
              video_url: type === 'video' ? les.videoUrl || null : null,
              content_text: les.contentText || les.articleContent || null,
              storage_asset_path: les.storageAssetPath || null,
              is_free_preview: !!les.isFreePreview,
              quiz_id: type === 'quiz' ? quizId : null,
              resources: Array.isArray(les.resources) ? les.resources.slice(0, 20) : [],
              lesson_order: lIdx + 1,
          };
          let { error: lesErr } = await supabaseAdmin.from('lessons').upsert(lessonRow, { onConflict: 'id' });
          if (lesErr && /resources/i.test(lesErr.message)) {
            // Database not yet migrated with lessons.resources — save without attachments
            delete lessonRow.resources;
            ({ error: lesErr } = await supabaseAdmin.from('lessons').upsert(lessonRow, { onConflict: 'id' }));
          }
          if (lesErr) console.error('[Lesson Save Error]:', lesErr);
          if (quizId && type === 'quiz') {
            await supabaseAdmin.from('quizzes').update({ lesson_id: lesId }).eq('id', quizId);
          }
        }
      }

      // Remove lessons and sections that were deleted in the editor
      const lessonsToDelete = [...existingLessonIds].filter((id) => !keptLessonIds.has(id));
      if (lessonsToDelete.length) await supabaseAdmin.from('lessons').delete().in('id', lessonsToDelete);
      const sectionsToDelete = [...existingSectionIds].filter((id) => !keptSectionIds.has(id));
      if (sectionsToDelete.length) await supabaseAdmin.from('course_sections').delete().in('id', sectionsToDelete);
    }

    return res.json({
      success: true,
      courseId: finalCourseId,
      status: targetStatus,
      isPublished,
      message: isPublished
        ? 'Course published successfully and is now live on the marketplace!'
        : submitForReview
        ? 'Course submitted for administrator review.'
        : 'Course draft saved successfully.',
    });
  } catch (error: any) {
    console.error('[Course Save Exception]:', error);
    return res.status(500).json({ error: 'Failed to save course.', details: error?.message });
  }
});

/**
 * 9. Get All Courses for Admin (including unpublished/drafts)
 * GET /api/courses/admin/all
 */
app.get('/api/courses/admin/all', async (req: Request, res: Response) => {
  try {
    const auth = await getAuthUserProfile(req);
    if (!auth || !auth.user || auth.profile?.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Admin credentials required.' });
    }

    if (!supabaseAdmin) {
      return res.status(503).json({ error: 'Database service unavailable.' });
    }

    const { data, error } = await supabaseAdmin
      .from('courses')
      .select(`
        *,
        course_sections (
          id,
          title,
          section_order,
          lessons (
            *,
            quizzes ( id, title, passing_score_percentage, quiz_questions ( id, question, options, correct_option_index, explanation, question_order ) )
          )
        ),
        profiles:instructor_id (
          id,
          full_name,
          avatar_url,
          headline,
          bio
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: 'Failed to retrieve admin catalog.', details: error.message });
    }

    return res.json({ courses: data || [] });
  } catch (error: any) {
    return res.status(500).json({ error: 'Catalog retrieval error.', details: error?.message });
  }
});

/**
 * 10. Get Courses Authored by Current Instructor
 * GET /api/courses/instructor/mine
 */
app.get('/api/courses/instructor/mine', async (req: Request, res: Response) => {
  try {
    const auth = await getAuthUserProfile(req);
    if (!auth || !auth.user) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required.' });
    }

    if (!supabaseAdmin) {
      return res.status(503).json({ error: 'Database service unavailable.' });
    }

    let query = supabaseAdmin
      .from('courses')
      .select(`
        *,
        course_sections (
          id,
          title,
          section_order,
          lessons (
            *,
            quizzes ( id, title, passing_score_percentage, quiz_questions ( id, question, options, correct_option_index, explanation, question_order ) )
          )
        ),
        profiles:instructor_id (
          id,
          full_name,
          avatar_url,
          headline,
          bio
        )
      `)
      .order('created_at', { ascending: false });

    // If user is not admin, only show their courses
    if (auth.profile?.role !== 'admin') {
      query = query.eq('instructor_id', auth.user.id);
    }

    const { data, error } = await query;
    if (error) {
      return res.status(500).json({ error: 'Failed to fetch instructor courses.', details: error.message });
    }

    return res.json({ courses: data || [] });
  } catch (error: any) {
    return res.status(500).json({ error: 'Instructor courses query failed.', details: error?.message });
  }
});

/**
 * 11. Toggle Course Publication Status
 * POST /api/courses/:id/publish
 */
app.post('/api/courses/:id/publish', async (req: Request, res: Response) => {
  try {
    const auth = await getAuthUserProfile(req);
    if (!auth || !auth.user) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required.' });
    }

    if (!supabaseAdmin) {
      return res.status(503).json({ error: 'Database service unavailable.' });
    }

    const courseId = req.params.id;
    const { isPublished, status } = req.body;
    const role = auth.profile?.role || 'student';

    const { data: course, error: fetchErr } = await supabaseAdmin
      .from('courses')
      .select('id, instructor_id, prerequisites')
      .eq('id', courseId)
      .single();

    if (fetchErr || !course) {
      return res.status(404).json({ error: 'Course not found.' });
    }

    // Check ownership
    if (role !== 'admin' && course.instructor_id !== auth.user.id) {
      return res.status(403).json({ error: 'Unauthorized: You can only alter your own courses.' });
    }

    let newPublished = false;
    let newStatus = status || 'draft';

    if (role === 'admin') {
      newPublished = isPublished !== undefined ? !!isPublished : status === 'published';
      newStatus = newPublished ? 'published' : (status || 'draft');
    } else {
      // Instructor can only request review or revert to draft
      if (status === 'pending_review') {
        newPublished = false;
        newStatus = 'pending_review';
      } else {
        newPublished = false;
        newStatus = 'draft';
      }
    }

    // Clean and encode status
    let prereqs = Array.isArray(course.prerequisites)
      ? course.prerequisites.filter((p: string) => !p.startsWith('__status:'))
      : [];
    if (!newPublished) {
      prereqs.unshift(`__status:${newStatus}`);
    }

    const { error: updateErr } = await supabaseAdmin
      .from('courses')
      .update({
        is_published: newPublished,
        prerequisites: prereqs,
        updated_at: new Date().toISOString(),
      })
      .eq('id', courseId);

    if (updateErr) {
      return res.status(500).json({ error: 'Failed to update publication status.', details: updateErr.message });
    }

    return res.json({
      success: true,
      courseId,
      isPublished: newPublished,
      status: newStatus,
      message: newPublished
        ? 'Course is now live and published on Edufy Academy.'
        : newStatus === 'pending_review'
        ? 'Course submitted for administrator review.'
        : 'Course moved to draft mode.',
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Publication update failed.', details: error?.message });
  }
});

/**
 * 12. Delete Course
 * DELETE /api/courses/:id
 */
app.delete('/api/courses/:id', async (req: Request, res: Response) => {
  try {
    const auth = await getAuthUserProfile(req);
    if (!auth || !auth.user) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required.' });
    }

    if (!supabaseAdmin) {
      return res.status(503).json({ error: 'Database service unavailable.' });
    }

    const courseId = req.params.id;
    const role = auth.profile?.role || 'student';

    const { data: course, error: fetchErr } = await supabaseAdmin
      .from('courses')
      .select('id, instructor_id, title')
      .eq('id', courseId)
      .single();

    if (fetchErr || !course) {
      return res.status(404).json({ error: 'Course not found.' });
    }

    if (role !== 'admin' && course.instructor_id !== auth.user.id) {
      return res.status(403).json({ error: 'Unauthorized: You can only delete your own courses.' });
    }

    // Delete course (cascades to course_sections, lessons, etc.)
    const { error: delErr } = await supabaseAdmin
      .from('courses')
      .delete()
      .eq('id', courseId);

    if (delErr) {
      return res.status(500).json({ error: 'Failed to delete course.', details: delErr.message });
    }

    return res.json({ success: true, message: `Course "${course.title}" was successfully deleted.` });
  } catch (error: any) {
    return res.status(500).json({ error: 'Course deletion failed.', details: error?.message });
  }
});

/**
 * 13. Become an Instructor Application
 * POST /api/instructor/apply
 */
app.post('/api/instructor/apply', async (req: Request, res: Response) => {
  try {
    const auth = await getAuthUserProfile(req);
    if (!auth || !auth.user) {
      return res.status(401).json({ error: 'Unauthorized: Please log in to become an instructor.' });
    }

    if (!supabaseAdmin) {
      return res.status(503).json({ error: 'Database service unavailable.' });
    }

    if (auth.profile?.role === 'instructor' || auth.profile?.role === 'admin') {
      return res.json({ success: true, status: 'approved', message: 'You already have instructor access.' });
    }

    const { headline, bio, expertise, website } = req.body;
    const { data: existing } = await supabaseAdmin
      .from('instructor_applications')
      .select('id, status')
      .eq('user_id', auth.user.id)
      .maybeSingle();

    if (existing?.status === 'pending') {
      // Allow applicants to refine a pending application
    }

    const { data: application, error: appErr } = await supabaseAdmin
      .from('instructor_applications')
      .upsert(
        {
          user_id: auth.user.id,
          headline: String(headline || '').trim().slice(0, 160),
          bio: String(bio || '').trim().slice(0, 4000),
          expertise: String(expertise || '').trim().slice(0, 200),
          website: website ? String(website).trim().slice(0, 300) : null,
          status: 'pending',
          admin_note: null,
          reviewed_by: null,
          reviewed_at: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
      .select()
      .single();

    if (appErr) {
      console.error('[Apply Instructor Error]:', appErr);
      return res.status(500).json({ error: 'Failed to submit instructor application.', details: appErr.message });
    }

    return res.json({
      success: true,
      status: 'pending',
      message: 'Application submitted. An Edufy administrator will review it shortly.',
      application,
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Instructor application failed.', details: error?.message });
  }
});

// ============================================================================
// ADILO VIDEO HOSTING (server-side only — keys never reach the browser)
// Docs: https://adilo-api.bigcommand.com/v1/  (Projects, Files multipart upload)
// ============================================================================

const ADILO_BASE = (envValue('ADILO_API_BASE_URL') || 'https://adilo-api.bigcommand.com/v1').replace(/\/+$/, '');
const ADILO_PUBLIC_KEY = envValue('ADILO_PUBLIC_KEY');
const ADILO_SECRET_KEY = envValue('ADILO_SECRET_KEY');
const ADILO_PLAYER_ORIGIN = 'https://adilo.bigcommand.com';
const ADILO_MAX_FILE_BYTES = 5 * 1024 * 1024 * 1024; // 5 GB
const ADILO_PART_BYTES = 10 * 1024 * 1024; // 10 MB parts (Adilo minimum is 5 MB except the last part)
const adiloConfigured = () => !!(ADILO_PUBLIC_KEY && ADILO_SECRET_KEY);

class AdiloError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Authenticated call to the Adilo REST API. Never logs keys. */
async function adiloRequest(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: any): Promise<any> {
  if (!adiloConfigured()) throw new AdiloError(503, 'Adilo is not configured on the server (ADILO_PUBLIC_KEY / ADILO_SECRET_KEY).');
  const res = await fetch(`${ADILO_BASE}${path}`, {
    method,
    headers: {
      'X-Public-Key': ADILO_PUBLIC_KEY,
      'X-Secret-Key': ADILO_SECRET_KEY,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON error body */
  }
  if (!res.ok || json?.status === 'error') {
    const msg = json?.message || `Adilo request failed (${res.status})`;
    console.warn(`[Adilo] ${method} ${path.split('?')[0]} -> ${res.status}: ${msg}`);
    throw new AdiloError(res.status === 401 ? 502 : res.status || 502, res.status === 401 ? 'Adilo rejected the API keys (401).' : msg);
  }
  return json;
}

/** Returns the Adilo project used for Edufy lessons (env → settings → create). */
async function getAdiloProjectId(): Promise<string> {
  const fromEnv = envValue('ADILO_PROJECT_ID');
  if (fromEnv) return fromEnv;
  if (!supabaseAdmin) throw new AdiloError(503, 'Database unavailable.');
  const { data } = await supabaseAdmin.from('platform_settings').select('value').eq('key', 'adilo_project_id').maybeSingle();
  const stored = data?.value ? String(data.value).replace(/"/g, '') : '';
  if (stored) return stored;
  const created = await adiloRequest('POST', '/projects', {
    title: 'Edufy Academy Lessons',
    description: 'Lesson videos uploaded from Edufy Academy',
  });
  const projectId = created?.payload?.id;
  if (!projectId) throw new AdiloError(502, 'Adilo did not return a project id.');
  await supabaseAdmin.from('platform_settings').upsert({ key: 'adilo_project_id', value: projectId, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  return projectId;
}

/** Find an Adilo player URL inside an API response (the docs do not define the field name). */
function findAdiloPlayerUrl(obj: any, depth = 0): string | null {
  if (!obj || depth > 4) return null;
  if (typeof obj === 'string') return obj.startsWith(`${ADILO_PLAYER_ORIGIN}/`) ? obj : null;
  if (typeof obj === 'object') {
    for (const v of Object.values(obj)) {
      const hit = findAdiloPlayerUrl(v, depth + 1);
      if (hit) return hit;
    }
  }
  return null;
}

/** Accepts an Adilo link or full <iframe> embed code and returns a safe https://adilo.bigcommand.com URL. */
function normaliseAdiloEmbedUrl(input: any): string | null {
  if (!input || typeof input !== 'string') return null;
  const src = input.match(/src=["']([^"']+)["']/i)?.[1] || input.trim();
  try {
    const u = new URL(src);
    if (u.protocol !== 'https:' || u.origin !== ADILO_PLAYER_ORIGIN) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** Ensures the caller is an instructor/admin and, for instructors, owns the course. */
async function requireCourseEditor(req: Request, courseId?: string | null) {
  const auth = await getAuthUserProfile(req);
  if (!auth?.user) throw new AdiloError(401, 'Authentication required.');
  const role = auth.profile?.role;
  if (role !== 'admin' && role !== 'instructor') throw new AdiloError(403, 'Only instructors and admins can manage course videos.');
  if (courseId && role !== 'admin' && supabaseAdmin) {
    const { data: course } = await supabaseAdmin.from('courses').select('instructor_id').eq('id', courseId).maybeSingle();
    if (course && course.instructor_id !== auth.user.id) throw new AdiloError(403, 'You can only manage videos for your own courses.');
  }
  return { user: auth.user, role };
}

const sendAdiloError = (res: Response, err: any) => {
  const status = err instanceof AdiloError ? err.status : 500;
  if (!(err instanceof AdiloError)) console.error('[Adilo] unexpected error:', err?.message || err);
  return res.status(status).json({ error: err?.message || 'Adilo request failed.' });
};

/** Load and authorise an upload session owned by the caller. */
async function getOwnedUpload(userId: string, role: string, uploadId: string) {
  if (!supabaseAdmin) throw new AdiloError(503, 'Database unavailable.');
  const { data } = await supabaseAdmin.from('adilo_uploads').select('*').eq('upload_id', uploadId).maybeSingle();
  if (!data) throw new AdiloError(404, 'Upload session not found.');
  if (data.user_id !== userId && role !== 'admin') throw new AdiloError(403, 'This upload belongs to another user.');
  return data;
}

app.get('/api/adilo/status', async (req: Request, res: Response) => {
  try {
    await requireCourseEditor(req);
    res.json({ configured: adiloConfigured(), partSize: ADILO_PART_BYTES, maxFileBytes: ADILO_MAX_FILE_BYTES, playerOrigin: ADILO_PLAYER_ORIGIN });
  } catch (err) {
    sendAdiloError(res, err);
  }
});

/**
 * Step 1 — Initiate multipart upload.  POST /v1/files/upload/start
 * Body: { filename, filesize, durationSeconds, mimeType, courseId? }
 */
app.post('/api/adilo/upload/start', async (req: Request, res: Response) => {
  try {
    const { filename, filesize, durationSeconds, mimeType, courseId } = req.body || {};
    const { user } = await requireCourseEditor(req, courseId);

    const size = Number(filesize);
    const duration = Math.round(Number(durationSeconds));
    const cleanName = String(filename || '').replace(/[^\w.\- ()]/g, '_').slice(0, 180);
    if (!cleanName.toLowerCase().endsWith('.mp4') || mimeType !== 'video/mp4') throw new AdiloError(422, 'Only MP4 videos (video/mp4) are supported.');
    if (!(size > 0) || size > ADILO_MAX_FILE_BYTES) throw new AdiloError(422, 'File size must be between 1 byte and 5 GB.');
    if (!(duration > 0) || duration > 24 * 3600) throw new AdiloError(422, 'Could not read a valid video duration.');

    const hh = String(Math.floor(duration / 3600)).padStart(2, '0');
    const mm = String(Math.floor((duration % 3600) / 60)).padStart(2, '0');
    const ss = String(duration % 60).padStart(2, '0');
    const projectId = await getAdiloProjectId();

    const started = await adiloRequest('POST', '/files/upload/start', {
      filename: cleanName,
      filesize: size,
      duration_seconds: duration,
      duration_string: `${hh}:${mm}:${ss}`,
      mime_type: 'video/mp4',
      project_id: projectId,
      drm_protection: false,
    });
    const uploadId = started?.payload?.uploadId;
    const key = started?.payload?.key;
    if (!uploadId || !key) throw new AdiloError(502, 'Adilo did not return an uploadId/key.');

    await supabaseAdmin!.from('adilo_uploads').insert({
      user_id: user.id,
      course_id: courseId || null,
      upload_id: uploadId,
      upload_key: key,
      filename: cleanName,
      filesize: size,
      duration_seconds: duration,
      project_id: projectId,
      status: 'uploading',
    });

    res.json({ uploadId, key, partSize: ADILO_PART_BYTES, totalParts: Math.max(1, Math.ceil(size / ADILO_PART_BYTES)) });
  } catch (err) {
    sendAdiloError(res, err);
  }
});

/**
 * Step 2 — Signed URL for one part.  GET /v1/files/upload/get-signed-url/{uploadId}/{partNumber}?key=
 */
app.get('/api/adilo/upload/sign', async (req: Request, res: Response) => {
  try {
    const { user, role } = await requireCourseEditor(req);
    const uploadId = String(req.query.uploadId || '');
    const partNumber = parseInt(String(req.query.partNumber || ''), 10);
    const session = await getOwnedUpload(user.id, role, uploadId);
    const maxParts = Math.max(1, Math.ceil(session.filesize / ADILO_PART_BYTES));
    if (!(partNumber >= 1 && partNumber <= maxParts)) throw new AdiloError(422, 'Invalid part number.');

    const signed = await adiloRequest(
      'GET',
      `/files/upload/get-signed-url/${encodeURIComponent(uploadId)}/${partNumber}?key=${encodeURIComponent(session.upload_key)}`
    );
    const url = signed?.payload?.url;
    if (!url) throw new AdiloError(502, 'Adilo did not return a signed URL.');
    res.json({ url, method: signed?.payload?.method || 'PUT' });
  } catch (err) {
    sendAdiloError(res, err);
  }
});

/**
 * Fallback when the browser cannot read the ETag response header (storage CORS):
 * the server PUTs the part to the Adilo signed URL and returns the ETag.
 */
app.post(
  '/api/adilo/upload/part',
  express.raw({ type: 'application/octet-stream', limit: '12mb' }),
  async (req: Request, res: Response) => {
    try {
      const { user, role } = await requireCourseEditor(req);
      const uploadId = String(req.query.uploadId || '');
      const partNumber = parseInt(String(req.query.partNumber || ''), 10);
      const session = await getOwnedUpload(user.id, role, uploadId);
      const body = req.body as Buffer;
      if (!Buffer.isBuffer(body) || body.length === 0) throw new AdiloError(422, 'Empty part.');
      const maxParts = Math.max(1, Math.ceil(session.filesize / ADILO_PART_BYTES));
      if (!(partNumber >= 1 && partNumber <= maxParts)) throw new AdiloError(422, 'Invalid part number.');

      const signed = await adiloRequest(
        'GET',
        `/files/upload/get-signed-url/${encodeURIComponent(uploadId)}/${partNumber}?key=${encodeURIComponent(session.upload_key)}`
      );
      // fetch() accepts ArrayBuffer-backed views only (a Node Buffer may sit on a pooled/shared buffer), so the
      // part is copied byte-for-byte into its own Uint8Array. Same bytes, same length, same request.
      const bytes = new Uint8Array(body.length);
      bytes.set(body);
      const put = await fetch(signed.payload.url, { method: 'PUT', body: bytes, headers: { 'Content-Type': 'video/mp4' } });
      const etag = put.headers.get('etag');
      if (!put.ok || !etag) throw new AdiloError(502, `Part ${partNumber} upload to storage failed (${put.status}).`);
      res.json({ ETag: etag.replace(/"/g, '') });
    } catch (err) {
      sendAdiloError(res, err);
    }
  }
);

/**
 * Step 3 — Complete upload.  POST /v1/files/upload/complete  { key, uploadId, parts:[{PartNumber, ETag}] }
 */
app.post('/api/adilo/upload/complete', async (req: Request, res: Response) => {
  try {
    const { user, role } = await requireCourseEditor(req);
    const { uploadId, parts } = req.body || {};
    const session = await getOwnedUpload(user.id, role, String(uploadId || ''));
    if (session.status !== 'uploading') throw new AdiloError(409, 'This upload has already been completed.');

    const maxParts = Math.max(1, Math.ceil(session.filesize / ADILO_PART_BYTES));
    if (!Array.isArray(parts) || parts.length !== maxParts) throw new AdiloError(422, `Expected ${maxParts} uploaded part(s).`);
    const cleanParts = parts
      .map((p: any) => ({ PartNumber: parseInt(p?.PartNumber, 10), ETag: String(p?.ETag || '').replace(/"/g, '') }))
      .sort((a: any, b: any) => a.PartNumber - b.PartNumber);
    if (cleanParts.some((p: any, i: number) => p.PartNumber !== i + 1 || !/^[A-Za-z0-9-]{8,}$/.test(p.ETag))) {
      throw new AdiloError(422, 'Part list is incomplete or has invalid ETags.');
    }

    let completed: any;
    try {
      completed = await adiloRequest('POST', '/files/upload/complete', { key: session.upload_key, uploadId: session.upload_id, parts: cleanParts });
    } catch (e) {
      await supabaseAdmin!.from('adilo_uploads').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('id', session.id);
      throw e;
    }
    const file = completed?.payload || {};
    if (!file.id) throw new AdiloError(502, 'Adilo did not return a file id.');

    // Look up file details for a player URL (field not defined in the docs — scanned defensively)
    let details: any = null;
    try {
      details = (await adiloRequest('GET', `/files/${encodeURIComponent(file.id)}`))?.payload || null;
    } catch {
      /* details are optional */
    }
    const embedUrl = findAdiloPlayerUrl(details) || findAdiloPlayerUrl(file);

    await supabaseAdmin!
      .from('adilo_uploads')
      .update({ status: 'uploaded', adilo_file_id: file.id, response: { complete: file, details }, updated_at: new Date().toISOString() })
      .eq('id', session.id);

    res.json({
      fileId: file.id,
      projectId: file.project?.id || session.project_id,
      title: file.title || session.filename,
      durationSeconds: session.duration_seconds,
      durationFormatted: file.duration_formatted || null,
      embedUrl,
      status: 'uploaded',
      metadata: { complete: file, details },
    });
  } catch (err) {
    sendAdiloError(res, err);
  }
});

/** Refresh file details from Adilo.  GET /v1/files/{file_id} */
app.get('/api/adilo/files/:fileId', async (req: Request, res: Response) => {
  try {
    const { user, role } = await requireCourseEditor(req);
    const fileId = req.params.fileId;
    const { data: upload } = await supabaseAdmin!.from('adilo_uploads').select('user_id').eq('adilo_file_id', fileId).maybeSingle();
    const { data: lesson } = await supabaseAdmin!.from('lessons').select('course_id, courses(instructor_id)').eq('adilo_file_id', fileId).limit(1).maybeSingle();
    const ownsLesson = (lesson as any)?.courses?.instructor_id === user.id;
    if (role !== 'admin' && upload?.user_id !== user.id && !ownsLesson) throw new AdiloError(403, 'Not allowed to view this video.');
    const details = (await adiloRequest('GET', `/files/${encodeURIComponent(fileId)}`))?.payload || null;
    res.json({ fileId, details, embedUrl: findAdiloPlayerUrl(details) });
  } catch (err) {
    sendAdiloError(res, err);
  }
});

/** Delete a video from Adilo and detach it from lessons.  DELETE /v1/files/{file_id} */
app.delete('/api/adilo/files/:fileId', async (req: Request, res: Response) => {
  try {
    const { user, role } = await requireCourseEditor(req);
    const fileId = req.params.fileId;
    const { data: upload } = await supabaseAdmin!.from('adilo_uploads').select('id, user_id').eq('adilo_file_id', fileId).maybeSingle();
    const { data: lessons } = await supabaseAdmin!.from('lessons').select('id, course_id, courses(instructor_id)').eq('adilo_file_id', fileId);
    // Videos from the Adilo library (imported, not uploaded through Edufy) are never deleted from Adilo
    if (!upload) throw new AdiloError(409, 'This video comes from your Adilo library, so Edufy does not delete it from Adilo. Remove it from the lesson instead.');
    const ownsAll = (lessons || []).every((l: any) => l.courses?.instructor_id === user.id);
    const allowed = role === 'admin' || (upload?.user_id === user.id && ownsAll) || ((lessons || []).length > 0 && ownsAll);
    if (!allowed) throw new AdiloError(403, 'Not allowed to delete this video.');

    await adiloRequest('DELETE', `/files/${encodeURIComponent(fileId)}`);
    await supabaseAdmin!
      .from('lessons')
      .update({
        adilo_file_id: null,
        adilo_project_id: null,
        adilo_embed_url: null,
        video_title: null,
        video_duration: null,
        video_status: null,
        video_metadata: {},
        video_updated_at: new Date().toISOString(),
      })
      .eq('adilo_file_id', fileId);
    if (upload) await supabaseAdmin!.from('adilo_uploads').update({ status: 'deleted', updated_at: new Date().toISOString() }).eq('id', upload.id);
    res.json({ success: true });
  } catch (err) {
    sendAdiloError(res, err);
  }
});

/**
 * Playback access for a lesson: enrolled learners, free previews, the course instructor and admins.
 * GET /api/lessons/:lessonId/video
 */
app.get('/api/lessons/:lessonId/video', async (req: Request, res: Response) => {
  try {
    if (!supabaseAdmin) throw new AdiloError(503, 'Database unavailable.');
    const { data: lesson } = await supabaseAdmin
      .from('lessons')
      .select('id, course_id, is_free_preview, adilo_file_id, adilo_embed_url, video_title, video_duration, video_status, courses(instructor_id, is_published)')
      .eq('id', req.params.lessonId)
      .maybeSingle();
    if (!lesson || (!lesson.adilo_file_id && !lesson.adilo_embed_url)) throw new AdiloError(404, 'No Adilo video for this lesson.');

    const user = await getAuthUser(req);
    let allowed = !!lesson.is_free_preview && !!(lesson as any).courses?.is_published;
    let progress: any = null;
    if (user) {
      const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single();
      const isStaff = profile?.role === 'admin' || (lesson as any).courses?.instructor_id === user.id;
      const { data: enrollment } = await supabaseAdmin
        .from('enrollments')
        .select('id')
        .eq('user_id', user.id)
        .eq('course_id', lesson.course_id)
        .eq('status', 'active')
        .maybeSingle();
      allowed = allowed || isStaff || !!enrollment;
      if (allowed) {
        const { data: p } = await supabaseAdmin
          .from('lesson_progress')
          .select('last_position_seconds, watched_seconds, is_completed')
          .eq('user_id', user.id)
          .eq('lesson_id', lesson.id)
          .maybeSingle();
        progress = p;
      }
    }
    if (!allowed) throw new AdiloError(403, 'Enrol in this course to watch this lesson.');
    if (!lesson.adilo_embed_url) throw new AdiloError(409, 'This video has no Adilo player link yet. Ask the instructor to add the embed link.');

    res.json({
      embedUrl: lesson.adilo_embed_url,
      playerOrigin: ADILO_PLAYER_ORIGIN,
      title: lesson.video_title,
      durationSeconds: lesson.video_duration,
      status: lesson.video_status,
      progress,
    });
  } catch (err) {
    sendAdiloError(res, err);
  }
});

/**
 * Verified watch progress from the Adilo player's postMessage events.
 * POST /api/lessons/:lessonId/video-progress  { position, watchedSeconds, duration, event }
 * Watch time is capped by elapsed wall-clock time so it cannot be inflated by the client.
 */
const VIDEO_COMPLETE_RATIO = 0.9;
app.post('/api/lessons/:lessonId/video-progress', async (req: Request, res: Response) => {
  try {
    const user = await getAuthUser(req);
    if (!user) throw new AdiloError(401, 'Authentication required.');
    if (!supabaseAdmin) throw new AdiloError(503, 'Database unavailable.');

    const { data: lesson } = await supabaseAdmin
      .from('lessons')
      .select('id, course_id, adilo_file_id, adilo_embed_url, video_duration')
      .eq('id', req.params.lessonId)
      .maybeSingle();
    if (!lesson?.adilo_file_id && !lesson?.adilo_embed_url) throw new AdiloError(404, 'No Adilo video for this lesson.');

    const { data: enrollment } = await supabaseAdmin
      .from('enrollments')
      .select('id')
      .eq('user_id', user.id)
      .eq('course_id', lesson.course_id)
      .eq('status', 'active')
      .maybeSingle();
    if (!enrollment) throw new AdiloError(403, 'Only enrolled learners record progress.');

    const reportedDuration = Math.round(Number(req.body?.duration) || 0);
    const duration = lesson.video_duration || (reportedDuration > 0 && reportedDuration < 86400 ? reportedDuration : 0);
    const position = Math.max(0, Math.min(duration || 86400, Math.round(Number(req.body?.position) || 0)));
    const claimedWatched = Math.max(0, Math.round(Number(req.body?.watchedSeconds) || 0));
    const event = String(req.body?.event || 'currentTime');

    const { data: existing } = await supabaseAdmin
      .from('lesson_progress')
      .select('id, watched_seconds, is_completed, completed_at, updated_at')
      .eq('user_id', user.id)
      .eq('lesson_id', lesson.id)
      .maybeSingle();

    const prevWatched = existing?.watched_seconds || 0;
    const elapsed = existing?.updated_at ? (Date.now() - new Date(existing.updated_at).getTime()) / 1000 : 30;
    // Max 2x playback speed plus a small tolerance between reports
    const maxIncrement = Math.max(0, Math.ceil(elapsed * 2 + 5));
    let watched = Math.max(prevWatched, Math.min(claimedWatched, prevWatched + maxIncrement));
    if (duration) watched = Math.min(watched, duration);

    const reachedEnd = event === 'ended' && duration > 0 && watched >= duration * VIDEO_COMPLETE_RATIO;
    const completeNow = !existing?.is_completed && duration > 0 && (watched >= duration * VIDEO_COMPLETE_RATIO || reachedEnd);

    const { error } = await supabaseAdmin.from('lesson_progress').upsert(
      {
        user_id: user.id,
        course_id: lesson.course_id,
        lesson_id: lesson.id,
        last_position_seconds: event === 'ended' ? 0 : position,
        watched_seconds: watched,
        video_duration_seconds: duration || null,
        is_completed: existing?.is_completed || completeNow,
        completed_at: existing?.completed_at || (completeNow ? new Date().toISOString() : null),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,lesson_id' }
    );
    if (error) throw new AdiloError(500, error.message);

    res.json({
      position,
      watchedSeconds: watched,
      duration,
      isCompleted: !!(existing?.is_completed || completeNow),
      justCompleted: completeNow,
      completionThreshold: VIDEO_COMPLETE_RATIO,
    });
  } catch (err) {
    sendAdiloError(res, err);
  }
});

// ============================================================================
// CSV BULK LESSON IMPORTER (admin only)
// The admin prepares a CSV of topic_name + Adilo embed link; the browser parses it
// and sends rows here. Every row is re-validated on the server. No Adilo API calls.
// ============================================================================
const CSV_IMPORT_MAX_ROWS = 500;
const CSV_TITLE_MAX = 200;
const ADILO_TRUSTED_HOSTS = new Set([new URL(ADILO_PLAYER_ORIGIN).host]); // adilo.bigcommand.com (verified player domain)

class ImportError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function requireAdminForImport(req: Request) {
  if (!supabaseAdmin) throw new ImportError(503, 'Database unavailable.');
  const auth = await getAuthUserProfile(req);
  if (!auth?.user) throw new ImportError(401, 'Authentication required.');
  if (auth.profile?.role !== 'admin') throw new ImportError(403, 'Only administrators can import lessons.');
  return auth.user;
}

const sendImportError = (res: Response, err: any) => {
  const status = err instanceof ImportError ? err.status : 500;
  if (!(err instanceof ImportError)) console.error('[CSV Import] unexpected error:', err?.message || err);
  return res.status(status).json({ error: err instanceof ImportError ? err.message : 'Import failed. Please try again.' });
};

const validCourseOrSectionId = (v: any) => typeof v === 'string' && /^[A-Za-z0-9_-]{3,80}$/.test(v);

/**
 * Accepts a direct Adilo URL or full <iframe> HTML. Only the src attribute is extracted —
 * the HTML itself is never stored or rendered. Returns a clean https URL on a trusted Adilo host.
 */
function parseAdiloVideoInput(input: any): { url: string | null; error?: string } {
  if (typeof input !== 'string' || !input.trim()) return { url: null, error: 'Video link is empty.' };
  let raw = input.trim();
  if (raw.length > 4000) return { url: null, error: 'Video link is too long.' };
  if (/<\s*iframe/i.test(raw)) {
    const src = raw.match(/\ssrc\s*=\s*"([^"]+)"/i)?.[1] || raw.match(/\ssrc\s*=\s*'([^']+)'/i)?.[1];
    if (!src) return { url: null, error: 'The iframe code has no src link.' };
    raw = src.replace(/&amp;/gi, '&').trim();
  } else if (/[<>]/.test(raw)) {
    return { url: null, error: 'Only an Adilo link or Adilo iframe code is allowed.' };
  }
  if (raw.startsWith('//')) raw = `https:${raw}`;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { url: null, error: 'Not a valid URL.' };
  }
  if (u.protocol !== 'https:') return { url: null, error: 'The link must use https.' };
  if (!ADILO_TRUSTED_HOSTS.has(u.host.toLowerCase())) return { url: null, error: `Only ${ADILO_PLAYER_ORIGIN} links are allowed.` };
  if (u.username || u.password) return { url: null, error: 'Not a valid Adilo link.' };
  if (!/\/[A-Za-z0-9_-]{4,}/.test(u.pathname)) return { url: null, error: 'The link has no Adilo video ID.' };
  u.hash = '';
  return { url: u.toString() };
}

/** Duplicate key: the Adilo video ID for /watch|/e|/embed links, otherwise host+path (query ignored). */
function adiloDuplicateKey(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/+$/, '');
    const id = path.match(/\/(?:watch|e|embed|video|videos)\/([A-Za-z0-9_-]+)$/i)?.[1];
    return id ? `id:${id}` : `path:${u.host.toLowerCase()}${path}`;
  } catch {
    return `raw:${url}`;
  }
}

function cleanTitle(v: any): string {
  return String(v ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

interface CheckedRow {
  index: number; // position in the submitted list (0-based)
  title: string;
  url: string | null;
  status: 'valid' | 'invalid' | 'duplicate';
  error: string | null;
  existingLessonId?: string | null;
}

/** Validate rows and mark duplicates against the target section and within the CSV itself. */
async function checkImportRows(rowsIn: any[], sectionId: string | null): Promise<CheckedRow[]> {
  const existing = new Map<string, string>();
  if (sectionId) {
    const { data } = await supabaseAdmin!
      .from('lessons')
      .select('id, adilo_embed_url, video_url')
      .eq('section_id', sectionId);
    for (const l of data || []) {
      for (const link of [l.adilo_embed_url, l.video_url]) {
        if (typeof link === 'string' && link) {
          const parsed = parseAdiloVideoInput(link);
          if (parsed.url) existing.set(adiloDuplicateKey(parsed.url), l.id);
        }
      }
    }
  }
  const seen = new Map<string, number>();
  return rowsIn.map((r, index) => {
    const title = cleanTitle(r?.title);
    const parsed = parseAdiloVideoInput(r?.embed);
    let error: string | null = null;
    if (!title) error = 'Topic name is empty.';
    else if (title.length > CSV_TITLE_MAX) error = `Topic name is longer than ${CSV_TITLE_MAX} characters.`;
    else if (!parsed.url) error = parsed.error || 'Invalid video link.';
    if (error) return { index, title, url: parsed.url, status: 'invalid', error };

    const key = adiloDuplicateKey(parsed.url!);
    if (existing.has(key)) {
      return { index, title, url: parsed.url, status: 'duplicate', error: 'Already exists in this section.', existingLessonId: existing.get(key) };
    }
    if (seen.has(key)) {
      return { index, title, url: parsed.url, status: 'duplicate', error: `Same video as row ${seen.get(key)! + 1} in this CSV.` };
    }
    seen.set(key, index);
    return { index, title, url: parsed.url, status: 'valid', error: null };
  });
}

async function loadImportTarget(courseId: any, sectionId: any) {
  if (!validCourseOrSectionId(courseId)) throw new ImportError(422, 'Choose a valid course.');
  const { data: course } = await supabaseAdmin!.from('courses').select('id, title').eq('id', courseId).maybeSingle();
  if (!course) throw new ImportError(404, 'Course not found.');
  let section: { id: string; title: string } | null = null;
  if (sectionId !== undefined && sectionId !== null && sectionId !== '') {
    if (!validCourseOrSectionId(sectionId)) throw new ImportError(422, 'Choose a valid section.');
    const { data } = await supabaseAdmin!.from('course_sections').select('id, title, course_id').eq('id', sectionId).maybeSingle();
    if (!data || data.course_id !== course.id) throw new ImportError(404, 'That section does not belong to this course.');
    section = { id: data.id, title: data.title };
  }
  return { course, section };
}

function readRows(body: any): any[] {
  const rows = body?.rows;
  if (!Array.isArray(rows) || rows.length === 0) throw new ImportError(422, 'No rows to import.');
  if (rows.length > CSV_IMPORT_MAX_ROWS) throw new ImportError(422, `A single import can contain at most ${CSV_IMPORT_MAX_ROWS} rows.`);
  return rows;
}

/** Keep courses.total_lessons / duration_hours in line with the curriculum (same rule as the course editor). */
async function refreshCourseTotals(courseId: string) {
  const { data } = await supabaseAdmin!.from('lessons').select('duration_minutes').eq('course_id', courseId);
  const total = (data || []).length;
  const minutes = (data || []).reduce((s: number, l: any) => s + (Number(l.duration_minutes) || 10), 0);
  await supabaseAdmin!
    .from('courses')
    .update({ total_lessons: Math.max(total, 1), duration_hours: Math.max(0.5, Math.round((minutes / 60) * 10) / 10), updated_at: new Date().toISOString() })
    .eq('id', courseId);
}

/**
 * POST /api/admin/lessons/bulk-import/check  { courseId, sectionId?, rows: [{ title, embed }] }
 * Server-side validation + duplicate detection for the preview table.
 */
app.post('/api/admin/lessons/bulk-import/check', async (req: Request, res: Response) => {
  try {
    await requireAdminForImport(req);
    const rows = readRows(req.body);
    const { section } = await loadImportTarget(req.body?.courseId, req.body?.sectionId);
    const checked = await checkImportRows(rows, section?.id || null);
    res.json({ rows: checked });
  } catch (err) {
    sendImportError(res, err);
  }
});

/**
 * POST /api/admin/lessons/bulk-import
 * { courseId, sectionId?, newSectionTitle?, rows: [{ title, embed }] }
 * Creates one video lesson per valid row, in row order, appended to the section.
 * Duplicates (same Adilo video already in the section, or repeated in the CSV) are skipped.
 */
app.post('/api/admin/lessons/bulk-import', async (req: Request, res: Response) => {
  try {
    const admin = await requireAdminForImport(req);
    const rows = readRows(req.body);
    const { course, section: chosen } = await loadImportTarget(req.body?.courseId, req.body?.sectionId);

    let section = chosen;
    let sectionCreated = false;
    if (!section) {
      const title = cleanTitle(req.body?.newSectionTitle).slice(0, CSV_TITLE_MAX);
      if (!title) throw new ImportError(422, 'Enter a title for the new section, or choose an existing section.');
      const { data: last } = await supabaseAdmin!
        .from('course_sections')
        .select('section_order')
        .eq('course_id', course.id)
        .order('section_order', { ascending: false })
        .limit(1)
        .maybeSingle();
      const id = `sec-${crypto.randomBytes(5).toString('hex')}`;
      const { error } = await supabaseAdmin!
        .from('course_sections')
        .insert({ id, course_id: course.id, title, section_order: (last?.section_order || 0) + 1 });
      if (error) throw new ImportError(500, `Could not create the section: ${error.message}`);
      section = { id, title };
      sectionCreated = true;
    }

    const checked = await checkImportRows(rows, section.id);
    const { data: lastLesson } = await supabaseAdmin!
      .from('lessons')
      .select('lesson_order')
      .eq('section_id', section.id)
      .order('lesson_order', { ascending: false })
      .limit(1)
      .maybeSingle();
    let nextOrder = (lastLesson?.lesson_order || 0) + 1;

    const now = new Date().toISOString();
    const results: { index: number; title: string; status: 'created' | 'skipped' | 'failed'; lessonId: string | null; error: string | null }[] = [];
    const toInsert: { index: number; row: any }[] = [];

    for (const c of checked) {
      if (c.status === 'invalid') {
        results.push({ index: c.index, title: c.title, status: 'failed', lessonId: null, error: c.error });
      } else if (c.status === 'duplicate') {
        results.push({ index: c.index, title: c.title, status: 'skipped', lessonId: c.existingLessonId || null, error: c.error });
      } else {
        toInsert.push({
          index: c.index,
          row: {
            id: `les-${crypto.randomBytes(5).toString('hex')}`,
            section_id: section.id,
            course_id: course.id,
            title: c.title,
            type: 'video',
            is_free_preview: false,
            lesson_order: nextOrder++,
            adilo_embed_url: c.url,
            video_title: c.title,
            video_status: 'linked',
            video_metadata: { source: 'csv_import', imported_by: admin.id, imported_at: now },
            video_created_at: now,
            video_updated_at: now,
          },
        });
      }
    }

    // Insert in chunks; if a chunk fails, retry its rows one by one so each failure is reported precisely.
    for (let i = 0; i < toInsert.length; i += 50) {
      const chunk = toInsert.slice(i, i + 50);
      const { error } = await supabaseAdmin!.from('lessons').insert(chunk.map((c) => c.row));
      if (!error) {
        chunk.forEach((c) => results.push({ index: c.index, title: c.row.title, status: 'created', lessonId: c.row.id, error: null }));
        continue;
      }
      for (const c of chunk) {
        const { error: oneErr } = await supabaseAdmin!.from('lessons').insert(c.row);
        results.push(
          oneErr
            ? { index: c.index, title: c.row.title, status: 'failed', lessonId: null, error: `Database error: ${oneErr.message}` }
            : { index: c.index, title: c.row.title, status: 'created', lessonId: c.row.id, error: null }
        );
      }
    }

    if (results.some((r) => r.status === 'created')) await refreshCourseTotals(course.id);
    results.sort((a, b) => a.index - b.index);

    res.json({
      course: { id: course.id, title: course.title },
      section: { ...section, created: sectionCreated },
      total: rows.length,
      created: results.filter((r) => r.status === 'created').length,
      skipped: results.filter((r) => r.status === 'skipped').length,
      failed: results.filter((r) => r.status === 'failed').length,
      results,
    });
  } catch (err) {
    sendImportError(res, err);
  }
});

// ============================================================================
// IMPORT FROM ADILO (admin): browse the Adilo library, create lessons or attach videos in bulk — see server/adiloLibrary.ts
// ============================================================================
const adiloLibrary = createAdiloLibrary({
  db: supabaseAdmin,
  request: (method, path) => adiloRequest(method, path),
  configured: adiloConfigured,
  requireAdmin: async (req: Request) => {
    if (!supabaseAdmin) throw new LibraryError(503, 'Database unavailable.');
    const auth = await getAuthUserProfile(req);
    if (!auth?.user) throw new LibraryError(401, 'Authentication required.');
    if (auth.profile?.role !== 'admin') throw new LibraryError(403, 'Only administrators can import from Adilo.');
    return { id: auth.user.id };
  },
  refreshCourseTotals,
});
adiloLibrary.registerRoutes(app);

// ============================================================================
// PUSH NOTIFICATIONS (admin API + background sender) — see server/push.ts
// ============================================================================
const pushNotifications = registerPushNotifications(app, {
  db: supabaseAdmin,
  serviceRole: !!(supabaseUrl && supabaseServiceKey),
  getAuthUserProfile,
  expoAccessToken: envValue('EXPO_ACCESS_TOKEN') || undefined,
  workerEnabled: process.env.PUSH_WORKER_ENABLED !== 'false',
  getNotificationSettings: async () => (await settingsService.getAll()).notifications,
});

// ============================================================================
// SCHEDULED PROCESSING (for hosts without always-on background workers, e.g. Hostinger Node.js web apps)
// Hostinger hPanel → Website → Advanced → Cron Jobs, every 5 minutes:
//   curl -s "https://api.edufyacademy.com/api/internal/cron?key=<CRON_SECRET>"
// Sends queued emails and push notifications. The in-process timers still run while the app is up;
// this makes sure nothing waits after a restart or redeploy. CRON_SECRET: 32+ letters/digits (no % sign).
// ============================================================================
app.get(
  '/api/internal/cron',
  createCronHandler(() => envValue('CRON_SECRET'), {
    email: async () => {
      await emailService.tick();
      return emailService.state.lastError ? `error: ${emailService.state.lastError}` : 'ok';
    },
    push: async () => {
      await pushNotifications.tick();
    },
    // Removes Cloudinary images that have not been used anywhere for 7 days (checked at most hourly)
    images: async () => {
      if (Date.now() - lastImageSweep < 60 * 60 * 1000) return 'skipped (runs hourly)';
      lastImageSweep = Date.now();
      return imageService.sweep();
    },
  })
);
let lastImageSweep = 0;

// ============================================================================
// SETTINGS & CONFIGURATION (public settings, admin settings, credentials, media) — see server/settings.ts
// ============================================================================
imageService.registerRoutes(app);

registerSettingsRoutes(app, {
  images: imageService,
  db: supabaseAdmin && supabaseServiceKey ? supabaseAdmin : null,
  serviceRole: !!(supabaseUrl && supabaseServiceKey),
  getAuthUserProfile,
  settings: settingsService,
  credentials: credentialStore,
  gateway: paymentGateway,
  email: emailService,
  management: supabaseManagement,
  supabaseUrl,
  supabaseAnonKey,
  env: {
    razorpayKeyId: razorpayEnv.keyId,
    razorpayConfigured: !!(razorpayEnv.keyId && razorpayEnv.keySecret),
    razorpayWebhookConfigured: !!razorpayEnv.webhookSecret,
    emailProvider: envValue('EMAIL_PROVIDER'),
    emailConfigured: !!((envValue('EMAIL_PROVIDER') && envValue('EMAIL_API_KEY')) || envValue('SMTP_HOST')),
    hookSecretFromEnv: !!envValue('SUPABASE_AUTH_HOOK_SECRET'),
    corsOrigins,
  },
});

// Supabase Auth "Send Email" hook: verification / reset / magic-link emails through our SMTP and templates
registerAuthEmailHook(app, {
  email: emailService,
  credentials: credentialStore,
  envSecret: envValue('SUPABASE_AUTH_HOOK_SECRET') || undefined,
  supabaseUrl: supabaseUrl || '',
  getDomain: async () => {
    const all = await settingsService.getAll();
    return { domain: all.domain, fallbackSiteUrl: all.general?.siteUrl || '' };
  },
});

// ============================================================================
// VITE MIDDLEWARE / STATIC FILES MOUNTING
// ============================================================================

async function startServer() {
  // API routes must ALWAYS answer with JSON. Without this, an unknown /api path (or an error
  // thrown by Express itself, e.g. a malformed or too-large body) falls through to the SPA
  // fallback / Express's HTML error page, and the browser gets "<!DOCTYPE html>" instead of JSON.
  app.use('/api', (req: Request, res: Response) => {
    res.status(404).json({ error: `API route not found: ${req.method} ${req.baseUrl}${req.path}` });
  });
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    if (!req.originalUrl.startsWith('/api')) return next(err);
    const status = Number(err?.status || err?.statusCode) || 500;
    if (status >= 500) console.error('[API Error]', req.method, req.originalUrl, err?.message || err);
    if (res.headersSent) return next(err);
    res.status(status).json({
      error: status === 413 ? 'The request is too large.' : status === 400 && err?.type === 'entity.parse.failed' ? 'The request body is not valid JSON.' : status >= 500 ? 'Internal server error.' : err?.message || 'Request failed.',
    });
  });

  if (process.env.NODE_ENV === 'production') {
    // Serve the website build when it sits next to the server (single-app deployment).
    // When the website is hosted elsewhere (e.g. Hostinger public_html), dist/ is absent and this
    // server answers the API only.
    const distPath = path.resolve(PROJECT_ROOT, 'dist');
    const indexHtml = path.resolve(distPath, 'index.html');
    if (fs.existsSync(indexHtml)) {
      // robots.txt and index.html follow Admin → Settings → SEO / Branding (no rebuild needed)
      app.get('/robots.txt', async (_req, res) => {
        const all = await settingsService.getAll();
        res.type('text/plain').setHeader('Cache-Control', 'public, max-age=300');
        res.send(robotsTxt(all.seo));
      });
      app.use(
        express.static(distPath, {
          index: false,
          setHeaders: (res, filePath) => {
            // Vite fingerprints files in /assets → safe to cache for a year. Everything else is revalidated.
            if (filePath.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            else res.setHeader('Cache-Control', 'no-cache');
          },
        })
      );
      const rawIndex = fs.readFileSync(indexHtml, 'utf8');
      let rendered: { key: string; html: string } | null = null;
      app.get('*', async (_req, res) => {
        res.setHeader('Cache-Control', 'no-cache');
        try {
          const pub = await settingsService.getPublic();
          if (rendered?.key !== pub.etag) {
            const all = await settingsService.getAll();
            rendered = { key: pub.etag, html: renderIndexHtml(rawIndex, all) };
          }
          res.type('html').send(rendered.html);
        } catch {
          res.sendFile(indexHtml);
        }
      });
      console.log(`[Server] Serving the website from ${distPath}`);
    } else {
      app.get('/', (_req, res) => {
        res.json({ service: 'Edufy Academy API', status: 'ok', health: '/api/health' });
      });
      console.log('[Server] No dist/ folder found — running as API-only server.');
    }
  } else {
    // Development mode: Vite middleware. On a server where only the production packages are installed
    // (e.g. a Hostinger Node.js app with NODE_ENV not set), Vite is absent: answer the API instead of crashing.
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch (e: any) {
      console.warn(`[Server] Vite is not available (${e?.code || e?.message}). Set NODE_ENV=production on servers. Running as API-only server.`);
      app.get('/', (_req, res) => {
        res.json({ service: 'Edufy Academy API', status: 'ok', health: '/api/health' });
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Edufy Academy] Fullstack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Server Error] Fatal startup error:', err);
  process.exit(1);
});
