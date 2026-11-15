import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Layers } from 'lucide-react';
import { bundleService } from '../../services/api';
import { Bundle } from '../../types';
import { formatPrice } from '../../components/common/CourseCard';

export const BundlesPage: React.FC = () => {
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    bundleService.getPublishedBundles().then(setBundles).finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-[1280px] mx-auto px-5 sm:px-8 py-8 sm:py-12">
      <header className="pt-4 pb-10 mb-12 border-b border-[#E2E8F0]">
        <span className="ed-eyebrow">Course bundles</span>
        <h1 className="ed-display mt-5 text-[2.5rem] sm:text-[3.25rem] leading-[1.06] max-w-3xl">Learn more, pay less.</h1>
        <p className="mt-5 text-[18px] sm:text-[19px] leading-[1.7] text-[#475569] measure">
          Curated sets of courses that build on each other — one purchase, lifetime access to every course in the bundle.
        </p>
      </header>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {[1, 2].map((i) => (
            <div key={i} className="h-80 rounded-[28px] bg-white border border-[#E2E8F0] animate-pulse" />
          ))}
        </div>
      ) : bundles.length === 0 ? (
        <div className="ed-surface p-12 text-center">
          <Layers className="w-10 h-10 text-[#94A3B8] mx-auto" />
          <h2 className="mt-4 font-display text-2xl font-bold text-[#111827]">No bundles yet</h2>
          <p className="mt-2 text-[#64748B]">New course bundles will appear here soon.</p>
          <Link to="/courses" className="ed-btn ed-btn-tonal mt-6">Browse individual courses</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {bundles.map((b) => {
            const saving = Math.max(0, b.coursesValue - b.price);
            return (
              <Link
                key={b.id}
                to={`/bundles/${b.slug}`}
                className="group bg-white rounded-[28px] border border-[#E2E8F0] p-2 hover:border-transparent hover:shadow-lg transition-all"
              >
                <div className="relative aspect-[16/8] rounded-[22px] overflow-hidden bg-[#E8EFFB]">
                  {b.thumbnail && <img src={b.thumbnail} alt="" className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-700" />}
                  <span className="absolute top-4 left-4 h-8 px-3.5 inline-flex items-center gap-1.5 rounded-full bg-white/95 text-[13px] font-semibold text-[#111827]">
                    <Layers className="w-4 h-4 text-[#5E17EB]" /> {b.courses.length} courses
                  </span>
                </div>
                <div className="p-5 sm:p-6">
                  <h2 className="font-display text-[24px] font-bold leading-snug text-[#111827] group-hover:text-[#004AAD]">{b.title}</h2>
                  {b.subtitle && <p className="mt-2 text-[17px] text-[#64748B] line-clamp-2">{b.subtitle}</p>}
                  <ul className="mt-4 space-y-1.5">
                    {b.courses.slice(0, 4).map((c) => (
                      <li key={c.id} className="text-[15px] text-[#334155] truncate">• {c.title}</li>
                    ))}
                    {b.courses.length > 4 && <li className="text-[15px] text-[#64748B]">+ {b.courses.length - 4} more</li>}
                  </ul>
                  <div className="mt-6 pt-5 border-t border-dashed border-[#E2E8F0] flex items-end justify-between gap-3">
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="font-display text-[26px] font-extrabold text-[#111827]">{formatPrice(b.price)}</span>
                        {saving > 0 && <span className="text-[16px] text-[#94A3B8] line-through">₹{b.coursesValue.toLocaleString('en-IN')}</span>}
                      </div>
                      {saving > 0 && <div className="text-[14px] font-semibold text-[#5E17EB]">You save ₹{saving.toLocaleString('en-IN')}</div>}
                    </div>
                    <span className="w-12 h-12 rounded-full bg-[#E8EFFB] text-[#004AAD] flex items-center justify-center group-hover:bg-[#004AAD] group-hover:text-white transition-colors">
                      <ArrowUpRight className="w-5 h-5" />
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};
