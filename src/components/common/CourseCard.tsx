import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Course } from '../../types';
import { Star, Heart, BookOpen, Check, ArrowUpRight, Clock, PlayCircle } from 'lucide-react';
import { useCartWishlist } from '../../context/CartWishlistContext';
import { formatDuration, calculateDiscountPercent } from '../../utils/courseUtils';
import { cdnImage, cdnSrcSet, cdnAvatar } from '../../lib/cdnImage';
import { displayInstructor } from '../../config/leadInstructor';
import { CoursePurchaseButton } from '../course/CoursePurchase';

interface CourseCardProps {
  course: Course;
  viewMode?: 'grid' | 'list';
}

/** Formats a price in INR, or "Free". */
export const formatPrice = (value: number) => (value === 0 ? 'Free' : `₹${value.toLocaleString('en-IN')}`);

/** Real rating display: only shows a score once a course actually has reviews. */
export const CourseRating: React.FC<{ course: Course; tone?: 'light' | 'dark' }> = ({ course, tone = 'light' }) => {
  if (!course.reviewCount) {
    return (
      <span
        className={`inline-flex items-center h-7 px-2.5 rounded-full text-[13px] font-semibold ${
          tone === 'dark' ? 'bg-white/15 text-white' : 'bg-[#E8EFFB] text-[#003B8B]'
        }`}
      >
        New course
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1.5 text-[15px] ${tone === 'dark' ? 'text-white' : 'text-[#111827]'}`}>
      <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
      <span className="font-semibold tabular-nums">{course.rating.toFixed(1)}</span>
      <span className={`tabular-nums ${tone === 'dark' ? 'text-white/70' : 'text-[#64748B]'}`}>
        ({course.reviewCount.toLocaleString('en-IN')})
      </span>
    </span>
  );
};

const Thumbnail: React.FC<{ course: Course; className?: string }> = ({ course, className = '' }) => {
  const [imageError, setImageError] = useState(false);
  if (imageError || !course.thumbnail) {
    return (
      <div className={`w-full h-full bg-[#E8EFFB] flex flex-col items-center justify-center text-center p-6 ${className}`}>
        <BookOpen className="w-9 h-9 text-[#004AAD] mb-2" />
        <span className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#003B8B]">{course.category}</span>
      </div>
    );
  }
  return (
    <img
      src={cdnImage(course.thumbnail, 640)}
      srcSet={cdnSrcSet(course.thumbnail, [320, 480, 640, 960])}
      sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 100vw"
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setImageError(true)}
      className={`w-full h-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.05,0.7,0.1,1)] group-hover:scale-[1.04] ${className}`}
    />
  );
};

