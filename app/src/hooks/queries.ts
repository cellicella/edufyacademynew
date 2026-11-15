import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { fetchCategoryRows, fetchCourse, fetchPublishedCourses, mergeCategories } from '@/services/courses';
import { fetchEnrollments, fetchProgress } from '@/services/learning';
import { fetchPaymentHistory } from '@/services/payments';
import { fetchBundle, fetchBundles } from '@/services/bundles';
import { fetchMyCertificates } from '@/services/certificates';
import { Course, CourseProgress } from '@/lib/types';
import { emptyProgress } from '@/logic/progress';

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

export function useCourses() {
  return useQuery({ queryKey: qk.courses, queryFn: ({ signal }) => fetchPublishedCourses(signal), staleTime: 5 * 60_000 });
}

/** Categories from the admin panel (database), with live course counts. */
export function useCategories() {
  const q = useCourses();
  const rows = useQuery({ queryKey: ['categories'], queryFn: ({ signal }) => fetchCategoryRows(signal), staleTime: 10 * 60_000 });
  const data = useMemo(() => (q.data ? mergeCategories(rows.isLoading ? null : rows.data ?? null, q.data) : []), [q.data, rows.data, rows.isLoading]);
  return { ...q, data };
}

export function useCourse(id: string | undefined) {
  const { session } = useAuth();
  // Lesson visibility depends on who is signed in, so cache per user
  return useQuery({
    queryKey: [...qk.course(id || ''), session?.user.id || 'guest'],
    queryFn: ({ signal }) => fetchCourse(id!, signal),
    enabled: !!id,
  });
}

export function useEnrollments() {
  const { session } = useAuth();
  const uid = session?.user.id;
  return useQuery({ queryKey: qk.enrollments(uid), queryFn: () => fetchEnrollments(uid!), enabled: !!uid });
}

export function useIsEnrolled(courseId: string | undefined) {
  const e = useEnrollments();
  return { ...e, enrolled: !!courseId && !!e.data?.some((x) => x.courseId === courseId) };
}

export function useProgress(courseIds: string[]) {
  const { session } = useAuth();
  const uid = session?.user.id;
  const key = [...courseIds].sort().join(',');
  return useQuery({ queryKey: qk.progress(uid, key), queryFn: () => fetchProgress(uid!, courseIds), enabled: !!uid && courseIds.length > 0 });
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
