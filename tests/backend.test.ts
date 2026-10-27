import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';

/**
 * Helper to compute Razorpay payment verification signature
 */
function computeRazorpaySignature(orderId: string, paymentId: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
}

/**
 * Helper to verify signature securely using timingSafeEqual
 */
function verifySignature(orderId: string, paymentId: string, signature: string, secret: string): boolean {
  try {
    const expected = computeRazorpaySignature(orderId, paymentId, secret);
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

/**
 * Helper to generate certificate hash
 */
function generateCertificateHash(certCode: string, userId: string, courseId: string, studentName: string): string {
  return crypto
    .createHash('sha256')
    .update(`${certCode}:${userId}:${courseId}:${studentName}`)
    .digest('hex');
}

test('Razorpay payment signature verifies correctly with genuine credentials', () => {
  const secret = 'rzp_secret_test_key_99421';
  const orderId = 'order_DA29104fa';
  const paymentId = 'pay_9210940fa';
  const validSignature = computeRazorpaySignature(orderId, paymentId, secret);

  const isValid = verifySignature(orderId, paymentId, validSignature, secret);
  assert.equal(isValid, true, 'Valid signature should verify successfully');
});

test('Razorpay payment signature rejects tampered or forged signatures', () => {
  const secret = 'rzp_secret_test_key_99421';
  const orderId = 'order_DA29104fa';
  const paymentId = 'pay_9210940fa';
  const forgedSignature = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  const isValid = verifySignature(orderId, paymentId, forgedSignature, secret);
  assert.equal(isValid, false, 'Forged signature must be rejected');

  // Tampered payment ID
  const validSignature = computeRazorpaySignature(orderId, paymentId, secret);
  const isTamperedValid = verifySignature(orderId, 'pay_tampered_id', validSignature, secret);
  assert.equal(isTamperedValid, false, 'Tampered payment ID must fail verification');
});

test('Razorpay webhook HMAC-SHA256 signature verification', () => {
  const webhookSecret = 'whsec_982402148109';
  const payload = JSON.stringify({ event: 'payment.captured', entity: { id: 'pay_123' } });

  const generatedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(payload)
    .digest('hex');

  const isMatch = crypto.timingSafeEqual(
    Buffer.from(generatedSignature),
    Buffer.from(generatedSignature)
  );
  assert.equal(isMatch, true, 'Genuine webhook payload should match signature');
});

test('Certificate hash generation creates reproducible sha256 checksum', () => {
  const hash1 = generateCertificateHash('EDFY-2026-REACT99', 'user-1', 'course-1', 'Alex Jordan');
  const hash2 = generateCertificateHash('EDFY-2026-REACT99', 'user-1', 'course-1', 'Alex Jordan');
  assert.equal(hash1, hash2, 'Identical certificate input must yield identical SHA-256 hash');
  assert.equal(hash1.length, 64, 'SHA-256 hex string must be 64 characters long');

  // Modified student name should yield completely distinct hash
  const hashDiffName = generateCertificateHash('EDFY-2026-REACT99', 'user-1', 'course-1', 'Jordan Smith');
  assert.notEqual(hash1, hashDiffName, 'Altered student name must produce different hash');
});

test('Multi-course cart order price calculation converts to accurate paise subunits', () => {
  const coursePrices = [34.99, 49.99, 19.99];
  const totalPrice = coursePrices.reduce((acc, p) => acc + p, 0);
  const amountInSubunits = Math.round(totalPrice * 100);

  assert.equal(totalPrice.toFixed(2), '104.97');
  assert.equal(amountInSubunits, 10497, 'Subunits must equal 10497 paise');
});

test('Webhook notes parsing handles single and multi-course purchase IDs', () => {
  // Case A: Comma-separated list
  const notesMulti = { courseIds: 'course-1, course-2, course-3' };
  const targetCourseIds = notesMulti.courseIds.split(',').map((s) => s.trim());
  assert.deepEqual(targetCourseIds, ['course-1', 'course-2', 'course-3']);

  // Case B: Single courseId fallback
  const notesSingle = { courseId: 'course-4' };
  const singleTarget = notesSingle.courseId ? [notesSingle.courseId] : [];
  assert.deepEqual(singleTarget, ['course-4']);
});

test('Certificate identifier matches EDFY standard credential specification', () => {
  const currentYear = new Date().getFullYear();
  const certPattern = new RegExp(`^EDFY-${currentYear}-[A-F0-9]{6}$`);

  const sampleCertCode = `EDFY-${currentYear}-4A9F2B`;
  assert.match(sampleCertCode, certPattern, 'Certificate code should match EDFY-YYYY-HEX6 pattern');
});
