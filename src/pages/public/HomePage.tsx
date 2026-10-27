import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { courseService, instructorService, adminService } from '../../services/api';
import { Course, Instructor } from '../../types';
import { CourseCard } from '../../components/common/CourseCard';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import {
  Search,
  ArrowRight,
  ShieldCheck,
  Award,
  Video,
  FileCode2,
  Users,
  Star,
  CheckCircle,
  Briefcase,
  Cpu,
  Palette,
  Cloud,
  ChevronRight,
  Sparkles,
  BookOpen,
  Laptop,
  Play,
  TrendingUp,
} from 'lucide-react';

export const HomePage: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [selectedCategoryTab, setSelectedCategoryTab] = useState<string>('all');
  const [heroSearch, setHeroSearch] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    Promise.all([
      courseService.getAllCourses(),
      instructorService.getAllInstructors(),
      courseService.getCategories(),
      adminService.getPlatformAnalytics(),
    ])
      .then(([allCourses, allInstructors, allCategories, stats]) => {
        setCourses(allCourses);
        setInstructors(allInstructors);
        setCategories(allCategories);
        setAnalytics(stats);
      })
      .finally(() => setLoading(false));

    // Fetch verified reviews from database
    if (isSupabaseConfigured) {
      supabase
        .from('reviews')
        .select('*, profiles(full_name, avatar_url), courses(title)')
        .limit(3)
        .then(({ data }) => {
          if (data && data.length > 0) {
            setReviews(
              data.map((r: any) => ({
                id: r.id,
                quote: r.comment,
                author: r.profiles?.full_name || 'Verified Graduate',
                course: r.courses?.title || 'Edufy Masterclass',
                rating: r.rating || 5,
              }))
            );
          }
        });
    }
  }, []);

  const handleHeroSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (heroSearch.trim()) {
      navigate(`/courses?search=${encodeURIComponent(heroSearch.trim())}`);
    } else {
      navigate('/courses');
    }
  };

  const trendingCourses = courses.filter((c) => {
    if (selectedCategoryTab === 'all') return c.trending || c.bestseller || c.rating >= 4.8;
    return c.categorySlug === selectedCategoryTab;
  });

  const bestSellingCourses = courses.filter((c) => c.bestseller || c.featured);
  const featuredCourse = courses.find((c) => c.featured) || courses[0];

  const categoryIcons: Record<string, React.ReactNode> = {
    'web-development': <FileCode2 className="w-5 h-5 text-[#004AAD]" />,
    'ai-data-science': <Cpu className="w-5 h-5 text-[#5E17EB]" />,
    'ui-ux-design': <Palette className="w-5 h-5 text-[#5271FF]" />,
    'cloud-devops': <Cloud className="w-5 h-5 text-[#004AAD]" />,
    'business-leadership': <Briefcase className="w-5 h-5 text-[#5E17EB]" />,
    'cybersecurity': <ShieldCheck className="w-5 h-5 text-emerald-600" />,
  };

  return (
    <div className="space-y-16 sm:space-y-24 pb-20 overflow-x-hidden">
      {/* 1. Hero Section */}
      <section className="relative bg-white border-b border-[#E2E8F0] pt-10 sm:pt-16 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-edufy-dots opacity-40 pointer-events-none" />
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#5271FF]/10 rounded-full blur-3xl pointer-events-none animate-pulse-glow" />
        <div className="absolute top-1/2 -right-32 w-[30rem] h-[30rem] bg-[#5E17EB]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Column */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="lg:col-span-7 space-y-6"
            >
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-[#EBF3FF] border border-[#5271FF]/30 rounded-lg text-xs font-semibold text-[#004AAD] tracking-wide shadow-xs">
                <Sparkles className="w-3.5 h-3.5 text-[#5271FF]" />
                <span>Next-Generation Online Learning Platform</span>
                <span className="hidden sm:inline text-slate-400">·</span>
                <span className="hidden sm:inline text-slate-600 font-medium">Industry-Vetted Curriculum</span>
              </div>

              <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold text-[#111827] tracking-tight leading-[1.1] text-balance">
                Master high-impact skills with world-class engineers.
              </h1>

              <p className="text-base sm:text-lg text-[#64748B] leading-relaxed max-w-2xl">
                Advance your technology career with comprehensive, project-based courses taught by senior architects from Google, Stanford, and leading tech labs.
              </p>

              {/* Prominent Course Search Bar */}
              <form onSubmit={handleHeroSearch} className="max-w-xl flex flex-col sm:flex-row gap-2.5 pt-2">
                <div className="relative flex-1 group">
                  <input
                    type="text"
                    value={heroSearch}
                    onChange={(e) => setHeroSearch(e.target.value)}
                    placeholder="What do you want to learn today? (e.g., React 19, TypeScript, Figma)"
                    className="w-full pl-11 pr-4 py-3.5 text-sm bg-[#F7F9FC] border border-[#E2E8F0] rounded-xl focus:outline-none focus:border-[#004AAD] focus:ring-4 focus:ring-[#004AAD]/15 text-[#111827] placeholder-[#64748B] transition-all shadow-xs"
                  />
                  <Search className="w-5 h-5 text-[#64748B] group-focus-within:text-[#004AAD] transition-colors absolute left-3.5 top-4" />
                </div>
                <button
                  type="submit"
                  className="px-6 py-3.5 text-sm font-semibold text-white bg-[#004AAD] hover:bg-[#003B8B] rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 whitespace-nowrap active:scale-[0.98]"
                >
                  <span>Explore Courses</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </button>
              </form>

              {/* Trust Indicators */}
              <div className="pt-2 flex flex-wrap items-center gap-6 text-xs text-[#64748B]">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Verified Completion Certificates</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-[#004AAD] shrink-0" />
                  <span>30-Day Money-Back Guarantee</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-[#5E17EB] shrink-0" />
                  <span>Lifetime Project Code Access</span>
                </div>
              </div>
            </motion.div>

            {/* Right Column: Hero Visual Showcase */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.15, ease: 'easeOut' }}
              className="lg:col-span-5 relative"
            >
              <div className="relative rounded-2xl overflow-hidden border border-[#E2E8F0] shadow-2xl min-h-[460px] flex flex-col justify-between group">
                <img
                  src={
                    featuredCourse?.thumbnail ||
                    'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1000&auto=format&fit=crop&q=80'
                  }
                  alt={featuredCourse?.title || 'Edufy Academy tech students collaborating'}
                  loading="eager"
                  className="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 ease-out"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-[#004AAD]/95 via-[#004AAD]/80 to-[#5E17EB]/75 backdrop-blur-[2px]" />
                <div className="absolute inset-0 bg-edufy-dots opacity-20" />

                <div className="relative z-10 p-7 text-white space-y-4">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 backdrop-blur-md rounded-lg text-xs font-semibold uppercase tracking-wider text-white border border-white/25 shadow-xs">
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>Featured Masterclass</span>
                  </div>
                  <h3 className="font-display text-2xl sm:text-3xl font-extrabold leading-tight drop-shadow-xs">
                    {featuredCourse?.title || 'Advanced Full-Stack Engineering'}
                  </h3>
                  <p className="text-xs sm:text-sm text-blue-100 leading-relaxed max-w-sm">
                    {featuredCourse
                      ? `Taught by ${featuredCourse.instructor.name}. ${featuredCourse.subtitle}`
                      : 'Master enterprise patterns, distributed architecture, and resilient production code.'}
                  </p>
                </div>

                <div className="relative z-10 p-6 pt-0">
                  <div className="bg-white/15 backdrop-blur-md border border-white/25 rounded-xl p-4 flex items-center justify-between shadow-lg">
                    <div className="space-y-0.5">
                      <div className="text-[11px] font-semibold text-blue-200 uppercase tracking-wider flex items-center gap-1">
                        <Video className="w-3.5 h-3.5" />
                        <span>Interactive Curriculum</span>
                      </div>
                      <div className="text-xs sm:text-sm font-bold text-white">
                        {featuredCourse
                          ? `${featuredCourse.totalLessons} Lessons · Verifiable Certificate`
                          : 'Hands-on Projects & Assessment Quizzes'}
                      </div>
                    </div>
                    {featuredCourse && (
                      <Link
                        to={`/courses/${featuredCourse.slug || featuredCourse.id}`}
                        className="px-3.5 py-2 text-xs font-semibold text-[#004AAD] bg-white rounded-lg hover:bg-blue-50 transition-colors shadow-xs shrink-0 flex items-center gap-1.5"
                      >
                        <span>Syllabus</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* KPI Strip */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-14 pt-10 border-t border-[#E2E8F0] grid grid-cols-2 md:grid-cols-4 gap-6 text-center"
          >
            <div className="p-3 rounded-xl hover:bg-[#F7F9FC] transition-colors">
              <div className="font-display text-3xl sm:text-4xl font-extrabold text-[#111827] tabular-nums">
                {analytics?.totalUsers ? `${analytics.totalUsers.toLocaleString()}+` : 'Active'}
              </div>
              <div className="text-xs text-[#64748B] font-medium mt-1">Platform Learners</div>
            </div>
            <div className="p-3 rounded-xl hover:bg-[#F7F9FC] transition-colors">
              <div className="font-display text-3xl sm:text-4xl font-extrabold text-[#004AAD] tabular-nums">
                {courses.length}
              </div>
              <div className="text-xs text-[#64748B] font-medium mt-1">Published Masterclasses</div>
            </div>
            <div className="p-3 rounded-xl hover:bg-[#F7F9FC] transition-colors">
              <div className="font-display text-3xl sm:text-4xl font-extrabold text-[#5E17EB] tabular-nums">
                {instructors.length}
              </div>
              <div className="text-xs text-[#64748B] font-medium mt-1">Certified Lead Mentors</div>
            </div>
            <div className="p-3 rounded-xl hover:bg-[#F7F9FC] transition-colors">
              <div className="font-display text-3xl sm:text-4xl font-extrabold text-[#111827] tabular-nums">
                100%
              </div>
              <div className="text-xs text-[#64748B] font-medium mt-1">Accredited Syllabus</div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 2. Popular Categories */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.5 }}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
      >
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#004AAD] uppercase tracking-wider mb-1">
              <Sparkles className="w-3.5 h-3.5 text-[#5271FF]" />
              <span>Specialized Disciplines</span>
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#111827]">
              Explore Top Categories
            </h2>
            <p className="text-sm text-[#64748B] mt-1">
              Curated technical domains designed to take you from foundational understanding to staff-level execution.
            </p>
          </div>
          <Link
            to="/categories"
            className="text-xs font-semibold text-[#004AAD] hover:text-[#003B8B] flex items-center gap-1 transition-colors"
          >
            <span>Browse All Categories</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {categories.map((cat) => (
            <Link
              key={cat.slug}
              to={`/courses?category=${cat.slug}`}
              className="group p-5 bg-white rounded-xl border border-[#E2E8F0] hover:border-[#004AAD]/40 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex items-start gap-4 relative overflow-hidden"
            >
              <div className="p-3 rounded-lg bg-[#F7F9FC] border border-[#E2E8F0] group-hover:bg-[#EBF3FF] group-hover:border-blue-200 group-hover:scale-105 transition-all duration-300 shrink-0">
                {categoryIcons[cat.slug] || <FileCode2 className="w-5 h-5 text-[#004AAD]" />}
              </div>
              <div className="min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-sm font-bold text-[#111827] group-hover:text-[#004AAD] transition-colors">
                    {cat.name}
                  </h3>
                  <span className="text-[11px] text-[#64748B] tabular-nums font-medium bg-[#F1F5F9] px-2 py-0.5 rounded-md group-hover:bg-[#EBF3FF] group-hover:text-[#004AAD] transition-colors">
                    {cat.courseCount} {cat.courseCount === 1 ? 'Course' : 'Courses'}
                  </span>
                </div>
                <p className="text-xs text-[#64748B] mt-1 line-clamp-1 leading-relaxed">{cat.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </motion.section>

      {/* 3. Trending Courses */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.5 }}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
      >
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#5E17EB] uppercase tracking-wider mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-[#5E17EB]" />
              <span>Learner Favorites</span>
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#111827]">
              Trending Courses
            </h2>
            <p className="text-sm text-[#64748B] mt-1">
              The highest-rated masterclasses chosen by learners this month.
            </p>
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-[#F1F5F9] rounded-lg overflow-x-auto shadow-inner">
            {[
              { id: 'all', label: 'All Fields' },
              { id: 'web-development', label: 'Web Dev' },
              { id: 'ai-data-science', label: 'AI & Data' },
              { id: 'ui-ux-design', label: 'Design' },
              { id: 'cloud-devops', label: 'Cloud' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedCategoryTab(tab.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
                  selectedCategoryTab === tab.id
                    ? 'bg-white text-[#004AAD] shadow-sm font-bold'
                    : 'text-[#64748B] hover:text-[#111827]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-[#E2E8F0] h-80 animate-pulse" />
            ))}
          </div>
        ) : trendingCourses.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-[#E2E8F0] text-center space-y-3">
            <BookOpen className="w-8 h-8 text-[#64748B] mx-auto opacity-40" />
            <h3 className="font-display text-sm font-bold text-[#111827]">No courses found in this category</h3>
            <p className="text-xs text-[#64748B]">
              Explore other categories or check back soon for newly published masterclasses.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {trendingCourses.slice(0, 3).map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        )}
      </motion.section>

      {/* 4. Best-Selling Courses Showcase */}
      {bestSellingCourses.length > 0 && (
        <section className="bg-white border-y border-[#E2E8F0] py-16 relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#004AAD] uppercase tracking-wider mb-1">
                  <Award className="w-3.5 h-3.5 text-[#004AAD]" />
                  <span>Premier Curriculum</span>
                </div>
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#111827]">
                  Best-Selling Masterclasses
                </h2>
                <p className="text-sm text-[#64748B] mt-1">
                  Field-tested by thousands of engineering squads and startup leaders.
                </p>
              </div>
              <Link
                to="/courses?sort=popular"
                className="text-xs font-semibold text-[#004AAD] hover:underline flex items-center gap-1"
              >
                <span>View All Courses</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {bestSellingCourses.slice(0, 3).map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 5. Why Learn with Edufy */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.5 }}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
      >
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#EBF3FF] border border-blue-200 rounded-lg text-xs font-semibold text-[#004AAD] mb-3">
            <Sparkles className="w-3.5 h-3.5 text-[#004AAD]" />
            <span>The Edufy Standard</span>
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#111827]">
            Why Learn with Edufy Academy?
          </h2>
          <p className="text-sm text-[#64748B] mt-2 leading-relaxed">
            We reject superficial tutorials. Every course is constructed to bridge the gap between academic theory and high-stakes production execution.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="group p-6 bg-white rounded-xl border border-[#E2E8F0] hover:border-[#004AAD]/40 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
            <div className="w-12 h-12 rounded-xl bg-[#EBF3FF] text-[#004AAD] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
              <Award className="w-6 h-6" />
            </div>
            <h3 className="font-display text-base font-bold text-[#111827] group-hover:text-[#004AAD] transition-colors">
              Cryptographically Verified Certificates
            </h3>
            <p className="text-xs text-[#64748B] mt-2 leading-relaxed">
              Earn shareable credentials with unique verification codes and cryptographic hashes that recruiters and hiring managers can verify instantly.
            </p>
          </div>

          <div className="group p-6 bg-white rounded-xl border border-[#E2E8F0] hover:border-[#5E17EB]/40 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
            <div className="w-12 h-12 rounded-xl bg-[#F4EFFF] text-[#5E17EB] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
              <Video className="w-6 h-6" />
            </div>
            <h3 className="font-display text-base font-bold text-[#111827] group-hover:text-[#5E17EB] transition-colors">
              Interactive Learning Player & Quizzes
            </h3>
            <p className="text-xs text-[#64748B] mt-2 leading-relaxed">
              Enjoy high-definition video playback with speed controls, integrated personal study notes, downloadable starter repositories, and module assessments.
            </p>
          </div>

          <div className="group p-6 bg-white rounded-xl border border-[#E2E8F0] hover:border-emerald-500/40 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="font-display text-base font-bold text-[#111827] group-hover:text-emerald-700 transition-colors">
              Mentorship from Industry Leaders
            </h3>
            <p className="text-xs text-[#64748B] mt-2 leading-relaxed">
              Learn directly from distinguished engineers, staff architects, and design directors who solve real-world scale problems daily.
            </p>
          </div>
        </div>
      </motion.section>

      {/* 6. Instructor Showcase */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#004AAD] uppercase tracking-wider mb-1">
              <Users className="w-3.5 h-3.5 text-[#004AAD]" />
              <span>World-Class Faculty</span>
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#111827]">
              Learn from Top Instructors
            </h2>
            <p className="text-sm text-[#64748B] mt-1">
              Practitioners who actively build and scale enterprise systems.
            </p>
          </div>
          <Link to="/instructors" className="text-xs font-semibold text-[#004AAD] hover:underline flex items-center gap-1">
            <span>View All Instructors</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {instructors.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-[#E2E8F0] text-center space-y-3">
            <Users className="w-8 h-8 text-[#64748B] mx-auto opacity-40" />
            <h3 className="font-display text-sm font-bold text-[#111827]">No instructors available yet</h3>
            <p className="text-xs text-[#64748B]">Instructor profiles will appear here as educators join our faculty.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {instructors.map((inst) => (
              <Link
                key={inst.id}
                to={`/instructors/${inst.id}`}
                className="group bg-white rounded-xl border border-[#E2E8F0] p-5 text-center hover:border-[#5271FF]/40 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col items-center justify-between"
              >
                <div>
                  <div className="relative mb-3 mx-auto inline-block">
                    <img
                      src={inst.avatar}
                      alt={inst.name}
                      referrerPolicy="no-referrer"
                      className="w-20 h-20 rounded-full object-cover border-2 border-[#E2E8F0] group-hover:border-[#004AAD] group-hover:scale-105 transition-all duration-300 shadow-sm"
                    />
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center text-white text-[9px] font-bold" title="Verified Instructor">
                      ✓
                    </div>
                  </div>
                  <h3 className="font-display text-sm font-bold text-[#111827] group-hover:text-[#004AAD] transition-colors">
                    {inst.name}
                  </h3>
                  <p className="text-xs text-[#64748B] mt-1 line-clamp-2 leading-snug">
                    {inst.title}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-[#E2E8F0] w-full flex items-center justify-between text-xs text-[#64748B]">
                  <div className="flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                    <span className="font-bold text-[#111827] tabular-nums">{inst.rating}</span>
                  </div>
                  <span className="tabular-nums font-medium">{inst.coursesCount} courses</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* 7. Student Testimonials */}
      <section className="relative bg-[#111827] text-white py-20 overflow-hidden">
        <div className="absolute inset-0 bg-edufy-grid-dark opacity-30 pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[40rem] h-[20rem] bg-gradient-to-b from-[#5271FF]/20 via-[#5E17EB]/10 to-transparent blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-lg text-xs font-semibold text-blue-300 border border-white/15 mb-3">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span>Verified Course Outcomes</span>
            </div>
            <h2 className="font-display text-2xl sm:text-4xl font-extrabold tracking-tight">
              Student Reviews & Accreditations
            </h2>
            <p className="text-sm text-slate-400 mt-2 leading-relaxed">
              Real feedback submitted by enrolled learners upon curriculum completion.
            </p>
          </div>

          {reviews.length === 0 ? (
            <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-10 text-center space-y-3 max-w-lg mx-auto">
              <Star className="w-8 h-8 text-amber-400 mx-auto opacity-50" />
              <h3 className="font-bold text-sm text-white">Student Reviews Awaiting Submissions</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Reviews and ratings are generated dynamically by students who complete masterclasses and evaluate syllabus quality.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {reviews.map((t, i) => (
                <div
                  key={i}
                  className="bg-slate-800/70 backdrop-blur-sm border border-slate-700/80 hover:border-[#5271FF]/50 hover:shadow-xl rounded-xl p-6 flex flex-col justify-between transition-all duration-300"
                >
                  <div>
                    <div className="flex items-center gap-1 mb-4">
                      {Array.from({ length: t.rating }).map((_, idx) => (
                        <Star key={idx} className="w-4 h-4 fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                    <p className="text-xs sm:text-sm text-slate-200 leading-relaxed italic">
                      "{t.quote}"
                    </p>
                  </div>
                  <div className="mt-6 pt-4 border-t border-slate-700">
                    <div className="font-bold text-sm text-white">{t.author}</div>
                    <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3 text-emerald-400 inline" />
                      <span>Verified Graduate · {t.course}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 8. Final Signup CTA Banner */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.5 }}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
      >
        <div className="relative overflow-hidden bg-gradient-to-r from-[#004AAD] via-[#5271FF] to-[#5E17EB] rounded-2xl p-8 sm:p-14 text-white shadow-2xl flex flex-col md:flex-row items-center justify-between gap-8 border border-blue-400/30">
          <div className="absolute -right-20 -top-20 w-80 h-80 rounded-full border border-white/15 pointer-events-none" />
          <div className="absolute -right-10 -top-10 w-60 h-60 rounded-full border border-white/10 pointer-events-none" />
          <div className="absolute -left-16 -bottom-16 w-72 h-72 rounded-full border border-white/15 pointer-events-none" />
          <div className="absolute inset-0 bg-edufy-dots opacity-15 pointer-events-none" />

          <div className="relative z-10 max-w-xl space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-md rounded-lg text-xs font-semibold uppercase tracking-wider text-white border border-white/25">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Invest in Your Craft</span>
            </div>
            <h2 className="font-display text-2xl sm:text-4xl font-extrabold text-white leading-tight">
              Start learning today. Accelerate your career forever.
            </h2>
            <p className="text-sm text-blue-100 leading-relaxed">
              Gain unlimited lifetime access to curriculum updates, high-definition lessons, and real enterprise code repositories.
            </p>
          </div>

          <div className="relative z-10 flex flex-col sm:flex-row gap-3.5 shrink-0">
            <Link
              to="/register"
              className="px-6 py-3.5 text-xs sm:text-sm font-semibold text-[#004AAD] bg-white hover:bg-blue-50 rounded-xl transition-all shadow-lg hover:shadow-xl hover:scale-[1.02] flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              <span>Create Free Account</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/courses"
              className="px-6 py-3.5 text-xs sm:text-sm font-semibold text-white bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-xl transition-all border border-white/30 flex items-center justify-center hover:scale-[1.02] active:scale-[0.98]"
            >
              Browse All Courses
            </Link>
          </div>
        </div>
      </motion.section>
    </div>
  );
};
