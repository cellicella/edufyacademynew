import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { courseService, instructorService } from '../../services/api';
import { Course, Instructor } from '../../types';
import { CourseCard, CourseRating, formatPrice } from '../../components/common/CourseCard';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { WebsiteBanners } from '../../components/site/WebsiteBanners';
import { formatDuration } from '../../utils/courseUtils';
import {
  Search,
  ArrowRight,
  ArrowUpRight,
  ShieldCheck,
  Hammer,
  Infinity as InfinityIcon,
  Star,
  Quote,
  Clock,
  PlayCircle,
  GraduationCap,
} from 'lucide-react';
import { cdnAvatar, cdnImage, cdnSrcSet } from '../../lib/cdnImage';
import { displayInstructor } from '../../config/leadInstructor';
import { CoursePurchaseButton } from '../../components/course/CoursePurchase';

/* Authentic educational photography (Unsplash) */
const PHOTOS = {
  heroMain: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1400&auto=format&fit=crop&q=80',
  heroSecondary: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=800&auto=format&fit=crop&q=80',
  career: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=1400&auto=format&fit=crop&q=80',
  teach: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=1200&auto=format&fit=crop&q=80',
};

const LEVEL_ORDER: Record<string, number> = { Beginner: 0, 'All Levels': 1, Intermediate: 2, Advanced: 3 };

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  courseCount: number;
}

interface Review {
  id: string;
  quote: string;
  author: string;
  avatar?: string;
  course: string;
  rating: number;
}

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.6, ease: [0.05, 0.7, 0.1, 1] as any },
};

const SectionHeader: React.FC<{
  index: string;
  eyebrow: string;
  title: React.ReactNode;
  lead?: string;
  action?: React.ReactNode;
  light?: boolean;
}> = ({ index, eyebrow, title, lead, action, light }) => (
  <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-12">
    <div className="max-w-3xl">
      <div className={`flex items-center gap-4 mb-5 ${light ? 'text-[#A5B8FF]' : ''}`}>
        <span className={`font-display text-[15px] font-bold tabular-nums ${light ? 'text-white/50' : 'text-[#94A3B8]'}`}>{index}</span>
        <span className={`ed-eyebrow ${light ? '!text-[#A5B8FF]' : ''}`}>{eyebrow}</span>
      </div>
      <h2 className={`ed-display text-[2.125rem] sm:text-[2.75rem] leading-[1.1] ${light ? '!text-white' : ''}`}>{title}</h2>
      {lead && <p className={`mt-5 text-[18px] sm:text-[19px] leading-[1.7] measure ${light ? 'text-white/70' : 'text-[#475569]'}`}>{lead}</p>}
    </div>
    {action}
  </div>
);

const SafeImage: React.FC<React.ImgHTMLAttributes<HTMLImageElement>> = ({ className = '', ...props }) => {
  const [failed, setFailed] = useState(false);
  if (failed) return <div className={`bg-[#E8EFFB] ${className}`} aria-hidden="true" />;
  return <img {...props} className={className} onError={() => setFailed(true)} />;
};

