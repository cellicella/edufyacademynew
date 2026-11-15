import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { sanitizeHtml, readingMinutes, toSlug } from '../utils/html';

/* =============================================================================
 * Course categories (table: categories). Public reads see active categories;
 * writes are restricted to admins by row-level security.
 * ========================================================================== */

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  imageUrl: string | null;
  icon: string | null;
  isActive: boolean;
  position: number;
  courseCount: number;
}

const missingTable = (e: any) => /relation .* does not exist|could not find the table|PGRST205|42P01/i.test(`${e?.code} ${e?.message}`);

async function courseCounts(publishedOnly: boolean): Promise<Record<string, number>> {
  let q = supabase.from('courses').select('category_slug, is_published');
  if (publishedOnly) q = q.eq('is_published', true);
  const { data } = await q;
  const counts: Record<string, number> = {};
  (data || []).forEach((c: any) => {
    if (c.category_slug) counts[c.category_slug] = (counts[c.category_slug] || 0) + 1;
  });
  return counts;
}

const mapCategory = (r: any, counts: Record<string, number>): Category => ({
  id: r.id,
  name: r.name,
  slug: r.slug,
  description: r.description || '',
  imageUrl: r.image_url || null,
  icon: r.icon || null,
  isActive: !!r.is_active,
  position: Number(r.position) || 0,
  courseCount: counts[r.slug] || 0,
});

export const categoryService = {
  /** Active categories for the public site, with published-course counts. */
  async listPublic(): Promise<Category[]> {
    if (!isSupabaseConfigured) return [];
    const [{ data, error }, counts] = await Promise.all([
      supabase.from('categories').select('*').eq('is_active', true).order('position').order('name'),
      courseCounts(true),
    ]);
    if (error) {
      if (!missingTable(error)) throw new Error(error.message);
      // Before the categories migration is applied: derive the list from the courses themselves
      const { data: rows } = await supabase.from('courses').select('category, category_slug').eq('is_published', true);
      const seen = new Map<string, Category>();
      (rows || []).forEach((c: any) => {
        if (c.category_slug && !seen.has(c.category_slug)) {
          seen.set(c.category_slug, { id: c.category_slug, name: c.category, slug: c.category_slug, description: '', imageUrl: null, icon: null, isActive: true, position: 0, courseCount: counts[c.category_slug] || 0 });
        }
      });
      return [...seen.values()].sort((a, b) => b.courseCount - a.courseCount);
    }
    return (data || []).map((r) => mapCategory(r, counts));
  },

  /** Every category (admins), with counts across ALL courses (drafts included). */
  async listAdmin(): Promise<Category[]> {
    const [{ data, error }, counts] = await Promise.all([
      supabase.from('categories').select('*').order('position').order('name'),
      courseCounts(false),
    ]);
    if (error) {
      if (missingTable(error)) throw new Error('The categories table is missing — run the latest database migration (supabase/RUN_IN_SQL_EDITOR.sql).');
      throw new Error(error.message);
    }
    return (data || []).map((r) => mapCategory(r, counts));
  },

  async save(c: { id?: string; name: string; slug?: string; description?: string; imageUrl?: string | null; icon?: string | null; isActive: boolean; position?: number }) {
    const name = c.name.trim();
    if (!name) throw new Error('Give the category a name.');
    const slug = toSlug(c.slug || name);
    if (!slug) throw new Error('The URL name (slug) must contain letters or numbers.');
    if (c.imageUrl && !/^https:\/\/\S+$/.test(c.imageUrl)) throw new Error('The image must be an https:// link.');
    const row = {
      name,
      slug,
      description: c.description?.trim() || null,
      image_url: c.imageUrl?.trim() || null,
      icon: c.icon?.trim() || null,
      is_active: c.isActive,
      ...(c.position !== undefined ? { position: c.position } : {}),
      updated_at: new Date().toISOString(),
    };
    const { error } = c.id ? await supabase.from('categories').update(row).eq('id', c.id) : await supabase.from('categories').insert(row);
    if (error) {
      if ((error as any).code === '23505') throw new Error('A category with this name or URL already exists.');
      if (/row-level security/i.test(error.message)) throw new Error('Only administrators can manage categories.');
      throw new Error(error.message);
    }
  },

  async remove(c: Category) {
    if (c.courseCount > 0) throw new Error(`“${c.name}” still has ${c.courseCount} course(s). Move them to another category first.`);
    const { error } = await supabase.from('categories').delete().eq('id', c.id);
    if (error) {
      if ((error as any).code === '23503') throw new Error(`“${c.name}” still has courses. Move them to another category first.`);
      throw new Error(error.message);
    }
  },

  async reorder(ids: string[]) {
    for (let i = 0; i < ids.length; i++) {
      const { error } = await supabase.from('categories').update({ position: i + 1 }).eq('id', ids[i]);
      if (error) throw new Error(error.message);
    }
  },

  /** Move courses into a category (the database keeps courses.category in sync with the name). */
  async assignCourses(category: Category, courseIds: string[]) {
    if (!courseIds.length) return;
    const { error } = await supabase
      .from('courses')
      .update({ category_slug: category.slug, category: category.name, updated_at: new Date().toISOString() })
      .in('id', courseIds);
    if (error) throw new Error(error.message);
  },
};

