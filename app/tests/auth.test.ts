import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authMessage, isValidEmail } from '../src/logic/authErrors';

test('Supabase auth errors become clear messages', () => {
  assert.equal(authMessage({ message: 'Invalid login credentials' }), 'Incorrect email or password.');
  assert.match(authMessage({ message: 'Email not confirmed' }), /confirm your email/);
  assert.match(authMessage({ message: 'User already registered' }), /already exists/);
  assert.match(authMessage({ message: 'For security purposes, you can only request this after 60 seconds. rate limit' }), /wait/);
  assert.match(authMessage({ message: 'Network request failed' }), /internet/);
  assert.match(authMessage({ message: 'Password should be at least 6 characters' }), /6 characters/);
  assert.match(authMessage({ message: 'Email link is invalid or has expired' }), /expired/);
  assert.match(authMessage({ message: 'New password should be different from the old password.' }), /different/);
});

test('messages never echo a password', () => {
  const msg = authMessage({ message: 'Invalid login credentials' });
  assert.equal(msg.includes('hunter2'), false);
});

test('email validation', () => {
  assert.equal(isValidEmail('student@edufy.in'), true);
  assert.equal(isValidEmail('  student@edufy.in  '), true);
  for (const bad of ['', 'a@b', 'a@b.c', 'no-at.com', 'a b@c.com', '@x.com']) assert.equal(isValidEmail(bad), false, bad);
});
