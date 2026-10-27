import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { blogService } from '../../services/api';
import { BlogPost } from '../../types';
import { Clock, ArrowRight } from 'lucide-react';

export const BlogListingPage: React.FC = () => {
  const [posts, setPosts] = useState<BlogPost[]>([]);

  useEffect(() => {
    blogService.getAllPosts().then(setPosts);
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="max-w-2xl mb-12">
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-[#111827]">
          Edufy Engineering & Design Blog
        </h1>
        <p className="text-sm text-[#64748B] mt-2 leading-relaxed">
          Deep-dives into scalable software architectures, design systems, machine learning pipelines, and career progression.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {posts.map((post) => (
          <article
            key={post.id}
            className="group bg-white rounded-xl border border-[#E2E8F0] p-6 hover:border-[#004AAD]/40 hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center gap-2 text-xs text-[#64748B] mb-2 font-medium">
                <span className="text-[#004AAD] font-semibold">{post.category}</span>
                <span aria-hidden="true">·</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{post.readTime}</span>
                </span>
              </div>

              <Link to={`/blog/${post.slug}`}>
                <h2 className="font-display text-lg font-bold text-[#111827] group-hover:text-[#004AAD] transition-colors leading-snug">
                  {post.title}
                </h2>
              </Link>

              <p className="text-xs text-[#64748B] mt-2 line-clamp-3 leading-relaxed">
                {post.excerpt}
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-[#E2E8F0] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <img
                  src={post.author.avatar}
                  alt={post.author.name}
                  referrerPolicy="no-referrer"
                  className="w-7 h-7 rounded-full object-cover"
                />
                <div className="text-xs">
                  <div className="font-bold text-[#111827]">{post.author.name}</div>
                  <div className="text-[10px] text-[#64748B]">{post.date}</div>
                </div>
              </div>

              <Link
                to={`/blog/${post.slug}`}
                className="text-xs font-semibold text-[#004AAD] hover:underline flex items-center gap-1"
              >
                <span>Read</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};
