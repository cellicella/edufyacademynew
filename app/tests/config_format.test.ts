import { test } from 'node:test';
import assert from 'node:assert/strict';
import { configProblems, PRODUCTION_WEB_URL, signupRedirectUrl } from '../src/logic/config';
import { discountPercent, formatDuration, formatPrice, initials, timeAgo } from '../src/logic/format';

const ok = { supabaseUrl: 'https://tyqdyfecdvclwsvcahod.supabase.co', supabaseKey: 'sb_publishable_abc', apiUrl: 'http://192.168.1.5:3000' };

test('valid public config has no problems', () => {
  assert.deepEqual(configProblems(ok, { isDevice: true }), []);
});

test('localhost API URL is flagged on a phone; secret key rejected; missing values reported', () => {
  assert.match(configProblems({ ...ok, apiUrl: 'http://localhost:3000' }, { isDevice: true })[0], /localhost/);
  assert.deepEqual(configProblems({ ...ok, apiUrl: 'http://localhost:3000' }, { isDevice: false }), []);
  assert.match(configProblems({ ...ok, supabaseKey: 'sb_secret_xyz' }, { isDevice: true })[0], /SECRET/);
  assert.equal(configProblems({ supabaseUrl: '', supabaseKey: '', apiUrl: '' }, { isDevice: true }).length, 3);
  assert.match(configProblems({ ...ok, supabaseUrl: 'https://example.com' }, { isDevice: true })[0], /supabase\.co/);
});

test('sign-up confirmation links always land on the public https website', () => {
  assert.equal(PRODUCTION_WEB_URL, 'https://edufyacademy.com');
  assert.equal(signupRedirectUrl('https://edufyacademy.com'), 'https://edufyacademy.com/auth/callback');
  assert.equal(signupRedirectUrl('https://staging.edufyacademy.com/'), 'https://staging.edufyacademy.com/auth/callback');
  // development addresses only work on the developer's PC, so the email uses the live website instead
  assert.equal(signupRedirectUrl('http://10.0.2.2:3000'), 'https://edufyacademy.com/auth/callback');
  assert.equal(signupRedirectUrl('http://localhost:3000'), 'https://edufyacademy.com/auth/callback');
  assert.equal(signupRedirectUrl(''), 'https://edufyacademy.com/auth/callback');
});

test('formatting helpers', () => {
  assert.equal(formatPrice(0), 'Free');
  assert.equal(formatPrice(1499), '₹1,499');
  assert.equal(discountPercent(999, 2499), 60);
  assert.equal(discountPercent(999, 0), 0);
  assert.equal(discountPercent(999, 500), 0);
  assert.equal(formatDuration(2.5), '2h 30m');
  assert.equal(formatDuration(0), '—');
  assert.equal(initials('Surya Prakash Kumar'), 'SP');
  assert.equal(initials(''), '?'); // avatar placeholder
  assert.equal(timeAgo(new Date(Date.now() - 5 * 60_000).toISOString()), '5 min ago');
});
