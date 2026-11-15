import test from 'node:test';
import assert from 'node:assert/strict';
import { isSafeExternalUrl, isSafeInternalPath, itemTarget, notificationTarget, parseLink } from '../src/logic/deepLinks';
import { groupByDay, isLive, mapBanner, mapInbox, mapOffer, offerCountdown, pushRecent, recommend } from '../src/logic/engagement';

const OFFER = '0b1e8b8e-2c3d-4e5f-8a9b-0c1d2e3f4a5b';

test('deep links: whitelisted internal routes only', () => {
  for (const ok of ['/course/abc', '/bundle/b-1', '/learn/c1?lesson=l2', `/offer/${OFFER}`, '/certificates?claim=c1', '/(tabs)/learning', '/notifications', '/offers']) {
    assert.equal(isSafeInternalPath(ok), true, ok);
  }
  for (const bad of ['/admin', '/course/../x', '/course/a b', 'course/x', '/learn/c1?lesson=../../x', '/checkout/c1', '//evil.com']) {
    assert.equal(isSafeInternalPath(bad), false, bad);
  }
});

test('deep links: only https external links', () => {
  assert.equal(isSafeExternalUrl('https://edufyacademy.com/x'), true);
  for (const bad of ['http://x.com', 'javascript:alert(1)', 'intent://scan#Intent;end', 'file:///etc/passwd', 'https://a:b@x.com', 'tel:123', 'https://x.com/a b']) {
    assert.equal(isSafeExternalUrl(bad), false, bad);
  }
  assert.deepEqual(parseLink('https://x.com'), { kind: 'external', url: 'https://x.com' });
  assert.equal(parseLink('/admin'), null);
});

test('notification tap target', () => {
  assert.deepEqual(notificationTarget({ url: '/course/c1', courseId: 'c9' }), { kind: 'internal', path: '/course/c1' });
  assert.deepEqual(notificationTarget({ url: 'javascript:x', courseId: 'c9' }), { kind: 'internal', path: '/course/c9' });
  assert.deepEqual(notificationTarget({ offerId: OFFER, courseId: 'c9' }), { kind: 'internal', path: `/offer/${OFFER}` });
  assert.deepEqual(notificationTarget({ bundleId: 'b1' }), { kind: 'internal', path: '/bundle/b1' });
  assert.deepEqual(notificationTarget(undefined), { kind: 'internal', path: '/notifications' });
  assert.deepEqual(notificationTarget({ courseId: '../x' }), { kind: 'internal', path: '/notifications' });
});

test('banner / offer targets', () => {
  assert.deepEqual(itemTarget({ linkType: 'course', courseId: 'c1' }), { kind: 'internal', path: '/course/c1' });
  assert.equal(itemTarget({ linkType: 'course', courseId: null }), null);
  assert.equal(itemTarget({ linkType: 'url', url: 'http://x.com' }), null);
  assert.equal(itemTarget({ linkType: 'none' }), null);
});

test('mappers sanitise image links', () => {
  const b = mapBanner({ id: 1, title: 'T', image_url: 'http://insecure/x.png', link_type: 'weird', position: '2' });
  assert.equal(b.imageUrl, null);
  assert.equal(b.linkType, 'none');
  assert.equal(b.position, 2);
  const o = mapOffer({ id: 'o', title: 'O', image_url: 'https://x/y.png', link_type: 'bundle', bundle_id: 'b', starts_at: '2026-01-01T00:00:00Z', is_active: true });
  assert.equal(o.imageUrl, 'https://x/y.png');
  const n = mapInbox({ id: 'n', title: 't', body: 'b', created_at: '2026-01-01T00:00:00Z' });
  assert.equal(n.category, 'announcement');
  assert.equal(n.readAt, null);
});

test('live window and countdown', () => {
  const now = Date.parse('2026-11-11T12:00:00Z');
  assert.equal(isLive({ startsAt: '2026-11-10T00:00:00Z', endsAt: '2026-11-12T00:00:00Z' }, now), true);
  assert.equal(isLive({ startsAt: '2026-11-12T00:00:00Z', endsAt: null }, now), false);
  assert.equal(isLive({ startsAt: null, endsAt: '2026-11-11T11:59:59Z' }, now), false);
  assert.equal(isLive({ startsAt: null, endsAt: null, isActive: false }, now), false);
  assert.equal(offerCountdown('2026-11-11T11:00:00Z', now), 'Offer ended');
  assert.equal(offerCountdown('2026-11-11T15:00:00Z', now), 'Ends in 3 hours');
  assert.equal(offerCountdown('2026-11-14T13:00:00Z', now), 'Ends in 3 days');
  assert.equal(offerCountdown(null, now), null);
});

test('group by day', () => {
  const now = new Date('2026-11-11T12:00:00');
  const g = groupByDay([{ createdAt: '2026-11-11T09:00:00' }, { createdAt: '2026-11-10T20:00:00' }, { createdAt: '2026-11-01T09:00:00' }], now);
  assert.deepEqual(g.map((x) => x.title), ['Today', 'Yesterday', 'Earlier']);
});

test('recently viewed + recommendations', () => {
  assert.deepEqual(pushRecent(['a', 'b', 'c'], 'b'), ['b', 'a', 'c']);
  assert.equal(pushRecent(Array.from({ length: 20 }, (_, i) => String(i)), 'x', 12).length, 12);
  const all = [
    { id: 'excel1', category: 'Excel', rating: 4, enrolledCount: 10 },
    { id: 'excel2', category: 'Excel', rating: 3, enrolledCount: 5 },
    { id: 'py1', category: 'Python', rating: 5, enrolledCount: 100, trending: true },
    { id: 'word1', category: 'Word', rating: 4.5, enrolledCount: 50 },
  ];
  const rec = recommend(all, new Set(['excel1']), []);
  assert.equal(rec[0].id, 'excel2'); // same category as an owned course
  assert.ok(!rec.some((c) => c.id === 'excel1')); // never recommends owned courses
  const cold = recommend(all, new Set(), []);
  assert.equal(cold[0].id, 'py1'); // no signals → trending/popular first
});
