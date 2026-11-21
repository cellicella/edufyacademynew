import { META_PIXEL_ID, type PixelWindow, installMetaPixel, isPixelPath } from './metaPixel';

/**
 * Meta Pixel conversion events (ViewContent, CompleteRegistration, InitiateCheckout, Purchase).
 *
 * Rules that apply to every event here:
 * - They go to the one Edufy pixel that index.html already initialised (fbq('trackSingle', id, …)); nothing here
 *   initialises a second pixel. If the visitor arrived on a page where the pixel is not loaded (sign-in callback),
 *   it is loaded the same way as for page views, and only on a public page.
 * - Never on the sign-in callback, password reset or dashboard pages (same rule as PageView).
 * - Parameters are course data and amounts only: no email, phone, name, password, token or user id is sent.
 * - Every event carries a stable eventID (order id for checkout/purchase) so Meta can de-duplicate it, also
 *   against a future server-side (Conversions API) event with the same name and id.
 */

export type MetaEventName = 'ViewContent' | 'CompleteRegistration' | 'InitiateCheckout' | 'Purchase';
export type MetaParams = Record<string, string | number | boolean | string[]>;

export interface MetaEnv {
  win: PixelWindow;
  doc: Document;
  /** Current page path (location.pathname). */
  path: () => string;
  /** localStorage-like store for de-duplication across refreshes; null when unavailable. */
  local: Pick<Storage, 'getItem' | 'setItem'> | null;
  session: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null;
  now: () => number;
}

const safeStorage = (get: () => Storage): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null => {
  try {
    const s = get();
    const k = '__edufy_px_test';
    s.setItem(k, '1');
    s.removeItem(k);
    return s;
  } catch {
    return null;
  }
};

let env: MetaEnv | null = null;
const browserEnv = (): MetaEnv | null => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;
  return {
    win: window as unknown as PixelWindow,
    doc: document,
    path: () => window.location.pathname,
    local: safeStorage(() => window.localStorage),
    session: safeStorage(() => window.sessionStorage),
    now: () => Date.now(),
  };
};
const getEnv = () => (env ??= browserEnv());

/** Tests: replace the browser environment and clear all de-duplication memory. */
export function setMetaEnv(e: MetaEnv | null) {
  env = e;
  lastViewKey = null;
  checkoutOrders.clear();
  purchaseOrders.clear();
}

/** Sends one event to the Edufy pixel. Returns false when nothing was sent (excluded page, no browser). */
export function sendMetaEvent(event: MetaEventName, params: MetaParams, eventID: string): boolean {
  const e = getEnv();
  if (!e || !isPixelPath(e.path())) return false;
  const fbq = e.win.fbq ?? installMetaPixel(e.win, e.doc);
  fbq('trackSingle', META_PIXEL_ID, event, params, { eventID });
  return true;
}

const money = (v: number) => Math.round(v * 100) / 100;
const isPositiveAmount = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;

/* ------------------------------------------------------------------ ViewContent */

let lastViewKey: string | null = null;

export interface ViewedCourse {
  id: string;
  title: string;
  category?: string | null;
  price: number;
  isPublished?: boolean;
}

/**
 * ViewContent for a published course page. `viewKey` identifies this page view (the router's location.key), so
 * re-renders and React StrictMode re-runs of the same view send nothing, while every new visit to a course page
 * (including in-app navigation back to the same course) sends one event.
 */
export function trackViewContent(course: ViewedCourse | null | undefined, viewKey: string): boolean {
  if (!course || !course.id || course.isPublished !== true) return false;
  const price = Number(course.price);
  if (!Number.isFinite(price) || price < 0) return false;
  const key = `${viewKey}|${course.id}`;
  if (key === lastViewKey) return false;
  const params: MetaParams = {
    content_name: course.title,
    content_ids: [course.id],
    content_type: 'product',
    value: money(price),
    currency: 'INR',
  };
  if (course.category) params.content_category = course.category;
  const sent = sendMetaEvent('ViewContent', params, `vc_${course.id}_${viewKey}`);
  if (sent) lastViewKey = key;
  return sent;
}

/* ------------------------------------------------------------------ CompleteRegistration */

const REGISTERED_KEY = 'edufy_px_registered';
const PENDING_KEY = 'edufy_px_pending_registration';
/** A Google account counts as a new registration when Supabase created it within this window. */
export const NEW_ACCOUNT_WINDOW_MS = 15 * 60 * 1000;

