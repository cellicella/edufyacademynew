import test from 'node:test';
import assert from 'node:assert/strict';
import { friendlyOAuthError, parseOAuthCallback } from '../src/logic/oauth';
import { DEFAULT_APP_SETTINGS, googleButtonLabel, mergeAppSettings } from '../src/logic/siteSettings';

test('oauth callback: code extracted from the app redirect', () => {
  assert.deepEqual(parseOAuthCallback('edufyacademy://auth/callback?code=abc123-def_456'), { code: 'abc123-def_456', error: null });
  assert.deepEqual(parseOAuthCallback('exp://192.168.1.5:8081/--/auth/callback?code=xyz789xyz'), { code: 'xyz789xyz', error: null });
});

test('oauth callback: cancelled / denied / malformed', () => {
  assert.equal(parseOAuthCallback('edufyacademy://auth/callback#error=access_denied&error_description=User+cancelled').error, 'Google sign-in was cancelled.');
  assert.match(parseOAuthCallback('edufyacademy://auth/callback?error=server_error&error_description=Unsupported+provider%3A+provider+is+not+enabled').error!, /not switched on/);
  assert.equal(parseOAuthCallback('edufyacademy://auth/callback').code, null);
  assert.equal(parseOAuthCallback('edufyacademy://auth/callback?code=<script>').code, null, 'unexpected characters rejected');
  assert.match(friendlyOAuthError('redirect_to is not allowed'), /redirect URL/);
});

test('auth settings: defaults, labels, lock-out protection', () => {
  assert.deepEqual(mergeAppSettings({}).auth, DEFAULT_APP_SETTINGS.auth);
  const hidden = mergeAppSettings({ auth: { googleEnabled: false, emailPasswordEnabled: false } }).auth;
  assert.equal(hidden.emailPasswordEnabled, true, 'email & password come back when Google is off');
  const g = mergeAppSettings({ auth: { googleEnabled: true, emailPasswordEnabled: false, preferredMethod: 'weird', googleButtonText: 'signin_with' } }).auth;
  assert.equal(g.emailPasswordEnabled, false);
  assert.equal(g.preferredMethod, 'google');
  assert.equal(googleButtonLabel(g.googleButtonText), 'Sign in with Google');
  assert.equal(googleButtonLabel('anything'), 'Continue with Google');
  // secrets are never part of the payload the app reads
  assert.equal(JSON.stringify(mergeAppSettings({ auth: { clientSecret: 'x' } })).includes('clientSecret'), false);
});
