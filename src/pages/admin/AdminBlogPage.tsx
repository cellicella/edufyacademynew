import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, X, Upload, Eye, Search, Star, Send, Save, CalendarClock, EyeOff, ExternalLink } from 'lucide-react';
import { AdminPageHeader, EmptyState, ErrorBanner } from '../../components/admin/AdminUI';
import { RichTextEditor } from '../../components/admin/RichTextEditor';
import { courseService } from '../../services/api';
import { BlogDraft, BlogPostFull, blogAdminService, postState } from '../../services/content';
import { sanitizeHtml, toSlug } from '../../utils/html';
import { fmtDateTime, fromLocalInput, toLocalInput } from '../../services/pushAdmin';
import { useAuth } from '../../context/AuthContext';
import { useCartWishlist } from '../../context/CartWishlistContext';

const STATE_STYLE = {
  draft: 'bg-[#F1F5F9] text-[#475569]',
  scheduled: 'bg-[#E8EFFB] text-[#004AAD]',
  published: 'bg-emerald-50 text-emerald-700',
} as const;

const blank = (author: string): BlogDraft => ({
  slug: '', title: '', excerpt: '', contentHtml: '', coverImageUrl: '', category: '', tags: [], authorName: author, authorRole: '',
  authorAvatarUrl: '', status: 'draft', publishedAt: null, isFeatured: false, seoTitle: '', seoDescription: '',
});

const toDraft = (p: BlogPostFull): BlogDraft => ({
  id: p.id, slug: p.slug, title: p.title, excerpt: p.excerpt, contentHtml: p.contentHtml, coverImageUrl: p.coverImageUrl || '', category: p.category || '',
  tags: p.tags, authorName: p.authorName, authorRole: p.authorRole, authorAvatarUrl: p.authorAvatarUrl || '', status: p.status, publishedAt: p.publishedAt,
  isFeatured: p.isFeatured, seoTitle: p.seoTitle || '', seoDescription: p.seoDescription || '',
});

