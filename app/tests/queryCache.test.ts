import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSnapshot, findCourseInList, PERSIST_MAX_AGE_MS, progressFromCache, readSnapshot, shouldPersistKey } from '../src/logic/queryCache';

test('only catalogue and learning data are saved on the phone', () => {
  for (const k of [['courses'], ['categories'], ['banners'], ['offers'], ['bundles'], ['blog'], ['enrollments', 'u1'], ['progress', 'u1', 'a,b']]) {
    assert.equal(shouldPersistKey(k), true, k.join('/'));
  }
  for (const k of [['course', 'c1', 'u1'], ['payments', 'u1'], ['inbox', 'u1'], ['site-settings'], ['notification-prefs', 'u1'], ['certificates', 'u1'], [], [42]]) {
    assert.equal(shouldPersistKey(k), false, JSON.stringify(k));
  }
});

test('snapshot round trip, version / app-update / age checks', () => {
  const now = Date.parse('2026-11-17T10:00:00Z');
  const state = { queries: [{ queryKey: ['courses'], state: { data: [1, 2] } }], mutations: [] };
  const raw = buildSnapshot(state, now, '1.0.0');
  assert.deepEqual(readSnapshot(raw, now + 1000, '1.0.0'), state);
  assert.equal(readSnapshot(raw, now, '1.0.1'), null, 'app update drops the old copy');
  assert.equal(readSnapshot(raw, now + PERSIST_MAX_AGE_MS + 1, '1.0.0'), null, 'older than 7 days');
  assert.equal(readSnapshot(raw, now - 10 * 60_000, '1.0.0'), null, 'saved in the future (clock change)');
  assert.equal(readSnapshot('{not json', now, '1.0.0'), null);
  assert.equal(readSnapshot('null', now, '1.0.0'), null);
  assert.equal(readSnapshot(JSON.stringify({ v: 99, savedAt: now, buster: '1.0.0', state }), now, '1.0.0'), null);
  assert.equal(readSnapshot(JSON.stringify({ v: 1, savedAt: now, buster: '1.0.0' }), now, '1.0.0'), null);
  assert.equal(readSnapshot(null, now, '1.0.0'), null);
});

test('course page placeholder is found by id or slug', () => {
  const list = [
    { id: 'course-1', slug: 'react-basics', title: 'A' },
    { id: 'course-2', slug: null, title: 'B' },
  ] as any[];
  assert.equal(findCourseInList(list, 'course-2')?.title, 'B');
  assert.equal(findCourseInList(list, 'react-basics')?.title, 'A');
  assert.equal(findCourseInList(list, 'missing'), undefined);
  assert.equal(findCourseInList(undefined, 'course-1'), undefined);
  assert.equal(findCourseInList(list, undefined), undefined);
});

test('lesson player starts from progress already loaded for My Learning', () => {
  const p1 = { courseId: 'c1', completed: 3, total: 10, percent: 30 } as any;
  const entries = [
    [['progress', 'u1', 'c2'], { c2: { courseId: 'c2' } as any }],
    [['progress', 'u1', 'c1,c2'], { c1: p1, c2: { courseId: 'c2' } as any }],
    [['progress', 'u1', 'x'], undefined],
  ] as const;
  assert.deepEqual(progressFromCache(entries, 'c1'), { c1: p1 });
  assert.equal(progressFromCache(entries, 'c9'), undefined);
  assert.equal(progressFromCache([], 'c1'), undefined);
});
