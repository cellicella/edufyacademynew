/** Pure mapping of Supabase rows (courses, sections, lessons, outline) into app models. */
import type { Category, Course, Lesson, Section } from '../lib/types';

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0) : []);
const num = (v: unknown, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

export function mapCourse(row: any): Course {
  const p = Array.isArray(row?.profiles) ? row.profiles[0] : row?.profiles;
  return {
    id: String(row.id),
    slug: row.slug ?? null,
    title: (row.title || 'Untitled course').trim(),
    subtitle: row.subtitle || null,
    description: row.description || null,
    category: row.category || 'General',
    categorySlug: row.category_slug || 'general',
    level: row.level || 'All Levels',
    language: row.language || 'English',
    price: Math.max(0, num(row.price)),
    originalPrice: Math.max(0, num(row.original_price)),
    rating: num(row.rating),
    reviewCount: num(row.review_count),
    enrolledCount: num(row.enrolled_count),
    durationHours: num(row.duration_hours),
    totalLessons: num(row.total_lessons),
    thumbnail: typeof row.thumbnail_url === 'string' && /^https?:\/\//.test(row.thumbnail_url) ? row.thumbnail_url : null,
    previewVideoUrl: row.banner_url || null,
    featured: !!row.featured,
    bestseller: !!row.bestseller,
    trending: !!row.trending,
    createdAt: row.created_at || '',
    instructor: {
      id: p?.id || row.instructor_id || '',
      name: p?.full_name || 'Edufy Instructor',
      headline: p?.headline || null,
      avatar: typeof p?.avatar_url === 'string' && /^https?:\/\//.test(p.avatar_url) ? p.avatar_url : null,
      bio: p?.bio || null,
    },
    learningOutcomes: strings(row.learning_outcomes),
    // The website stores a "__status:" workflow marker in prerequisites; never show it.
    requirements: strings(row.prerequisites).filter((r) => !r.startsWith('__status:')),
    targetAudience: strings(row.target_audience),
  };
}

/** Categories derived from the live catalogue (the website has no categories table). */
export function deriveCategories(courses: Course[]): Category[] {
  const map = new Map<string, Category>();
  for (const c of courses) {
    const cur = map.get(c.categorySlug) || { slug: c.categorySlug, name: c.category, count: 0 };
    cur.count++;
    map.set(c.categorySlug, cur);
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/**
 * Categories managed in the admin panel (categories table) joined with live course counts.
 * Only active categories that have at least one published course are shown, in admin order.
 * When the table isn't available, falls back to categories derived from the courses.
 */
export function mergeCategories(rows: any[] | null, courses: Course[]): Category[] {
  const derived = deriveCategories(courses);
  if (!rows) return derived;
  const counts = new Map(derived.map((c) => [c.slug, c.count]));
  return rows
    .filter((r) => r && r.is_active !== false && typeof r.slug === 'string')
    .map((r) => ({
      slug: r.slug as string,
      name: String(r.name || r.slug),
      count: counts.get(r.slug) || 0,
      description: r.description || null,
      imageUrl: typeof r.image_url === 'string' && /^https:\/\//.test(r.image_url) ? r.image_url : null,
      position: Number(r.position) || 0,
    }))
    .filter((c) => c.count > 0)
    .sort((a, b) => (a.position || 0) - (b.position || 0) || b.count - a.count || a.name.localeCompare(b.name));
}

/**
 * Merges RLS-visible lesson rows (full content) with the public outline (titles only).
 * Lessons appear once even if both sources contain them; order follows lesson_order.
 */
export function buildSections(rawSections: any[], outline: any[]): Section[] {
  const content = new Map<string, any>();
  for (const s of rawSections || []) for (const l of s.lessons || []) content.set(l.id, l);

  const outlineBySection = new Map<string, any[]>();
  for (const o of outline || []) {
    const list = outlineBySection.get(o.section_id) || [];
    list.push(o);
    outlineBySection.set(o.section_id, list);
  }

  return [...(rawSections || [])]
    .sort((a, b) => num(a.section_order) - num(b.section_order))
    .map((s) => {
      const fromOutline = outlineBySection.get(s.id) || [];
      const seen = new Set<string>();
      const rows = [...fromOutline, ...(s.lessons || [])].filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
      const lessons: Lesson[] = rows
        .map((o) => {
          const full = content.get(o.id);
          return {
            id: String(o.id),
            sectionId: String(s.id),
            title: full?.title || o.title || 'Untitled lesson',
            durationMinutes: Math.max(0, num(full?.duration_minutes ?? o.duration_minutes, 10)),
            type: (['video', 'article', 'quiz'].includes(full?.type || o.type) ? full?.type || o.type : 'video') as Lesson['type'],
            order: num(full?.lesson_order ?? o.lesson_order),
            isFreePreview: !!(full?.is_free_preview ?? o.is_free_preview),
            accessible: !!full,
            videoUrl: full?.video_url || null,
            contentText: full?.content_text || null,
            adiloFileId: full?.adilo_file_id || null,
            adiloEmbedUrl: full?.adilo_embed_url || null,
            quizId: full?.quiz_id || null,
          };
        })
        .sort((a, b) => a.order - b.order);
      return { id: String(s.id), title: s.title || 'Section', order: num(s.section_order), lessons };
    });
}

export const isAdiloLesson = (l: Pick<Lesson, 'adiloFileId' | 'adiloEmbedUrl'>) => !!(l.adiloFileId || l.adiloEmbedUrl);
