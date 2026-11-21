import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
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
  CheckCircle,
  Heart,
  PlayCircle,
  ShoppingBag,
  Lock,
  ChevronDown,
  ShieldCheck,
  Share2,
  FileText,
  Play,
  X,
} from 'lucide-react';
import { cdnImage, cdnSrcSet, cdnAvatar } from '../../lib/cdnImage';
import { CoursePurchaseButton, CtaStrip, PriceInline, StickyPurchaseBar } from '../../components/course/CoursePurchase';
import { InstructorSpotlight } from '../../components/course/InstructorSpotlight';
import { displayInstructor } from '../../config/leadInstructor';
import { useResumePurchase, useStartCoursePurchase } from '../../hooks/usePurchaseFlow';

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
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    'sec-1': true,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const navigate = useNavigate();
  const {
    isInWishlist,
    toggleWishlist,
    initiateCourseEnrollment,
    isEnrolled,
    isProcessingPayment,
    isInCart,
    addToCart,
    setIsCartOpen,
  } = useCartWishlist();

  const [courseReviews, setCourseReviews] = useState<any[]>([]);

  // Guests are sent to sign in and come back here (?enroll=1) to continue the purchase once
  const startPurchase = useStartCoursePurchase();
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
        // Expand first section by default
        if (data.curriculum[0]) {
          setExpandedSections({ [data.curriculum[0].id]: true });
        }
        // Fetch related
        courseService
          .getAllCourses({ category: data.categorySlug })
          .then((related) => {
            setRelatedCourses(related.filter((c) => c.id !== data.id).slice(0, 3));
          });
        // Fetch real reviews
        courseService.getCourseReviews(data.id).then(setCourseReviews);
      }
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center text-sm text-[#64748B]">
        Loading course curriculum...
      </div>
    );
  }

  if (!course) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center space-y-4">
        <h2 className="font-display text-2xl font-bold text-[#111827]">Course Not Found</h2>
        <p className="text-sm text-[#64748B]">The masterclass you requested could not be located in the catalog.</p>
        <Link
          to="/courses"
          className="inline-block px-4 py-2 text-sm font-semibold text-white bg-[#004AAD] rounded-full"
        >
          Return to Marketplace
        </Link>
      </div>
    );
  }

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const isFavorited = isInWishlist(course.id);
  const enrolled = isEnrolled(course.id);
  const instructor = displayInstructor(course.instructor);
  const discountPercent = calculateDiscountPercent(course.price, course.originalPrice);

  const handleEnrollClick = async () => {
    if (!course) return;
    const success = await startPurchase(course);
    if (success) {
      navigate(`/learn/${course.id}`);
    }
  };

  const hasPreview = !!resolveVideo(course.previewVideoUrl);

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
      {/* 1. Product hero — editorial, light, with framed preview */}
      <section className="relative bg-[#F7F9FC] border-b border-[#E2E8F0]">
        <div className="max-w-[1280px] mx-auto px-5 sm:px-8 pt-10 pb-14 lg:pt-14 lg:pb-20">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-[15px] text-[#64748B] mb-8">
            <Link to="/courses" className="hover:text-[#004AAD]">Courses</Link>
            <span aria-hidden="true">/</span>
            <Link to={`/courses?category=${course.categorySlug}`} className="hover:text-[#004AAD]">{course.category}</Link>
            <span aria-hidden="true">/</span>
            <span className="text-[#111827] font-medium truncate max-w-[50vw]">{course.title}</span>
          </nav>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
            <div className="lg:col-span-7">
              <div className="flex flex-wrap items-center gap-2 mb-6">
                <span className="h-8 px-3.5 inline-flex items-center rounded-full bg-[#E8EFFB] text-[14px] font-semibold text-[#003B8B]">{course.level}</span>
                {course.bestseller && <span className="h-8 px-3.5 inline-flex items-center rounded-full bg-[#F1EAFE] text-[14px] font-semibold text-[#5E17EB]">Bestseller</span>}
                {course.certificateOffered && <span className="h-8 px-3.5 inline-flex items-center gap-1.5 rounded-full bg-white border border-[#E2E8F0] text-[14px] font-medium text-[#334155]"><Award className="w-4 h-4 text-[#004AAD]" />Certificate of completion</span>}
              </div>

              <h1 className="ed-display text-[2.25rem] sm:text-[2.75rem] lg:text-[3.25rem] leading-[1.08]">{course.title}</h1>
              {course.subtitle && <p className="mt-6 text-[19px] sm:text-[20px] leading-[1.65] text-[#475569] max-w-2xl">{course.subtitle}</p>}

              <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-5">
                <div className="flex items-center gap-3">
                  <img src={cdnAvatar(instructor.avatar, 48)} alt="" width={48} height={48} referrerPolicy="no-referrer" className="w-12 h-12 rounded-full object-cover ring-2 ring-white shadow-sm" />
                  <div className="leading-tight">
                    <div className="text-[13px] text-[#64748B]">{instructor.isLead ? instructor.title : 'Instructor'}</div>
                    <div className="text-[17px] font-semibold text-[#111827]">{instructor.name}</div>
                  </div>
                </div>
                <CourseRating course={course} />
                {course.enrolledCount > 0 && (
                  <span className="text-[16px] text-[#475569] tabular-nums">{course.enrolledCount.toLocaleString('en-IN')} learners enrolled</span>
                )}
              </div>

              <dl className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-px bg-[#E2E8F0] rounded-[20px] overflow-hidden border border-[#E2E8F0]">
                {[
                  { k: 'Duration', v: formatDuration(course.durationHours), icon: Clock },
                  { k: 'Lessons', v: String(course.totalLessons), icon: PlayCircle },
                  { k: 'Language', v: course.language, icon: Globe },
                  { k: 'Updated', v: course.lastUpdated, icon: Award },
                ].map((m) => (
                  <div key={m.k} className="bg-white px-5 py-4">
                    <dt className="flex items-center gap-1.5 text-[14px] text-[#64748B]"><m.icon className="w-4 h-4" />{m.k}</dt>
                    <dd className="mt-1 font-display text-[18px] font-bold text-[#111827] truncate">{m.v}</dd>
                  </div>
                ))}
              </dl>

              {/* Purchase — top of the page */}
              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
                {!enrolled && <PriceInline course={course} />}
                <CoursePurchaseButton course={course} />
                {!enrolled && hasPreview && (
                  <button type="button" onClick={() => setPreviewOpen(true)} className="ed-btn ed-btn-outlined">
                    <Play className="w-4 h-4" /> Watch preview
                  </button>
                )}
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="ed-frame">
                <div className="ed-frame-inner relative aspect-[4/3] overflow-hidden bg-[#E8EFFB]">
                  <img src={cdnImage(course.thumbnail, 960)} srcSet={cdnSrcSet(course.thumbnail, [480, 640, 960, 1280])} sizes="(min-width: 1024px) 400px, 100vw" alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Main Content Split */}
      <div className="max-w-[1280px] mx-auto px-5 sm:px-8 mt-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Left Column: Syllabus, Outcomes, Description, Instructor */}
          <div className="lg:col-span-8 space-y-10">
            {/* What you'll learn checklist */}
            <section className="bg-white p-6 sm:p-8 rounded-2xl border border-[#E2E8F0]">
              <h2 className="font-display text-xl font-bold text-[#111827] mb-4">
                What You'll Learn
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {course.learningOutcomes.map((outcome, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-[#111827] leading-relaxed">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{outcome}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Course Curriculum Accordion */}
            <section className="bg-white p-6 sm:p-8 rounded-2xl border border-[#E2E8F0]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#E2E8F0] gap-2 mb-6">
                <div>
                  <h2 className="font-display text-xl font-bold text-[#111827]">
                    Course Curriculum
                  </h2>
                  <div className="text-xs text-[#64748B] mt-1">
                    {course.curriculum.length} modules · {course.totalLessons} lessons · {formatDuration(course.durationHours)} total length
                  </div>
                </div>
                <button
                  onClick={() => {
                    const allExpanded = Object.keys(expandedSections).length === course.curriculum.length;
                    if (allExpanded) {
                      setExpandedSections({});
                    } else {
                      const all: Record<string, boolean> = {};
                      course.curriculum.forEach((s) => (all[s.id] = true));
                      setExpandedSections(all);
                    }
                  }}
                  className="text-xs font-semibold text-[#004AAD] hover:underline self-start sm:self-auto"
                >
                  {Object.keys(expandedSections).length === course.curriculum.length
                    ? 'Collapse all sections'
                    : 'Expand all sections'}
                </button>
              </div>

              {/* Sections Accordion */}
              <div className="space-y-3">
                {course.curriculum.map((section, sIdx) => {
                  const isExpanded = !!expandedSections[section.id];
                  const totalSecMins = section.lessons.reduce((acc, l) => acc + l.durationMinutes, 0);

                  return (
                    <div
                      key={section.id}
                      className="border border-[#E2E8F0] rounded-lg overflow-hidden transition-colors"
                    >
                      <button
                        onClick={() => toggleSection(section.id)}
                        className="w-full bg-[#F8FAFC] hover:bg-[#F1F5F9] p-4 text-left flex items-center justify-between transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <ChevronDown
                            className={`w-4 h-4 text-[#64748B] transition-transform duration-200 ${
                              isExpanded ? 'rotate-180' : ''
                            }`}
                          />
                          <span className="font-display text-sm font-bold text-[#111827]">
                            {section.title}
                          </span>
                        </div>
                        <div className="text-xs text-[#64748B] tabular-nums font-medium">
                          {section.lessons.length} lessons · {totalSecMins}m
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="divide-y divide-[#E2E8F0] bg-white">
                          {section.lessons.map((lesson) => (
                            <div
                              key={lesson.id}
                              className="p-3.5 px-5 flex items-center justify-between hover:bg-[#F8FAFC] transition-colors text-xs text-[#111827]"
                            >
                              <div className="flex items-center gap-3">
                                {lesson.type === 'video' && (
                                  <PlayCircle className="w-4 h-4 text-[#004AAD] shrink-0" />
                                )}
                                {lesson.type === 'article' && (
                                  <FileText className="w-4 h-4 text-[#5271FF] shrink-0" />
                                )}
                                {lesson.type === 'quiz' && (
                                  <Award className="w-4 h-4 text-[#5E17EB] shrink-0" />
                                )}
                                <span className="font-medium">{lesson.title}</span>
                              </div>

                              <div className="flex items-center gap-4">
                                {lesson.isFreePreview && (
                                  <span className="text-[13px] font-semibold text-[#004AAD] bg-[#EBF3FF] px-2 py-0.5 rounded">
                                    Preview
                                  </span>
                                )}
                                <span className="text-[#64748B] tabular-nums">{lesson.durationMinutes}m</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            <CtaStrip
              course={course}
              heading="Ready to start learning?"
              text={`${course.totalLessons} lessons · ${formatDuration(course.durationHours)} of video · learn at your own pace`}
            />

            {/* Requirements & Target Audience */}
            <section className="bg-white p-6 sm:p-8 rounded-2xl border border-[#E2E8F0] space-y-6">
              <div>
                <h3 className="font-display text-base font-bold text-[#111827] mb-3">
                  Prerequisites
                </h3>
                <ul className="space-y-2 text-xs sm:text-sm text-[#64748B] list-disc list-inside">
                  {course.requirements.map((req, i) => (
                    <li key={i}>{req}</li>
                  ))}
                </ul>
              </div>

              <div className="pt-4 border-t border-[#E2E8F0]">
                <h3 className="font-display text-base font-bold text-[#111827] mb-3">
                  Who This Masterclass is For
                </h3>
                <ul className="space-y-2 text-xs sm:text-sm text-[#64748B] list-disc list-inside">
                  {course.targetAudience.map((aud, i) => (
                    <li key={i}>{aud}</li>
                  ))}
                </ul>
              </div>
            </section>

            {/* Instructor */}
            <InstructorSpotlight course={course} />

            {/* Reviews Section */}
            <section className="bg-white p-6 sm:p-8 rounded-2xl border border-[#E2E8F0] space-y-6">
              <h2 className="font-display text-xl font-bold text-[#111827]">
                Student Feedback & Reviews
              </h2>
              {courseReviews.length === 0 ? (
                <div className="py-6 text-center text-xs text-[#64748B] space-y-1">
                  <Star className="w-6 h-6 text-amber-400 mx-auto opacity-40" />
                  <p className="font-semibold text-[#111827]">No reviews submitted yet</p>
                  <p>Be the first enrolled student to review this masterclass upon completing your modules.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {courseReviews.map((rev) => (
                    <div key={rev.id} className="pt-4 first:pt-0 border-t first:border-0 border-[#E2E8F0] space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={rev.userAvatar}
                            alt={rev.userName}
                            referrerPolicy="no-referrer"
                            className="w-7 h-7 rounded-full object-cover"
                          />
                          <div>
                            <div className="text-xs font-bold text-[#111827]">{rev.userName}</div>
                            <div className="text-[13px] text-[#64748B]">{rev.date}</div>
                          </div>
                        </div>
                        <div className="flex items-center text-amber-500">
                          {[...Array(rev.rating)].map((_, i) => (
                            <Star key={i} className="w-3.5 h-3.5 fill-current" />
                          ))}
                        </div>
                      </div>
                      <p className="text-xs text-[#111827] leading-relaxed">
                        {rev.comment}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
            {courseReviews.length > 0 && <CtaStrip course={course} heading="Join the learners taking this course" />}
          </div>

          {/* Right Column: Sticky Enrollment Box */}
          <div className="lg:col-span-4 lg:sticky lg:top-28 space-y-4">
            <div className="bg-white rounded-[24px] border border-[#E2E8F0] shadow-lg p-6 space-y-5">
              {/* Thumbnail Container */}
              {hasPreview ? (
                <button
                  type="button"
                  onClick={() => setPreviewOpen(true)}
                  aria-label={`Play preview of ${course.title}`}
                  className="group aspect-[16/9] w-full rounded-lg overflow-hidden bg-slate-900 relative block"
                >
                  <img src={cdnImage(course.thumbnail, 960)} srcSet={cdnSrcSet(course.thumbnail, [480, 640, 960, 1280])} sizes="(min-width: 1024px) 400px, 100vw" alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                  <span className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors flex flex-col items-center justify-center gap-2">
                    <span className="w-14 h-14 rounded-full bg-white text-[#004AAD] flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                      <Play className="w-6 h-6 ml-0.5 fill-current" />
                    </span>
                    <span className="text-[14px] font-semibold text-white drop-shadow">Preview this course</span>
                  </span>
                </button>
              ) : (
                <div className="aspect-[16/9] w-full rounded-lg overflow-hidden bg-slate-900">
                  <img src={cdnImage(course.thumbnail, 960)} srcSet={cdnSrcSet(course.thumbnail, [480, 640, 960, 1280])} sizes="(min-width: 1024px) 400px, 100vw" alt={course.title} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                </div>
              )}

              {/* Price & Savings */}
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-3xl font-extrabold text-[#111827] tabular-nums">
                    {course.price === 0 ? 'FREE' : `₹${course.price.toLocaleString('en-IN')}`}
                  </span>
                  {course.originalPrice > course.price && (
                    <span className="text-sm text-[#64748B] line-through tabular-nums">
                      ₹{course.originalPrice.toLocaleString('en-IN')}
                    </span>
                  )}
                  {discountPercent > 0 && (
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                      {discountPercent}% OFF
                    </span>
                  )}
                </div>
                <div className="text-[13px] text-[#5E17EB] font-semibold mt-1">
                  Guaranteed lifetime access to all future lectures
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2.5">
                {enrolled ? (
                  <button
                    onClick={() => navigate(`/learn/${course.id}`)}
                    className="w-full py-3.5 px-4 text-sm font-bold text-white bg-[#004AAD] hover:bg-[#003B8B] rounded-full shadow transition-colors flex items-center justify-center gap-2"
                  >
                    <span>Resume Course Player</span>
                    <PlayCircle className="w-4 h-4" />
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleEnrollClick}
                      disabled={isProcessingPayment}
                      className="w-full py-3.5 px-4 text-sm font-bold text-white bg-[#004AAD] hover:bg-[#003B8B] disabled:opacity-75 disabled:cursor-not-allowed rounded-full shadow transition-colors flex items-center justify-center gap-2"
                    >
                      <span>{isProcessingPayment ? 'Processing Payment...' : 'Enroll Now'}</span>
                      <CheckCircle className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => {
                        if (isInCart(course.id)) {
                          setIsCartOpen(true);
                        } else {
                          addToCart(course);
                        }
                      }}
                      className={`w-full py-2.5 px-4 text-xs font-semibold rounded-xl border transition-colors flex items-center justify-center gap-2 ${
                        isInCart(course.id)
                          ? 'bg-[#EBF3FF] border-[#004AAD] text-[#004AAD]'
                          : 'bg-white border-[#CBD5E1] text-[#111827] hover:bg-[#F8FAFC]'
                      }`}
                    >
                      <ShoppingBag className="w-4 h-4" />
                      <span>{isInCart(course.id) ? 'View in Cart' : 'Add to Cart'}</span>
                    </button>
                  </>
                )}

                <button
                  onClick={() => toggleWishlist(course.id, course.title)}
                  className={`w-full py-2.5 px-4 text-xs font-semibold rounded-xl border transition-colors flex items-center justify-center gap-2 ${
                    isFavorited
                      ? 'bg-[#F4EFFF] border-[#5E17EB] text-[#5E17EB]'
                      : 'bg-white border-[#E2E8F0] text-[#111827] hover:bg-[#F8FAFC]'
                  }`}
                >
                  <Heart className={`w-4 h-4 ${isFavorited ? 'fill-[#5E17EB]' : ''}`} />
                  <span>{isFavorited ? 'Saved in Wishlist' : 'Add to Wishlist'}</span>
                </button>
              </div>

              {/* Guarantees and Inclusions */}
              <div className="pt-4 border-t border-[#E2E8F0] space-y-2 text-xs text-[#64748B]">
                <div className="font-bold text-[#111827] mb-1">This masterclass includes:</div>
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-[#004AAD]" />
                  <span>{formatDuration(course.durationHours)} on-demand video</span>
                </div>
                <div className="flex items-center gap-2">
                  <BookOpen className="w-3.5 h-3.5 text-[#004AAD]" />
                  <span>{course.totalLessons} practical lessons & source files</span>
                </div>
                <div className="flex items-center gap-2">
                  <Award className="w-3.5 h-3.5 text-[#5E17EB]" />
                  <span>Verified Certificate of Completion</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>30-Day Money-Back Guarantee</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Related Courses */}
        {relatedCourses.length > 0 && (
          <section className="mt-16 pt-12 border-t border-[#E2E8F0]">
            <h2 className="font-display text-2xl font-bold text-[#111827] mb-6">
              More Courses in {course.category}
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
              {course.totalLessons} lessons · {formatDuration(course.durationHours)}
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
