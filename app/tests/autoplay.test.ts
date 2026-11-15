import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideAfterEnd } from '../src/logic/autoplay';

const L = (id: string, o: Partial<any> = {}) => ({
  id, sectionId: 's', title: id, durationMinutes: 5, type: 'video', order: 0, isFreePreview: false, accessible: true,
  videoUrl: null, contentText: null, adiloFileId: null, adiloEmbedUrl: 'https://adilo.bigcommand.com/watch/x', quizId: null, ...o,
}) as any;

test('next video lesson auto-plays (immediate next, in curriculum order)', () => {
  const r = decideAfterEnd([L('a'), L('b'), L('c')], 'a', { enrolled: true, completed: new Set(), autoplayEnabled: true });
  assert.equal(r.kind, 'next');
  assert.equal((r as any).lesson.id, 'b');
  assert.equal((r as any).autoplay, true);
});

test('autoplay preference off → next lesson offered without autoplay', () => {
  const r = decideAfterEnd([L('a'), L('b')], 'a', { enrolled: true, completed: new Set(), autoplayEnabled: false });
  assert.deepEqual([r.kind, (r as any).autoplay], ['next', false]);
});

test('articles/quizzes are offered but never auto-started', () => {
  const r = decideAfterEnd([L('a'), L('b', { type: 'article' })], 'a', { enrolled: true, completed: new Set(), autoplayEnabled: true });
  assert.deepEqual([r.kind, (r as any).autoplay], ['next', false]);
});

test('locked next lesson is never skipped or auto-played', () => {
  const r = decideAfterEnd([L('a', { isFreePreview: true }), L('b', { accessible: false }), L('c', { isFreePreview: true })], 'a', {
    enrolled: false, completed: new Set(), autoplayEnabled: true,
  });
  assert.equal(r.kind, 'locked');
  assert.equal((r as any).lesson.id, 'b');
});

test('last lesson: course complete vs lessons remaining', () => {
  const lessons = [L('a'), L('b'), L('c')];
  assert.deepEqual(decideAfterEnd(lessons, 'c', { enrolled: true, completed: new Set(['a', 'b']), autoplayEnabled: true }), { kind: 'course_complete' });
  assert.deepEqual(decideAfterEnd(lessons, 'c', { enrolled: true, completed: new Set(['a']), autoplayEnabled: true }), { kind: 'last_lesson', remaining: 1 });
});

test('unknown current lesson does not crash', () => {
  const r = decideAfterEnd([L('a')], 'zzz', { enrolled: true, completed: new Set(), autoplayEnabled: true });
  assert.equal(r.kind, 'last_lesson');
});