const readList = (store: Pick<Storage, 'getItem'> | null, key: string): string[] => {
  try {
    const v = JSON.parse(store?.getItem(key) || '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
};
const addToList = (store: Pick<Storage, 'getItem' | 'setItem'> | null, key: string, value: string, max = 50) => {
  try {
    store?.setItem(key, JSON.stringify([...readList(store, key).filter((x) => x !== value), value].slice(-max)));
  } catch {
    /* storage full or blocked: in-memory de-duplication still applies */
  }
};

/** Minimal Supabase user shape used to recognise a brand-new Google account. */
export interface AuthUserLike {
  id: string;
  created_at?: string;
  identities?: { provider?: string }[] | null;
  app_metadata?: { provider?: string; providers?: string[] } | null;
}

export function isNewGoogleAccount(user: AuthUserLike | null | undefined, now: number): boolean {
  if (!user?.id || !user.created_at) return false;
  const google = (user.identities || []).some((i) => i?.provider === 'google') || user.app_metadata?.provider === 'google';
  const created = Date.parse(user.created_at);
  return google && Number.isFinite(created) && now - created >= -60_000 && now - created <= NEW_ACCOUNT_WINDOW_MS;
}

/**
 * Records a successful registration (account created by Supabase) and sends CompleteRegistration as soon as the
 * visitor is on a page where the pixel runs (right away on the sign-up page; after the Google sign-in callback,
 * on the page the visitor lands on). Each account is counted once on this browser. The user id is only used
 * locally for that check and is never sent to Meta.
 */
export function recordRegistration(userId: string, method: 'email' | 'google'): boolean {
  const e = getEnv();
  if (!e || !userId) return false;
  if (readList(e.local, REGISTERED_KEY).includes(userId)) return false;
  addToList(e.local, REGISTERED_KEY, userId);
  const eventID = `reg_${e.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  try {
    e.session?.setItem(PENDING_KEY, JSON.stringify({ method, eventID }));
  } catch {
    /* ignore */
  }
  return flushRegistration();
}

/** Sends a recorded registration once the current page allows the pixel. Called on every page change. */
export function flushRegistration(): boolean {
  const e = getEnv();
  if (!e?.session || !isPixelPath(e.path())) return false;
  let pending: { method?: string; eventID?: string } | null = null;
  try {
    pending = JSON.parse(e.session.getItem(PENDING_KEY) || 'null');
  } catch {
    pending = null;
  }
  if (!pending?.eventID) return false;
  e.session.removeItem(PENDING_KEY);
  return sendMetaEvent('CompleteRegistration', { content_name: 'Edufy Academy account', status: true, registration_method: pending.method === 'google' ? 'google' : 'email' }, pending.eventID);
}

/* ------------------------------------------------------------------ InitiateCheckout and Purchase */

/** The server-created Razorpay order (POST /api/payments/create-order), priced from the database. */
export interface CheckoutOrder {
  orderId: string;
  /** Amount in paise, as returned by the server and charged by Razorpay. */
  amount: number;
  currency: string;
  /** Courses this order pays for (server response courseIds). */
  courseIds: string[];
  /** Course or bundle title from the server. */
  title: string;
}

const checkoutOrders = new Set<string>();
const purchaseOrders = new Set<string>();
const PURCHASES_KEY = 'edufy_px_purchases';

/** Simulated local-development orders are never real payments. */
const isRealOrder = (o: CheckoutOrder) => typeof o.orderId === 'string' && /^order_/.test(o.orderId) && !o.orderId.startsWith('order_test_');

const orderParams = (o: CheckoutOrder): MetaParams => ({
  content_name: o.title,
  content_ids: o.courseIds,
  content_type: 'product',
  value: money(o.amount / 100),
  currency: 'INR',
  num_items: o.courseIds.length,
});

/**
 * InitiateCheckout when the Razorpay checkout window is actually opened for a signed-in learner's paid order.
 * (Guests, enrolled learners and free courses never reach this point: the server makes no paid order for them.)
 * Once per order.
 */
export function trackInitiateCheckout(order: CheckoutOrder): boolean {
  if (!isRealOrder(order) || !isPositiveAmount(order.amount) || order.currency !== 'INR' || !order.courseIds.length) return false;
  if (checkoutOrders.has(order.orderId)) return false;
  const sent = sendMetaEvent('InitiateCheckout', orderParams(order), `ic_${order.orderId}`);
  if (sent) checkoutOrders.add(order.orderId);
  return sent;
}

/** Response of POST /api/payments/verify-payment. */
export interface VerifyResponse {
  httpOk: boolean;
  body: { success?: unknown; orderId?: unknown; paymentId?: unknown; courseIds?: unknown } | null | undefined;
}

/**
 * The Purchase decision. The source of truth is the backend verification result:
 * - HTTP 2xx and success === true (the server checked Razorpay's HMAC signature with the secret it alone holds,
 *   marked the payment captured and granted the enrollments);
 * - the verified order id is the order created for this checkout, and a Razorpay payment id is present;
 * - the server confirms enrollment in every course of the order.
 * The value is the server's order amount (what Razorpay charged for this order), never a client-side price.
 * Returns null for failed, cancelled, pending, unverified, mismatched or simulated payments.
 */
export function verifiedPurchase(order: CheckoutOrder, verify: VerifyResponse): { params: MetaParams; eventID: string } | null {
  const b = verify.body;
  if (!verify.httpOk || !b || b.success !== true) return null;
  if (!isRealOrder(order) || !isPositiveAmount(order.amount) || order.currency !== 'INR' || !order.courseIds.length) return null;
  if (b.orderId !== order.orderId) return null;
  if (typeof b.paymentId !== 'string' || !/^pay_/.test(b.paymentId) || b.paymentId.startsWith('pay_test_')) return null;
  const granted = Array.isArray(b.courseIds) ? b.courseIds.filter((x): x is string => typeof x === 'string') : [];
  if (!order.courseIds.every((id) => granted.includes(id))) return null;
  return { params: orderParams(order), eventID: `purchase_${order.orderId}` };
}

/**
 * Purchase after a backend-verified payment, at most once per Razorpay order on this browser (survives refresh,
 * navigation and repeated callbacks). Returns true only when the event was sent.
 */
export function trackVerifiedPurchase(order: CheckoutOrder, verify: VerifyResponse): boolean {
  const p = verifiedPurchase(order, verify);
  if (!p) return false;
  const e = getEnv();
  if (purchaseOrders.has(order.orderId) || readList(e?.local ?? null, PURCHASES_KEY).includes(order.orderId)) return false;
  const sent = sendMetaEvent('Purchase', p.params, p.eventID);
  if (sent) {
    purchaseOrders.add(order.orderId);
    addToList(e?.local ?? null, PURCHASES_KEY, order.orderId);
  }
  return sent;
}
