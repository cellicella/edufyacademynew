/**
 * Rules for the on-device copy of the data cache (pure logic, unit-tested).
 *
 * The app keeps a snapshot of catalogue data (courses, categories, banners, offers, bundles, blog) and the
 * student's enrolments/progress so screens open instantly on the next start and refresh in the background.
 * Course content (lessons), payments, messages and anything secret are never written.
 */
import type { Course } from '@/lib/types';
import type { CourseProgress } from '@/logic/progress';

export const PERSIST_VERSION = 1;
export const PERSIST_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const PERSISTED_ROOTS = new Set(['courses', 'categories', 'banners', 'offers', 'bundles', 'blog', 'enrollments', 'progress']);

/** Only these query roots are saved on the phone. */
export function shouldPersistKey(key: readonly unknown[]): boolean {
  return typeof key[0] === 'string' && PERSISTED_ROOTS.has(key[0]);
}

interface Snapshot<S> {
  v: number;
  savedAt: number;
  buster: string;
  state: S;
}

/** Serialised snapshot; `buster` is the app version so an update never reads an older data shape. */
export function buildSnapshot<S>(state: S, now: number, buster: string): string {
  const snap: Snapshot<S> = { v: PERSIST_VERSION, savedAt: now, buster, state };
  return JSON.stringify(snap);
}

/** The saved state, or null when missing, corrupt, from another app version or older than 7 days. */
export function readSnapshot<S>(raw: string | null | undefined, now: number, buster: string): S | null {
  if (!raw) return null;
  try {
    const snap = JSON.parse(raw) as Partial<Snapshot<S>> | null;
    if (!snap || typeof snap !== 'object') return null;
    if (snap.v !== PERSIST_VERSION || snap.buster !== buster) return null;
    if (typeof snap.savedAt !== 'number' || now - snap.savedAt > PERSIST_MAX_AGE_MS || snap.savedAt > now + 60_000) return null;
    if (!snap.state || typeof snap.state !== 'object') return null;
    return snap.state;
  } catch {
    return null;
  }
}

/** Catalogue entry for a course id or slug (used to draw the course page while its curriculum loads). */
export function findCourseInList(list: readonly Course[] | null | undefined, idOrSlug: string | undefined): Course | undefined {
  if (!list || !idOrSlug) return undefined;
  return list.find((c) => c.id === idOrSlug) || list.find((c) => !!c.slug && c.slug === idOrSlug);
}

/** Progress for one course taken from any cached multi-course progress result (instant resume). */
export function progressFromCache(
  entries: readonly (readonly [readonly unknown[], Record<string, CourseProgress> | undefined])[],
  courseId: string
): Record<string, CourseProgress> | undefined {
  for (const [, data] of entries) {
    if (data && data[courseId]) return { [courseId]: data[courseId] };
  }
  return undefined;
}
