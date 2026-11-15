import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isMissingPkceVerifier, misdirectedAuthLink } from '../src/lib/authLinks';

test('auth email links that fell back to the home page are sent to the right page', () => {
  assert.equal(misdirectedAuthLink('/', '', '#access_token=a&refresh_token=b&type=recovery'), '/reset-password#access_token=a&refresh_token=b&type=recovery');
  assert.equal(misdirectedAuthLink('/', '', '#access_token=a&type=signup'), '/auth/callback#access_token=a&type=signup');
  assert.equal(misdirectedAuthLink('/', '?code=abc', ''), '/auth/callback?code=abc');
  assert.equal(misdirectedAuthLink('/', '?token_hash=h&type=signup', ''), '/auth/callback?token_hash=h&type=signup');
  assert.equal(
    misdirectedAuthLink('/', '', '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid'),
    '/auth/callback#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid'
  );
});

test('ordinary visits and other pages are never rerouted', () => {
  assert.equal(misdirectedAuthLink('/', '', ''), null);
  assert.equal(misdirectedAuthLink('/', '?utm_source=mail', '#courses'), null);
  assert.equal(misdirectedAuthLink('/courses', '?code=abc', ''), null);
  assert.equal(misdirectedAuthLink('/auth/callback', '?code=abc', ''), null);
  assert.equal(misdirectedAuthLink('/reset-password', '', '#access_token=a&type=recovery'), null);
});

test('a PKCE link opened outside the app that started it is recognised', () => {
  assert.equal(isMissingPkceVerifier({ name: 'AuthPKCECodeVerifierMissingError', message: 'PKCE code verifier not found in storage.' }), true);
  assert.equal(isMissingPkceVerifier({ code: 'pkce_code_verifier_not_found' }), true);
  assert.equal(isMissingPkceVerifier({ message: 'invalid request: both auth code and code verifier should be non-empty' }), true);
  assert.equal(isMissingPkceVerifier({ message: 'Email link is invalid or has expired' }), false);
  assert.equal(isMissingPkceVerifier(null), false);
});
