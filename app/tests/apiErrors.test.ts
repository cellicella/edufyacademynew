import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AppError, friendlyMessage, isTransientError, kindForStatus, messageForStatus, retryDelay, shouldRetryQuery } from '../src/logic/apiErrors';

test('status codes map to error kinds', () => {
  assert.equal(kindForStatus(0), 'network');
  assert.equal(kindForStatus(400), 'validation');
  assert.equal(kindForStatus(401), 'auth');
  assert.equal(kindForStatus(403), 'forbidden');
  assert.equal(kindForStatus(404), 'not_found');
  assert.equal(kindForStatus(408), 'timeout');
  assert.equal(kindForStatus(422), 'validation');
  assert.equal(kindForStatus(429), 'rate_limit');
  assert.equal(kindForStatus(500), 'server');
  assert.equal(kindForStatus(503), 'server');
});

test('server 4xx messages are shown; 5xx details and 401 text are replaced', () => {
  assert.equal(messageForStatus(400, 'Already enrolled: you already have access to the selected course(s).'), 'Already enrolled: you already have access to the selected course(s).');
  assert.match(messageForStatus(500, 'TypeError: cannot read x of undefined at /srv/server.ts:12'), /trouble/);
  assert.match(messageForStatus(401, 'Unauthorized: Valid authentication token required.'), /session has expired/);
  assert.match(messageForStatus(429), /Too many/);
  assert.match(messageForStatus(422, ''), /check/);
});

test('only network, timeout and 5xx errors are retried — never 4xx', () => {
  assert.equal(isTransientError(new AppError(0, 'x')), true);
  assert.equal(isTransientError(new AppError(408, 'x')), true);
  assert.equal(isTransientError(new AppError(502, 'x')), true);
  for (const s of [400, 401, 403, 404, 409, 422, 429]) assert.equal(isTransientError(new AppError(s, 'x')), false, String(s));
  assert.equal(isTransientError(new Error('Network request failed')), true);
  assert.equal(isTransientError(new Error('duplicate key value')), false);
});

test('query retry policy is bounded', () => {
  const net = new AppError(0, 'x');
  assert.equal(shouldRetryQuery(0, net), true);
  assert.equal(shouldRetryQuery(1, net), true);
  assert.equal(shouldRetryQuery(2, net), false);
  assert.equal(shouldRetryQuery(0, new AppError(404, 'x')), false);
  assert.equal(retryDelay(0), 1000);
  assert.equal(retryDelay(10), 8000);
});

test('friendly messages for raw errors', () => {
  assert.match(friendlyMessage(new Error('TypeError: Network request failed')), /internet/);
  assert.match(friendlyMessage(new Error('The operation was aborted')), /too long/);
  assert.match(friendlyMessage(new Error('JWT expired')), /sign in/);
  assert.match(friendlyMessage(new Error('new row violates row-level security policy')), /access/);
  assert.equal(friendlyMessage(new AppError(404, 'Course not found.')), 'Course not found.');
  assert.equal(friendlyMessage(null, 'fallback'), 'fallback');
});
