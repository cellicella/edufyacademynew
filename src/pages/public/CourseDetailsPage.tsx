import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { courseService } from '../../services/api';
import { Course } from '../../types';
import { useCartWishlist } from '../../context/CartWishlistContext';
import { calculateDiscountPercent, formatDuration } from '../../utils/courseUtils';
import { CourseCard } from '../../components/common/CourseCard';
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
} from 'lucide-react';

export const CourseDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [course, setCourse] = useState<Course | null>(null);
  const [relatedCourses, setRelatedCourses] = useState<Course[]>([]);
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
          className="inline-block px-4 py-2 text-xs font-semibold text-white bg-[#004AAD] rounded-lg"
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
  const discountPercent = calculateDiscountPercent(course.price, course.originalPrice);

  const handleEnrollClick = async () => {
    if (!course) return;
    const success = await initiateCourseEnrollment(course);
    if (success) {
      navigate(`/learn/${course.id}`);
    }
  };

  return (
    <div className="pb-24">
      {/* 1. Header / Hero Banner */}
      <section className="bg-[#111827] text-white pt-12 pb-14 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-8 space-y-4">
              {/* Unboxed breadcrumb metadata */}
              <div className="flex items-center gap-2 text-xs text-blue-300 font-medium">
                <Link to="/courses" className="hover:underline">
                  Courses
                </Link>
                <span aria-hidden="true">·</span>
                <Link to={`/courses?category=${course.categorySlug}`} className="hover:underline">
                  {course.category}
                </Link>
                <span aria-hidden="true">·</span>
                <span>{course.level}</span>
              </div>

              <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
                {course.title}
              </h1>

              <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-3xl">
                {course.subtitle}
              </p>

              {/* Course Meta strip */}
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 pt-2">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-white tabular-nums text-sm">{course.rating.toFixed(1)}</span>
                  <div className="flex items-center text-amber-400">
                    <Star className="w-4 h-4 fill-current" />
                  </div>
                  <span className="text-slate-400 tabular-nums">({course.reviewCount.toLocaleString()} reviews)</span>
                </div>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">{course.enrolledCount.toLocaleString()} students enrolled</span>
                <span aria-hidden="true">·</span>
                <span>Created by <strong className="text-white font-medium">{course.instructor.name}</strong></span>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1">
                <div className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Last updated {course.lastUpdated}</span>
                </div>
                <span aria-hidden="true">·</span>
                <div className="flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5" />
                  <span>{course.language}</span>
                </div>
                <span aria-hidden="true">·</span>
                <div className="flex items-center gap-1">
                  <Award className="w-3.5 h-3.5 text-[#5E17EB]" />
                  <span>Accredited Certificate</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Main Content Split */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Left Column: Syllabus, Outcomes, Description, Instructor */}
          <div className="lg:col-span-8 space-y-10">
            {/* What you'll learn checklist */}
            <section className="bg-white p-6 sm:p-8 rounded-xl border border-[#E2E8F0]">
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
            <section className="bg-white p-6 sm:p-8 rounded-xl border border-[#E2E8F0]">
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
                                  <span className="text-[11px] font-semibold text-[#004AAD] bg-[#EBF3FF] px-2 py-0.5 rounded">
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

            {/* Requirements & Target Audience */}
            <section className="bg-white p-6 sm:p-8 rounded-xl border border-[#E2E8F0] space-y-6">
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

            {/* Instructor Bio Box */}
            <section className="bg-white p-6 sm:p-8 rounded-xl border border-[#E2E8F0]">
              <h2 className="font-display text-xl font-bold text-[#111827] mb-4">
                Instructor
              </h2>
              <div className="flex flex-col sm:flex-row items-start gap-4">
                <img
                  src={course.instructor.avatar}
                  alt={course.instructor.name}
                  referrerPolicy="no-referrer"
                  className="w-16 h-16 rounded-full object-cover border border-[#E2E8F0]"
                />
                <div className="space-y-1.5 flex-1">
                  <h3 className="font-display text-base font-bold text-[#111827]">
                    {course.instructor.name}
                  </h3>
                  <div className="text-xs text-[#004AAD] font-semibold">{course.instructor.title}</div>
                  <div className="flex items-center gap-3 text-xs text-[#64748B] pt-1">
                    <span className="tabular-nums font-medium">{course.instructor.rating} Rating</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums font-medium">{course.instructor.totalStudents.toLocaleString()} Students</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums font-medium">{course.instructor.coursesCount} Courses</span>
                  </div>
                  <p className="text-xs text-[#64748B] pt-2 leading-relaxed">
                    {course.instructor.bio}
                  </p>
                </div>
              </div>
            </section>

            {/* Reviews Section */}
            <section className="bg-white p-6 sm:p-8 rounded-xl border border-[#E2E8F0] space-y-6">
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
                            <div className="text-[11px] text-[#64748B]">{rev.date}</div>
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
          </div>

          {/* Right Column: Sticky Enrollment Box */}
          <div className="lg:col-span-4 lg:sticky lg:top-24 space-y-4">
            <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-lg p-6 space-y-5">
              {/* Thumbnail Container */}
              <div className="aspect-[16/9] w-full rounded-lg overflow-hidden bg-slate-900 relative">
                <img
                  src={course.thumbnail}
                  alt={course.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-white/90 text-[#004AAD] flex items-center justify-center shadow-md">
                    <PlayCircle className="w-6 h-6 fill-current" />
                  </div>
                </div>
              </div>

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
                <div className="text-[11px] text-[#5E17EB] font-semibold mt-1">
                  Guaranteed lifetime access to all future lectures
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2.5">
                {enrolled ? (
                  <button
                    onClick={() => navigate(`/learn/${course.id}`)}
                    className="w-full py-3.5 px-4 text-sm font-bold text-white bg-[#004AAD] hover:bg-[#003B8B] rounded-xl shadow transition-colors flex items-center justify-center gap-2"
                  >
                    <span>Resume Course Player</span>
                    <PlayCircle className="w-4 h-4" />
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleEnrollClick}
                      disabled={isProcessingPayment}
                      className="w-full py-3.5 px-4 text-sm font-bold text-white bg-[#004AAD] hover:bg-[#003B8B] disabled:opacity-75 disabled:cursor-not-allowed rounded-xl shadow transition-colors flex items-center justify-center gap-2"
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
      </div>
    </div>
  );
};