export const AdminBlogPage: React.FC = () => {
  const { showToast } = useCartWishlist();
  const { currentUser } = useAuth();
  const [posts, setPosts] = useState<BlogPostFull[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'published' | 'scheduled' | 'draft'>('all');
  const [draft, setDraft] = useState<BlogDraft | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [tagsText, setTagsText] = useState('');
  const [scheduleAt, setScheduleAt] = useState('');
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setPosts(await blogAdminService.list());
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const categories = useMemo(() => [...new Set(posts.map((p) => p.category).filter(Boolean) as string[])].sort(), [posts]);
  const shown = posts.filter((p) => (filter === 'all' || postState(p) === filter) && (!query.trim() || `${p.title} ${p.category} ${p.authorName}`.toLowerCase().includes(query.trim().toLowerCase())));

  const openEditor = async (p?: BlogPostFull) => {
    try {
      const full = p ? await blogAdminService.get(p.id) : null;
      const d = full ? toDraft(full) : blank(currentUser?.name || 'Edufy Academy');
      setDraft(d);
      setSlugTouched(!!full);
      setTagsText(d.tags.join(', '));
      setScheduleAt(full && postState(full) === 'scheduled' ? toLocalInput(full.publishedAt) : '');
      setPreview(false);
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const save = async (mode: 'draft' | 'publish' | 'schedule') => {
    if (!draft) return;
    if (mode === 'schedule') {
      const at = fromLocalInput(scheduleAt);
      if (!at || new Date(at).getTime() <= Date.now()) return showToast('Choose a future date and time to schedule.', 'warning');
    }
    setSaving(true);
    try {
      const d: BlogDraft = {
        ...draft,
        tags: tagsText.split(',').map((t) => t.trim()).filter(Boolean),
        status: mode === 'draft' ? 'draft' : 'published',
        publishedAt: mode === 'schedule' ? fromLocalInput(scheduleAt) : mode === 'publish' ? (draft.status === 'published' && draft.publishedAt && new Date(draft.publishedAt).getTime() <= Date.now() ? draft.publishedAt : new Date().toISOString()) : draft.publishedAt,
      };
      const saved = await blogAdminService.save(d);
      showToast(mode === 'draft' ? 'Draft saved' : mode === 'schedule' ? `Scheduled for ${fmtDateTime(saved.publishedAt)}` : 'Post published', 'success');
      setDraft(toDraft(saved));
      setSlugTouched(true);
      await load();
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (p: BlogPostFull, status: 'draft' | 'published') => {
    try {
      await blogAdminService.setStatus(p, status);
      showToast(status === 'published' ? 'Post published' : 'Post unpublished (now a draft)', 'success');
      await load();
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const remove = async (p: BlogPostFull) => {
    if (!window.confirm(`Delete “${p.title}”? This can’t be undone.`)) return;
    try {
      await blogAdminService.remove(p.id);
      showToast('Post deleted', 'info');
      await load();
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const upload = async (file: File | undefined, field: 'coverImageUrl' | 'authorAvatarUrl') => {
    if (!file || !draft) return;
    if (!file.type.startsWith('image/')) return showToast('Choose an image file', 'warning');
    setUploading(field);
    try {
      const r = await courseService.uploadMedia(file, 'course-thumbnails');
      setDraft({ ...draft, [field]: r.url });
    } catch (e: any) {
      showToast(e.message || 'Upload failed — paste an image link instead.', 'error');
    } finally {
      setUploading(null);
    }
  };

  const field = (label: string, el: React.ReactNode, hint?: string) => (
    <label className="block">
      <span className="text-[15px] font-semibold text-[#111827]">{label}</span>
      <div className="mt-1.5">{el}</div>
      {hint && <span className="text-[12.5px] text-[#64748B]">{hint}</span>}
    </label>
  );

  /* ------------------------------------------------------------------ editor */
  if (draft) {
    const state = draft.id ? postState({ status: draft.status, publishedAt: draft.publishedAt }) : 'draft';
    return (
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <button onClick={() => setDraft(null)} className="ed-btn ed-btn-text ed-btn-sm"><X className="w-4 h-4" /> Close editor</button>
          <div className="flex flex-wrap items-center gap-2">
            {draft.id && <span className={`px-2.5 h-7 inline-flex items-center rounded-full text-[13px] font-semibold capitalize ${STATE_STYLE[state]}`}>{state}</span>}
            {state === 'published' && <a href={`/blog/${draft.slug}`} target="_blank" rel="noreferrer" className="ed-btn ed-btn-text ed-btn-sm"><ExternalLink className="w-4 h-4" /> View live</a>}
            <button onClick={() => setPreview(!preview)} className="ed-btn ed-btn-outlined ed-btn-sm"><Eye className="w-4 h-4" /> {preview ? 'Back to editing' : 'Preview'}</button>
            <button disabled={saving} onClick={() => save('draft')} className="ed-btn ed-btn-outlined ed-btn-sm"><Save className="w-4 h-4" /> {state === 'draft' ? 'Save draft' : 'Save as draft (unpublish)'}</button>
            <button disabled={saving} onClick={() => save('publish')} className="ed-btn ed-btn-filled ed-btn-sm"><Send className="w-4 h-4" /> {state === 'published' ? 'Update' : 'Publish now'}</button>
          </div>
        </div>

        {preview ? (
          <article className="max-w-3xl mx-auto bg-white rounded-[28px] border border-[#E2E8F0] overflow-hidden">
            {draft.coverImageUrl && <img src={draft.coverImageUrl} alt="" className="w-full aspect-[16/8] object-cover" />}
            <div className="p-6 sm:p-10">
              <div className="text-[14px] font-semibold text-[#5E17EB]">{draft.category || 'Uncategorised'}</div>
              <h1 className="mt-2 font-display text-[2rem] sm:text-[2.5rem] font-extrabold leading-tight text-[#111827]">{draft.title || 'Untitled post'}</h1>
              {draft.excerpt && <p className="mt-3 text-[18px] text-[#475569]">{draft.excerpt}</p>}
              <div className="mt-4 text-[14px] text-[#64748B]">By {draft.authorName || 'Edufy Academy'}</div>
              <div className="ed-article mt-8" dangerouslySetInnerHTML={{ __html: sanitizeHtml(draft.contentHtml) }} />
            </div>
          </article>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
            <section className="space-y-4">
              <input
                className="w-full bg-transparent font-display text-[2rem] font-extrabold text-[#111827] placeholder-[#CBD5E1] focus:outline-none"
                placeholder="Post title"
                maxLength={160}
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value, slug: slugTouched ? draft.slug : toSlug(e.target.value) })}
                aria-label="Post title"
              />
              <textarea
                rows={2}
                maxLength={400}
                className="ed-field !h-auto py-3"
                placeholder="Short description (shown on the blog list and in search results)"
                value={draft.excerpt}
                onChange={(e) => setDraft({ ...draft, excerpt: e.target.value })}
                aria-label="Short description"
              />
              <RichTextEditor value={draft.contentHtml} onChange={(html) => setDraft((d) => (d ? { ...d, contentHtml: html } : d))} />
            </section>

            <aside className="space-y-5">
              <div className="bg-white rounded-[20px] border border-[#E2E8F0] p-5 space-y-4">
                <h2 className="font-display text-[17px] font-bold text-[#111827]">Publishing</h2>
                {field('Schedule for later', <input type="datetime-local" className="ed-field" value={scheduleAt} min={toLocalInput(new Date().toISOString())} onChange={(e) => setScheduleAt(e.target.value)} />, 'The post goes live automatically at this time.')}
                <button disabled={saving || !scheduleAt} onClick={() => save('schedule')} className="ed-btn ed-btn-tonal ed-btn-sm w-full justify-center"><CalendarClock className="w-4 h-4" /> Schedule</button>
                <label className="flex items-center gap-3 text-[15px] font-medium text-[#111827] cursor-pointer">
                  <input type="checkbox" className="w-5 h-5" checked={draft.isFeatured} onChange={(e) => setDraft({ ...draft, isFeatured: e.target.checked })} /> Featured post
                </label>
              </div>

              <div className="bg-white rounded-[20px] border border-[#E2E8F0] p-5 space-y-4">
                <h2 className="font-display text-[17px] font-bold text-[#111827]">Details</h2>
                {field('URL', <input className="ed-field font-mono" value={draft.slug} onChange={(e) => { setSlugTouched(true); setDraft({ ...draft, slug: toSlug(e.target.value) }); }} />, `/blog/${draft.slug || 'post-url'}`)}
                <div>
                  <span className="text-[15px] font-semibold text-[#111827]">Featured image</span>
                  {draft.coverImageUrl && <img src={draft.coverImageUrl} alt="" className="mt-1.5 w-full aspect-video object-cover rounded-xl bg-[#E8EFFB]" />}
                  <div className="mt-1.5 flex gap-2">
                    <input className="ed-field" value={draft.coverImageUrl} onChange={(e) => setDraft({ ...draft, coverImageUrl: e.target.value })} placeholder="https://…" />
                    <label className="ed-btn ed-btn-tonal ed-btn-sm cursor-pointer shrink-0"><Upload className="w-4 h-4" />{uploading === 'coverImageUrl' ? '…' : ''}
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0], 'coverImageUrl')} /></label>
                  </div>
                </div>
                {field('Category', <><input className="ed-field" list="blog-categories" maxLength={60} value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} placeholder="e.g. Career tips" /><datalist id="blog-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist></>)}
                {field('Tags', <input className="ed-field" value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="excel, productivity" />, 'Separate with commas.')}
              </div>

              <div className="bg-white rounded-[20px] border border-[#E2E8F0] p-5 space-y-4">
                <h2 className="font-display text-[17px] font-bold text-[#111827]">Author</h2>
                {field('Name', <input className="ed-field" maxLength={80} value={draft.authorName} onChange={(e) => setDraft({ ...draft, authorName: e.target.value })} />)}
                {field('Role', <input className="ed-field" maxLength={80} value={draft.authorRole} onChange={(e) => setDraft({ ...draft, authorRole: e.target.value })} placeholder="e.g. Lead Instructor" />)}
                <div className="flex gap-2 items-end">
                  <div className="flex-1">{field('Photo', <input className="ed-field" value={draft.authorAvatarUrl} onChange={(e) => setDraft({ ...draft, authorAvatarUrl: e.target.value })} placeholder="https://…" />)}</div>
                  <label className="ed-btn ed-btn-tonal ed-btn-sm cursor-pointer shrink-0 mb-0.5"><Upload className="w-4 h-4" />{uploading === 'authorAvatarUrl' ? '…' : ''}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0], 'authorAvatarUrl')} /></label>
                </div>
              </div>

              <div className="bg-white rounded-[20px] border border-[#E2E8F0] p-5 space-y-4">
                <h2 className="font-display text-[17px] font-bold text-[#111827]">Search engines (SEO)</h2>
                {field(`SEO title (${(draft.seoTitle || draft.title).length}/70)`, <input className="ed-field" maxLength={70} value={draft.seoTitle} onChange={(e) => setDraft({ ...draft, seoTitle: e.target.value })} placeholder={draft.title} />)}
                {field(`Meta description (${(draft.seoDescription || draft.excerpt).length}/170)`, <textarea rows={3} maxLength={170} className="ed-field !h-auto py-3" value={draft.seoDescription} onChange={(e) => setDraft({ ...draft, seoDescription: e.target.value })} placeholder={draft.excerpt} />)}
                <div className="rounded-xl border border-[#E2E8F0] p-3">
                  <div className="text-[12px] text-[#64748B] truncate">…/blog/{draft.slug || 'post-url'}</div>
                  <div className="text-[16px] text-[#1a0dab] leading-snug line-clamp-1">{draft.seoTitle || draft.title || 'Post title'} | Edufy Academy</div>
                  <div className="text-[13px] text-[#4d5156] line-clamp-2">{draft.seoDescription || draft.excerpt || 'Short description of the post.'}</div>
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>
    );
  }

  /* ------------------------------------------------------------------ list */
  return (
    <div>
      <AdminPageHeader
        eyebrow="Content"
        title="Blog"
        description="Write articles for the website blog and the student app. Only published posts are visible to visitors and students."
        actions={<button onClick={() => openEditor()} className="ed-btn ed-btn-filled ed-btn-sm"><Plus className="w-4 h-4" /> New post</button>}
      />
      {error && <ErrorBanner message={error} />}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <label className="relative flex-1">
          <Search className="w-4 h-4 text-[#94A3B8] absolute left-4 top-1/2 -translate-y-1/2" />
          <input className="ed-field !pl-10" placeholder="Search posts" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search posts" />
        </label>
        <div className="flex flex-wrap gap-2">
          {(['all', 'published', 'scheduled', 'draft'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`ed-btn ed-btn-sm capitalize ${filter === f ? 'ed-btn-ink' : 'ed-btn-outlined'}`}>
              {f}{f !== 'all' ? ` (${posts.filter((p) => postState(p) === f).length})` : ''}
            </button>
          ))}
        </div>
      </div>
      <section className="bg-white rounded-[20px] border border-[#E2E8F0] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[15px]">
            <thead className="bg-[#F7F9FC] text-[13px] uppercase tracking-wide text-[#64748B]">
              <tr><th className="px-5 py-3">Post</th><th className="px-5 py-3">Category</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Date</th><th className="px-5 py-3" /></tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2F7]">
              {shown.map((p) => {
                const st = postState(p);
                return (
                  <tr key={p.id}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-20 aspect-video rounded-lg overflow-hidden bg-[#E8EFFB] shrink-0">{p.coverImageUrl && <img src={p.coverImageUrl} alt="" className="w-full h-full object-cover" />}</div>
                        <div className="min-w-0">
                          <div className="font-semibold text-[#111827] truncate max-w-[340px] flex items-center gap-1.5">{p.isFeatured && <Star className="w-4 h-4 text-amber-500 shrink-0" aria-label="Featured" />}{p.title}</div>
                          <div className="text-[13px] text-[#64748B]">{p.authorName} · {p.readingMinutes} min read</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-[14px] text-[#334155]">{p.category || '—'}</td>
                    <td className="px-5 py-3"><span className={`px-2.5 h-7 inline-flex items-center rounded-full text-[13px] font-semibold capitalize ${STATE_STYLE[st]}`}>{st}</span></td>
                    <td className="px-5 py-3 text-[13px] text-[#334155] whitespace-nowrap">{st === 'draft' ? `Edited ${fmtDateTime(p.updatedAt)}` : fmtDateTime(p.publishedAt)}</td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      {st === 'published' && <a href={`/blog/${p.slug}`} target="_blank" rel="noreferrer" className="ed-btn ed-btn-text ed-btn-sm" title="View"><Eye className="w-4 h-4" /></a>}
                      <button onClick={() => openEditor(p)} className="ed-btn ed-btn-text ed-btn-sm" aria-label={`Edit ${p.title}`}><Pencil className="w-4 h-4" /></button>
                      {st === 'draft' ? (
                        <button onClick={() => setStatus(p, 'published')} className="ed-btn ed-btn-text ed-btn-sm !text-[#004AAD]" title="Publish now"><Send className="w-4 h-4" /></button>
                      ) : (
                        <button onClick={() => setStatus(p, 'draft')} className="ed-btn ed-btn-text ed-btn-sm" title="Unpublish"><EyeOff className="w-4 h-4" /></button>
                      )}
                      <button onClick={() => remove(p)} className="ed-btn ed-btn-text ed-btn-sm !text-rose-600" aria-label={`Delete ${p.title}`}><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!loading && shown.length === 0 && <EmptyState title={posts.length ? 'No posts match' : 'No blog posts yet'} body={posts.length ? 'Try another search or filter.' : 'Write your first article — it appears on the website and in the student app once published.'} />}
          {loading && <div className="py-12 text-center text-[15px] text-[#64748B]">Loading posts…</div>}
        </div>
      </section>
    </div>
  );
};
