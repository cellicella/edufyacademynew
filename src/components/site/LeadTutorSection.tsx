import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BadgeCheck, Briefcase, GraduationCap } from 'lucide-react';
import { LEAD_INSTRUCTOR } from '../../config/leadInstructor';

/**
 * Homepage "Meet your lead tutor". Shows only the details configured in src/config/leadInstructor.ts
 * (verified by Edufy); empty fields — biography, qualifications, experience, expertise — are left out.
 * "Learn more" opens a course the lead tutor teaches, when there is one.
 */
export const LeadTutorSection: React.FC<{ courseHref?: string | null; courseCount?: number }> = ({ courseHref, courseCount = 0 }) => {
  const t = LEAD_INSTRUCTOR;
  const hasDetails = t.qualifications.length > 0 || !!t.experience;

  return (
    <section aria-labelledby="lead-tutor-heading" className="relative overflow-hidden bg-[#F7F9FC]">
      {/* soft brand glows */}
      <div aria-hidden="true" className="pointer-events-none absolute -top-24 -left-24 w-80 h-80 rounded-full bg-[#5271FF]/15 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 right-0 w-96 h-96 rounded-full bg-[#5E17EB]/10 blur-3xl" />

      <div className="relative max-w-[1280px] mx-auto px-5 sm:px-8 py-20 lg:py-28 grid grid-cols-1 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-10 lg:gap-16 items-center">
        {/* Portrait */}
        <div className="mx-auto w-full max-w-[260px] sm:max-w-[320px] md:max-w-[380px]">
          <div className="relative rounded-[32px] p-[6px] bg-gradient-to-br from-[#004AAD] via-[#5271FF] to-[#5E17EB] shadow-[0_24px_60px_-24px_rgba(0,74,173,0.55)]">
            <picture>
              <source srcSet={t.portraitWebp} type="image/webp" />
              <img
                src={t.portraitJpg}
                width={480}
                height={600}
                loading="lazy"
                decoding="async"
                alt={`${t.name}, ${t.designation} at ${t.organisation}`}
                className="block w-full aspect-[4/5] object-cover rounded-[27px] bg-[#E8EFFB]"
              />
            </picture>
            <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap h-10 px-4 inline-flex items-center gap-2 rounded-full bg-white shadow-lg text-[14px] font-bold text-[#004AAD]">
              <BadgeCheck className="w-[18px] h-[18px]" aria-hidden="true" />
              {t.designation}
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="text-center md:text-left">
          <span className="ed-eyebrow">Meet your lead tutor</span>
          <h2 id="lead-tutor-heading" className="mt-4 ed-display text-[2.25rem] sm:text-[2.75rem] lg:text-[3.25rem] leading-[1.08]">
            {t.name}
          </h2>
          <p className="mt-3 text-[18px] sm:text-[20px] font-semibold">
            <span className="text-[#004AAD]">{t.designation}</span>
            <span className="text-[#94A3B8]"> · </span>
            <span className="text-[#5E17EB]">{t.organisation}</span>
          </p>

          {t.bio && <p className="mt-6 text-[17px] sm:text-[18px] leading-[1.75] text-[#475569] measure md:mx-0 mx-auto">{t.bio}</p>}

          {hasDetails && (
            <ul className="mt-6 space-y-3 text-[16px] text-[#334155] inline-block text-left">
              {t.qualifications.map((q) => (
                <li key={q} className="flex items-start gap-3"><GraduationCap className="w-5 h-5 mt-0.5 text-[#5271FF] shrink-0" aria-hidden="true" />{q}</li>
              ))}
              {t.experience && <li className="flex items-start gap-3"><Briefcase className="w-5 h-5 mt-0.5 text-[#5271FF] shrink-0" aria-hidden="true" />{t.experience}</li>}
            </ul>
          )}

          {t.expertise.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2 justify-center md:justify-start">
              {t.expertise.map((e) => (
                <span key={e} className="h-8 px-3.5 inline-flex items-center rounded-full bg-white border border-[#D6E2F8] text-[14px] font-medium text-[#003B8B]">{e}</span>
              ))}
            </div>
          )}

          {courseCount > 0 && (
            <p className="mt-6 text-[16px] text-[#475569]">
              Teaching <b className="text-[#111827] tabular-nums">{courseCount}</b> Edufy Academy course{courseCount === 1 ? '' : 's'}.
            </p>
          )}

          <div className="mt-8 flex flex-wrap gap-3 justify-center md:justify-start">
            {courseHref && (
              <Link to={courseHref} className="ed-btn ed-btn-filled">
                Learn more <ArrowRight className="w-5 h-5" aria-hidden="true" />
              </Link>
            )}
            <Link to="/courses" className="ed-btn ed-btn-outlined">
              Browse all courses
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};
