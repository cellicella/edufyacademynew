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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      {/* Banner Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[#004AAD] via-[#5271FF] to-[#5E17EB] rounded-2xl p-6 sm:p-10 mb-10 text-white shadow-xl border border-blue-400/20">
        <div className="absolute inset-0 bg-edufy-dots opacity-20 pointer-events-none" />
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/15 backdrop-blur-md rounded-lg text-xs font-semibold text-blue-100 border border-white/20 mb-3">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Structured Career Paths</span>
          </div>
          <h1 className="font-display text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
            Explore Learning Disciplines
          </h1>
          <p className="text-xs sm:text-sm text-blue-100 mt-2 leading-relaxed">
            Structured educational pathways constructed to prepare engineers, designers, and managers for modern technical challenges.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white p-6 rounded-xl border border-[#E2E8F0] h-52 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((cat) => (
            <div
              key={cat.id || cat.slug}
              className="group bg-white p-6 rounded-xl border border-[#E2E8F0] hover:border-[#004AAD]/40 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                <div className="p-3 w-fit rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] group-hover:bg-[#EBF3FF] group-hover:border-blue-200 group-hover:scale-105 transition-all duration-300 mb-4">
                  {categoryIcons[cat.slug] || <FileCode2 className="w-8 h-8 text-[#004AAD]" />}
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
