import { supabase } from '@/lib/supabase';
import { Bundle, mapBundle } from '@/logic/bundles';

const COURSE_FIELDS = 'id, slug, title, subtitle, category, category_slug, level, price, original_price, rating, review_count, enrolled_count, duration_hours, total_lessons, thumbnail_url, is_published, created_at, instructor_id, profiles:instructor_id ( id, full_name, avatar_url )';
const BUNDLE_SELECT = `id, slug, title, subtitle, description, thumbnail_url, price, is_published, created_at, bundle_courses ( position, course_id, courses ( ${COURSE_FIELDS} ) )`;

/** Published bundles (RLS: "Published bundles are public"). Prices come from the database. */
export async function fetchBundles(signal?: AbortSignal): Promise<Bundle[]> {
  let q = supabase.from('bundles').select(BUNDLE_SELECT).eq('is_published', true).order('created_at', { ascending: false });
  if (signal) q = q.abortSignal(signal);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data || []).map(mapBundle).filter((b) => b.courses.length > 0);
}

export async function fetchBundle(idOrSlug: string, signal?: AbortSignal): Promise<Bundle | null> {
  const safe = idOrSlug.replace(/[^A-Za-z0-9_-]/g, '');
  if (!safe) return null;
  let q = supabase.from('bundles').select(BUNDLE_SELECT).eq('is_published', true).or(`id.eq.${safe},slug.eq.${safe}`).limit(1);
  if (signal) q = q.abortSignal(signal);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data?.[0] ? mapBundle(data[0]) : null;
}