/* =============================================================================
 * Blog (table: blog_posts). Visitors/students only receive published posts whose publish
 * time has passed (RLS) — drafts and scheduled posts are visible to admins only.
 * ========================================================================== */

export interface BlogPostFull {
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
  status: 'draft' | 'published';
  publishedAt: string | null;
  isFeatured: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  readingMinutes: number;
  createdAt: string;
  updatedAt: string;
}

const mapPost = (r: any): BlogPostFull => ({
  id: r.id,
  slug: r.slug,
  title: r.title,
  excerpt: r.excerpt || '',
  contentHtml: r.content_html || '',
  coverImageUrl: r.cover_image_url || null,
  category: r.category || null,
  tags: Array.isArray(r.tags) ? r.tags : [],
  authorName: r.author_name || 'Edufy Academy',
  authorRole: r.author_role || '',
  authorAvatarUrl: r.author_avatar_url || null,
  status: r.status === 'published' ? 'published' : 'draft',
  publishedAt: r.published_at || null,
  isFeatured: !!r.is_featured,
  seoTitle: r.seo_title || null,
  seoDescription: r.seo_description || null,
  readingMinutes: Number(r.reading_minutes) || 1,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const LIST_COLUMNS = 'id, slug, title, excerpt, cover_image_url, category, tags, author_name, author_role, author_avatar_url, status, published_at, is_featured, seo_title, seo_description, reading_minutes, created_at, updated_at';

export type BlogPostState = 'draft' | 'scheduled' | 'published';
export const postState = (p: Pick<BlogPostFull, 'status' | 'publishedAt'>): BlogPostState =>
  p.status !== 'published' ? 'draft' : p.publishedAt && new Date(p.publishedAt).getTime() > Date.now() ? 'scheduled' : 'published';

export const blogPublicService = {
  async list(opts: { search?: string; category?: string; limit?: number } = {}): Promise<BlogPostFull[]> {
    if (!isSupabaseConfigured) return [];
    let q = supabase.from('blog_posts').select(LIST_COLUMNS).eq('status', 'published').lte('published_at', new Date().toISOString()).order('published_at', { ascending: false }).limit(opts.limit || 60);
    if (opts.category) q = q.eq('category', opts.category);
    const term = (opts.search || '').trim().replace(/[%,()]/g, ' ');
    if (term) q = q.or(`title.ilike.%${term}%,excerpt.ilike.%${term}%`);
    const { data, error } = await q;
    if (error) {
      if (missingTable(error)) return [];
      throw new Error(error.message);
    }
    return (data || []).map(mapPost);
  },

  async get(slug: string): Promise<BlogPostFull | null> {
    if (!isSupabaseConfigured) return null;
    const { data, error } = await supabase.from('blog_posts').select('*').eq('slug', slug).maybeSingle();
    if (error) {
      if (missingTable(error)) return null;
      throw new Error(error.message);
    }
    return data ? { ...mapPost(data), contentHtml: sanitizeHtml(data.content_html || '') } : null;
  },

  async related(post: BlogPostFull, limit = 3): Promise<BlogPostFull[]> {
    const all = await this.list({ limit: 30 });
    const others = all.filter((p) => p.id !== post.id);
    const score = (p: BlogPostFull) => (p.category && p.category === post.category ? 10 : 0) + p.tags.filter((t) => post.tags.includes(t)).length;
    return others.sort((a, b) => score(b) - score(a)).slice(0, limit);
  },
};

export interface BlogDraft {
  id?: string;
  slug: string;
  title: string;
  excerpt: string;
  contentHtml: string;
  coverImageUrl: string;
  category: string;
  tags: string[];
  authorName: string;
  authorRole: string;
  authorAvatarUrl: string;
  status: 'draft' | 'published';
  publishedAt: string | null;
  isFeatured: boolean;
  seoTitle: string;
  seoDescription: string;
}

export const blogAdminService = {
  async list(): Promise<BlogPostFull[]> {
    const { data, error } = await supabase.from('blog_posts').select(LIST_COLUMNS).order('updated_at', { ascending: false });
    if (error) {
      if (missingTable(error)) throw new Error('The blog table is missing — run the latest database migration (supabase/RUN_IN_SQL_EDITOR.sql).');
      throw new Error(error.message);
    }
    return (data || []).map(mapPost);
  },

  async get(id: string): Promise<BlogPostFull> {
    const { data, error } = await supabase.from('blog_posts').select('*').eq('id', id).single();
    if (error) throw new Error(error.message);
    return mapPost(data);
  },

  async save(d: BlogDraft): Promise<BlogPostFull> {
    const title = d.title.trim();
    if (!title) throw new Error('Give the post a title.');
    const slug = toSlug(d.slug || title);
    if (!slug) throw new Error('The URL (slug) must contain letters or numbers.');
    for (const [label, url] of [['Featured image', d.coverImageUrl], ['Author photo', d.authorAvatarUrl]] as const) {
      if (url && !/^https:\/\/\S+$/.test(url.trim())) throw new Error(`${label} must be an https:// link.`);
    }
    const html = sanitizeHtml(d.contentHtml);
    if (d.status === 'published' && !html.replace(/<[^>]+>/g, '').trim()) throw new Error('Add some content before publishing.');
    const { data: auth } = await supabase.auth.getUser();
    const row = {
      slug,
      title,
      excerpt: d.excerpt.trim() || null,
      content_html: html,
      cover_image_url: d.coverImageUrl.trim() || null,
      category: d.category.trim() || null,
      tags: [...new Set(d.tags.map((t) => t.trim()).filter(Boolean))].slice(0, 12),
      author_name: d.authorName.trim() || null,
      author_role: d.authorRole.trim() || null,
      author_avatar_url: d.authorAvatarUrl.trim() || null,
      status: d.status,
      published_at: d.status === 'published' ? d.publishedAt || new Date().toISOString() : d.publishedAt,
      is_featured: d.isFeatured,
      seo_title: d.seoTitle.trim().slice(0, 70) || null,
      seo_description: d.seoDescription.trim().slice(0, 170) || null,
      reading_minutes: readingMinutes(html),
      updated_at: new Date().toISOString(),
    };
    const q = d.id
      ? supabase.from('blog_posts').update(row).eq('id', d.id)
      : supabase.from('blog_posts').insert({ ...row, author_id: auth.user?.id || null });
    const { data, error } = await q.select('*').single();
    if (error) {
      if ((error as any).code === '23505') throw new Error('Another post already uses this URL. Change the slug.');
      if (/row-level security/i.test(error.message)) throw new Error('Only administrators can manage the blog.');
      throw new Error(error.message);
    }
    return mapPost(data);
  },

  async setStatus(p: BlogPostFull, status: 'draft' | 'published') {
    const { error } = await supabase
      .from('blog_posts')
      .update({ status, published_at: status === 'published' ? p.publishedAt || new Date().toISOString() : p.publishedAt, updated_at: new Date().toISOString() })
      .eq('id', p.id);
    if (error) throw new Error(error.message);
  },

  async remove(id: string) {
    const { error } = await supabase.from('blog_posts').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },
};
