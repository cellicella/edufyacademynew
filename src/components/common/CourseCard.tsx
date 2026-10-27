import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Course } from '../../types';
import { Star, Heart, Clock, BookOpen, Check } from 'lucide-react';
import { useCartWishlist } from '../../context/CartWishlistContext';
import { formatDuration, calculateDiscountPercent } from '../../utils/courseUtils';

interface CourseCardProps {
  course: Course;
  viewMode?: 'grid' | 'list';
}

export const CourseCard: React.FC<CourseCardProps> = ({ course, viewMode = 'grid' }) => {
  const { isInWishlist, toggleWishlist, isEnrolled } = useCartWishlist();
  const [imageError, setImageError] = useState(false);
  const navigate = useNavigate();

  const isFavorited = isInWishlist(course.id);
  const enrolled = isEnrolled(course.id);
  const discountPercent = calculateDiscountPercent(course.price, course.originalPrice);

  const fallbackBackgrounds: Record<string, string> = {
    'web-development': 'from-blue-900 via-indigo-900 to-slate-900',
    'ai-data-science': 'from-purple-950 via-indigo-900 to-slate-950',
    'ui-ux-design': 'from-slate-900 via-purple-950 to-blue-950',
    'cloud-devops': 'from-sky-950 via-slate-900 to-blue-900',
    'business-leadership': 'from-slate-900 via-blue-950 to-slate-800',
    'cybersecurity': 'from-emerald-950 via-slate-900 to-indigo-950',
  };

  const gradientClass = fallbackBackgrounds[course.categorySlug] || 'from-blue-900 to-slate-900';

  if (viewMode === 'list') {
    return (
      <div className="group bg-white rounded-xl border border-[#E2E8F0] hover:border-[#5271FF]/50 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col md:flex-row">
        {/* Thumbnail Slot with resilient fallback */}
        <div className="relative md:w-72 h-48 md:h-auto shrink-0 bg-slate-900 overflow-hidden">
          {!imageError ? (
            <img
              src={course.thumbnail}
              alt={course.title}
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setImageError(true)}
              className="w-full h-full object-cover group-hover:scale-108 group-hover:brightness-105 transition-all duration-500 ease-out"
            />
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${gradientClass} flex flex-col items-center justify-center p-4 text-center text-white`}>
              <BookOpen className="w-8 h-8 text-blue-300 mb-2 opacity-80" />
              <span className="text-xs font-semibold text-blue-200 uppercase tracking-wider">{course.category}</span>
            </div>
          )}

          {/* Quick Wishlist Action */}
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleWishlist(course.id, course.title);
            }}
            aria-label={isFavorited ? 'Remove from wishlist' : 'Save to wishlist'}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm shadow flex items-center justify-center text-[#111827] hover:text-[#5E17EB] active:scale-90 transition-all"
          >
            <Heart className={`w-4 h-4 transition-transform duration-200 ${isFavorited ? 'fill-[#5E17EB] text-[#5E17EB] scale-110' : 'group-hover:scale-105'}`} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 flex-1 flex flex-col justify-between">
          <div>
            {/* Unboxed Metadata Line */}
            <div className="flex items-center gap-2 text-xs text-[#64748B] mb-2 font-medium">
              <span className="text-[#004AAD] font-semibold">{course.category}</span>
              <span aria-hidden="true">·</span>
              <span>{course.level}</span>
              {course.bestseller && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-amber-600 font-semibold">Bestseller</span>
                </>
              )}
            </div>

            <Link to={`/courses/${course.id}`} className="block">
              <h3 className="font-display text-lg font-bold text-[#111827] group-hover:text-[#004AAD] transition-colors line-clamp-2">
                {course.title}
              </h3>
            </Link>

            <p className="text-xs text-[#64748B] mt-1 line-clamp-2 leading-relaxed">
              {course.subtitle}
            </p>

            <div className="text-xs text-[#64748B] mt-2">
              Instructor: <span className="text-[#111827] font-medium">{course.instructor.name}</span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#E2E8F0] flex items-center justify-between">
            {/* Rating and Duration */}
            <div className="flex items-center gap-3 text-xs text-[#64748B]">
              <div className="flex items-center gap-1">
                <span className="font-bold text-[#111827] tabular-nums">{course.rating.toFixed(1)}</span>
                <div className="flex items-center text-amber-500">
                  <Star className="w-3.5 h-3.5 fill-current" />
                </div>
                <span className="text-[#64748B] tabular-nums">({course.reviewCount.toLocaleString()})</span>
              </div>
              <span aria-hidden="true">·</span>
              <div className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>{formatDuration(course.durationHours)}</span>
              </div>
              <span aria-hidden="true">·</span>
              <span>{course.totalLessons} lessons</span>
            </div>

            {/* Price and Action */}
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="flex items-baseline gap-1.5">
                  <span className="font-display font-bold text-lg text-[#111827] tabular-nums">
                    {course.price === 0 ? 'FREE' : `₹${course.price.toLocaleString('en-IN')}`}
                  </span>
                  {course.originalPrice > course.price && (
                    <span className="text-xs text-[#64748B] line-through tabular-nums">
                      ₹{course.originalPrice.toLocaleString('en-IN')}
                    </span>
                  )}
                </div>
                {discountPercent > 0 && (
                  <span className="text-[11px] font-semibold text-emerald-600">
                    {discountPercent}% off
                  </span>
                )}
              </div>

              {enrolled ? (
                <button
                  onClick={() => navigate(`/learn/${course.id}`)}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#004AAD] hover:bg-[#003B8B] rounded-lg transition-colors whitespace-nowrap"
                >
                  Go to Course
                </button>
              ) : (
                <Link
                  to={`/courses/${course.id}`}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#004AAD] hover:bg-[#003B8B] rounded-lg transition-colors whitespace-nowrap"
                >
                  View Details
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Grid Card View (Default)
  return (
    <div className="group bg-white rounded-xl border border-[#E2E8F0] hover:border-[#5271FF]/50 hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 overflow-hidden flex flex-col h-full">
      {/* Thumbnail Slot */}
      <div className="relative aspect-[16/10] w-full bg-slate-900 overflow-hidden">
        {!imageError ? (
          <img
            src={course.thumbnail}
            alt={course.title}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setImageError(true)}
            className="w-full h-full object-cover group-hover:scale-108 group-hover:brightness-105 transition-all duration-500 ease-out"
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${gradientClass} flex flex-col items-center justify-center p-4 text-center text-white`}>
            <BookOpen className="w-8 h-8 text-blue-300 mb-2 opacity-80" />
            <span className="text-xs font-semibold text-blue-200 uppercase tracking-wider">{course.category}</span>
          </div>
        )}

        {/* Quick Wishlist Action */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleWishlist(course.id, course.title);
          }}
          aria-label={isFavorited ? 'Remove from wishlist' : 'Save to wishlist'}
          className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm shadow flex items-center justify-center text-[#111827] hover:text-[#5E17EB] active:scale-90 transition-all"
        >
          <Heart className={`w-4 h-4 transition-transform duration-200 ${isFavorited ? 'fill-[#5E17EB] text-[#5E17EB] scale-110' : 'group-hover:scale-105'}`} />
        </button>

        {enrolled && (
          <div className="absolute bottom-2.5 left-2.5 bg-[#004AAD] text-white text-[11px] font-semibold px-2 py-0.5 rounded flex items-center gap-1 shadow-md">
            <Check className="w-3 h-3" /> Enrolled
          </div>
        )}
      </div>

      {/* Card Body */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          {/* Unboxed Metadata Line */}
          <div className="flex items-center gap-2 text-xs text-[#64748B] mb-1.5 font-medium">
            <span className="text-[#004AAD] font-semibold">{course.category}</span>
            <span aria-hidden="true">·</span>
            <span>{course.level}</span>
            {course.bestseller && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-amber-600 font-semibold">Bestseller</span>
              </>
            )}
          </div>

          <Link to={`/courses/${course.id}`} className="block">
            <h3 className="font-display text-base font-bold text-[#111827] group-hover:text-[#004AAD] transition-colors line-clamp-2 leading-snug">
              {course.title}
            </h3>
          </Link>

          <p className="text-xs text-[#64748B] mt-1.5 line-clamp-1">
            By {course.instructor.name}
          </p>
        </div>

        <div className="mt-4 pt-3 border-t border-[#E2E8F0]">
          {/* Metrics: Rating and Course Length */}
          <div className="flex items-center justify-between text-xs text-[#64748B] mb-2">
            <div className="flex items-center gap-1">
              <span className="font-bold text-[#111827] tabular-nums">{course.rating.toFixed(1)}</span>
              <div className="flex items-center text-amber-500">
                <Star className="w-3.5 h-3.5 fill-current" />
              </div>
              <span className="tabular-nums">({course.reviewCount.toLocaleString()})</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>{formatDuration(course.durationHours)}</span>
            </div>
          </div>

          {/* Pricing Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-baseline gap-1.5">
              <span className="font-display font-bold text-base text-[#111827] tabular-nums">
                {course.price === 0 ? 'FREE' : `₹${course.price.toLocaleString('en-IN')}`}
              </span>
              {course.originalPrice > course.price && (
                <span className="text-xs text-[#64748B] line-through tabular-nums">
                  ₹{course.originalPrice.toLocaleString('en-IN')}
                </span>
              )}
            </div>
            {discountPercent > 0 && (
              <span className="text-[11px] font-semibold text-emerald-600">
                {discountPercent}% off
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
