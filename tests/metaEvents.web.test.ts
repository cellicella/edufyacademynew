import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { META_PIXEL_ID, type Fbq, type PixelWindow } from '../src/lib/metaPixel';
import {
  type CheckoutOrder,
  type MetaEnv,
  NEW_ACCOUNT_WINDOW_MS,
  flushRegistration,
  isNewGoogleAccount,
  recordRegistration,
  setMetaEnv,
  trackInitiateCheckout,
  trackVerifiedPurchase,
  trackViewContent,
  verifiedPurchase,
} from '../src/lib/metaEvents';

class MemStore {
  map = new Map<string, string>();
  getItem(k: string) {
    return this.map.has(k) ? this.map.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}

let calls: unknown[][];
let path: string;
let local: MemStore;
let session: MemStore;
const NOW = Date.parse('2026-11-22T10:00:00Z');

function makeEnv(): MetaEnv {
  const fbq = Object.assign((...a: unknown[]) => {
    calls.push(a);
  }, { queue: [], loaded: true, version: '2.0' }) as unknown as Fbq;
  const win: PixelWindow = { fbq };
  return { win, doc: {} as Document, path: () => path, local, session, now: () => NOW };
}
const events = () => calls.filter((c) => c[0] === 'trackSingle').map((c) => ({ pixel: c[1], ev: c[2], params: c[3] as Record<string, unknown>, eventID: (c[4] as { eventID: string }).eventID }));

beforeEach(() => {
  calls = [];
  path = '/courses/course-1';
  local = new MemStore();
  session = new MemStore();
  setMetaEnv(makeEnv());
});

const COURSE = { id: 'course-1', title: 'Excel for Beginners', category: 'Office', price: 499, isPublished: true };
const ORDER: CheckoutOrder = { orderId: 'order_ABC123', amount: 49900, currency: 'INR', courseIds: ['course-1'], title: 'Excel for Beginners' };
const VERIFIED = { httpOk: true, body: { success: true, orderId: 'order_ABC123', paymentId: 'pay_XYZ789', courseIds: ['course-1'] } };

/* ---------------------------------------------------------------- ViewContent */

test('ViewContent: published course page sends real course data in INR to the Edufy pixel', () => {
  assert.equal(trackViewContent(COURSE, 'k1'), true);
  assert.deepEqual(events(), [{
    pixel: META_PIXEL_ID, ev: 'ViewContent', eventID: 'vc_course-1_k1',
    params: { content_name: 'Excel for Beginners', content_ids: ['course-1'], content_type: 'product', value: 499, currency: 'INR', content_category: 'Office' },
  }]);
});

test('ViewContent: once per page view, again on a new visit (SPA navigation)', () => {
  trackViewContent(COURSE, 'k1');
  trackViewContent(COURSE, 'k1'); // re-render / StrictMode
  trackViewContent({ ...COURSE }, 'k1');
  assert.equal(events().length, 1);
  trackViewContent(COURSE, 'k2'); // navigated away and back
  trackViewContent({ ...COURSE, id: 'course-2', title: 'Word' }, 'k3');
  assert.deepEqual(events().map((e) => e.params.content_ids), [['course-1'], ['course-1'], ['course-2']]);
});

test('ViewContent: not for missing or unpublished courses, nor on dashboard or private pages', () => {
  assert.equal(trackViewContent(null, 'k'), false);
  assert.equal(trackViewContent({ ...COURSE, isPublished: false }, 'k'), false);
  assert.equal(trackViewContent({ ...COURSE, isPublished: undefined }, 'k'), false);
  for (const p of ['/admin/courses/course-1/edit', '/instructor/courses', '/auth/callback']) {
    path = p;
    assert.equal(trackViewContent(COURSE, 'k-' + p), false, p);
  }
  assert.equal(events().length, 0);
});

/* ---------------------------------------------------------------- CompleteRegistration */

test('CompleteRegistration: sent once after a successful sign-up, without personal data', () => {
  path = '/register';
  assert.equal(recordRegistration('user-uuid-1', 'email'), true);
  assert.equal(recordRegistration('user-uuid-1', 'email'), false, 'same account is never counted twice');
  const ev = events();
  assert.equal(ev.length, 1);
  assert.equal(ev[0].ev, 'CompleteRegistration');
  assert.deepEqual(ev[0].params, { content_name: 'Edufy Academy account', status: true, registration_method: 'email' });
  assert.match(ev[0].eventID, /^reg_/);
  assert.ok(!JSON.stringify(ev).includes('user-uuid-1'), 'user id is not sent');
});

test('CompleteRegistration after Google sign-up waits for a page where the pixel runs', () => {
  path = '/auth/callback';
  assert.equal(recordRegistration('google-user', 'google'), false, 'nothing sent on the callback page');
  assert.equal(events().length, 0);
  assert.equal(flushRegistration(), false);
  path = '/courses/course-1'; // redirected back to the course
  assert.equal(flushRegistration(), true);
  assert.equal(flushRegistration(), false, 'sent once');
  assert.deepEqual(events().map((e) => [e.ev, e.params.registration_method]), [['CompleteRegistration', 'google']]);
});

test('only a brand-new Google account counts as a registration', () => {
  const iso = (ms: number) => new Date(ms).toISOString();
  assert.equal(isNewGoogleAccount({ id: 'a', created_at: iso(NOW - 60_000), identities: [{ provider: 'google' }] }, NOW), true);
  assert.equal(isNewGoogleAccount({ id: 'a', created_at: iso(NOW - 60_000), app_metadata: { provider: 'google' } }, NOW), true);
  assert.equal(isNewGoogleAccount({ id: 'a', created_at: iso(NOW - NEW_ACCOUNT_WINDOW_MS - 1000), identities: [{ provider: 'google' }] }, NOW), false, 'existing account signing in');
  assert.equal(isNewGoogleAccount({ id: 'a', created_at: iso(NOW - 60_000), identities: [{ provider: 'email' }] }, NOW), false, 'email account');
  assert.equal(isNewGoogleAccount({ id: 'a', identities: [{ provider: 'google' }] }, NOW), false);
  assert.equal(isNewGoogleAccount(null, NOW), false);
});

/* ---------------------------------------------------------------- InitiateCheckout */

test('InitiateCheckout: server order amount in INR, once per order, never for simulated orders', () => {
  assert.equal(trackInitiateCheckout(ORDER), true);
  assert.equal(trackInitiateCheckout(ORDER), false);
  assert.deepEqual(events(), [{
    pixel: META_PIXEL_ID, ev: 'InitiateCheckout', eventID: 'ic_order_ABC123',
    params: { content_name: 'Excel for Beginners', content_ids: ['course-1'], content_type: 'product', value: 499, currency: 'INR', num_items: 1 },
  }]);
  assert.equal(trackInitiateCheckout({ ...ORDER, orderId: 'order_test_1' }), false);
  assert.equal(trackInitiateCheckout({ ...ORDER, orderId: 'order_Z', amount: 0 }), false);
  assert.equal(trackInitiateCheckout({ ...ORDER, orderId: 'order_Z', currency: 'USD' }), false);
  assert.equal(trackInitiateCheckout({ ...ORDER, orderId: 'order_Z', courseIds: [] }), false);
});

test('InitiateCheckout keeps paise precision (₹1,299.50)', () => {
  trackInitiateCheckout({ ...ORDER, orderId: 'order_P', amount: 129950 });
  assert.equal(events()[0].params.value, 1299.5);
});

/* ---------------------------------------------------------------- Purchase */

test('Purchase: only after the backend verified the payment and confirmed enrollment', () => {
  assert.equal(trackVerifiedPurchase(ORDER, VERIFIED), true);
  assert.deepEqual(events(), [{
    pixel: META_PIXEL_ID, ev: 'Purchase', eventID: 'purchase_order_ABC123',
    params: { content_name: 'Excel for Beginners', content_ids: ['course-1'], content_type: 'product', value: 499, currency: 'INR', num_items: 1 },
  }]);
});

test('no Purchase for failed, cancelled, pending, unverified or mismatched payments', () => {
  const cases: [string, typeof VERIFIED | { httpOk: boolean; body: unknown }][] = [
    ['invalid signature (HTTP 400)', { httpOk: false, body: { success: false, error: 'Payment verification failed: invalid signature.' } }],
    ['server error / pending (HTTP 500)', { httpOk: false, body: { error: 'Failed to verify payment.' } }],
    ['no response body', { httpOk: true, body: null }],
    ['success flag missing', { httpOk: true, body: { orderId: 'order_ABC123', paymentId: 'pay_XYZ789', courseIds: ['course-1'] } }],
    ['success as a string', { httpOk: true, body: { ...VERIFIED.body, success: 'true' } }],
    ['different order', { httpOk: true, body: { ...VERIFIED.body, orderId: 'order_OTHER' } }],
    ['no payment id', { httpOk: true, body: { ...VERIFIED.body, paymentId: undefined } }],
    ['simulated payment id', { httpOk: true, body: { ...VERIFIED.body, paymentId: 'pay_test_1' } }],
    ['enrollment not confirmed', { httpOk: true, body: { ...VERIFIED.body, courseIds: [] } }],
    ['enrollment for another course', { httpOk: true, body: { ...VERIFIED.body, courseIds: ['course-9'] } }],
  ];
  for (const [name, v] of cases) assert.equal(trackVerifiedPurchase(ORDER, v as typeof VERIFIED), false, name);
  assert.equal(trackVerifiedPurchase({ ...ORDER, orderId: 'order_test_1' }, { httpOk: true, body: { ...VERIFIED.body, orderId: 'order_test_1' } }), false, 'local test order');
  assert.equal(trackVerifiedPurchase({ ...ORDER, amount: 0 }, VERIFIED), false, 'no amount');
  assert.equal(events().length, 0);
});

test('no duplicate Purchase on repeated callbacks or after a page refresh', () => {
  assert.equal(trackVerifiedPurchase(ORDER, VERIFIED), true);
  assert.equal(trackVerifiedPurchase(ORDER, VERIFIED), false, 'repeated callback');
  setMetaEnv(makeEnv()); // page refresh: memory cleared, browser storage kept
  assert.equal(trackVerifiedPurchase(ORDER, VERIFIED), false, 'after refresh');
  assert.equal(events().filter((e) => e.ev === 'Purchase').length, 1);
  // a different order is a new purchase
  assert.equal(trackVerifiedPurchase({ ...ORDER, orderId: 'order_NEW' }, { httpOk: true, body: { ...VERIFIED.body, orderId: 'order_NEW' } }), true);
});

test('Purchase still de-duplicates in memory when browser storage is blocked', () => {
  setMetaEnv({ ...makeEnv(), local: null, session: null });
  assert.equal(trackVerifiedPurchase(ORDER, VERIFIED), true);
  assert.equal(trackVerifiedPurchase(ORDER, VERIFIED), false);
});

test('verifiedPurchase uses the server order amount, not a client price, and multi-course orders', () => {
  const order: CheckoutOrder = { orderId: 'order_B', amount: 99900, currency: 'INR', courseIds: ['c1', 'c2'], title: 'Office pack' };
  const r = verifiedPurchase(order, { httpOk: true, body: { success: true, orderId: 'order_B', paymentId: 'pay_B', courseIds: ['c2', 'c1'] } });
  assert.deepEqual(r?.params, { content_name: 'Office pack', content_ids: ['c1', 'c2'], content_type: 'product', value: 999, currency: 'INR', num_items: 2 });
  assert.equal(r?.eventID, 'purchase_order_B');
});

test('no events on excluded pages, and none when there is no browser', () => {
  path = '/admin';
  assert.equal(trackInitiateCheckout(ORDER), false);
  assert.equal(trackVerifiedPurchase(ORDER, VERIFIED), false);
  assert.equal(events().length, 0);
  setMetaEnv(null); // server-side / tests without a DOM
  assert.equal(trackViewContent(COURSE, 'k'), false);
  assert.equal(recordRegistration('x', 'email'), false);
});
