/** Pure bundle mapping and pricing helpers (bundle data always comes from the backend). */
import type { Course } from '../lib/types';
import { mapCourse } from './courses';

export interface Bundle {
  id: string;
  slug: string | null;
  title: string;
  subtitle: string | null;
  description: string | null;
  thumbnail: string | null;
  price: number;
  courses: Course[];
  /** Sum of the included courses' individual prices (same rule as the website). */
  coursesValue: number;
}

export function mapBundle(row: any): Bundle {
  const courses = [...(row?.bundle_courses || [])]
    .sort((a, b) => (Number(a.position) || 0) - (Number(b.position) || 0))
    .map((bc) => (Array.isArray(bc.courses) ? bc.courses[0] : bc.courses))
    .filter((c) => c && c.id && c.is_published !== false)
    .map(mapCourse);
  const price = Math.max(0, Number(row?.price) || 0);
  return {
    id: String(row.id),
    slug: row.slug || null,
    title: (row.title || 'Course bundle').trim(),
    subtitle: row.subtitle || null,
    description: row.description || null,
    thumbnail: (typeof row.thumbnail_url === 'string' && /^https?:\/\//.test(row.thumbnail_url) ? row.thumbnail_url : null) || courses[0]?.thumbnail || null,
    price,
    courses,
    coursesValue: courses.reduce((s, c) => s + (c.price || 0), 0),
  };
}

export function bundleSavings(b: Pick<Bundle, 'price' | 'coursesValue'>) {
  const amount = Math.max(0, b.coursesValue - b.price);
  return { amount, percent: b.coursesValue > 0 ? Math.round((amount / b.coursesValue) * 100) : 0 };
}

/**
 * Ownership summary for a student. The server skips already-owned courses when enrolling,
 * but charges the bundle price as set by the admin (existing website rule) — so the app shows
 * this clearly before purchase.
 */
export function bundleOwnership(b: Pick<Bundle, 'courses'>, ownedCourseIds: Set<string>) {
  const owned = b.courses.filter((c) => ownedCourseIds.has(c.id));
  return {
    ownedCount: owned.length,
    total: b.courses.length,
    ownsAll: b.courses.length > 0 && owned.length === b.courses.length,
    missing: b.courses.filter((c) => !ownedCourseIds.has(c.id)),
  };
}
