import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { courseService } from '../../services/api';
import {
  FileCode2,
  Cpu,
  Palette,
  Cloud,
  Briefcase,
  ShieldCheck,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { cdnImage } from '../../lib/cdnImage';

export const CategoriesPage: React.FC = () => {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    courseService
      .getCategories()
      .then(setCategories)
      .finally(() => setLoading(false));
  }, []);

  const categoryIcons: Record<string, React.ReactNode> = {
    'web-development': <FileCode2 className="w-8 h-8 text-[#004AAD]" />,
    'ai-data-science': <Cpu className="w-8 h-8 text-[#5E17EB]" />,
    'ui-ux-design': <Palette className="w-8 h-8 text-[#5271FF]" />,
    'cloud-devops': <Cloud className="w-8 h-8 text-[#004AAD]" />,
    'business-leadership': <Briefcase className="w-8 h-8 text-[#5E17EB]" />,
    'cybersecurity': <ShieldCheck className="w-8 h-8 text-emerald-600" />,
  };

  return (
    <div className="max-w-[1280px] mx-auto px-5 sm:px-8 py-8 sm:py-12">
      {/* Page header — editorial */}
      <header className="pt-4 pb-10 mb-12 border-b border-[#E2E8F0]">
        <span className="ed-eyebrow">Disciplines</span>
        <h1 className="ed-display mt-5 text-[2.5rem] sm:text-[3.25rem] leading-[1.06] max-w-3xl">Explore learning disciplines.</h1>
        <p className="mt-5 text-[18px] sm:text-[19px] leading-[1.7] text-[#475569] measure">Focused curricula that take you from fundamentals to the techniques used on real projects.</p>
      </header>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white p-6 rounded-2xl border border-[#E2E8F0] h-52 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((cat) => (
            <div
              key={cat.id || cat.slug}
              className="group bg-white p-6 rounded-2xl border border-[#E2E8F0] hover:border-[#004AAD]/40 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                <div className="p-3 w-fit rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] group-hover:bg-[#EBF3FF] group-hover:border-blue-200 group-hover:scale-105 transition-all duration-300 mb-4">
                  {cat.imageUrl ? (
                    <img src={cdnImage(cat.imageUrl, 64, { height: 64, crop: 'fill' })} alt="" className="w-8 h-8 object-cover rounded-lg" loading="lazy" />
                  ) : (
                    categoryIcons[cat.slug] || <FileCode2 className="w-8 h-8 text-[#004AAD]" />
                  )}
                </div>
                <h2 className="font-display text-lg font-bold text-[#111827] group-hover:text-[#004AAD] transition-colors">
                  {cat.name}
                </h2>
                <div className="text-xs text-[#004AAD] font-semibold mt-0.5">
                  {cat.courseCount} {cat.courseCount === 1 ? 'Masterclass' : 'Masterclasses'} Available
                </div>
                <p className="text-xs text-[#64748B] mt-2 line-clamp-2 leading-relaxed">
                  {cat.description}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-[#E2E8F0]">
                <Link
                  to={`/courses?category=${cat.slug}`}
                  className="text-xs font-bold text-[#004AAD] group-hover:text-[#003B8B] flex items-center justify-between"
                >
                  <span>Explore Track</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
