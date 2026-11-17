import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Share2, Tag, Check } from 'lucide-react';
import { BlogPostFull, blogPublicService } from '../../services/content';
import { useDocumentMeta } from '../../lib/seo';
import { BlogCard, PostMeta } from './BlogListingPage';
import { cdnImage, cdnSrcSet } from '../../lib/cdnImage';

export const BlogDetailsPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<BlogPostFull | null>(null);
  const [related, setRelated] = useState<BlogPostFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    blogPublicService
      .get(slug)
      .then(async (p) => {
        setPost(p);
        setRelated(p ? await blogPublicService.related(p).catch(() => []) : []);
      })
      .catch((e) => setError(e.message || 'Could not load this article.'))
      .finally(() => setLoading(false));
  }, [slug]);

  useDocumentMeta(
    post
      ? { title: post.seoTitle || post.title, description: post.seoDescription || post.excerpt, image: post.coverImageUrl, type: 'article', canonicalPath: `/blog/${post.slug}` }
      : null
  );

  const share = async () => {
    if (!post) return;
    const url = `${window.location.origin}/blog/${post.slug}`;
    try {
      if (navigator.share) await navigator.share({ title: post.title, text: post.excerpt, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      /* share sheet dismissed */
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-5 py-16 space-y-4" aria-busy="true">
        <div className="h-6 w-40 rounded bg-[#EEF2F7] animate-pulse" />
        <div className="h-12 rounded bg-[#EEF2F7] animate-pulse" />
        <div className="aspect-[16/8] rounded-[24px] bg-[#EEF2F7] animate-pulse" />
      </div>
    );
  }
  if (error) return <div className="max-w-3xl mx-auto px-5 py-16"><div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800">{error}</div></div>;
  if (!post) {
    return (
      <div className="py-24 text-center space-y-4 px-5">
        <h1 className="font-display text-[26px] font-bold text-[#111827]">Article not found</h1>
        <p className="text-[16px] text-[#64748B]">It may have been moved or unpublished.</p>
        <Link to="/blog" className="ed-btn ed-btn-filled ed-btn-sm">Back to the blog</Link>
      </div>
    );
  }

  return (
    <article className="pb-16">
      <div className="max-w-3xl mx-auto px-5 sm:px-8 pt-10">
        <Link to="/blog" className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-[#004AAD] hover:underline">
          <ArrowLeft className="w-4 h-4" /> All articles
        </Link>
        {post.category && (
          <Link to={`/blog?category=${encodeURIComponent(post.category)}`} className="block mt-8 text-[14px] font-bold uppercase tracking-[0.08em] text-[#5E17EB]">{post.category}</Link>
        )}
        <h1 className="mt-3 font-display text-[2.1rem] sm:text-[2.9rem] font-extrabold leading-[1.1] tracking-[-0.02em] text-[#111827]">{post.title}</h1>
        {post.excerpt && <p className="mt-4 text-[19px] leading-relaxed text-[#475569]">{post.excerpt}</p>}
        <div className="mt-6 flex items-center justify-between gap-4 pb-6 border-b border-[#E2E8F0]">
          <PostMeta post={post} />
          <button onClick={share} className="ed-btn ed-btn-outlined ed-btn-sm" aria-label="Share this article">
            {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />} {copied ? 'Link copied' : 'Share'}
          </button>
        </div>
      </div>

      {post.coverImageUrl && (
        <div className="max-w-5xl mx-auto px-5 sm:px-8 mt-8">
          <img src={cdnImage(post.coverImageUrl, 1280)} srcSet={cdnSrcSet(post.coverImageUrl, [640, 960, 1280, 1600])} sizes="(min-width: 1024px) 1000px, 100vw" alt="" className="w-full aspect-[16/8] object-cover rounded-[28px]" />
        </div>
      )}

      {/* Content is sanitised when saved and again when loaded (see utils/html.ts) */}
      <div className="max-w-3xl mx-auto px-5 sm:px-8 mt-10">
        <div className="ed-article" dangerouslySetInnerHTML={{ __html: post.contentHtml }} />
        {post.tags.length > 0 && (
          <div className="mt-10 pt-6 border-t border-[#E2E8F0] flex flex-wrap items-center gap-2">
            <Tag className="w-4 h-4 text-[#64748B]" />
            {post.tags.map((t) => <span key={t} className="ed-chip !h-8 !text-[13px]">#{t}</span>)}
          </div>
        )}
      </div>

      {related.length > 0 && (
        <section className="max-w-[1280px] mx-auto px-5 sm:px-8 mt-16" aria-labelledby="related-heading">
          <h2 id="related-heading" className="font-display text-[26px] font-bold text-[#111827] mb-6">Related articles</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {related.map((p) => <BlogCard key={p.id} post={p} />)}
          </div>
        </section>
      )}
    </article>
  );
};
