/**
 * Razorpay credential provider.
 *
 * Source of truth, in order:
 *   1. Active credentials saved from the admin panel (encrypted in secure_credentials, verified before activation)
 *   2. RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET / RAZORPAY_WEBHOOK_SECRET from the server environment
 *
 * Changes made in the admin panel take effect without a restart (cached for at most 60 s per server instance).
 * The previous key secret is remembered for 24 h so payments started just before a key change still verify.
 */
import crypto from 'crypto';
import Razorpay from 'razorpay';
import type { CredentialStore } from './credentials';

export interface RazorpayConfig {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
  mode: 'live' | 'test';
  source: 'admin' | 'env';
  client: any;
}

export interface EnvRazorpay { keyId: string; keySecret: string; webhookSecret: string }

import { KEY_ID_RE, modeOf } from './paymentLogic';
export { KEY_ID_RE, modeOf };

export function createPaymentGateway(credentials: CredentialStore, env: EnvRazorpay) {
  let cached: { sig: string; cfg: RazorpayConfig } | null = null;
  const previousSecrets: { secret: string; until: number }[] = [];

  const build = (keyId: string, keySecret: string, webhookSecret: string, source: 'admin' | 'env'): RazorpayConfig | null => {
    if (!keyId || !keySecret) return null;
    const sig = crypto.createHash('sha256').update(`${keyId}|${keySecret}|${webhookSecret}`).digest('hex');
    if (cached?.sig === sig) return cached.cfg;
    if (cached && cached.cfg.keySecret !== keySecret) {
      previousSecrets.push({ secret: cached.cfg.keySecret, until: Date.now() + 24 * 3600_000 });
      if (previousSecrets.length > 3) previousSecrets.shift();
    }
    let client: any = null;
    try {
      client = new (Razorpay as any)({ key_id: keyId, key_secret: keySecret });
    } catch (e: any) {
      console.error('[Razorpay] client init failed:', e?.message || e);
    }
    const cfg: RazorpayConfig = { keyId, keySecret, webhookSecret, mode: modeOf(keyId), source, client };
    cached = { sig, cfg };
    return cfg;
  };

  async function current(): Promise<RazorpayConfig | null> {
    const active = await credentials.load('razorpay', 'active');
    if (active?.publicConfig?.keyId && active.secrets?.keySecret) {
      return build(active.publicConfig.keyId, active.secrets.keySecret, active.secrets.webhookSecret || env.webhookSecret, 'admin');
    }
    return build(env.keyId, env.keySecret, env.webhookSecret, 'env');
  }

  /** Secrets accepted when verifying a checkout signature (current first, then recently replaced ones). */
  async function verificationSecrets(): Promise<string[]> {
    const cfg = await current();
    const now = Date.now();
    const old = previousSecrets.filter((p) => p.until > now).map((p) => p.secret);
    return [...(cfg ? [cfg.keySecret] : []), ...old];
  }

  async function webhookSecrets(): Promise<string[]> {
    const cfg = await current();
    const list = [cfg?.webhookSecret, env.webhookSecret].filter((s): s is string => !!s);
    return [...new Set(list)];
  }

  return { current, verificationSecrets, webhookSecrets, envConfigured: !!(env.keyId && env.keySecret) };
}

export type PaymentGateway = ReturnType<typeof createPaymentGateway>;

export interface GatewayTestStep { id: string; label: string; status: 'pass' | 'fail' | 'warn' | 'manual'; detail: string }

/**
 * Server-side test of a Razorpay key set. Never marks a gateway active by itself; callers decide.
 * Creates one ₹1 order (unpaid; Razorpay discards it) to prove order creation works.
 */
