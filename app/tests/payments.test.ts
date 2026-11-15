import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isExternalPaymentUrl, isFinalVerifyError, isValidRazorpaySuccess, parseRazorpayError } from '../src/logic/payments';

test('only a complete Razorpay response is sent for server verification', () => {
  assert.equal(isValidRazorpaySuccess({ razorpay_payment_id: 'pay_123', razorpay_order_id: 'order_1', razorpay_signature: 'abc' }), true);
  assert.equal(isValidRazorpaySuccess({ razorpay_payment_id: 'pay_123', razorpay_order_id: 'order_1' }), false);
  assert.equal(isValidRazorpaySuccess({ razorpay_payment_id: '123', razorpay_order_id: 'o', razorpay_signature: 's' }), false);
  assert.equal(isValidRazorpaySuccess(null), false);
});

test('native SDK cancellations are recognised', () => {
  assert.equal(parseRazorpayError({ code: 0, description: 'Payment Cancelled' }).cancelled, true);
  assert.equal(parseRazorpayError({ code: 2, description: '{"error":{"description":"Payment processing cancelled by user","reason":"payment_cancelled"}}' }).cancelled, true);
});

test('native SDK failures surface Razorpay’s description', () => {
  const r = parseRazorpayError({ code: 1, description: '{"error":{"code":"BAD_REQUEST_ERROR","description":"Your payment has been declined by the bank","reason":"payment_failed"}}' });
  assert.equal(r.cancelled, false);
  assert.equal(r.message, 'Your payment has been declined by the bank');
  assert.equal(parseRazorpayError({}).cancelled, false);
});

test('UPI / bank intents open outside the WebView', () => {
  for (const u of ['upi://pay?pa=x', 'intent://pay#Intent;end', 'tez://upi/pay', 'phonepe://pay', 'paytmmp://pay']) assert.equal(isExternalPaymentUrl(u), true, u);
  for (const u of ['https://api.razorpay.com/v1/checkout', 'about:blank']) assert.equal(isExternalPaymentUrl(u), false, u);
});

test('verification retries stop on definitive server answers', () => {
  assert.equal(isFinalVerifyError(400), true); // invalid signature
  assert.equal(isFinalVerifyError(404), true); // order not found
  assert.equal(isFinalVerifyError(500), false);
  assert.equal(isFinalVerifyError(0), false);
});
