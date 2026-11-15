import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeProgress } from '../src/logic/progress';

const outline = [
  { id: 'l1', course_id: 'c1' }, { id: 'l2', course_id: 'c1' }, { id: 'l3', course_id: 'c1' }, { id: 'l4', course_id: 'c1' },
  { id: 'm1', course_id: 'c2' },
];

test('progress counts only existing, completed lessons once', () => {
  const p = computeProgress(['c1', 'c2'], [
    { course_id: 'c1', lesson_id: 'l1', is_completed: true, updated_at: '2026-11-01T10:00:00Z' },
    { course_id: 'c1', lesson_id: 'l1', is_completed: true, updated_at: '2026-11-01T09:00:00Z' }, // duplicate row
    { course_id: 'c1', lesson_id: 'deleted', is_completed: true, updated_at: '2026-11-01T08:00:00Z' }, // lesson removed from course
    { course_id: 'c1', lesson_id: 'l2', is_completed: false, updated_at: '2026-11-02T10:00:00Z' }, // opened, not finished
  ], outline);
  assert.equal(p.c1.completed, 1);
  assert.equal(p.c1.total, 4);
  assert.equal(p.c1.percent, 25);
  assert.equal(p.c1.lastLessonId, 'l2'); // most recent row, regardless of input order
  assert.equal(p.c2.completed, 0);
  assert.equal(p.c2.percent, 0);
});

test('100% when every lesson is complete; never above 100', () => {
  const rows = ['l1', 'l2', 'l3', 'l4'].map((id) => ({ course_id: 'c1', lesson_id: id, is_completed: true, updated_at: '2026-11-01T00:00:00Z' }));
  assert.equal(computeProgress(['c1'], rows, outline).c1.percent, 100);
});

test('rows for other courses are ignored and empty input is safe', () => {
  const p = computeProgress(['c1'], [{ course_id: 'zzz', lesson_id: 'l1', is_completed: true, updated_at: null }], []);
  assert.equal(p.c1.total, 0);
  assert.equal(p.c1.percent, 0);
  assert.deepEqual(computeProgress([], [], []), {});
});
