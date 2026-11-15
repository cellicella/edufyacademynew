import test from 'node:test';
import assert from 'node:assert/strict';
import { COUNTRY_CODES, DEFAULT_COUNTRY, formatPhone, isStoredPhone, phoneError } from '../src/logic/phone';
import { googleAvailability, parseAuthProviders } from '../src/logic/authProviders';

const IN = DEFAULT_COUNTRY;
const UAE = COUNTRY_CODES.find((c) => c.code === '+971')!;

test('phone: Indian mobile numbers', () => {
  assert.equal(phoneError('98765 43210', IN), null);
  assert.equal(formatPhone('98765-43210', IN), '+91 9876543210');
  assert.equal(formatPhone('09876543210', IN), '+91 9876543210', 'leading trunk 0 removed');
  assert.match(phoneError('12345 67890', IN)!, /start with 6, 7, 8 or 9/);
  assert.match(phoneError('98765', IN)!, /10-digit/);
  assert.match(phoneError('', IN)!, /Enter your mobile number/);
  assert.equal(formatPhone('123', IN), null);
});

test('phone: other countries and stored format', () => {
  assert.equal(phoneError('50 123 4567', UAE), null);
  assert.equal(formatPhone('501234567', UAE), '+971 501234567');
  assert.match(phoneError('5012345678901', UAE)!, /8–9 digits/);
  assert.equal(isStoredPhone('+91 9876543210'), true);
  assert.equal(isStoredPhone('9876543210'), false);
  assert.equal(isStoredPhone('+91 98765<script>'), false);
});

test('auth providers: parsed from Supabase settings; Google states', () => {
  assert.deepEqual(parseAuthProviders({ external: { google: true, email: true } }), { google: true, email: true });
  assert.deepEqual(parseAuthProviders({}), { google: null, email: null });
  assert.deepEqual(parseAuthProviders(null), { google: null, email: null });
  assert.equal(googleAvailability(true, { google: true, email: true }), 'ready');
  assert.equal(googleAvailability(true, { google: false, email: true }), 'not_configured');
  assert.equal(googleAvailability(false, { google: true, email: true }), 'disabled_by_admin');
  assert.equal(googleAvailability(true, { google: null, email: null }), 'unknown');
});
