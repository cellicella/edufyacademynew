import React from 'react';
import { Link } from 'react-router-dom';
import { Award, ShieldCheck, Users, Target, BookOpen, Sparkles, ArrowRight } from 'lucide-react';

export const AboutPage: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-12">
      {/* Visual Hero Banner */}
      <div className="relative rounded-2xl overflow-hidden shadow-2xl min-h-[340px] flex items-center p-8 sm:p-12 text-white border border-blue-400/20">
        <img
          src="https://images.unsplash.com/photo-1531482615713-2afd69097998?w=1000&auto=format&fit=crop&q=80"
          alt="Edufy Academy tech leadership and education"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#004AAD]/95 via-[#004AAD]/85 to-[#5E17EB]/80 backdrop-blur-[2px]" />
        <div className="absolute inset-0 bg-edufy-dots opacity-20 pointer-events-none" />

        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 backdrop-blur-md rounded-lg text-xs font-semibold uppercase tracking-wider text-white border border-white/25">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Our Mission & Standards</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight">
            Empowering the next generation of software architects and tech leaders.
          </h1>
          <p className="text-sm sm:text-base text-blue-100 leading-relaxed">
            Edufy Academy was established on a simple conviction: technical education should reflect real-world engineering standards, not toy projects or dated video recordings.
          </p>
        </div>
      </div>

      {/* 3 Core Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-white p-6 rounded-xl border border-[#E2E8F0] space-y-3">
          <div className="w-10 h-10 rounded-lg bg-[#EBF3FF] text-[#004AAD] flex items-center justify-center">
            <Target className="w-5 h-5" />
          </div>
          <h3 className="font-display text-base font-bold text-[#111827]">Production Rigor</h3>
          <p className="text-xs text-[#64748B] leading-relaxed">
            Every lesson teaches enterprise design patterns, strict TypeScript typing, testing methodologies, and deployment automation.
          </p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-[#E2E8F0] space-y-3">
          <div className="w-10 h-10 rounded-lg bg-[#F4EFFF] text-[#5E17EB] flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="font-display text-base font-bold text-[#111827]">Verifiable Accreditation</h3>
          <p className="text-xs text-[#64748B] leading-relaxed">
            Our completion certificates are backed by cryptographic checksums and individual registry identifiers that employers trust.
          </p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-[#E2E8F0] space-y-3">
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
      <div className="bg-white p-8 rounded-xl border border-[#E2E8F0] space-y-6">
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
