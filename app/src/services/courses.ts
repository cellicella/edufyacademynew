import { supabase } from '@/lib/supabase';
import { Course, CourseWithCurriculum } from '@/lib/types';
import { buildSections, mapCourse } from '@/logic/courses';

export { mapCourse, deriveCategories, mergeCategories } from '@/logic/courses';

/** Admin-managed categories (null when the table isn't available yet → callers derive from courses). */
export async function fetchCategoryRows(signal?: AbortSignal): Promise<any[] | null> {
  let q = supabase.from('categories').select('slug, name, description, image_url, is_active, position').eq('is_active', true).order('position');
  if (signal) q = q.abortSignal(signal);
  const { data, error } = await q;
  if (error) {
    console.warn('[courses] categories table unavailable, deriving from courses:', error.message);
    return null;
  }
  return data || [];
}

const INSTRUCTOR_SELECT = 'profiles:instructor_id ( id, full_name, avatar_url, headline, bio )';

/** All published courses (RLS: "Published courses are viewable by everyone"). */
export async function fetchPublishedCourses(signal?: AbortSignal): Promise<Course[]> {
  let q = supabase.from('courses').select(`*, ${INSTRUCTOR_SELECT}`).eq('is_published', true).order('created_at', { ascending: false });
  if (signal) q = q.abortSignal(signal);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data || []).map(mapCourse);
}

/**
 * Course + curriculum. Lesson rows with content are only returned by RLS to enrolled learners
 * (or free previews); the public outline comes from the website's get_course_outline RPC.
 */
export async function fetchCourse(idOrSlug: string, signal?: AbortSignal): Promise<CourseWithCurriculum | null> {
  const safe = idOrSlug.replace(/[^A-Za-z0-9_-]/g, '');
  if (!safe) return null;
  let q = supabase
    .from('courses')
    .select(`*, ${INSTRUCTOR_SELECT}, course_sections ( id, title, section_order, lessons ( * ) )`)
    .or(`id.eq.${safe},slug.eq.${safe}`)
    .limit(1);
  if (signal) q = q.abortSignal(signal);
  // Course and outline are requested together (one round trip instead of two). Links normally use the
  // course id; when a slug was given the outline is fetched again with the real id.
  let outlineQ = supabase.rpc('get_course_outline', { p_course_ids: [safe] });
  if (signal) outlineQ = outlineQ.abortSignal(signal);
  const [{ data: rows, error }, first] = await Promise.all([q, outlineQ]);
  if (error) throw new Error(error.message);
  const data = rows?.[0];
  if (!data) return null;

  let outlineRes = first;
  if (data.id !== safe) {
    let again = supabase.rpc('get_course_outline', { p_course_ids: [data.id] });
    if (signal) again = again.abortSignal(signal);
    outlineRes = await again;
  }
  const { data: outline, error: outlineErr } = outlineRes;
  if (outlineErr) console.warn('[courses] outline unavailable, showing accessible lessons only:', outlineErr.message);

  const sections = buildSections(data.course_sections || [], (outline as any[]) || []);
  const totalLessons = sections.reduce((n, s) => n + s.lessons.length, 0);
  return { ...mapCourse(data), totalLessons: totalLessons || data.total_lessons || 0, sections };
}
