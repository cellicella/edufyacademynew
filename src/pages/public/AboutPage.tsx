import React from 'react';
import { Link } from 'react-router-dom';
import { Award, ShieldCheck, Users, Target, BookOpen, Sparkles, ArrowRight } from 'lucide-react';

export const AboutPage: React.FC = () => {
  return (
    <div className="max-w-[1280px] mx-auto px-5 sm:px-8 py-8 sm:py-12 space-y-12">
      {/* Editorial hero */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
        <div className="lg:col-span-6">
          <span className="ed-eyebrow">About Edufy Academy</span>
          <h1 className="ed-display mt-6 text-[2.5rem] sm:text-[3.25rem] leading-[1.06]">
            Education that reflects how real work gets done.
          </h1>
          <p className="mt-6 text-[19px] leading-[1.7] text-[#475569]">
            Edufy Academy was established on a simple conviction: technical education should reflect real-world standards,
            not toy projects or dated recordings.
          </p>
        </div>
        <div className="lg:col-span-6">
          <div className="ed-frame">
            <img
              src="https://images.unsplash.com/photo-1531482615713-2afd69097998?w=1200&auto=format&fit=crop&q=80"
              alt="A learner working through a lesson on her laptop"
              className="w-full aspect-[4/3] object-cover"
            />
          </div>
        </div>
      </section>

      {/* 3 Core Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-white p-6 rounded-2xl border border-[#E2E8F0] space-y-3">
          <div className="w-10 h-10 rounded-lg bg-[#EBF3FF] text-[#004AAD] flex items-center justify-center">
            <Target className="w-5 h-5" />
          </div>
          <h3 className="font-display text-base font-bold text-[#111827]">Production Rigor</h3>
          <p className="text-xs text-[#64748B] leading-relaxed">
            Every lesson teaches enterprise design patterns, strict TypeScript typing, testing methodologies, and deployment automation.
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-[#E2E8F0] space-y-3">
          <div className="w-10 h-10 rounded-lg bg-[#F4EFFF] text-[#5E17EB] flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="font-display text-base font-bold text-[#111827]">Verifiable Accreditation</h3>
          <p className="text-xs text-[#64748B] leading-relaxed">
            Our completion certificates are backed by cryptographic checksums and individual registry identifiers that employers trust.
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-[#E2E8F0] space-y-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <h3 className="font-display text-base font-bold text-[#111827]">Direct Mentorship</h3>
          <p className="text-xs text-[#64748B] leading-relaxed">
            Connect with curriculum authors and peers in discussion threads, code reviews, and live Q&A roundtables.
          </p>
        </div>
      </div>

      {/* Leadership summary */}
      <div className="bg-white p-8 rounded-2xl border border-[#E2E8F0] space-y-6">
        <h2 className="font-display text-xl font-bold text-[#111827]">
          Pedagogical Framework
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-[#64748B] leading-relaxed">
          <p>
            Traditional courses often front-load syntax and leave students stranded when facing architectural edge-cases. At Edufy, each module is anchored by a concrete engineering problem statement drawn from production systems at high-scale tech firms.
          </p>
          <p>
            Students build complete, end-to-end full-stack applications with modular components, reactive state systems, database persistence, and comprehensive test coverage.
          </p>
        </div>
      </div>
    </div>
  );
};
