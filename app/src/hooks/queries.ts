import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { fetchCategoryRows, fetchCourse, fetchPublishedCourses, mergeCategories } from '@/services/courses';
import { fetchEnrollments, fetchProgress, getLessonVideo } from '@/services/learning';
import { fetchPaymentHistory } from '@/services/payments';
import { fetchBundle, fetchBundles } from '@/services/bundles';
import { fetchMyCertificates } from '@/services/certificates';
import { Course, CourseProgress } from '@/lib/types';
import { emptyProgress } from '@/logic/progress';
import { findCourseInList, progressFromCache } from '@/logic/queryCache';
import { fetchBanners } from '@/services/inbox';
import { Image } from 'expo-image';
import { cdnImage } from '@/logic/cdnImage';
import type { Banner } from '@/logic/engagement';

export const qk = {
  courses: ['courses'] as const,
  course: (id: string) => ['course', id] as const,
  enrollments: (uid?: string) => ['enrollments', uid] as const,
  progress: (uid?: string, ids?: string) => ['progress', uid, ids] as const,
  payments: (uid?: string) => ['payments', uid] as const,
  bundles: ['bundles'] as const,
  bundle: (id: string) => ['bundle', id] as const,
  certificates: (uid?: string) => ['certificates', uid] as const,
};

/** How long data counts as fresh (cached data is still shown instantly and refreshed in the background). */
export const STALE = {
  catalogue: 5 * 60_000,
  categories: 10 * 60_000,
  course: 5 * 60_000,
  enrollments: 2 * 60_000,
  progress: 60_000,
} as const;

const coursesQuery = { queryKey: qk.courses, queryFn: ({ signal }: { signal?: AbortSignal }) => fetchPublishedCourses(signal), staleTime: STALE.catalogue };
const categoriesQuery = { queryKey: ['categories'] as const, queryFn: ({ signal }: { signal?: AbortSignal }) => fetchCategoryRows(signal), staleTime: STALE.categories };
const courseQuery = (id: string, uid: string | undefined) => ({
  // Lesson visibility depends on who is signed in, so cache per user
  queryKey: [...qk.course(id), uid || 'guest'] as const,
  queryFn: ({ signal }: { signal?: AbortSignal }) => fetchCourse(id, signal),
  staleTime: STALE.course,
});

/**
 * Enrollment-checked Adilo player details for one lesson (existing endpoint GET /api/lessons/:id/video):
 * resume position, verified watch time and duration. Cached per student so revisiting a lesson is instant.
 */
export const lessonVideoQuery = (lessonId: string, uid: string | undefined) => ({
  queryKey: ['lesson-video', lessonId, uid] as const,
  queryFn: ({ signal }: { signal?: AbortSignal }) => getLessonVideo(lessonId, signal),
  staleTime: 2 * 60_000,
  retry: 1,
});

/**
 * Starts loading the catalogue (courses, categories, home banners) in parallel — called at app start while the
 * session is restored. Skips anything already fresh in the cache, so it never causes repeated requests.
 */
export async function prefetchCatalogue(qc: QueryClient): Promise<void> {
  await Promise.allSettled([
    qc.prefetchQuery(coursesQuery),
    qc.prefetchQuery(categoriesQuery),
    qc.prefetchQuery({ queryKey: ['banners'], queryFn: ({ signal }) => fetchBanners(signal), staleTime: STALE.catalogue }),
  ]);
  // Download the first course cards and banners at the exact CDN size the screens use
  const urls = [
    ...(qc.getQueryData<Banner[]>(['banners']) || []).map((b) => cdnImage(b.imageUrl, 1080)),
    ...(qc.getQueryData<Course[]>(qk.courses) || []).slice(0, 12).map((c) => cdnImage(c.thumbnail, 720)),
  ].filter((u): u is string => !!u);
  if (urls.length) Image.prefetch(urls, 'memory-disk').catch(() => undefined);
}

/** Starts loading the signed-in student's enrolments (Home / My Learning) during start-up. */
export function prefetchEnrollments(qc: QueryClient, uid: string): Promise<unknown> {
  return qc.prefetchQuery({ queryKey: qk.enrollments(uid), queryFn: () => fetchEnrollments(uid), staleTime: STALE.enrollments });
}

export function useCourses() {
  return useQuery(coursesQuery);
}

/**
 * Returns a function that warms a course page (on press-in, before navigation finishes). With `lessonId`
 * (Continue learning) the lesson's video details are requested at the same time, in parallel.
 */
export function usePrefetchCourse() {
  const qc = useQueryClient();
  const { session } = useAuth();
  const uid = session?.user.id;
  return useCallback((id: string, lessonId?: string | null) => {
    qc.prefetchQuery(courseQuery(id, uid)).catch(() => undefined);
    if (lessonId && uid) qc.prefetchQuery(lessonVideoQuery(lessonId, uid)).catch(() => undefined);
  }, [qc, uid]);
}

