import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Clock, ArrowRight, Search, X, Newspaper } from 'lucide-react';
import { BlogPostFull, blogPublicService } from '../../services/content';
import { cdnImage, cdnSrcSet, cdnAvatar } from '../../lib/cdnImage';

const dateLabel = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

export const PostMeta: React.FC<{ post: BlogPostFull; light?: boolean }> = ({ post, light }) => (
  <div className={`flex items-center gap-2.5 ${light ? 'text-white/85' : 'text-[#64748B]'}`}>
    {post.authorAvatarUrl ? (
      <img src={cdnAvatar(post.authorAvatarUrl, 32)} alt="" className="w-8 h-8 rounded-full object-cover" referrerPolicy="no-referrer" />
    ) : (
      <span className="w-8 h-8 rounded-full bg-[#E8EFFB] text-[#004AAD] text-[13px] font-bold flex items-center justify-center">{post.authorName.slice(0, 1)}</span>
    )}
    <div className="text-[14px] leading-tight">
      <div className={`font-semibold ${light ? 'text-white' : 'text-[#111827]'}`}>{post.authorName}</div>
      <div>{dateLabel(post.publishedAt)} · {post.readingMinutes} min read</div>
    </div>
  </div>
);

export const BlogCard: React.FC<{ post: BlogPostFull }> = ({ post }) => (
  <article className="group bg-white rounded-[24px] border border-[#E2E8F0] overflow-hidden flex flex-col hover:shadow-[0_18px_40px_-20px_rgba(17,24,39,0.25)] transition-shadow">
    <Link to={`/blog/${post.slug}`} className="block aspect-[16/9] bg-gradient-to-br from-[#004AAD] to-[#5E17EB] overflow-hidden" tabIndex={-1} aria-hidden="true">
      {post.coverImageUrl ? (
        <img src={cdnImage(post.coverImageUrl, 640)} srcSet={cdnSrcSet(post.coverImageUrl, [320, 480, 640, 960])} sizes="(min-width: 1024px) 33vw, 100vw" alt={post.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" />
      ) : (
        <div className="w-full h-full flex items-center justify-center"><Newspaper className="w-10 h-10 text-white/70" /></div>
      )}
    </Link>
    <div className="p-6 flex flex-col flex-1">
      {post.category && <span className="text-[13px] font-bold uppercase tracking-[0.08em] text-[#5E17EB]">{post.category}</span>}
      <Link to={`/blog/${post.slug}`} className="mt-2">
        <h2 className="font-display text-[20px] font-bold leading-snug text-[#111827] group-hover:text-[#004AAD] transition-colors line-clamp-2">{post.title}</h2>
      </Link>
      {post.excerpt && <p className="mt-2 text-[15.5px] leading-relaxed text-[#475569] line-clamp-3">{post.excerpt}</p>}
      <div className="flex-1" />
      <div className="mt-5 pt-4 border-t border-[#EEF2F7] flex items-center justify-between gap-3">
        <PostMeta post={post} />
        <Link to={`/blog/${post.slug}`} className="text-[14px] font-semibold text-[#004AAD] inline-flex items-center gap-1 shrink-0" aria-label={`Read ${post.title}`}>
          Read <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  </article>
);

export const BlogListingPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const [posts, setPosts] = useState<BlogPostFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [term, setTerm] = useState(params.get('q') || '');
  const category = params.get('category') || '';
  const q = params.get('q') || '';


  useEffect(() => {
    setLoading(true);
    blogPublicService
      .list({ search: q })
      .then((p) => {
        setPosts(p);
        setError(null);
      })
      .catch((e) => setError(e.message || 'Could not load the blog.'))
      .finally(() => setLoading(false));
  }, [q]);

  const categories = useMemo(() => [...new Set(posts.map((p) => p.category).filter(Boolean) as string[])].sort(), [posts]);
  const filtered = category ? posts.filter((p) => p.category === category) : posts;
  const featured = !q && !category ? filtered.find((p) => p.isFeatured) || null : null;
  const rest = featured ? filtered.filter((p) => p.id !== featured.id) : filtered;

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    value ? next.set(key, value) : next.delete(key);
    setParams(next);
  };

  return (
    <div className="max-w-[1280px] mx-auto px-5 sm:px-8 py-12 lg:py-16">
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
        <div className="max-w-2xl">
          <span className="ed-eyebrow">Edufy Academy Blog</span>
          <h1 className="ed-display mt-3 text-[2.25rem] sm:text-[3rem] leading-[1.05]">Learn something new today</h1>
          <p className="mt-3 text-[18px] text-[#64748B]">Career guides, study tips, tool tutorials and news from the Edufy team.</p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            update('q', term.trim());
          }}
          className="relative w-full lg:w-[360px]"
          role="search"
        >
          <Search className="w-4 h-4 text-[#94A3B8] absolute left-4 top-1/2 -translate-y-1/2" />
          <input value={term} onChange={(e) => setTerm(e.target.value)} className="ed-field !pl-10 !pr-10" placeholder="Search articles" aria-label="Search articles" />
          {term && (
            <button type="button" onClick={() => { setTerm(''); update('q', ''); }} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#94A3B8]" aria-label="Clear search">
              <X className="w-4 h-4" />
            </button>
          )}
        </form>
      </header>

      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-10" role="tablist" aria-label="Filter by category">
          <button onClick={() => update('category', '')} className={`ed-chip ${!category ? '!bg-[#111827] !text-white' : ''}`} role="tab" aria-selected={!category}>All</button>
          {categories.map((c) => (
            <button key={c} onClick={() => update('category', c)} className={`ed-chip ${category === c ? '!bg-[#111827] !text-white' : ''}`} role="tab" aria-selected={category === c}>{c}</button>
          ))}
        </div>
      )}

      {error ? (
        <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800">{error}</div>
      ) : loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8" aria-busy="true">
          {[0, 1, 2].map((i) => <div key={i} className="h-[380px] rounded-[24px] bg-[#EEF2F7] animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center">
          <Newspaper className="w-10 h-10 text-[#94A3B8] mx-auto" />
          <h2 className="mt-4 font-display text-[22px] font-bold text-[#111827]">{q || category ? 'No articles match' : 'Articles are coming soon'}</h2>
          <p className="mt-1 text-[16px] text-[#64748B]">{q || category ? 'Try a different search or category.' : 'Check back shortly for guides and news from Edufy Academy.'}</p>
        </div>
      ) : (
        <>
          {featured && (
            <Link to={`/blog/${featured.slug}`} className="group relative block rounded-[28px] overflow-hidden mb-12 bg-gradient-to-br from-[#004AAD] to-[#5E17EB] min-h-[360px]">
              {featured.coverImageUrl && <img src={cdnImage(featured.coverImageUrl, 1280)} srcSet={cdnSrcSet(featured.coverImageUrl, [640, 960, 1280, 1600])} sizes="100vw" alt={featured.title} className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-700" />}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0B1220]/90 via-[#0B1220]/40 to-transparent" />
              <div className="relative p-7 sm:p-10 flex flex-col justify-end min-h-[360px] max-w-3xl">
                <span className="self-start px-3 h-7 inline-flex items-center rounded-full bg-white/15 text-white text-[13px] font-semibold">Featured{featured.category ? ` · ${featured.category}` : ''}</span>
                <h2 className="mt-4 font-display text-[1.9rem] sm:text-[2.6rem] font-extrabold leading-tight text-white">{featured.title}</h2>
                {featured.excerpt && <p className="mt-3 text-[17px] text-white/85 line-clamp-2">{featured.excerpt}</p>}
                <div className="mt-5"><PostMeta post={featured} light /></div>
              </div>
            </Link>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {rest.map((p) => <BlogCard key={p.id} post={p} />)}
          </div>
        </>
      )}
    </div>
  );
};
