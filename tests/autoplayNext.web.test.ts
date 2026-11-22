import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AUTOPLAY_COUNTDOWN_SECONDS, lessonToAutoplay, readAutoplayPref, writeAutoplayPref } from '../src/lib/autoplayNext';

const lessons = [
  { id: 'L1', isFreePreview: true },
  { id: 'L2', isFreePreview: false },
  { id: 'L3', isFreePreview: true },
];

test('the next lesson is offered after a video ends', () => {
  assert.equal(lessonToAutoplay(lessons, 'L1', { enabled: true, enrolled: true })?.id, 'L2');
  assert.equal(lessonToAutoplay(lessons, 'L2', { enabled: true, enrolled: true })?.id, 'L3');
  assert.equal(AUTOPLAY_COUNTDOWN_SECONDS, 5);
});

test('nothing after the last lesson, when switched off, or for an unknown lesson', () => {
  assert.equal(lessonToAutoplay(lessons, 'L3', { enabled: true, enrolled: true }), null);
  assert.equal(lessonToAutoplay(lessons, 'L1', { enabled: false, enrolled: true }), null);
  assert.equal(lessonToAutoplay(lessons, 'nope', { enabled: true, enrolled: true }), null);
  assert.equal(lessonToAutoplay([], 'L1', { enabled: true, enrolled: true }), null);
});

test('learners who are not enrolled only continue to free-preview lessons', () => {
  assert.equal(lessonToAutoplay(lessons, 'L1', { enabled: true, enrolled: false }), null, 'L2 is locked');
  assert.equal(lessonToAutoplay(lessons, 'L2', { enabled: true, enrolled: false })?.id, 'L3', 'L3 is a free preview');
});

test('autoplay is on by default and the choice is remembered', () => {
  const map = new Map<string, string>();
  const store = { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) };
  assert.equal(readAutoplayPref(store), true);
  writeAutoplayPref(false, store);
  assert.equal(readAutoplayPref(store), false);
  writeAutoplayPref(true, store);
  assert.equal(readAutoplayPref(store), true);
  assert.equal(readAutoplayPref(null), true, 'no storage → on');
  const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  assert.equal(readAutoplayPref(broken), true);
  assert.doesNotThrow(() => writeAutoplayPref(false, broken));
});
