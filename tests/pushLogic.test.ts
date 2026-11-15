import test from 'node:test';
import assert from 'node:assert/strict';
import {
  channelFor, chunk, cleanText, defaultActionUrl, expoMessage, finalStatus, isRetryableStatus, readTicket,
  validateActionUrl, validateCampaign, validateImageUrl,
} from '../server/pushLogic';

test('action links: in-app whitelist and https only', () => {
  assert.deepEqual(validateActionUrl('/course/abc-123'), { ok: true, value: '/course/abc-123' });
  assert.deepEqual(validateActionUrl('/learn/c1?lesson=l9'), { ok: true, value: '/learn/c1?lesson=l9' });
  assert.deepEqual(validateActionUrl('/(tabs)/learning'), { ok: true, value: '/(tabs)/learning' });
  assert.deepEqual(validateActionUrl(''), { ok: true, value: null });
  assert.equal(validateActionUrl('https://edufyacademy.com/offer?x=1').ok, true);
  for (const bad of ['javascript:alert(1)', 'http://edufy.com', '/admin', '/course/../admin', 'intent://x', 'https://user:pw@evil.com', 'data:text/html,hi', '/course/a b']) {
    assert.equal(validateActionUrl(bad).ok, false, bad);
  }
});

test('image links must be https', () => {
  assert.equal(validateImageUrl('https://cdn.x/a.png').ok, true);
  assert.equal(validateImageUrl('http://cdn.x/a.png').ok, false);
  assert.deepEqual(validateImageUrl(undefined), { ok: true, value: null });
});

test('campaign validation', () => {
  const ok = validateCampaign({ title: '  Big  news ', body: 'Hello\u0007 students', category: 'announcement', audience: 'all_students' });
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.value.title, 'Big news');
    assert.equal(ok.value.body, 'Hello students');
    assert.equal(ok.value.audience_course_id, null);
  }
  const bad = validateCampaign({ title: '', body: 'x'.repeat(241), category: 'spam', audience: 'course_students' });
  assert.equal(bad.ok, false);
  if (!bad.ok) {
    assert.ok(bad.errors.title && bad.errors.body && bad.errors.category && bad.errors.audienceCourseId);
  }
  const longTitle = validateCampaign({ title: 'x'.repeat(66), body: 'b', category: 'offer' });
  assert.equal(longTitle.ok, false);
  const badId = validateCampaign({ title: 't', body: 'b', category: 'offer', offerId: 'not-a-uuid' });
  assert.equal(badId.ok, false);
});

test('default destination', () => {
  assert.equal(defaultActionUrl({ course_id: 'c1' }), '/course/c1');
  assert.equal(defaultActionUrl({ bundle_id: 'b1' }), '/bundle/b1');
  assert.equal(defaultActionUrl({ action_url: 'https://x.com', course_id: 'c1' }), 'https://x.com');
  assert.equal(defaultActionUrl({}), null);
});

test('expo message: channel, image and data', () => {
  const m: any = expoMessage('ExponentPushToken[abc]', { title: 'T', body: 'B', category: 'new_course', url: '/course/1', image_url: 'https://i/x.png', data: { notificationId: 'n1' } });
  assert.equal(m.channelId, 'courses');
  assert.deepEqual(m.richContent, { image: 'https://i/x.png' });
  assert.deepEqual(m.data, { notificationId: 'n1', type: 'new_course', url: '/course/1' });
  assert.ok(Buffer.byteLength(JSON.stringify(m)) < 4096);
  const noImg: any = expoMessage('t', { title: 'T', body: 'B', category: 'offer', url: null, data: {} });
  assert.equal(noImg.richContent, undefined);
  assert.equal(channelFor('certificate'), 'learning');
  assert.equal(channelFor('custom'), 'announcements');
});

test('tickets, retries and final status', () => {
  assert.deepEqual(readTicket({ status: 'ok', id: 'r1' }), { status: 'ok', id: 'r1' });
  const dead = readTicket({ status: 'error', message: 'not registered', details: { error: 'DeviceNotRegistered' } });
  assert.equal(dead.status === 'error' && dead.invalidToken, true);
  assert.equal(readTicket(undefined).status, 'error');
  assert.equal(isRetryableStatus(429), true);
  assert.equal(isRetryableStatus(503), true);
  assert.equal(isRetryableStatus(400), false);
  assert.equal(finalStatus({ devices: 0, ticketsOk: 0 }).status, 'sent');
  assert.equal(finalStatus({ devices: 3, ticketsOk: 0 }).status, 'failed');
  assert.equal(finalStatus({ devices: 3, ticketsOk: 1 }).note, null);
});

test('helpers', () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.equal(cleanText('a\n\n\n\nb', 10), 'a\n\nb');
  assert.equal(cleanText(42, 10), '');
});
