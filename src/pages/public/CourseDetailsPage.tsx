import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { courseService } from '../../services/api';
import { Course } from '../../types';
import { useCartWishlist } from '../../context/CartWishlistContext';
import { calculateDiscountPercent, formatDuration } from '../../utils/courseUtils';
import { CourseCard, CourseRating } from '../../components/common/CourseCard';
import { ResponsiveVideo } from '../../components/common/ResponsiveVideo';
import { resolveVideo } from '../../utils/videoEmbed';
import {
  Star,
  Clock,
  BookOpen,
  Award,
  Globe,
  CheckCircle2,
  Heart,
  PlayCircle,
  ShoppingBag,
  ChevronDown,
  ShieldCheck,
  FileText,
  Play,
  X,
  CalendarDays,
  Target,
  Users,
  ListChecks,
  MonitorSmartphone,
} from 'lucide-react';
import { cdnImage, cdnSrcSet, cdnAvatar } from '../../lib/cdnImage';
import { CoursePurchaseButton, CtaStrip, PriceInline, StickyPurchaseBar } from '../../components/course/CoursePurchase';
import { InstructorSpotlight } from '../../components/course/InstructorSpotlight';
import { displayInstructor } from '../../config/leadInstructor';
import { useResumePurchase } from '../../hooks/usePurchaseFlow';
import { useSeo } from '../../lib/seo';
import { trackViewContent } from '../../lib/metaEvents';
import { formatINR } from '../../utils/currency';
import { SeoCourse, breadcrumbLd, courseLd, coursePath, courseSeo, readableTitle } from '../../seo/seoConfig';

/** Column classes written out in full so Tailwind generates them. */
const FACT_COLS: Record<number, string> = { 1: 'sm:grid-cols-1', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-4' };

/** Smooth-scrolls to a section (instant when the visitor prefers reduced motion). */
function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
}

/**
 * The full course thumbnail at 16:9, never cropped: the image is contained, and a soft blurred copy of
 * the same image fills any letterbox space when an upload isn't exactly 16:9.
 */
const CourseThumbnail: React.FC<{
  course: Course;
  sizes: string;
  hasPreview: boolean;
  onPreview: () => void;
  priority?: boolean;
  /** Tailwind radius class for the frame */
  radius?: string;
}> = ({ course, sizes, hasPreview, onPreview, priority, radius = 'rounded-[20px]' }) => {
  const [failed, setFailed] = useState(false);
  const src = course.thumbnail && !failed ? cdnImage(course.thumbnail, 960) : '';
  const srcSet = course.thumbnail && !failed ? cdnSrcSet(course.thumbnail, [480, 640, 960, 1280]) : undefined;
  const inner = (
    <>
      {src ? (
        <>
          <img src={src} alt="" aria-hidden="true" referrerPolicy="no-referrer" className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-40" />
          <img
            src={src}
            srcSet={srcSet}
            sizes={sizes}
            alt={course.title}
            referrerPolicy="no-referrer"
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : undefined}
            decoding="async"
            onError={() => setFailed(true)}
            className="relative w-full h-full object-contain"
          />
        </>
      ) : (
        <div className="relative w-full h-full flex items-center justify-center text-[#004AAD]">
          <BookOpen className="w-12 h-12 opacity-40" />
        </div>
      )}
      {hasPreview && (
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/0 group-hover:bg-black/25 transition-colors">
          <span className="w-16 h-16 rounded-full bg-white/95 text-[#004AAD] flex items-center justify-center shadow-xl motion-safe:group-hover:scale-105 transition-transform">
            <Play className="w-7 h-7 ml-0.5 fill-current" />
          </span>
          <span className="text-[14px] font-semibold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]">Preview this course</span>
        </span>
      )}
    </>
  );
  const frame = `relative block w-full aspect-video overflow-hidden ${radius} bg-gradient-to-br from-[#EEF3FF] via-white to-[#F3EEFF] ring-1 ring-[#DCE4F5]`;
  return hasPreview ? (
    <button type="button" onClick={onPreview} aria-label={`Play preview of ${course.title}`} className={`group ${frame}`}>
      {inner}
    </button>
  ) : (
    <div className={frame}>{inner}</div>
  );
};

