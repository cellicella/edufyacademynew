/** Pure course-progress computation from lesson_progress rows + the curriculum outline. */
export interface ProgressRow { course_id: string; lesson_id: string; is_completed: boolean | null; updated_at: string | null }
export interface OutlineRow { id: string; course_id: string }
export interface CourseProgress {
  courseId: string;
  completedLessonIds: string[];
  completed: number;
  total: number;
  percent: number;
  lastLessonId: string | null;
  lastAccessedAt: string | null;
}

export function emptyProgress(courseId: string, total = 0): CourseProgress {
  return { courseId, completedLessonIds: [], completed: 0, total, percent: 0, lastLessonId: null, lastAccessedAt: null };
}

/**
 * - Only lessons that still exist in the curriculum count as completed (deleted lessons are ignored).
 * - Duplicate progress rows for the same lesson are counted once.
 * - "Last accessed" is the most recently updated row, regardless of input order.
 */
export function computeProgress(courseIds: string[], rows: ProgressRow[], outline: OutlineRow[]): Record<string, CourseProgress> {
  const lessonsByCourse = new Map<string, Set<string>>();
  for (const o of outline || []) {
    if (!lessonsByCourse.has(o.course_id)) lessonsByCourse.set(o.course_id, new Set());
    lessonsByCourse.get(o.course_id)!.add(o.id);
  }
  const out: Record<string, CourseProgress> = {};
  for (const id of courseIds) out[id] = emptyProgress(id, lessonsByCourse.get(id)?.size || 0);

  const done = new Map<string, Set<string>>();
  for (const r of rows || []) {
    const p = out[r.course_id];
    if (!p) continue;
    if (r.updated_at && (!p.lastAccessedAt || r.updated_at > p.lastAccessedAt)) {
      p.lastAccessedAt = r.updated_at;
      p.lastLessonId = r.lesson_id;
    }
    const valid = lessonsByCourse.get(r.course_id);
    if (r.is_completed && (!valid || valid.has(r.lesson_id))) {
      if (!done.has(r.course_id)) done.set(r.course_id, new Set());
      done.get(r.course_id)!.add(r.lesson_id);
    }
  }
  for (const p of Object.values(out)) {
    p.completedLessonIds = [...(done.get(p.courseId) || [])];
    p.completed = p.completedLessonIds.length;
    p.percent = p.total ? Math.min(100, Math.round((p.completed / p.total) * 100)) : 0;
  }
  return out;
}