export const HomePage: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [heroSearch, setHeroSearch] = useState('');
  const [activePath, setActivePath] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    Promise.all([courseService.getAllCourses(), instructorService.getAllInstructors(), courseService.getCategories()])
      .then(([allCourses, allInstructors, allCategories]) => {
        setCourses(allCourses);
        setInstructors(allInstructors);
        setCategories(allCategories as Category[]);
      })
      .finally(() => setLoading(false));

    // Genuine learner reviews from the database only
    if (isSupabaseConfigured) {
      supabase
        .from('reviews')
        .select('*, profiles(full_name, avatar_url), courses(title)')
        .order('created_at', { ascending: false })
        .limit(3)
        .then(({ data }) => {
          if (data && data.length > 0) {
            setReviews(
              data.map((r: any) => ({
                id: r.id,
                quote: r.comment,
                author: r.profiles?.full_name || 'Edufy learner',
                avatar: r.profiles?.avatar_url,
                course: r.courses?.title || '',
                rating: r.rating || 0,
              }))
            );
          }
        });
    }
  }, []);

  const handleHeroSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = heroSearch.trim();
    navigate(q ? `/courses?search=${encodeURIComponent(q)}` : '/courses');
  };

  /* ------------------------------ Derived data ------------------------------ */
  const featuredCourse = useMemo(() => courses.find((c) => c.featured) || courses.find((c) => c.bestseller) || courses[0], [courses]);

  const editorsPicks = useMemo(() => {
    const picked = courses.filter((c) => c.featured || c.bestseller);
    const rest = [...courses].sort((a, b) => b.enrolledCount - a.enrolledCount);
    const merged = [...picked, ...rest.filter((c) => !picked.includes(c))];
    return merged.slice(0, 4);
  }, [courses]);

  const railCourses = useMemo(() => {
    const trending = courses.filter((c) => c.trending || c.newlyAdded);
    const pool = trending.length >= 3 ? trending : courses;
    return pool.filter((c) => c.id !== editorsPicks[0]?.id).slice(0, 8);
  }, [courses, editorsPicks]);

  const learningPaths = useMemo(() => {
    return categories
      .map((cat) => ({
        ...cat,
        steps: courses
          .filter((c) => c.categorySlug === cat.slug)
          .sort((a, b) => (LEVEL_ORDER[a.level] ?? 1) - (LEVEL_ORDER[b.level] ?? 1))
          .slice(0, 4),
      }))
      .filter((p) => p.steps.length >= 2)
      .slice(0, 4);
  }, [categories, courses]);

  useEffect(() => {
    if (!activePath && learningPaths.length > 0) setActivePath(learningPaths[0].slug);
  }, [learningPaths, activePath]);

  const currentPath = learningPaths.find((p) => p.slug === activePath) || learningPaths[0];

  const spotlightInstructors = useMemo(
    () => [...instructors].sort((a, b) => b.totalStudents - a.totalStudents || b.coursesCount - a.coursesCount).slice(0, 5),
    [instructors]
  );

  const liveCategories = categories.filter((c) => c.courseCount > 0);
  const suggestionChips = (liveCategories.length ? liveCategories : categories).slice(0, 4);

  return (
    <div className="bg-[#F7F9FC] overflow-x-hidden">
      {/* Admin-managed banners (Settings → Website banners); renders nothing when none are live */}
      <WebsiteBanners />
      {/* ================================================================
          HERO — asymmetric editorial composition
         ================================================================ */}
      <section className="relative">
        <div className="max-w-[1280px] mx-auto px-5 sm:px-8 pt-10 sm:pt-16 pb-20 lg:pb-28">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-10 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.05, 0.7, 0.1, 1] }}
              className="lg:col-span-6 xl:col-span-6"
            >
              <span className="ed-eyebrow">Edufy Academy</span>
              <h1 className="ed-display mt-6 text-[2.75rem] sm:text-[3.5rem] xl:text-[4.25rem] leading-[1.04]">
                Skills that move your{' '}
                <span className="relative inline-block text-[#004AAD]">
                  career forward
                  <svg className="absolute left-0 -bottom-2 w-full h-3 text-[#5271FF]/45" viewBox="0 0 300 12" preserveAspectRatio="none" aria-hidden="true">
                    <path d="M2 9 C 80 3, 200 3, 298 8" stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round" />
                  </svg>
                </span>
                .
              </h1>
              <p className="mt-7 text-[19px] sm:text-[20px] leading-[1.7] text-[#475569] max-w-xl">
                Practical, project-based courses in technology and modern work — taught by practitioners and backed by a
                certificate anyone can verify.
              </p>

              <form onSubmit={handleHeroSearch} className="mt-9 max-w-xl">
                <label htmlFor="hero-search" className="sr-only">
                  Search courses
                </label>
                <div className="relative flex items-center bg-white rounded-[20px] shadow-md border border-[#E2E8F0] focus-within:border-[#004AAD] focus-within:ring-4 focus-within:ring-[#004AAD]/10 transition">
                  <Search className="absolute left-5 w-6 h-6 text-[#64748B]" />
                  <input
                    id="hero-search"
                    type="text"
                    value={heroSearch}
                    onChange={(e) => setHeroSearch(e.target.value)}
                    placeholder="Try “React”, “Figma” or “AWS”"
                    className="flex-1 min-w-0 h-[68px] pl-14 pr-3 bg-transparent text-[18px] text-[#111827] placeholder-[#94A3B8] focus:outline-none"
                  />
                  <button type="submit" className="ed-btn ed-btn-filled mr-2 !h-[52px]">
                    <span className="hidden sm:inline">Search</span>
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </form>

              {suggestionChips.length > 0 && (
                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <span className="text-[15px] text-[#64748B] mr-1">Popular:</span>
                  {suggestionChips.map((c) => (
                    <Link key={c.slug} to={`/courses?category=${c.slug}`} className="ed-chip">
                      {c.name}
                    </Link>
                  ))}
                </div>
              )}

              <div className="mt-10 flex flex-wrap gap-3">
                <Link to="/courses" className="ed-btn ed-btn-filled">
                  Explore all courses <ArrowRight className="w-5 h-5" />
                </Link>
                <Link to="/become-instructor" className="ed-btn ed-btn-outlined">
                  Teach on Edufy
                </Link>
              </div>
            </motion.div>

            {/* Photographic composition */}
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.9, delay: 0.1, ease: [0.05, 0.7, 0.1, 1] }}
              className="lg:col-span-6 relative"
            >
              <div className="relative ml-auto w-full max-w-[600px]">
                <div className="relative aspect-[4/5] sm:aspect-[5/5] lg:aspect-[4/5] rounded-[32px] overflow-hidden bg-[#E8EFFB] shadow-xl">
                  <SafeImage src={PHOTOS.heroMain} alt="Learners collaborating around a laptop" loading="eager" className="w-full h-full object-cover" />
                  <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#111827]/35 to-transparent" />
                </div>

                <div className="hidden sm:block absolute -left-10 lg:-left-16 top-10 w-40 lg:w-48 aspect-[3/4] rounded-[24px] overflow-hidden border-[6px] border-[#F7F9FC] shadow-lg bg-[#E8EFFB]">
                  <SafeImage src={PHOTOS.heroSecondary} alt="A learner studying at her desk" className="w-full h-full object-cover" />
                </div>

                {featuredCourse && (
                  <div className="group absolute -bottom-10 left-4 right-4 sm:left-auto sm:-right-4 lg:-right-8 sm:w-[360px] bg-white rounded-[24px] p-5 shadow-xl hover:shadow-2xl transition-shadow">
                    <Link to={`/courses/${featuredCourse.id}`} className="block">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[13px] font-bold uppercase tracking-[0.08em] text-[#5E17EB]">Featured course</span>
                        <ArrowUpRight className="w-5 h-5 text-[#94A3B8] group-hover:text-[#004AAD] group-hover:rotate-45 transition" />
                      </div>
                      <div className="font-display text-[19px] font-bold leading-snug text-[#111827] line-clamp-2">{featuredCourse.title}</div>
                      <div className="mt-2 text-[15px] text-[#64748B] truncate">{displayInstructor(featuredCourse.instructor).name}</div>
                    </Link>
                    <div className="mt-4 pt-4 border-t border-[#EEF2F7] flex items-center justify-between gap-3">
                      <div className="flex flex-col gap-1 min-w-0">
                        <CourseRating course={featuredCourse} />
                        <span className="font-display text-[18px] font-extrabold text-[#111827]">{formatPrice(featuredCourse.price)}</span>
                      </div>
                      <CoursePurchaseButton course={featuredCourse} size="sm" className="shrink-0" />
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </div>

        {/* Real catalogue facts (only from live data) */}
        {!loading && courses.length > 0 && (
          <div className="border-y border-[#E2E8F0] bg-white">
            <div className="max-w-[1280px] mx-auto px-5 sm:px-8 grid grid-cols-2 md:grid-cols-4 divide-x divide-[#E2E8F0]">
              {[
                { value: courses.length, label: 'Published courses' },
                { value: liveCategories.length, label: 'Disciplines' },
                { value: instructors.length, label: 'Expert instructors' },
                { value: courses.reduce((s, c) => s + c.totalLessons, 0), label: 'Lessons to explore' },
              ]
                .filter((s) => s.value > 0)
                .map((s) => (
                  <div key={s.label} className="py-8 px-4 sm:px-8 first:pl-0">
                    <div className="font-display text-[2.25rem] font-extrabold tracking-tight text-[#111827] tabular-nums">
                      {s.value.toLocaleString('en-IN')}
                    </div>
                    <div className="text-[16px] text-[#64748B] mt-1">{s.label}</div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </section>

      {/* ================================================================
          01 — DISCIPLINES: editorial index list
         ================================================================ */}
      <section className="max-w-[1280px] mx-auto px-5 sm:px-8 py-24 lg:py-32">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          <motion.div {...fadeUp} className="lg:col-span-4">
            <div className="lg:sticky lg:top-28">
              <div className="flex items-center gap-4 mb-5">
                <span className="font-display text-[15px] font-bold text-[#94A3B8]">01</span>
                <span className="ed-eyebrow">Disciplines</span>
              </div>
              <h2 className="ed-display text-[2.125rem] sm:text-[2.75rem] leading-[1.1]">Choose where you want to grow.</h2>
              <p className="mt-5 text-[18px] leading-[1.7] text-[#475569]">
                Each discipline is a focused curriculum — from first principles to the techniques used on real teams.
              </p>
              <Link to="/categories" className="ed-btn ed-btn-tonal mt-8">
                All categories <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </motion.div>

          <div className="lg:col-span-8">
            <ol className="border-t border-[#E2E8F0]">
              {categories.map((cat, i) => (
                <motion.li key={cat.slug} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.04 }}>
                  <Link
                    to={`/courses?category=${cat.slug}`}
                    className="group grid grid-cols-[auto_1fr_auto] items-center gap-5 sm:gap-8 py-7 px-2 sm:px-5 border-b border-[#E2E8F0] rounded-2xl hover:bg-white hover:shadow-md hover:border-transparent transition-all duration-300"
                  >
                    <span className="font-display text-[15px] font-bold text-[#94A3B8] group-hover:text-[#004AAD] tabular-nums w-7">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                        <h3 className="font-display text-[22px] sm:text-[26px] font-bold tracking-tight text-[#111827]">{cat.name}</h3>
                        <span className="text-[15px] font-medium text-[#64748B] tabular-nums">
                          {cat.courseCount > 0 ? `${cat.courseCount} ${cat.courseCount === 1 ? 'course' : 'courses'}` : 'Coming soon'}
                        </span>
                      </div>
                      <p className="mt-1.5 text-[16px] sm:text-[17px] leading-relaxed text-[#64748B]">{cat.description}</p>
                    </div>
                    <span className="w-12 h-12 rounded-full border border-[#E2E8F0] flex items-center justify-center text-[#334155] group-hover:bg-[#004AAD] group-hover:border-[#004AAD] group-hover:text-white transition-colors">
                      <ArrowUpRight className="w-5 h-5 transition-transform group-hover:rotate-45" />
                    </span>
                  </Link>
                </motion.li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ================================================================
          02 — LEARNING PATHS: built from real courses ordered by level
         ================================================================ */}
      {currentPath && (
        <section className="bg-white border-y border-[#E2E8F0]">
          <div className="max-w-[1280px] mx-auto px-5 sm:px-8 py-24 lg:py-28">
            <SectionHeader
              index="02"
              eyebrow="Learning paths"
              title={<>A clear route from first lesson to confident practice.</>}
              lead="Courses within a discipline, arranged by level, so you always know what to take next."
            />

            <div role="tablist" aria-label="Learning paths" className="inline-flex flex-wrap gap-1 p-1.5 bg-[#F1F5F9] rounded-full mb-12">
              {learningPaths.map((p) => (
                <button
                  key={p.slug}
                  role="tab"
                  aria-selected={p.slug === currentPath.slug}
                  onClick={() => setActivePath(p.slug)}
                  className={`h-11 px-5 rounded-full text-[15px] font-semibold transition-all ${
                    p.slug === currentPath.slug ? 'bg-white text-[#004AAD] shadow-sm' : 'text-[#475569] hover:text-[#111827]'
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>

            <div className="relative">
              <ol className={`grid grid-cols-1 sm:grid-cols-2 gap-8 ${currentPath.steps.length >= 4 ? 'lg:grid-cols-4' : currentPath.steps.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
                {currentPath.steps.map((course, i) => (
                  <motion.li key={course.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08, duration: 0.5 }} className="relative">
                    <Link to={`/courses/${course.id}`} className="group block">
                      <div className="aspect-[16/10] rounded-[18px] overflow-hidden bg-[#E8EFFB] mb-4">
                        <SafeImage src={cdnImage(course.thumbnail, 640)} srcSet={cdnSrcSet(course.thumbnail, [320, 480, 640, 960])} sizes="(min-width: 1024px) 33vw, 100vw" alt="" className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-700" />
                      </div>
                      <div className="text-[14px] font-semibold text-[#5E17EB]">{course.level}</div>
                      <h3 className="mt-1 font-display text-[20px] font-bold leading-snug text-[#111827] group-hover:text-[#004AAD] transition-colors line-clamp-2">
                        {course.title}
                      </h3>
                      <div className="mt-2 flex items-center gap-3 text-[15px] text-[#64748B]">
                        <span className="inline-flex items-center gap-1"><Clock className="w-4 h-4" />{formatDuration(course.durationHours)}</span>
                        <span className="inline-flex items-center gap-1"><PlayCircle className="w-4 h-4" />{course.totalLessons} lessons</span>
                      </div>
                    </Link>
                  </motion.li>
                ))}
              </ol>
            </div>

            <div className="mt-12">
              <Link to={`/courses?category=${currentPath.slug}`} className="ed-btn ed-btn-outlined">
                See every {currentPath.name} course <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ================================================================
          03 — EDITOR'S SELECTION: asymmetric feature + index
         ================================================================ */}
      {editorsPicks.length > 0 && (
        <section className="max-w-[1280px] mx-auto px-5 sm:px-8 py-24 lg:py-32">
          <SectionHeader
            index="03"
            eyebrow="Editor’s selection"
            title="Courses our learners return to."
            action={
              <Link to="/courses?sort=popular" className="ed-btn ed-btn-text">
                Browse the catalogue <ArrowRight className="w-5 h-5" />
              </Link>
            }
          />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Feature */}
            <motion.div {...fadeUp} className="lg:col-span-7">
              <Link to={`/courses/${editorsPicks[0].id}`} className="group relative block h-full min-h-[460px] rounded-[32px] overflow-hidden bg-[#111827] shadow-lg">
                <SafeImage src={cdnImage(editorsPicks[0].thumbnail, 1280)} srcSet={cdnSrcSet(editorsPicks[0].thumbnail, [640, 960, 1280])} sizes="(min-width: 1024px) 50vw, 100vw" alt="" className="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:scale-[1.03] transition-transform duration-1000" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0B1220] via-[#0B1220]/55 to-transparent" />
                <div className="relative h-full flex flex-col justify-end p-7 sm:p-10 text-white">
                  <span className="self-start h-8 px-3.5 inline-flex items-center rounded-full bg-white/15 backdrop-blur text-[13px] font-semibold">
                    {editorsPicks[0].category}
                  </span>
                  <h3 className="mt-5 font-display text-[28px] sm:text-[36px] font-extrabold leading-[1.12] tracking-tight max-w-xl">
                    {editorsPicks[0].title}
                  </h3>
                  {editorsPicks[0].subtitle && (
                    <p className="mt-4 text-[17px] sm:text-[18px] leading-relaxed text-white/80 max-w-xl line-clamp-2">{editorsPicks[0].subtitle}</p>
                  )}
                  <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
                    <div className="flex items-center gap-2.5">
                      <img src={cdnAvatar(displayInstructor(editorsPicks[0].instructor).avatar, 36)} alt="" width={36} height={36} referrerPolicy="no-referrer" className="w-9 h-9 rounded-full object-cover ring-2 ring-white/40" />
                      <span className="text-[16px] font-semibold">{displayInstructor(editorsPicks[0].instructor).name}</span>
                    </div>
                    <CourseRating course={editorsPicks[0]} tone="dark" />
                    <span className="font-display text-[22px] font-extrabold">{formatPrice(editorsPicks[0].price)}</span>
                  </div>
                </div>
              </Link>
            </motion.div>

            {/* Index of picks */}
            <div className="lg:col-span-5 flex flex-col gap-4">
              {editorsPicks.slice(1).map((course, i) => (
                <motion.div key={course.id} {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.08 * (i + 1) }}>
                  <Link
                    to={`/courses/${course.id}`}
                    className="group grid grid-cols-[120px_1fr] sm:grid-cols-[148px_1fr] gap-5 p-3 bg-white rounded-[24px] border border-[#E2E8F0] hover:border-transparent hover:shadow-lg transition-all"
                  >
                    <div className="aspect-square rounded-[18px] overflow-hidden bg-[#E8EFFB]">
                      <SafeImage src={cdnImage(course.thumbnail, 480)} srcSet={cdnSrcSet(course.thumbnail, [320, 480, 640])} sizes="(min-width: 1024px) 25vw, 50vw" alt="" className="w-full h-full object-cover group-hover:scale-[1.05] transition-transform duration-700" />
                    </div>
                    <div className="py-1 pr-2 flex flex-col min-w-0">
                      <span className="text-[13px] font-bold uppercase tracking-[0.08em] text-[#5E17EB] truncate">{course.category}</span>
                      <h3 className="mt-1.5 font-display text-[18px] sm:text-[20px] font-bold leading-snug text-[#111827] line-clamp-2 group-hover:text-[#004AAD] transition-colors">
                        {course.title}
                      </h3>
                      <div className="mt-auto pt-3 flex items-center justify-between gap-2">
                        <span className="text-[15px] text-[#64748B] truncate">{displayInstructor(course.instructor).name}</span>
                        <span className="font-display text-[17px] font-extrabold text-[#111827] shrink-0">{formatPrice(course.price)}</span>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ================================================================
          04 — NOW ENROLLING: responsive course grid
         ================================================================ */}
      {railCourses.length > 0 && (
        <section className="pb-24 lg:pb-32">
          <div className="max-w-[1280px] mx-auto px-5 sm:px-8">
            <SectionHeader
              index="04"
              eyebrow="Now enrolling"
              title="Fresh on the timetable."
              action={
                <Link to="/courses" className="ed-btn ed-btn-text">
                  View all courses <ArrowRight className="w-5 h-5" />
                </Link>
              }
            />
          </div>
          <div className="max-w-[1280px] mx-auto px-5 sm:px-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {railCourses.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ================================================================
          05 — CAREER: split composition with photography
         ================================================================ */}
      <section className="bg-white border-y border-[#E2E8F0]">
        <div className="max-w-[1280px] mx-auto px-5 sm:px-8 py-24 lg:py-32 grid grid-cols-1 lg:grid-cols-2 gap-14 lg:gap-20 items-center">
          <motion.div {...fadeUp} className="relative order-2 lg:order-1">
            <div className="aspect-[5/4] rounded-[32px] overflow-hidden bg-[#E8EFFB] shadow-lg">
              <SafeImage src={PHOTOS.career} alt="A team planning work together on a whiteboard" className="w-full h-full object-cover" />
            </div>
            <div className="absolute -bottom-6 -right-2 sm:right-8 bg-[#004AAD] text-white rounded-[22px] px-6 py-5 shadow-xl max-w-[260px]">
              <GraduationCap className="w-7 h-7 mb-2 text-[#A5B8FF]" />
              <div className="font-display text-[18px] font-bold leading-snug">Every certificate carries a public verification code.</div>
            </div>
          </motion.div>

          <motion.div {...fadeUp} className="order-1 lg:order-2">
            <div className="flex items-center gap-4 mb-5">
              <span className="font-display text-[15px] font-bold text-[#94A3B8]">05</span>
              <span className="ed-eyebrow">Built for your career</span>
            </div>
            <h2 className="ed-display text-[2.125rem] sm:text-[2.75rem] leading-[1.1]">Learning designed around the work you want to do.</h2>
            <p className="mt-5 text-[18px] sm:text-[19px] leading-[1.7] text-[#475569]">
              We focus on what employers look for: the ability to apply a skill, and proof that you can.
            </p>

            <ul className="mt-10 space-y-7">
              {[
                {
                  icon: Hammer,
                  title: 'Learn by building',
                  body: 'Lessons are organised around practical projects, quizzes and resources you can take back to your own work.',
                },
                {
                  icon: ShieldCheck,
                  title: 'Show verified proof',
                  body: 'Complete a course to earn a certificate with a unique code that employers can check on Edufy.',
                },
                {
                  icon: InfinityIcon,
                  title: 'Keep lifetime access',
                  body: 'Enrol once and return to the material whenever you need a refresher — at your own pace.',
                },
              ].map((item) => (
                <li key={item.title} className="flex gap-5">
                  <span className="w-14 h-14 shrink-0 rounded-2xl bg-[#E8EFFB] text-[#004AAD] flex items-center justify-center">
                    <item.icon className="w-6 h-6" />
                  </span>
                  <div>
                    <h3 className="font-display text-[21px] font-bold text-[#111827]">{item.title}</h3>
                    <p className="mt-1.5 text-[17px] leading-[1.7] text-[#64748B]">{item.body}</p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-10 flex flex-wrap gap-3">
              <Link to="/register" className="ed-btn ed-btn-filled">
                Create your free account
              </Link>
              <Link to="/verify-certificate" className="ed-btn ed-btn-text">
                Verify a certificate <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ================================================================
          06 — INSTRUCTOR SPOTLIGHT (ink band)
         ================================================================ */}
      {spotlightInstructors.length > 0 && (
        <section className="bg-[#0B1220] text-white">
          <div className="max-w-[1280px] mx-auto px-5 sm:px-8 py-24 lg:py-32">
            <SectionHeader
              index="06"
              eyebrow="Instructor spotlight"
              title="Taught by people who do the work."
              light
              action={
                <Link to="/instructors" className="ed-btn bg-white text-[#111827]">
                  Meet all instructors <ArrowRight className="w-5 h-5" />
                </Link>
              }
            />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
              {/* Lead instructor */}
              <motion.div {...fadeUp} className="lg:col-span-7">
                <Link to={`/instructors/${spotlightInstructors[0].id}`} className="group grid grid-cols-1 sm:grid-cols-[240px_1fr] gap-8 p-3 rounded-[32px] bg-white/[0.04] border border-white/10 hover:bg-white/[0.07] transition-colors">
                  <div className="aspect-[4/5] sm:aspect-auto sm:h-full min-h-[280px] rounded-[24px] overflow-hidden bg-white/5">
                    <SafeImage src={cdnImage(spotlightInstructors[0].avatar, 640)} alt={spotlightInstructors[0].name} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                  </div>
                  <div className="py-4 pr-4 flex flex-col">
                    <Quote className="w-9 h-9 text-[#5271FF]" />
                    <h3 className="mt-4 font-display text-[30px] font-extrabold tracking-tight">{spotlightInstructors[0].name}</h3>
                    <div className="text-[17px] text-[#A5B8FF] mt-1">{spotlightInstructors[0].title}</div>
                    {spotlightInstructors[0].bio && (
                      <p className="mt-5 text-[17px] leading-[1.75] text-white/70 line-clamp-4">{spotlightInstructors[0].bio}</p>
                    )}
                    <div className="mt-auto pt-8 flex flex-wrap gap-8">
                      <div>
                        <div className="font-display text-[28px] font-extrabold tabular-nums">{spotlightInstructors[0].coursesCount}</div>
                        <div className="text-[15px] text-white/60">{spotlightInstructors[0].coursesCount === 1 ? 'Course' : 'Courses'}</div>
                      </div>
                      {spotlightInstructors[0].totalStudents > 0 && (
                        <div>
                          <div className="font-display text-[28px] font-extrabold tabular-nums">{spotlightInstructors[0].totalStudents.toLocaleString('en-IN')}</div>
                          <div className="text-[15px] text-white/60">Learners</div>
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              </motion.div>

              {/* Other instructors */}
              <div className="lg:col-span-5">
                <ul className="divide-y divide-white/10 border-y border-white/10">
                  {spotlightInstructors.slice(1).map((inst) => (
                    <li key={inst.id}>
                      <Link to={`/instructors/${inst.id}`} className="group flex items-center gap-5 py-5 px-2">
                        <SafeImage src={cdnAvatar(inst.avatar, 64)} alt="" referrerPolicy="no-referrer" className="w-16 h-16 rounded-2xl object-cover bg-white/10" />
                        <div className="flex-1 min-w-0">
                          <div className="font-display text-[19px] font-bold truncate group-hover:text-[#A5B8FF] transition-colors">{inst.name}</div>
                          <div className="text-[15px] text-white/60 truncate">{inst.title}</div>
                        </div>
                        <span className="text-[15px] text-white/60 tabular-nums shrink-0">
                          {inst.coursesCount} {inst.coursesCount === 1 ? 'course' : 'courses'}
                        </span>
                        <ArrowUpRight className="w-5 h-5 text-white/40 group-hover:text-white group-hover:rotate-45 transition" />
                      </Link>
                    </li>
                  ))}
                  {spotlightInstructors.length === 1 && (
                    <li className="py-8 px-2 text-[17px] leading-relaxed text-white/60">
                      More instructors are joining Edufy.{' '}
                      <Link to="/become-instructor" className="text-white underline underline-offset-4">Share what you know</Link>.
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ================================================================
          07 — LEARNER STORIES (genuine reviews only)
         ================================================================ */}
      {reviews.length > 0 && (
        <section className="max-w-[1280px] mx-auto px-5 sm:px-8 py-24 lg:py-32">
          <SectionHeader index="07" eyebrow="Learner stories" title="In their own words." />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <motion.figure {...fadeUp} className="lg:col-span-7 ed-surface-raised p-8 sm:p-12 flex flex-col">
              <Quote className="w-12 h-12 text-[#004AAD]/20" />
              <blockquote className="mt-4 font-display text-[24px] sm:text-[30px] font-semibold leading-[1.4] tracking-tight text-[#111827]">
                “{reviews[0].quote}”
              </blockquote>
              <figcaption className="mt-auto pt-10 flex items-center gap-4">
                {reviews[0].avatar && <img src={cdnAvatar(reviews[0].avatar, 56)} alt="" referrerPolicy="no-referrer" className="w-14 h-14 rounded-full object-cover" />}
                <div>
                  <div className="text-[17px] font-semibold text-[#111827]">{reviews[0].author}</div>
                  {reviews[0].course && <div className="text-[15px] text-[#64748B]">{reviews[0].course}</div>}
                </div>
                <div className="ml-auto flex gap-0.5" aria-label={`${reviews[0].rating} out of 5`}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={`w-5 h-5 ${i < reviews[0].rating ? 'fill-amber-400 text-amber-400' : 'text-[#CBD5E1]'}`} />
                  ))}
                </div>
              </figcaption>
            </motion.figure>
            <div className="lg:col-span-5 flex flex-col gap-8">
              {reviews.slice(1).map((r) => (
                <motion.figure key={r.id} {...fadeUp} className="ed-surface p-7 sm:p-8 flex-1">
                  <div className="flex gap-0.5 mb-4" aria-label={`${r.rating} out of 5`}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`w-4 h-4 ${i < r.rating ? 'fill-amber-400 text-amber-400' : 'text-[#CBD5E1]'}`} />
                    ))}
                  </div>
                  <blockquote className="text-[18px] leading-[1.7] text-[#334155]">“{r.quote}”</blockquote>
                  <figcaption className="mt-6 text-[16px]">
                    <span className="font-semibold text-[#111827]">{r.author}</span>
                    {r.course && <span className="text-[#64748B]"> · {r.course}</span>}
                  </figcaption>
                </motion.figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ================================================================
          PROMOTION DUO — teach + verify
         ================================================================ */}
      <section className="max-w-[1280px] mx-auto px-5 sm:px-8 pb-24 lg:pb-32 pt-4">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <motion.div {...fadeUp} className="lg:col-span-3 relative overflow-hidden rounded-[32px] bg-[#F1EAFE] grid grid-cols-1 md:grid-cols-2">
            <div className="p-8 sm:p-12 flex flex-col">
              <span className="ed-eyebrow !text-[#5E17EB]">Teach on Edufy</span>
              <h3 className="mt-5 ed-display text-[30px] sm:text-[36px] leading-[1.12]">Turn your expertise into a course.</h3>
              <p className="mt-4 text-[17px] leading-[1.7] text-[#4B4470]">
                Build your curriculum in our course studio, then publish to learners across India and beyond.
              </p>
              <Link to="/become-instructor" className="ed-btn mt-8 self-start bg-[#5E17EB] text-white">
                Become an instructor <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
            <div className="relative min-h-[240px]">
              <SafeImage src={PHOTOS.teach} alt="An instructor teaching a class" className="absolute inset-0 w-full h-full object-cover" />
            </div>
          </motion.div>

          <motion.div {...fadeUp} className="lg:col-span-2 rounded-[32px] bg-white border border-[#E2E8F0] p-8 sm:p-12 flex flex-col">
            <span className="w-14 h-14 rounded-2xl bg-[#E8EFFB] text-[#004AAD] flex items-center justify-center">
              <ShieldCheck className="w-7 h-7" />
            </span>
            <h3 className="mt-6 ed-display text-[28px] sm:text-[32px] leading-[1.15]">Hiring an Edufy graduate?</h3>
            <p className="mt-4 text-[17px] leading-[1.7] text-[#64748B]">
              Confirm any Edufy certificate in seconds using the code printed on it.
            </p>
            <Link to="/verify-certificate" className="ed-btn ed-btn-outlined mt-auto self-start">
              Verify a certificate
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
};
