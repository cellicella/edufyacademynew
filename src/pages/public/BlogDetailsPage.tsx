import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { blogService } from '../../services/api';
import { BlogPost } from '../../types';
import { ArrowLeft, Clock, Calendar, Share2, Tag } from 'lucide-react';

export const BlogDetailsPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    blogService.getPostBySlug(slug).then((data) => {
      setPost(data);
      setLoading(false);
    });
  }, [slug]);

  if (loading) {
    return <div className="py-20 text-center text-sm text-[#64748B]">Loading article...</div>;
  }

  if (!post) {
    return (
      <div className="py-20 text-center space-y-4">
        <h2 className="text-xl font-bold">Article Not Found</h2>
        <Link to="/blog" className="text-xs text-[#004AAD] underline">
          Return to Blog
        </Link>
      </div>
    );
  }

  return (
    <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <Link
        to="/blog"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#004AAD] hover:underline mb-8"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to all articles</span>
      </Link>

      <div className="space-y-4 mb-8">
        <div className="flex items-center gap-2 text-xs text-[#64748B] font-medium">
          <span className="text-[#004AAD] font-semibold">{post.category}</span>
          <span aria-hidden="true">·</span>
          <span>{post.readTime}</span>
          <span aria-hidden="true">·</span>
          <span>{post.date}</span>
        </div>

        <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#111827] leading-tight">
          {post.title}
        </h1>

        {/* Author Card */}
        <div className="flex items-center gap-3 pt-4 border-t border-[#E2E8F0]">
          <img
            src={post.author.avatar}
            alt={post.author.name}
            referrerPolicy="no-referrer"
            className="w-10 h-10 rounded-full object-cover border border-[#E2E8F0]"
          />
          <div>
            <div className="font-bold text-sm text-[#111827]">{post.author.name}</div>
            <div className="text-xs text-[#64748B]">{post.author.role}</div>
          </div>
        </div>
      </div>

      {/* Article Content */}
      <div className="bg-white p-6 sm:p-10 rounded-xl border border-[#E2E8F0] prose prose-slate max-w-none text-sm text-[#111827] leading-relaxed space-y-6">
        {post.content.split('\n\n').map((paragraph, idx) => {
          if (paragraph.startsWith('### ')) {
            return (
              <h3 key={idx} className="font-display text-xl font-bold text-[#111827] pt-4">
                {paragraph.replace('### ', '')}
              </h3>
            );
          }
          return <p key={idx}>{paragraph}</p>;
        })}

        {/* Tags */}
        <div className="pt-6 border-t border-[#E2E8F0] flex items-center gap-2">
          <Tag className="w-4 h-4 text-[#64748B]" />
          <span className="text-xs text-[#64748B]">Tags:</span>
          <div className="flex items-center gap-2 text-xs text-[#004AAD] font-medium">
            {post.tags.map((tag) => (
              <span key={tag}>#{tag}</span>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
};
