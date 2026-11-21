/** Pure lesson-navigation logic for the player (start lesson, previous/next). */
import type { Lesson } from '../lib/types';

export const canOpenLesson = (l: Lesson, enrolled: boolean) => l.accessible && (enrolled || l.isFreePreview);

/**
 * True when the database returned full content for a lesson that is not a free preview — row-level security
 * only does that for students with access (or the course staff), so the player can open without waiting for
 * the enrollment list.
 */
export const hasFullAccess = (lessons: Lesson[]) => lessons.some((l) => l.accessible && !l.isFreePreview);

/**
 * Starting lesson: explicit lesson → resume point (the last opened lesson if unfinished,
 * otherwise the next unfinished one after it) → first unfinished openable → first openable → first.
 */
export function pickStartLesson(
  lessons: Lesson[],
  opts: { requestedId?: string | null; lastLessonId?: string | null; completed: Set<string>; enrolled: boolean }
): Lesson | null {
  if (!lessons.length) return null;
  const open = (l: Lesson) => canOpenLesson(l, opts.enrolled);
  const requested = opts.requestedId ? lessons.find((l) => l.id === opts.requestedId) : undefined;
  if (requested) return requested;
  if (opts.lastLessonId) {
    const i = lessons.findIndex((l) => l.id === opts.lastLessonId);
    if (i >= 0) {
      if (!opts.completed.has(lessons[i].id) && open(lessons[i])) return lessons[i];
      const after = lessons.slice(i + 1).find((l) => !opts.completed.has(l.id) && open(l));
      if (after) return after;
    }
  }
  const openable = lessons.filter(open);
  return openable.find((l) => !opts.completed.has(l.id)) || openable[0] || lessons[0];
}

export function neighbours(lessons: Lesson[], currentId: string | null, enrolled: boolean) {
  const idx = lessons.findIndex((l) => l.id === currentId);
  const open = (l: Lesson) => canOpenLesson(l, enrolled);
  return {
    index: idx,
    prev: idx > 0 ? [...lessons.slice(0, idx)].reverse().find(open) : undefined,
    next: idx >= 0 ? lessons.slice(idx + 1).find(open) : undefined,
  };
}