/** Categories from the admin panel (database), with live course counts. */
export function useCategories() {
  const q = useCourses();
  const rows = useQuery(categoriesQuery);
  const data = useMemo(() => (q.data ? mergeCategories(rows.isLoading ? null : rows.data ?? null, q.data) : []), [q.data, rows.data, rows.isLoading]);
  return { ...q, data };
}

/**
 * Course + curriculum. With `fromList`, the course page is drawn at once from the catalogue already in the
 * cache (title, price, description…) while the curriculum loads — `isPlaceholderData` is true until then.
 */
export function useCourse(id: string | undefined, opts: { fromList?: boolean } = {}) {
  const { session } = useAuth();
  const qc = useQueryClient();
  return useQuery({
    ...courseQuery(id || '', session?.user.id),
    enabled: !!id,
    placeholderData: opts.fromList
      ? () => {
          const c = findCourseInList(qc.getQueryData<Course[]>(qk.courses), id);
          return c ? { ...c, sections: [] } : undefined;
        }
      : undefined,
  });
}

export function useEnrollments() {
  const { session } = useAuth();
  const uid = session?.user.id;
  return useQuery({ queryKey: qk.enrollments(uid), queryFn: () => fetchEnrollments(uid!), enabled: !!uid, staleTime: STALE.enrollments });
}

export function useIsEnrolled(courseId: string | undefined) {
  const e = useEnrollments();
  return { ...e, enrolled: !!courseId && !!e.data?.some((x) => x.courseId === courseId) };
}

export function useProgress(courseIds: string[]) {
  const { session } = useAuth();
  const qc = useQueryClient();
  const uid = session?.user.id;
  const key = [...courseIds].sort().join(',');
  return useQuery({
    queryKey: qk.progress(uid, key),
    queryFn: () => fetchProgress(uid!, courseIds),
    enabled: !!uid && courseIds.length > 0,
    staleTime: STALE.progress,
    // One course (lesson player): start from the progress Home / My Learning already loaded
    // and keep the previous numbers on screen while a changed course list refreshes
    placeholderData: (previous: Record<string, CourseProgress> | undefined) =>
      courseIds.length === 1
        ? progressFromCache(qc.getQueriesData<Record<string, CourseProgress>>({ queryKey: ['progress', uid] }), courseIds[0])
        : previous,
  });
}

export interface LearningItem {
  course: Course;
  progress: CourseProgress;
  enrolledAt: string;
  completed: boolean;
  bundleId: string | null;
}

/** Enrolled courses joined with catalogue data and progress — powers Home, My Learning and Dashboard. */
export function useMyLearning() {
  const courses = useCourses();
  const enrollments = useEnrollments();
  const ids = useMemo(() => (enrollments.data || []).map((e) => e.courseId), [enrollments.data]);
  const progress = useProgress(ids);

  const items = useMemo<LearningItem[]>(() => {
    if (!enrollments.data || !courses.data) return [];
    const byId = new Map(courses.data.map((c) => [c.id, c]));
    return enrollments.data
      .map((e) => {
        const course = byId.get(e.courseId);
        if (!course) return null;
        const p = progress.data?.[e.courseId] || emptyProgress(e.courseId, course.totalLessons);
        return { course, progress: p, enrolledAt: e.enrolledAt, completed: !!e.completedAt || (p.total > 0 && p.completed >= p.total), bundleId: e.bundleId };
      })
      .filter(Boolean) as LearningItem[];
  }, [enrollments.data, courses.data, progress.data]);

  const recent = useMemo(
    () => [...items].sort((a, b) => (b.progress.lastAccessedAt || b.enrolledAt).localeCompare(a.progress.lastAccessedAt || a.enrolledAt)),
    [items]
  );

  return {
    items,
    recent,
    inProgress: recent.filter((i) => !i.completed),
    completed: items.filter((i) => i.completed),
    isLoading: courses.isLoading || enrollments.isLoading || (ids.length > 0 && progress.isLoading),
    error: courses.error || enrollments.error || progress.error,
    refetch: async () => {
      await Promise.all([courses.refetch(), enrollments.refetch(), progress.refetch()]);
    },
  };
}

export function usePayments() {
  const { session } = useAuth();
  return useQuery({ queryKey: qk.payments(session?.user.id), queryFn: fetchPaymentHistory, enabled: !!session });
}

export function useBundles() {
  return useQuery({ queryKey: qk.bundles, queryFn: ({ signal }) => fetchBundles(signal), staleTime: 5 * 60_000 });
}

export function useBundle(id: string | undefined) {
  return useQuery({ queryKey: qk.bundle(id || ''), queryFn: ({ signal }) => fetchBundle(id!, signal), enabled: !!id });
}

export function useCertificates() {
  const { session } = useAuth();
  const uid = session?.user.id;
  return useQuery({ queryKey: qk.certificates(uid), queryFn: ({ signal }) => fetchMyCertificates(uid!, signal), enabled: !!uid });
}
