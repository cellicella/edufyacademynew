import { supabase } from '@/lib/supabase';

/**
 * Blog posts — the same records as the website (table blog_posts). Row-level security only returns
 * published posts whose publish time has passed, so drafts and scheduled posts never reach the app.
 */
export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  contentHtml: string;
  coverImageUrl: string | null;
  category: string | null;
  tags: string[];
  authorName: string;
  authorRole: string;
  authorAvatarUrl: string | null;
  publishedAt: string | null;
  isFeatured: boolean;
  readingMinutes: number;
}

const https = (v: unknown) => (typeof v === 'string' && /^https:\/\/\S+$/.test(v) ? v : null);

export function mapPost(r: any): BlogPost {
  return {
    id: String(r.id),
    slug: String(r.slug),
    title: String(r.title || ''),
    excerpt: r.excerpt || '',
    contentHtml: r.content_html || '',
    coverImageUrl: https(r.cover_image_url),
    category: r.category || null,
    tags: Array.isArray(r.tags) ? r.tags : [],
    authorName: r.author_name || 'Edufy Academy',
    authorRole: r.author_role || '',
    authorAvatarUrl: https(r.author_avatar_url),
    publishedAt: r.published_at || null,
    isFeatured: !!r.is_featured,
    readingMinutes: Number(r.reading_minutes) || 1,
  };
}

const LIST = 'id, slug, title, excerpt, cover_image_url, category, tags, author_name, author_role, author_avatar_url, published_at, is_featured, reading_minutes';

export async function fetchPosts(signal?: AbortSignal): Promise<BlogPost[]> {
  let q = supabase.from('blog_posts').select(LIST).eq('status', 'published').lte('published_at', new Date().toISOString()).order('published_at', { ascending: false }).limit(60);
  if (signal) q = q.abortSignal(signal);
  const { data, error } = await q;
  if (error) {
    // Table not created yet → no posts (not an error for students)
    if (/does not exist|could not find the table|PGRST205|42P01/i.test(`${(error as any).code} ${error.message}`)) return [];
    throw new Error(error.message);
  }
  return (data || []).map(mapPost);
}

export async function fetchPost(slug: string, signal?: AbortSignal): Promise<BlogPost | null> {
  const safe = slug.replace(/[^a-z0-9-]/g, '');
  if (!safe) return null;
  let q = supabase.from('blog_posts').select('*').eq('slug', safe);
  if (signal) q = q.abortSignal(signal);
  const { data, error } = await q.maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapPost(data) : null;
}
