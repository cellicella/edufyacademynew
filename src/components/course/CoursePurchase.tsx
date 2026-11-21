import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Loader2, PlayCircle } from 'lucide-react';
import { Course } from '../../types';
import { useCartWishlist } from '../../context/CartWishlistContext';
import { calculateDiscountPercent } from '../../utils/courseUtils';

/* -------------------------------------------------------------------------------------------------
 * Purchase calls-to-action. Every button uses the existing enrollment flow (CartWishlistContext →
 * initiateCourseEnrollment: sign-in check, server order, Razorpay checkout, server verification, free
 * enrollment). Enrolled students see "Continue learning"; free courses show "Enroll for free".
 * ---------------------------------------------------------------------------------------------- */

type PurchaseCourse = Pick<Course, 'id' | 'title' | 'price' | 'originalPrice'> & { isFree?: boolean };

export const isFreeCourse = (c: PurchaseCourse) => c.price <= 0 || !!c.isFree;
const inr = (v: number) => `₹${v.toLocaleString('en-IN')}`;

export function useCoursePurchase(course: PurchaseCourse) {
  const { initiateCourseEnrollment, isEnrolled, isProcessingPayment } = useCartWishlist();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const enrolled = isEnrolled(course.id);
  const free = isFreeCourse(course);

  const run = useCallback(async () => {
    if (enrolled) {
      navigate(`/learn/${course.id}`);
      return;
    }
    setBusy(true);
    try {
      const ok = await initiateCourseEnrollment(course);
      if (ok) navigate(`/learn/${course.id}`);
    } finally {
      setBusy(false);
    }
  }, [enrolled, course, initiateCourseEnrollment, navigate]);

  return { enrolled, free, busy: busy && isProcessingPayment, disabled: isProcessingPayment, run };
}

/** Current price, original price (struck through) and discount, from the existing course data only. */
export const PriceInline: React.FC<{ course: PurchaseCourse; size?: 'sm' | 'md'; tone?: 'light' | 'dark' }> = ({ course, size = 'md', tone = 'light' }) => {
  const free = isFreeCourse(course);
  const discount = free ? 0 : calculateDiscountPercent(course.price, course.originalPrice);
  return (
    <span className="inline-flex items-baseline gap-2 flex-wrap">
      <span className={`font-display font-extrabold tabular-nums ${size === 'sm' ? 'text-[19px]' : 'text-[24px]'} ${tone === 'dark' ? 'text-white' : 'text-[#111827]'}`}>
        {free ? 'Free' : inr(course.price)}
      </span>
      {!free && course.originalPrice > course.price && (
        <span className={`line-through tabular-nums ${size === 'sm' ? 'text-[13px]' : 'text-[15px]'} ${tone === 'dark' ? 'text-white/60' : 'text-[#94A3B8]'}`}>
          <span className="sr-only">Original price </span>
          {inr(course.originalPrice)}
        </span>
      )}
      {discount > 0 && (
        <span className={`text-[12px] font-bold px-1.5 h-5 inline-flex items-center rounded ${tone === 'dark' ? 'bg-white/15 text-white' : 'bg-emerald-50 text-emerald-700'}`}>
          {discount}% OFF
        </span>
      )}
    </span>
  );
};

interface ButtonProps {
  course: PurchaseCourse;
  /** Wording for paid courses. */
  label?: 'Buy now' | 'Enroll now' | 'Start learning today';
  size?: 'sm' | 'md';
  variant?: 'filled' | 'tonal' | 'light';
  fullWidth?: boolean;
  className?: string;
  /** Set on the main course-page CTA so the sticky bar can tell when it is on screen. */
  buttonRef?: React.Ref<HTMLButtonElement>;
}

export const CoursePurchaseButton: React.FC<ButtonProps> = ({ course, label = 'Buy now', size = 'md', variant = 'filled', fullWidth, className = '', buttonRef }) => {
  const p = useCoursePurchase(course);
  const text = p.enrolled ? 'Continue learning' : p.busy ? 'Processing…' : p.free ? 'Enroll for free' : label;
  const look =
    variant === 'filled'
      ? 'ed-btn-filled'
      : variant === 'tonal'
        ? 'ed-btn-tonal'
        : 'bg-white text-[#004AAD] hover:bg-[#F1F5FF]';
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        p.run();
      }}
      disabled={p.disabled && !p.enrolled}
      aria-label={`${text}: ${course.title}`}
      className={`ed-btn ${size === 'sm' ? 'ed-btn-sm' : ''} ${look} ${fullWidth ? 'w-full justify-center' : ''} disabled:opacity-70 disabled:cursor-not-allowed ${className}`}
    >
      {p.busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
      <span>{text}</span>
      {!p.busy && (p.enrolled ? <PlayCircle className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />)}
    </button>
  );
};

/** Compact call-to-action band placed between course-page sections. */
export const CtaStrip: React.FC<{ course: PurchaseCourse; heading: string; text?: string }> = ({ course, heading, text }) => {
  const { enrolled } = useCoursePurchase(course);
  return (
    <div className="rounded-2xl border border-[#D6E2F8] bg-gradient-to-r from-[#F1F5FF] to-[#F5F0FF] px-5 py-4 sm:px-6 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
      <div className="flex-1 min-w-0">
        <div className="font-display text-[16px] font-bold text-[#111827]">{enrolled ? 'You’re enrolled in this course' : heading}</div>
        {!enrolled && text && <div className="text-[14px] text-[#475569] mt-0.5">{text}</div>}
      </div>
      <div className="flex items-center gap-4 flex-wrap">
        {!enrolled && <PriceInline course={course} size="sm" />}
        <CoursePurchaseButton course={course} size="sm" />
      </div>
    </div>
  );
};

/**
 * Bottom purchase bar.
 *  - Mobile/tablet (< 1024 px): always shown on the course page, compact, above the safe area.
 *  - Desktop: slides in only when `desktopVisible` (the main purchase buttons are off screen).
 * While it is visible, its height is published as --ed-bottom-bar so the page, footer, WhatsApp button,
 * toasts and live chat move up instead of being covered.
 */
export const StickyPurchaseBar: React.FC<{ course: PurchaseCourse; desktopVisible: boolean }> = ({ course, desktopVisible }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const on = () => setIsDesktop(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  const shown = !isDesktop || desktopVisible;

  useEffect(() => {
    const root = document.documentElement;
    const el = ref.current;
    if (!shown || !el) {
      root.style.removeProperty('--ed-bottom-bar');
      delete root.dataset.bottomBar;
      return;
    }
    const apply = () => root.style.setProperty('--ed-bottom-bar', `${Math.ceil(el.getBoundingClientRect().height)}px`);
    apply();
    root.dataset.bottomBar = '1';
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty('--ed-bottom-bar');
      delete root.dataset.bottomBar;
    };
  }, [shown]);

  return (
    <div
      ref={ref}
      role="region"
      aria-label="Course purchase"
      inert={!shown}
      className={`fixed inset-x-0 bottom-0 z-40 bg-white/95 backdrop-blur border-t border-[#E2E8F0] shadow-[0_-6px_24px_-12px_rgba(17,24,39,0.25)] transition-transform duration-300 ease-out ${
        shown ? 'translate-y-0' : 'translate-y-full pointer-events-none'
      }`}
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      <div className="max-w-[1280px] mx-auto px-4 sm:px-8 pt-3 flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="hidden lg:block text-[14px] font-semibold text-[#111827] truncate">{course.title}</div>
          <PriceInline course={course} size="sm" />
        </div>
        <CoursePurchaseButton course={course} size="sm" className="shrink-0" />
      </div>
    </div>
  );
};