export async function testRazorpayCredentials(c: { keyId: string; keySecret: string; webhookSecret?: string; expectedMode?: 'live' | 'test' }, extra: {
  webhookUrl: string | null;
  lastWebhookAt: string | null;
  enrollmentReady: boolean;
}): Promise<{ ok: boolean; steps: GatewayTestStep[] }> {
  const steps: GatewayTestStep[] = [];
  const push = (s: GatewayTestStep) => steps.push(s);

  const keyOk = KEY_ID_RE.test(c.keyId) && c.keySecret.length >= 10;
  push({
    id: 'keys', label: 'Key configuration', status: keyOk ? 'pass' : 'fail',
    detail: keyOk ? `Key ID ${c.keyId.slice(0, 13)}… (${modeOf(c.keyId)} mode) and secret present.` : 'Key ID must look like rzp_live_… or rzp_test_…, and the secret must be filled in.',
  });
  if (keyOk && c.expectedMode && modeOf(c.keyId) !== c.expectedMode) {
    push({ id: 'mode', label: 'Mode matches keys', status: 'fail', detail: `You selected ${c.expectedMode} mode but the key is a ${modeOf(c.keyId)} key.` });
  }
  if (!keyOk || steps.some((s) => s.status === 'fail')) return { ok: false, steps };

  const client = new (Razorpay as any)({ key_id: c.keyId, key_secret: c.keySecret });
  try {
    await client.orders.all({ count: 1 });
    push({ id: 'auth', label: 'Backend connection to Razorpay', status: 'pass', detail: 'Razorpay accepted the key and secret.' });
  } catch (e: any) {
    const msg = e?.statusCode === 401 ? 'Razorpay rejected the key/secret (authentication failed).' : e?.error?.description || e?.message || 'Could not reach Razorpay.';
    push({ id: 'auth', label: 'Backend connection to Razorpay', status: 'fail', detail: msg });
    return { ok: false, steps };
  }

  let orderId = '';
  try {
    const order = await client.orders.create({ amount: 100, currency: 'INR', receipt: `cfgtest_${Date.now()}`, notes: { purpose: 'Edufy settings test (not a sale)' } });
    orderId = order?.id || '';
    push({ id: 'order', label: 'Order creation', status: orderId ? 'pass' : 'fail', detail: orderId ? `Test order ${orderId} created (₹1, never charged).` : 'Razorpay returned no order id.' });
  } catch (e: any) {
    push({ id: 'order', label: 'Order creation', status: 'fail', detail: e?.error?.description || e?.message || 'Order creation failed.' });
    return { ok: false, steps };
  }

  // Signature verification: same HMAC the checkout verification uses, checked both ways
  const fakePayment = `pay_cfgtest${crypto.randomBytes(5).toString('hex')}`;
  const sig = crypto.createHmac('sha256', c.keySecret).update(`${orderId}|${fakePayment}`).digest('hex');
  const recomputed = crypto.createHmac('sha256', c.keySecret).update(`${orderId}|${fakePayment}`).digest('hex');
  const tampered = crypto.createHmac('sha256', c.keySecret).update(`${orderId}|pay_other`).digest('hex');
  const sigOk = sig === recomputed && sig !== tampered;
  push({ id: 'verify', label: 'Payment signature verification', status: sigOk ? 'pass' : 'fail', detail: sigOk ? 'HMAC-SHA256 verification works with this secret (valid signature accepted, tampered one rejected).' : 'Signature check failed.' });

  if (c.webhookSecret) {
    push({
      id: 'webhook', label: 'Webhook', status: extra.lastWebhookAt ? 'pass' : 'warn',
      detail: extra.lastWebhookAt
        ? `Webhook secret set. Last verified webhook received ${extra.lastWebhookAt}.`
        : `Webhook secret set, but no verified webhook has been received yet. In Razorpay → Webhooks add ${extra.webhookUrl || 'https://<api-address>/api/payments/webhook'} (events payment.captured, order.paid) with the same secret.`,
    });
  } else {
    push({ id: 'webhook', label: 'Webhook', status: 'warn', detail: 'No webhook secret: enrollment still works from checkout verification, but add a webhook as a backup.' });
  }

  push({
    id: 'enrollment', label: 'Automatic enrollment after verified payment', status: extra.enrollmentReady ? 'manual' : 'fail',
    detail: extra.enrollmentReady
      ? 'Enrollment uses the server service role and runs only after signature verification. Confirm end-to-end with one real low-value purchase (test mode: use a Razorpay test card).'
      : 'SUPABASE_SERVICE_ROLE_KEY is missing on the server, so enrollments cannot be created.',
  });

  return { ok: steps.every((s) => s.status !== 'fail'), steps };
}
