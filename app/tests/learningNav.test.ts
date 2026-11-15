import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canOpenLesson, neighbours, pickStartLesson } from '../src/logic/learningNav';

const L = (id: string, o: Partial<any> = {}) => ({
  id, sectionId: 's', title: id, durationMinutes: 5, type: 'video', order: 0, isFreePreview: false, accessible: true,
  videoUrl: null, contentText: null, adiloFileId: null, adiloEmbedUrl: null, quizId: null, ...o,
}) as any;
const lessons = [L('a'), L('b'), L('c'), L('d')];

test('explicit lesson wins', () => {
  assert.equal(pickStartLesson(lessons, { requestedId: 'c', completed: new Set(), enrolled: true })?.id, 'c');
});

test('resume: unfinished last lesson, else next unfinished after it', () => {
  assert.equal(pickStartLesson(lessons, { lastLessonId: 'b', completed: new Set(['a']), enrolled: true })?.id, 'b');
  assert.equal(pickStartLesson(lessons, { lastLessonId: 'b', completed: new Set(['a', 'b']), enrolled: true })?.id, 'c');
  assert.equal(pickStartLesson(lessons, { lastLessonId: 'd', completed: new Set(['d']), enrolled: true })?.id, 'a'); // wraps to first unfinished
});

test('everything complete → first lesson; unknown last lesson ignored', () => {
  assert.equal(pickStartLesson(lessons, { completed: new Set(['a', 'b', 'c', 'd']), enrolled: true })?.id, 'a');
  assert.equal(pickStartLesson(lessons, { lastLessonId: 'gone', completed: new Set(), enrolled: true })?.id, 'a');
});

test('not enrolled: only free previews open', () => {
  const ls = [L('a', { accessible: false }), L('b', { isFreePreview: true }), L('c')];
  assert.equal(canOpenLesson(ls[0], false), false);
  assert.equal(canOpenLesson(ls[1], false), true);
  assert.equal(canOpenLesson(ls[2], false), false);
  assert.equal(pickStartLesson(ls, { completed: new Set(), enrolled: false })?.id, 'b');
  const n = neighbours(ls, 'b', false);
  assert.equal(n.prev, undefined);
  assert.equal(n.next, undefined); // c is locked
});

test('prev/next skip locked lessons; empty course is safe', () => {
  const ls = [L('a'), L('b', { accessible: false }), L('c')];
  const n = neighbours(ls, 'a', true);
  assert.equal(n.next?.id, 'c');
  assert.equal(neighbours(ls, 'c', true).prev?.id, 'a');
  assert.equal(pickStartLesson([], { completed: new Set(), enrolled: true }), null);
});