export const CourseCard: React.FC<CourseCardProps> = ({ course, viewMode = 'grid' }) => {
  const { isInWishlist, toggleWishlist, isEnrolled } = useCartWishlist();
  const navigate = useNavigate();

  const isFavorited = isInWishlist(course.id);
  const enrolled = isEnrolled(course.id);
  const discountPercent = calculateDiscountPercent(course.price, course.originalPrice);
  const href = `/courses/${course.id}`;
  const instructor = displayInstructor(course.instructor);

  const wishlistButton = (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleWishlist(course.id, course.title);
      }}
      aria-label={isFavorited ? 'Remove from wishlist' : 'Save to wishlist'}
      aria-pressed={isFavorited}
      className="absolute top-3 right-3 w-10 h-10 rounded-full bg-white/95 shadow-sm flex items-center justify-center text-[#334155] hover:text-[#5E17EB] hover:scale-105 active:scale-95 transition"
    >
      <Heart className={`w-[18px] h-[18px] ${isFavorited ? 'fill-[#5E17EB] text-[#5E17EB]' : ''}`} />
    </button>
  );

  const priceBlock = (
    <div className="flex items-baseline gap-2 flex-wrap">
      <span className="font-display text-[22px] font-extrabold tracking-tight text-[#111827] tabular-nums">
        {formatPrice(course.price)}
      </span>
      {course.originalPrice > course.price && (
        <span className="text-[15px] text-[#94A3B8] line-through tabular-nums">₹{course.originalPrice.toLocaleString('en-IN')}</span>
      )}
      {discountPercent > 0 && (
        <span className="text-[13px] font-bold text-[#5E17EB] bg-[#F1EAFE] px-2 h-6 inline-flex items-center rounded-md">
          −{discountPercent}%
        </span>
      )}
    </div>
  );

  const instructorRow = (
    <div className="flex items-center gap-2.5 min-w-0">
      <img
        src={cdnAvatar(instructor.avatar, 32)}
        alt=""
        width={32}
        height={32}
        loading="lazy"
        referrerPolicy="no-referrer"
        className="w-8 h-8 rounded-full object-cover ring-2 ring-white shadow-sm shrink-0"
      />
      <div className="min-w-0 leading-tight">
        <div className="text-[15px] font-semibold text-[#111827] truncate">{instructor.name}</div>
        {instructor.title && <div className="text-[13px] text-[#64748B] truncate">{instructor.title}</div>}
      </div>
    </div>
  );

  const metaLine = (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-[#64748B]">
      <span className="font-semibold text-[#004AAD]">{course.level}</span>
      <span className="inline-flex items-center gap-1">
        <Clock className="w-4 h-4" /> {formatDuration(course.durationHours)}
      </span>
      <span className="inline-flex items-center gap-1">
        <PlayCircle className="w-4 h-4" /> {course.totalLessons} lessons
      </span>
    </div>
  );

  /* ----------------------------- List variant ----------------------------- */
  if (viewMode === 'list') {
    return (
      <article className="group relative grid grid-cols-1 md:grid-cols-[300px_1fr] gap-5 p-2 bg-white rounded-[24px] border border-[#E2E8F0] hover:border-transparent hover:shadow-lg transition-[box-shadow,border-color] duration-300">
        <Link to={href} className="relative block aspect-[16/10] md:aspect-auto md:h-full min-h-[190px] rounded-[18px] overflow-hidden bg-[#E8EFFB]">
          <Thumbnail course={course} />
          {wishlistButton}
        </Link>
        <div className="flex flex-col gap-3 px-3 md:px-2 pb-3 md:py-4 md:pr-5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px] font-bold uppercase tracking-[0.08em] text-[#5E17EB]">{course.category}</span>
            {course.bestseller && <span className="text-[13px] font-semibold text-[#003B8B] bg-[#E8EFFB] px-2.5 h-7 inline-flex items-center rounded-full">Bestseller</span>}
          </div>
          <Link to={href}>
            <h3 className="font-display text-[22px] md:text-[24px] font-bold leading-[1.25] tracking-tight text-[#111827] group-hover:text-[#004AAD] transition-colors">
              {course.title}
            </h3>
          </Link>
          {course.subtitle && <p className="text-[16px] leading-relaxed text-[#475569] line-clamp-2 measure">{course.subtitle}</p>}
          {metaLine}
          <div className="mt-auto pt-4 border-t border-[#EEF2F7] flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-5 flex-wrap">
              {instructorRow}
              <CourseRating course={course} />
            </div>
            <div className="flex items-center gap-4">
              {priceBlock}
              {enrolled ? (
                <button onClick={() => navigate(`/learn/${course.id}`)} className="ed-btn ed-btn-filled ed-btn-sm">
                  <Check className="w-4 h-4" /> Continue
                </button>
              ) : (
                <>
                  <Link to={href} className="ed-btn ed-btn-text ed-btn-sm">
                    View course
                  </Link>
                  <CoursePurchaseButton course={course} size="sm" />
                </>
              )}
            </div>
          </div>
        </div>
      </article>
    );
  }

  /* ----------------------------- Grid variant ----------------------------- */
  return (
    <article className="group relative h-full flex flex-col p-2 bg-white rounded-[24px] border border-[#E2E8F0] hover:border-transparent hover:shadow-lg transition-[box-shadow,border-color] duration-300">
      <Link to={href} className="relative block aspect-[16/10] rounded-[18px] overflow-hidden bg-[#E8EFFB]" tabIndex={-1} aria-hidden="true">
        <Thumbnail course={course} />
        <span className="absolute top-3 left-3 max-w-[70%] truncate h-8 px-3 inline-flex items-center rounded-full bg-white/95 text-[13px] font-semibold text-[#111827] shadow-sm">
          {course.category}
        </span>
        {enrolled && (
          <span className="absolute bottom-3 left-3 h-8 px-3 inline-flex items-center gap-1.5 rounded-full bg-[#004AAD] text-white text-[13px] font-semibold shadow">
            <Check className="w-3.5 h-3.5" /> Enrolled
          </span>
        )}
      </Link>
      {wishlistButton}

      <div className="flex-1 flex flex-col gap-3 px-3 pt-4 pb-3">
        {metaLine}
        <Link to={href} className="focus-visible:outline-none">
          <h3 className="font-display text-[21px] font-bold leading-[1.28] tracking-tight text-[#111827] line-clamp-2 group-hover:text-[#004AAD] transition-colors">
            {course.title}
          </h3>
        </Link>
        {instructorRow}

        <div className="mt-auto pt-4 border-t border-dashed border-[#E2E8F0] flex items-end justify-between gap-3">
          <div className="space-y-1.5">
            <CourseRating course={course} />
            {priceBlock}
          </div>
          {enrolled ? (
            <button
              onClick={() => navigate(`/learn/${course.id}`)}
              className="w-12 h-12 shrink-0 rounded-full bg-[#004AAD] text-white flex items-center justify-center shadow-sm"
              aria-label={`Continue ${course.title}`}
            >
              <ArrowUpRight className="w-5 h-5" />
            </button>
          ) : (
            <CoursePurchaseButton course={course} size="sm" variant="tonal" className="shrink-0 !px-4" />
          )}
        </div>
      </div>
    </article>
  );
};
