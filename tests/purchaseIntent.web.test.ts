import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INTENT_TTL_MS, consumeIntent, loginUrl, matchesIntent, resumePath, safeInternalPath, saveIntent } from '../src/lib/purchaseIntent';

test('redirects are limited to safe paths on this website', () => {
  assert.equal(safeInternalPath('/courses/course-1?enroll=1'), '/courses/course-1?enroll=1');
  assert.equal(safeInternalPath('/bundles/office-pack?buy=1#top'), '/bundles/office-pack?buy=1#top');
  for (const bad of ['https://evil.com', '//evil.com', '/\\evil.com', '\\\\evil.com', 'javascript:alert(1)', 'courses/x', '/auth/callback?next=/', '/x\nSet-Cookie: a', '', null, undefined, 42, '/' + 'a'.repeat(600)]) {
    assert.equal(safeInternalPath(bad as any), null, String(bad));
  }
});

test('return address and sign-in link for each purchase type', () => {
  assert.equal(resumePath('course', 'course-c0d5dc79'), '/courses/course-c0d5dc79?enroll=1');
  assert.equal(resumePath('bundle', 'office-pack'), '/bundles/office-pack?buy=1');
  assert.equal(resumePath('cart', 'cart', '/courses?category=excel'), '/courses?checkout=cart');
  assert.equal(resumePath('cart', 'cart', 'https://evil.com'), '/?checkout=cart');
  assert.equal(loginUrl('/courses/course-1?enroll=1'), '/login?redirect=%2Fcourses%2Fcourse-1%3Fenroll%3D1');
  assert.equal(loginUrl('//evil.com'), '/login?redirect=%2F');
});

test('an intent only matches the same purchase while it is recent', () => {
  const now = 1_800_000_000_000;
  const raw = JSON.stringify({ kind: 'course', id: 'course-1', at: now });
  assert.equal(matchesIntent(raw, 'course', 'course-1', now + 60_000), true);
  assert.equal(matchesIntent(raw, 'course', 'course-2', now), false, 'other course');
  assert.equal(matchesIntent(raw, 'bundle', 'course-1', now), false, 'other kind');
  assert.equal(matchesIntent(raw, 'course', 'course-1', now + INTENT_TTL_MS + 1), false, 'expired');
  assert.equal(matchesIntent(raw, 'course', 'course-1', now - 1000), false, 'from the future');
  assert.equal(matchesIntent('{bad', 'course', 'course-1', now), false);
  assert.equal(matchesIntent(null, 'course', 'course-1', now), false);
});

test('the purchase continues once only (intent is consumed), and never without a saved intent', () => {
  const store = new Map<string, string>();
  (globalThis as any).window = { localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) } };
  try {
    assert.equal(consumeIntent('course', 'course-1'), false, 'no intent (link opened directly / sign-in cancelled)');
    saveIntent('course', 'course-1');
    assert.equal(consumeIntent('course', 'course-2'), false, 'different course does not run…');
    assert.equal(consumeIntent('course', 'course-1'), false, '…and the intent was cleared');
    saveIntent('course', 'course-1');
    assert.equal(consumeIntent('course', 'course-1'), true);
    assert.equal(consumeIntent('course', 'course-1'), false, 'second time: nothing');
    saveIntent('course', '../../etc');
    assert.equal(store.size, 0, 'invalid ids are not stored');
  } finally {
    delete (globalThis as any).window;
  }
});
