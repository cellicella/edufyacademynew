import React from 'react';
import { Award, BadgeCheck, Briefcase, GraduationCap } from 'lucide-react';
import { Course } from '../../types';
import { LEAD_INSTRUCTOR, displayInstructor } from '../../config/leadInstructor';
import { cdnAvatar } from '../../lib/cdnImage';
import { CoursePurchaseButton } from './CoursePurchase';

/**
 * "Meet your instructor" section for the course page. Edufy's own courses show the lead instructor
 * (photo and details from src/config/leadInstructor.ts); courses by other instructors show their profile.
 * Only verified details are rendered — empty fields are left out.
 */
export const InstructorSpotlight: React.FC<{ course: Course }> = ({ course }) => {
  const who = displayInstructor(course.instructor);
  const lead = who.isLead ? LEAD_INSTRUCTOR : null;
  const bio = lead ? lead.bio : course.instructor.bio;
  const qualifications = lead?.qualifications || [];
  const expertise = lead?.expertise || [];
  const experience = lead?.experience || '';
  const i = course.instructor;

  return (
    <section aria-labelledby="instructor-heading" className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden">
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] md:grid-cols-[220px_1fr]">
        {/* Portrait */}
        <div className="relative bg-gradient-to-br from-[#004AAD] via-[#5271FF] to-[#5E17EB] p-5 sm:p-6 flex sm:block items-center justify-center">
          {lead ? (
            <picture>
              <source srcSet={lead.portraitWebp} type="image/webp" />
              <img
                src={lead.portraitJpg}
                width={480}
                height={600}
                loading="lazy"
                decoding="async"
                alt={`${who.name}, ${who.title} at ${lead.organisation}`}
                className="w-40 sm:w-full aspect-[4/5] object-cover rounded-xl ring-4 ring-white/25 shadow-lg"
              />
            </picture>
          ) : (
            <img
              src={cdnAvatar(who.avatar, 160)}
              width={160}
              height={160}
              loading="lazy"
              alt={who.name}
              referrerPolicy="no-referrer"
              className="w-32 h-32 sm:w-full sm:h-auto sm:aspect-square object-cover rounded-xl ring-4 ring-white/25 shadow-lg"
            />
          )}
        </div>

        {/* Details */}
        <div className="p-6 sm:p-7 flex flex-col">
          <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#5E17EB]">Meet your instructor</p>
          <h2 id="instructor-heading" className="mt-2 font-display text-[24px] font-extrabold tracking-tight text-[#111827] flex items-center gap-2">
            {who.name}
            {lead && <BadgeCheck className="w-5 h-5 text-[#004AAD]" aria-label="Edufy Academy instructor" />}
          </h2>
          {who.title && (
            <div className="mt-1 text-[15px] font-semibold text-[#004AAD]">
              {who.title}
              {lead ? ` · ${lead.organisation}` : ''}
            </div>
          )}

          {!lead && (
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-[#64748B]">
              {i.rating > 0 && <span className="tabular-nums font-medium">{i.rating} rating</span>}
              {i.totalStudents > 0 && <span className="tabular-nums font-medium">{i.totalStudents.toLocaleString('en-IN')} students</span>}
              {i.coursesCount > 0 && <span className="tabular-nums font-medium">{i.coursesCount} courses</span>}
            </div>
          )}

          {(qualifications.length > 0 || experience) && (
            <ul className="mt-4 space-y-2 text-[14px] text-[#334155]">
              {qualifications.map((q) => (
                <li key={q} className="flex items-start gap-2"><GraduationCap className="w-4 h-4 mt-0.5 text-[#5271FF] shrink-0" />{q}</li>
              ))}
              {experience && <li className="flex items-start gap-2"><Briefcase className="w-4 h-4 mt-0.5 text-[#5271FF] shrink-0" />{experience}</li>}
            </ul>
          )}

          {expertise.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {expertise.map((e) => (
                <span key={e} className="h-7 px-3 inline-flex items-center rounded-full bg-[#F1F5FF] text-[13px] font-medium text-[#003B8B]">{e}</span>
              ))}
            </div>
          )}

          {bio && <p className="mt-4 text-[15px] leading-relaxed text-[#475569]">{bio}</p>}

          {lead && !bio && (
            <p className="mt-4 text-[15px] leading-relaxed text-[#475569] flex items-start gap-2">
              <Award className="w-4 h-4 mt-1 text-[#5E17EB] shrink-0" />
              <span>{who.name} leads this course for {lead.organisation}.</span>
            </p>
          )}

          <div className="mt-6 pt-5 border-t border-[#EEF2F7] flex flex-wrap items-center gap-3">
            <CoursePurchaseButton course={course} label="Enroll now" size="sm" />
            <span className="text-[14px] text-[#64748B]">Learn with {who.name.split(' ')[0]} at your own pace.</span>
          </div>
        </div>
      </div>
    </section>
  );
};