const SectionCard: React.FC<{ id?: string; title: string; icon?: React.ElementType; children: React.ReactNode; aside?: React.ReactNode }> = ({ id, title, icon: Icon, children, aside }) => (
  <section id={id} aria-labelledby={id ? `${id}-heading` : undefined} className="scroll-mt-28 bg-white p-6 sm:p-8 rounded-[24px] border border-[#E2E8F0]">
    <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
      <h2 id={id ? `${id}-heading` : undefined} className="font-display text-[22px] font-extrabold tracking-tight text-[#111827] flex items-center gap-2.5">
        {Icon && (
          <span className="w-9 h-9 rounded-xl bg-[#EEF3FF] text-[#004AAD] flex items-center justify-center">
            <Icon className="w-[18px] h-[18px]" />
          </span>
        )}
        {title}
      </h2>
      {aside}
    </div>
    {children}
  </section>
);

export const CourseDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [course, setCourse] = useState<Course | null>(null);
  const [relatedCourses, setRelatedCourses] = useState<Course[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  useEffect(() => {
    if (!previewOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPreviewOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [previewOpen]);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const navigate = useNavigate();
  const { isInWishlist, toggleWishlist, initiateCourseEnrollment, isEnrolled, isInCart, addToCart, setIsCartOpen } = useCartWishlist();

  const [courseReviews, setCourseReviews] = useState<any[]>([]);

  // Search metadata from the real course data (same text as the prerendered page)
  const seoCourse: SeoCourse | null = course
    ? {
        id: course.id, slug: course.slug, title: course.title, seoTitle: course.seoTitle, seoDescription: course.seoDescription, subtitle: course.subtitle, description: course.description, category: course.category,
        level: course.level, language: course.language, price: course.price, originalPrice: course.originalPrice,
        durationHours: course.durationHours, totalLessons: course.totalLessons, thumbnail: course.thumbnail,
        learningOutcomes: course.learningOutcomes, requirements: course.requirements,
        instructorName: course.instructor?.name, instructorTitle: course.instructor?.title,
      }
    : null;
  useSeo(
    loading
      ? null
      : seoCourse
        ? {
            ...courseSeo(seoCourse),
            canonicalPath: coursePath(seoCourse),
            image: course?.thumbnail,
            ld: [courseLd(seoCourse), breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Courses', path: '/courses' }, { name: readableTitle(seoCourse.title), path: coursePath(seoCourse) }])],
          }
        : { title: 'Course not found | Edufy Academy', robots: 'noindex, follow', canonicalPath: null, description: null, ld: [] }
  );

  // Guests are sent to sign in and come back here (?enroll=1) to continue the purchase once
  useResumePurchase(
    'course',
    course?.id,
    () => (course ? initiateCourseEnrollment(course) : Promise.resolve(false)),
    () => course && navigate(`/learn/${course.id}`)
  );

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    courseService.getCourseById(id).then((data) => {
      setCourse(data);
      if (data) {
        if (data.curriculum[0]) setExpandedSections({ [data.curriculum[0].id]: true });
        courseService.getAllCourses({ category: data.categorySlug }).then((related) => {
          setRelatedCourses(related.filter((c) => c.id !== data.id).slice(0, 3));
        });
        courseService.getCourseReviews(data.id).then(setCourseReviews);
      }
      setLoading(false);
    });
  }, [id]);

  // Meta Pixel ViewContent: once per visit to a published course page (location.key changes on every navigation,
  // re-renders keep it). The loaded course must be the one in the address, so a previous course is never counted.
  const viewKey = useLocation().key;
  useEffect(() => {
    if (loading || !course || !id || (course.id !== id && course.slug !== id)) return;
    trackViewContent({ id: course.id, title: course.title, category: course.category, price: course.price, isPublished: course.isPublished }, viewKey);
  }, [loading, course, id, viewKey]);

  if (loading) {
    return (
      <div className="max-w-[1280px] mx-auto px-5 sm:px-8 py-12" aria-busy="true" aria-label="Loading course">
        <div className="grid lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7 space-y-4">
            <div className="h-7 w-40 rounded-full bg-slate-200 animate-pulse" />
            <div className="h-12 w-full rounded-xl bg-slate-200 animate-pulse" />
            <div className="h-12 w-4/5 rounded-xl bg-slate-200 animate-pulse" />
            <div className="h-5 w-3/4 rounded bg-slate-100 animate-pulse" />
            <div className="h-24 w-full rounded-2xl bg-slate-100 animate-pulse" />
          </div>
          <div className="lg:col-span-5 aspect-video rounded-[20px] bg-slate-200 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center space-y-4">
        <h1 className="font-display text-2xl font-bold text-[#111827]">Course not found</h1>
        <p className="text-sm text-[#64748B]">We couldn't find this course. It may have been moved or is no longer available.</p>
        <Link to="/courses" className="inline-block px-5 py-2.5 text-sm font-semibold text-white bg-[#004AAD] rounded-full">
          Browse all courses
        </Link>
      </div>
    );
  }

  const toggleSection = (sectionId: string) => setExpandedSections((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));

  const isFavorited = isInWishlist(course.id);
  const enrolled = isEnrolled(course.id);
  const instructor = displayInstructor(course.instructor);
  const discountPercent = calculateDiscountPercent(course.price, course.originalPrice);
  const savings = course.price > 0 && course.originalPrice > course.price ? course.originalPrice - course.price : 0;
  const hasPreview = !!resolveVideo(course.previewVideoUrl);
  const allExpanded = course.curriculum.length > 0 && course.curriculum.every((s) => expandedSections[s.id]);
  const descriptionParagraphs = (course.description || '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const requirements = (course.requirements || []).filter(Boolean);
  const audience = (course.targetAudience || []).filter(Boolean);
  const outcomes = (course.learningOutcomes || []).filter(Boolean);
  const facts = [
    { k: 'Duration', v: course.durationHours > 0 ? formatDuration(course.durationHours) : '', icon: Clock },
    { k: 'Lessons', v: course.totalLessons > 0 ? String(course.totalLessons) : '', icon: PlayCircle },
    { k: 'Language', v: course.language || '', icon: Globe },
    { k: 'Last updated', v: course.lastUpdated || '', icon: CalendarDays },
  ].filter((f) => f.v);
  const jumpLinks = [
    outcomes.length > 0 && { id: 'learn', label: "What you'll learn" },
    { id: 'curriculum', label: 'Curriculum' },
    { id: 'instructor', label: 'Instructor' },
    { id: 'reviews', label: 'Reviews' },
  ].filter(Boolean) as Array<{ id: string; label: string }>;

  return (
    <div className="pb-24">
      {previewOpen && hasPreview && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Preview: ${course.title}`}
          className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreviewOpen(false)}
        >
          <div className="w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-4 mb-3 text-white">
              <div className="min-w-0">
                <div className="text-[13px] text-white/70">Course preview</div>
                <div className="font-display text-[18px] font-bold truncate">{course.title}</div>
              </div>
              <button type="button" onClick={() => setPreviewOpen(false)} aria-label="Close preview" className="w-10 h-10 shrink-0 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center">
                <X className="w-5 h-5" />
              </button>
            </div>
            <ResponsiveVideo source={course.previewVideoUrl} title={`${course.title} — preview`} autoPlay className="rounded-2xl shadow-2xl" />
          </div>
        </div>
      )}

      {/* 1. Hero: course facts and purchase on the left, the full 16:9 thumbnail on the right */}
      <section className="relative overflow-hidden border-b border-[#E2E8F0] bg-[radial-gradient(ellipse_at_top_right,#EEF0FF_0%,transparent_55%),radial-gradient(ellipse_at_bottom_left,#EAF2FF_0%,transparent_50%)] bg-[#F7F9FC]">
        <div className="max-w-[1280px] mx-auto px-5 sm:px-8 pt-8 pb-12 lg:pt-12 lg:pb-16">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-[14px] text-[#64748B] mb-6 lg:mb-8">
            <Link to="/courses" className="hover:text-[#004AAD]">Courses</Link>
            <span aria-hidden="true">/</span>
            {course.category && (
              <>
                <Link to={`/courses?category=${encodeURIComponent(course.categorySlug)}`} className="hover:text-[#004AAD]">{course.category}</Link>
                <span aria-hidden="true">/</span>
              </>
            )}
            <span className="text-[#111827] font-medium truncate max-w-[60vw]">{course.title}</span>
          </nav>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-center">
            <div className="lg:col-span-5 lg:order-2">
              <div className="rounded-[24px] p-1.5 bg-gradient-to-br from-[#5271FF]/40 via-white to-[#5E17EB]/30 shadow-[0_30px_70px_-35px_rgba(0,74,173,0.55)]">
                <CourseThumbnail course={course} priority sizes="(min-width: 1280px) 500px, (min-width: 1024px) 40vw, 100vw" hasPreview={hasPreview} onPreview={() => setPreviewOpen(true)} />
              </div>
            </div>

            <div className="lg:col-span-7 lg:order-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-5">
                {course.category && (
                  <Link
                    to={`/courses?category=${encodeURIComponent(course.categorySlug)}`}
                    className="h-8 px-3.5 inline-flex items-center rounded-full bg-gradient-to-r from-[#004AAD] to-[#5E17EB] text-[13px] font-bold tracking-wide text-white hover:opacity-90"
                  >
                    {course.category}
                  </Link>
                )}
                {course.level && <span className="h-8 px-3.5 inline-flex items-center rounded-full bg-[#E8EFFB] text-[13px] font-semibold text-[#003B8B]">{course.level}</span>}
                {course.bestseller && <span className="h-8 px-3.5 inline-flex items-center rounded-full bg-[#F1EAFE] text-[13px] font-semibold text-[#5E17EB]">Bestseller</span>}
                {course.certificateOffered && (
                  <span className="h-8 px-3.5 inline-flex items-center gap-1.5 rounded-full bg-white border border-[#E2E8F0] text-[13px] font-medium text-[#334155]">
                    <Award className="w-4 h-4 text-[#B8913A]" />Certificate of completion
                  </span>
                )}
              </div>

              <h1 className="ed-display text-[2rem] sm:text-[2.6rem] lg:text-[3rem] leading-[1.08] [text-wrap:balance]">{course.title}</h1>
              {course.subtitle && <p className="mt-4 text-[18px] sm:text-[19px] leading-[1.6] text-[#475569] max-w-2xl">{course.subtitle}</p>}

              <div className="mt-6 flex flex-wrap items-center gap-x-7 gap-y-4">
                <div className="flex items-center gap-3">
                  <img src={cdnAvatar(instructor.avatar, 48)} alt="" width={48} height={48} referrerPolicy="no-referrer" className="w-12 h-12 rounded-full object-cover ring-2 ring-white shadow-sm" />
                  <div className="leading-tight">
                    <div className="text-[13px] text-[#64748B]">{instructor.isLead ? instructor.title : 'Instructor'}</div>
                    <button type="button" onClick={() => scrollToSection('instructor')} className="text-[16px] font-semibold text-[#111827] hover:text-[#004AAD]">
                      {instructor.name}
                    </button>
                  </div>
                </div>
                <CourseRating course={course} />
                {course.enrolledCount > 0 && (
                  <span className="text-[15px] text-[#475569] tabular-nums inline-flex items-center gap-1.5">
                    <Users className="w-4 h-4" />
                    {course.enrolledCount.toLocaleString('en-IN')} learners enrolled
                  </span>
                )}
              </div>

              {facts.length > 0 && (
                <dl className={`mt-7 grid grid-cols-2 ${FACT_COLS[Math.min(facts.length, 4)]} gap-px bg-[#E2E8F0] rounded-[18px] overflow-hidden border border-[#E2E8F0]`}>
                  {facts.map((m) => (
                    <div key={m.k} className="bg-white px-4 py-3.5">
                      <dt className="flex items-center gap-1.5 text-[13px] text-[#64748B]"><m.icon className="w-4 h-4" />{m.k}</dt>
                      <dd className="mt-1 font-display text-[17px] font-bold text-[#111827] truncate">{m.v}</dd>
                    </div>
                  ))}
                </dl>
              )}

              {/* Price and purchase */}
              <div className="mt-7 rounded-[20px] bg-white border border-[#E2E8F0] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 shadow-[0_12px_30px_-22px_rgba(17,24,39,0.35)]">
                {enrolled ? (
                  <div className="flex-1 text-[15px] font-semibold text-emerald-700 inline-flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5" /> You're enrolled in this course
                  </div>
                ) : (
                  <div className="flex-1 min-w-0">
                    <PriceInline course={course} />
                    {savings > 0 && <div className="mt-1 text-[14px] font-semibold text-emerald-700">You save {formatINR(savings)}</div>}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2.5">
                  <CoursePurchaseButton course={course} className="h-12 px-7 text-[15px]" />
                  {!enrolled && hasPreview && (
                    <button type="button" onClick={() => setPreviewOpen(true)} className="ed-btn ed-btn-outlined">
                      <Play className="w-4 h-4" /> Preview
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => toggleWishlist(course.id, course.title)}
                    aria-pressed={isFavorited}
                    aria-label={isFavorited ? 'Remove from wishlist' : 'Add to wishlist'}
                    className={`w-12 h-12 rounded-full border flex items-center justify-center transition-colors ${
                      isFavorited ? 'bg-[#F4EFFF] border-[#5E17EB] text-[#5E17EB]' : 'bg-white border-[#CBD5E1] text-[#475569] hover:bg-[#F8FAFC]'
                    }`}
                  >
                    <Heart className={`w-5 h-5 ${isFavorited ? 'fill-[#5E17EB]' : ''}`} />
                  </button>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2" aria-label="Jump to section">
                {jumpLinks.map((j) => (
                  <button
                    key={j.id}
                    type="button"
                    onClick={() => scrollToSection(j.id)}
                    className="h-8 px-3.5 rounded-full text-[13px] font-semibold text-[#334155] bg-white/70 border border-[#E2E8F0] hover:border-[#5271FF] hover:text-[#004AAD] transition-colors"
                  >
                    {j.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Course details + sticky purchase card */}
      <div className="max-w-[1280px] mx-auto px-5 sm:px-8 mt-10 lg:mt-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
          <div className="lg:col-span-8 space-y-8 min-w-0">
            {outcomes.length > 0 && (
              <SectionCard id="learn" title="What you'll learn" icon={ListChecks}>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {outcomes.map((outcome, idx) => (
                    <li key={idx} className="flex items-start gap-3 rounded-2xl bg-[#F7F9FC] border border-[#EEF2F7] p-3.5 text-[15px] text-[#1F2937] leading-relaxed">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{outcome}</span>
                    </li>
                  ))}
                </ul>
              </SectionCard>
            )}

            {descriptionParagraphs.length > 0 && (
              <SectionCard id="description" title="Course description" icon={FileText}>
                <div className="space-y-4 text-[16px] leading-[1.75] text-[#334155] max-w-[68ch]">
                  {descriptionParagraphs.map((p, i) => (
                    <p key={i} className="whitespace-pre-line">{p}</p>
                  ))}
                </div>
              </SectionCard>
            )}

            <SectionCard
              id="curriculum"
              title="Course curriculum"
              icon={BookOpen}
              aside={
                course.curriculum.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (allExpanded) setExpandedSections({});
                      else setExpandedSections(Object.fromEntries(course.curriculum.map((s) => [s.id, true])));
                    }}
                    className="text-[13px] font-semibold text-[#004AAD] hover:underline"
                  >
                    {allExpanded ? 'Collapse all sections' : 'Expand all sections'}
                  </button>
                ) : null
              }
            >
              <p className="-mt-2 mb-5 text-[14px] text-[#64748B]">
                {course.curriculum.length} {course.curriculum.length === 1 ? 'section' : 'sections'} · {course.totalLessons} lessons
                {course.durationHours > 0 ? ` · ${formatDuration(course.durationHours)} total length` : ''}
              </p>
              <div className="space-y-3">
                {course.curriculum.map((section, sIdx) => {
                  const isExpanded = !!expandedSections[section.id];
                  const totalSecMins = section.lessons.reduce((acc, l) => acc + (l.durationMinutes || 0), 0);
                  return (
                    <div key={section.id} className={`border rounded-2xl overflow-hidden transition-colors ${isExpanded ? 'border-[#C9D7F2]' : 'border-[#E2E8F0]'}`}>
                      <button
                        type="button"
                        onClick={() => toggleSection(section.id)}
                        aria-expanded={isExpanded}
                        className="w-full bg-[#F8FAFC] hover:bg-[#F1F5F9] p-4 text-left flex items-start justify-between gap-3 transition-colors"
                      >
                        <span className="flex items-start gap-3 min-w-0">
                          <span className="mt-0.5 w-7 h-7 shrink-0 rounded-lg bg-white border border-[#E2E8F0] text-[12px] font-bold text-[#004AAD] flex items-center justify-center tabular-nums">
                            {sIdx + 1}
                          </span>
                          <span className="min-w-0">
                            <span className="block font-display text-[15px] font-bold text-[#111827]">{section.title}</span>
                            {section.description && <span className="block mt-0.5 text-[13px] text-[#64748B] leading-snug">{section.description}</span>}
                          </span>
                        </span>
                        <span className="flex items-center gap-3 shrink-0">
                          <span className="hidden sm:inline text-[13px] text-[#64748B] tabular-nums font-medium">
                            {section.lessons.length} {section.lessons.length === 1 ? 'lesson' : 'lessons'}
                            {totalSecMins > 0 ? ` · ${totalSecMins} min` : ''}
                          </span>
                          <ChevronDown className={`w-5 h-5 text-[#64748B] transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                        </span>
                      </button>
                      {isExpanded && (
                        <ul className="divide-y divide-[#EEF2F7] bg-white">
                          {section.lessons.map((lesson) => (
                            <li key={lesson.id} className="px-4 sm:px-5 py-3 flex items-center justify-between gap-3 text-[14px] text-[#111827] hover:bg-[#FAFBFD]">
                              <span className="flex items-center gap-3 min-w-0">
                                {lesson.type === 'article' ? (
                                  <FileText className="w-4 h-4 text-[#5271FF] shrink-0" />
                                ) : lesson.type === 'quiz' ? (
                                  <Award className="w-4 h-4 text-[#5E17EB] shrink-0" />
                                ) : (
                                  <PlayCircle className="w-4 h-4 text-[#004AAD] shrink-0" />
                                )}
                                <span className="font-medium">{lesson.title}</span>
                              </span>
                              <span className="flex items-center gap-3 shrink-0">
                                {lesson.isFreePreview && <span className="text-[12px] font-semibold text-[#004AAD] bg-[#EBF3FF] px-2 py-0.5 rounded">Preview</span>}
                                {lesson.durationMinutes > 0 && <span className="text-[#64748B] tabular-nums text-[13px]">{lesson.durationMinutes} min</span>}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </SectionCard>

            <CtaStrip
              course={course}
              heading="Ready to start learning?"
              text={`${course.totalLessons} lessons${course.durationHours > 0 ? ` · ${formatDuration(course.durationHours)} of video` : ''} · learn at your own pace`}
            />

            {(requirements.length > 0 || audience.length > 0) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {requirements.length > 0 && (
                  <SectionCard id="requirements" title="Requirements" icon={Target}>
                    <ul className="space-y-2.5">
                      {requirements.map((req, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-[15px] text-[#334155] leading-relaxed">
                          <span className="mt-2 w-1.5 h-1.5 rounded-full bg-[#5271FF] shrink-0" />
                          <span>{req}</span>
                        </li>
                      ))}
                    </ul>
                  </SectionCard>
                )}
                {audience.length > 0 && (
                  <SectionCard id="audience" title="Who this course is for" icon={Users}>
                    <ul className="space-y-2.5">
                      {audience.map((aud, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-[15px] text-[#334155] leading-relaxed">
                          <span className="mt-2 w-1.5 h-1.5 rounded-full bg-[#5E17EB] shrink-0" />
                          <span>{aud}</span>
                        </li>
                      ))}
                    </ul>
                  </SectionCard>
                )}
              </div>
            )}

            <div id="instructor" className="scroll-mt-28">
              <InstructorSpotlight course={course} />
            </div>

            <SectionCard id="reviews" title="Student reviews" icon={Star}>
              {courseReviews.length === 0 ? (
                <p className="text-[15px] text-[#64748B]">This course has no reviews yet. Students can review it after enrolling.</p>
              ) : (
                <div className="space-y-5">
                  {courseReviews.map((rev) => (
                    <div key={rev.id} className="pt-5 first:pt-0 border-t first:border-0 border-[#EEF2F7] space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <img src={rev.userAvatar} alt="" referrerPolicy="no-referrer" className="w-9 h-9 rounded-full object-cover bg-slate-100" />
                          <div>
                            <div className="text-[14px] font-bold text-[#111827]">{rev.userName}</div>
                            <div className="text-[13px] text-[#64748B]">{rev.date}</div>
                          </div>
                        </div>
                        <div className="flex items-center text-amber-500" aria-label={`${rev.rating} out of 5 stars`}>
                          {Array.from({ length: Math.max(0, Math.min(5, Number(rev.rating) || 0)) }, (_, i) => (
                            <Star key={i} className="w-4 h-4 fill-current" />
                          ))}
                        </div>
                      </div>
                      <p className="text-[15px] text-[#334155] leading-relaxed">{rev.comment}</p>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>

          {/* Sticky purchase card (desktop) */}
          <aside className="lg:col-span-4 lg:sticky lg:top-28 space-y-4" aria-label="Purchase this course">
            <div className="bg-white rounded-[24px] border border-[#E2E8F0] shadow-[0_24px_60px_-32px_rgba(17,24,39,0.35)] p-5 space-y-5">
              <CourseThumbnail course={course} sizes="(min-width: 1024px) 360px, 100vw" hasPreview={hasPreview} onPreview={() => setPreviewOpen(true)} radius="rounded-[16px]" />

              {enrolled ? (
                <div className="text-[15px] font-semibold text-emerald-700 inline-flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" /> You're enrolled
                </div>
              ) : (
                <div>
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-display text-[32px] font-extrabold text-[#111827] tabular-nums">{course.price <= 0 ? 'Free' : formatINR(course.price)}</span>
                    {course.price > 0 && course.originalPrice > course.price && <span className="text-[16px] text-[#94A3B8] line-through tabular-nums">{formatINR(course.originalPrice)}</span>}
                    {discountPercent > 0 && <span className="text-[12px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">{discountPercent}% OFF</span>}
                  </div>
                  {savings > 0 && <div className="text-[14px] font-semibold text-emerald-700 mt-1">You save {formatINR(savings)}</div>}
                </div>
              )}

              <div className="space-y-2.5">
                <CoursePurchaseButton course={course} fullWidth className="h-12 text-[15px]" />
                {!enrolled && (
                  <button
                    type="button"
                    onClick={() => (isInCart(course.id) ? setIsCartOpen(true) : addToCart(course))}
                    className={`w-full h-11 px-4 text-[14px] font-semibold rounded-full border transition-colors flex items-center justify-center gap-2 ${
                      isInCart(course.id) ? 'bg-[#EBF3FF] border-[#004AAD] text-[#004AAD]' : 'bg-white border-[#CBD5E1] text-[#111827] hover:bg-[#F8FAFC]'
                    }`}
                  >
                    <ShoppingBag className="w-4 h-4" />
                    {isInCart(course.id) ? 'View in cart' : 'Add to cart'}
                  </button>
                )}
              </div>

              <div className="pt-4 border-t border-[#E2E8F0] space-y-2.5 text-[14px] text-[#475569]">
                <div className="font-bold text-[#111827]">This course includes</div>
                {course.durationHours > 0 && (
                  <div className="flex items-center gap-2.5"><Clock className="w-4 h-4 text-[#004AAD]" />{formatDuration(course.durationHours)} of on-demand video</div>
                )}
                <div className="flex items-center gap-2.5"><PlayCircle className="w-4 h-4 text-[#004AAD]" />{course.totalLessons} lessons</div>
                {course.certificateOffered && (
                  <div className="flex items-center gap-2.5"><Award className="w-4 h-4 text-[#B8913A]" />Certificate of completion</div>
                )}
                <div className="flex items-center gap-2.5"><MonitorSmartphone className="w-4 h-4 text-[#004AAD]" />Learn on mobile or desktop</div>
                <Link to="/refund" className="flex items-center gap-2.5 hover:text-[#004AAD]"><ShieldCheck className="w-4 h-4 text-emerald-600" />See our refund policy</Link>
              </div>
            </div>
          </aside>
        </div>

        {/* 3. Related courses */}
        {relatedCourses.length > 0 && (
          <section className="mt-16 pt-12 border-t border-[#E2E8F0]" aria-labelledby="related-heading">
            <h2 id="related-heading" className="font-display text-[24px] font-extrabold tracking-tight text-[#111827] mb-6">
              More courses in {course.category}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {relatedCourses.map((rel) => (
                <CourseCard key={rel.id} course={rel} />
              ))}
            </div>
          </section>
        )}

        {/* 4. Final call to action */}
        <section aria-label="Enroll in this course" className="mt-16 rounded-[28px] bg-gradient-to-br from-[#004AAD] via-[#5271FF] to-[#5E17EB] text-white px-6 py-10 sm:px-12 sm:py-12 flex flex-col lg:flex-row lg:items-center gap-8">
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold uppercase tracking-[0.12em] text-white/75">{enrolled ? 'Continue where you left off' : 'Start learning today'}</p>
            <h2 className="mt-2 font-display text-[26px] sm:text-[32px] font-extrabold leading-tight">{course.title}</h2>
            <p className="mt-3 text-[16px] text-white/85">
              {course.totalLessons} lessons
              {course.durationHours > 0 ? ` · ${formatDuration(course.durationHours)}` : ''}
              {course.certificateOffered ? ' · Certificate of completion' : ''}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end gap-4">
            {!enrolled && <PriceInline course={course} tone="dark" />}
            <CoursePurchaseButton course={course} label="Enroll now" variant="light" />
          </div>
        </section>
      </div>

      <StickyPurchaseBar course={course} />
    </div>
  );
};
