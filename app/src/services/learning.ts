import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { Enrollment } from '@/lib/types';
import { computeProgress, CourseProgress } from '@/logic/progress';

export async function fetchEnrollments(userId: string): Promise<Enrollment[]> {
  const { data, error } = await supabase
    .from('enrollments')
    .select('course_id, status, enrolled_at, completed_at, bundle_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('enrolled_at', { ascending: false });
  if (error) throw new Error(error.message);
  const seen = new Set<string>();
  return (data || [])
    .filter((e: any) => (seen.has(e.course_id) ? false : (seen.add(e.course_id), true)))
    .map((e: any) => ({ courseId: e.course_id, status: e.status, enrolledAt: e.enrolled_at, completedAt: e.completed_at, bundleId: e.bundle_id || null }));
}

/** Per-course progress from lesson_progress (same table the website writes). */
export async function fetchProgress(userId: string, courseIds: string[]): Promise<Record<string, CourseProgress>> {
  if (!courseIds.length) return {};
  const [{ data: rows, error }, { data: outline, error: outlineErr }] = await Promise.all([
    supabase
      .from('lesson_progress')
      .select('course_id, lesson_id, is_completed, updated_at')
      .eq('user_id', userId)
      .in('course_id', courseIds),
    supabase.rpc('get_course_outline', { p_course_ids: courseIds }),
  ]);
  if (error) throw new Error(error.message);
  if (outlineErr) throw new Error(outlineErr.message);
  return computeProgress(courseIds, (rows as any[]) || [], (outline as any[]) || []);
}

/** Marks a lesson as opened (drives "Continue learning" / resume). Never changes completion. */
export async function touchLesson(userId: string, courseId: string, lessonId: string) {
  const { error } = await supabase
    .from('lesson_progress')
    .upsert({ user_id: userId, course_id: courseId, lesson_id: lessonId, updated_at: new Date().toISOString() }, { onConflict: 'user_id,lesson_id' });
  if (error) throw new Error(error.message);
}

/**
 * Manual completion for non-Adilo lessons (articles, external videos) — same upsert the
 * website's CourseProgressContext performs. Adilo video lessons are completed by the server
 * from verified watch time; the database trigger rejects client-side completion for them.
 */
export async function setLessonComplete(userId: string, courseId: string, lessonId: string, done: boolean) {
  const { error } = await supabase.from('lesson_progress').upsert(
    {
      user_id: userId,
      course_id: courseId,
      lesson_id: lessonId,
      is_completed: done,
      completed_at: done ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,lesson_id' }
  );
  if (error) throw new Error(error.message);
}

export interface LessonVideoAccess {
  embedUrl: string;
  playerOrigin: string;
  title: string | null;
  durationSeconds: number | null;
  status: string | null;
  progress: { last_position_seconds: number; watched_seconds: number; is_completed: boolean } | null;
}

/** Existing endpoint: enrollment-checked Adilo player link. */
export const getLessonVideo = (lessonId: string, signal?: AbortSignal) => api<LessonVideoAccess>(`/lessons/${encodeURIComponent(lessonId)}/video`, { signal });

/** Existing endpoint: verified watch progress (server completes the lesson at 90%). */
export const reportVideoProgress = (
  lessonId: string,
  body: { position: number; watchedSeconds: number; duration: number; event: string }
) =>
  api<{ position: number; watchedSeconds: number; duration: number; isCompleted: boolean; justCompleted: boolean }>(
    `/lessons/${encodeURIComponent(lessonId)}/video-progress`,
    { body }
  );
