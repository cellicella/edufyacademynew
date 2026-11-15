/** Decides what happens when a lesson video genuinely ends (pure; unit-tested). */
import type { Lesson } from '../lib/types';
import { canOpenLesson } from './learningNav';

export type AfterEnd =
  | { kind: 'next'; lesson: Lesson; autoplay: boolean }
  | { kind: 'locked'; lesson: Lesson }
  | { kind: 'course_complete' }
  | { kind: 'last_lesson'; remaining: number };

/**
 * - Uses the lesson that IMMEDIATELY follows in curriculum order (sections → lessons): never skips.
 * - A locked next lesson is shown as locked; it is never auto-played.
 * - Only video lessons auto-play; articles/quizzes are offered but not started automatically.
 * - On the last lesson: "course complete" when every lesson is done, otherwise how many remain.
 */
export function decideAfterEnd(
  lessons: Lesson[],
  currentId: string,
  opts: { enrolled: boolean; completed: Set<string>; autoplayEnabled: boolean }
): AfterEnd {
  const idx = lessons.findIndex((l) => l.id === currentId);
  const next = idx >= 0 ? lessons[idx + 1] : undefined;
  if (next) {
    if (!canOpenLesson(next, opts.enrolled)) return { kind: 'locked', lesson: next };
    return { kind: 'next', lesson: next, autoplay: opts.autoplayEnabled && next.type === 'video' };
  }
  const done = new Set(opts.completed);
  if (idx >= 0) done.add(lessons[idx].id);
  const remaining = lessons.filter((l) => !done.has(l.id)).length;
  return remaining === 0 ? { kind: 'course_complete' } : { kind: 'last_lesson', remaining };
}

export const AUTOPLAY_SECONDS = 5;
