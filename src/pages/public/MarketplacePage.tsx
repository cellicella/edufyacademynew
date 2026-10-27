import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { courseService } from '../../services/api';
import { Course } from '../../types';
import { CourseCard } from '../../components/common/CourseCard';
import {
  Search,
  Filter,
  Grid,
  List,
  SlidersHorizontal,
  X,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

export const MarketplacePage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [mobileFilterOpen, setMobileFilterOpen] = useState<boolean>(false);

  // Filter state
  const searchQuery = searchParams.get('search') || '';
  const categoryFilter = searchParams.get('category') || 'all';
  const levelFilter = searchParams.get('level') || 'all';
  const priceFilter = searchParams.get('price') || 'all';
  const sortOption = searchParams.get('sort') || 'popular';

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 6;

  useEffect(() => {
    setLoading(true);
    courseService
      .getAllCourses({
        search: searchQuery,
        category: categoryFilter,
        level: levelFilter,
        priceFilter: priceFilter !== 'all' ? priceFilter : undefined,
        sort: sortOption,
      })
      .then((data) => {
        setCourses(data);
        setLoading(false);
      });
  }, [searchQuery, categoryFilter, levelFilter, priceFilter, sortOption]);

  const updateParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value === 'all' || !value) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    setSearchParams(params);
    setCurrentPage(1);
  };

  const resetFilters = () => {
    setSearchParams({});
    setCurrentPage(1);
  };

  const categories = [
    { id: 'all', label: 'All Categories' },
    { id: 'web-development', label: 'Web Development' },
    { id: 'ai-data-science', label: 'Artificial Intelligence' },
    { id: 'ui-ux-design', label: 'UI/UX Design' },
    { id: 'cloud-devops', label: 'Cloud & DevOps' },
    { id: 'business-leadership', label: 'Business & Leadership' },
    { id: 'cybersecurity', label: 'Cybersecurity' },
  ];

  const levels = [
    { id: 'all', label: 'All Levels' },
    { id: 'Beginner', label: 'Beginner' },
    { id: 'Intermediate', label: 'Intermediate' },
    { id: 'Advanced', label: 'Advanced' },
  ];

  const priceOptions = [
    { id: 'all', label: 'All Prices' },
    { id: 'discounted', label: 'Special Offers (Discounted)' },
    { id: 'under-35', label: 'Under $35' },
  ];

  // Pagination calculation
  const totalPages = Math.ceil(courses.length / itemsPerPage);
  const paginatedCourses = courses.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      {/* Page Header Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[#004AAD] via-[#003B8B] to-[#5E17EB] rounded-2xl p-6 sm:p-10 mb-8 text-white shadow-xl border border-blue-400/20">
        <div className="absolute inset-0 bg-edufy-dots opacity-20 pointer-events-none" />
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-white/5 blur-2xl pointer-events-none" />
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/15 backdrop-blur-md rounded-lg text-xs font-semibold text-blue-200 border border-white/20 mb-3">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Curated Technology Library</span>
          </div>
          <h1 className="font-display text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
            Explore All Masterclasses
          </h1>
          <p className="text-xs sm:text-sm text-blue-100 mt-2 leading-relaxed">
            Hands-on curriculum engineered for real-world production. Filter by domain, skill depth, or pricing to find your next career breakthrough.
          </p>
        </div>
      </div>

      {/* Main Layout: Filters Sidebar + Course Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
        {/* Desktop Sidebar Filters */}
        <aside className="hidden lg:block bg-white p-6 rounded-xl border border-[#E2E8F0] space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-[#E2E8F0]">
            <div className="flex items-center gap-2 font-bold text-sm text-[#111827]">
              <Filter className="w-4 h-4 text-[#004AAD]" />
              <span>Filters</span>
            </div>
            {(categoryFilter !== 'all' || levelFilter !== 'all' || priceFilter !== 'all' || searchQuery) && (
              <button
                onClick={resetFilters}
                className="text-xs text-[#004AAD] hover:underline flex items-center gap-1 font-medium"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
          </div>

          {/* Search within marketplace */}
          <div>
            <label className="block text-xs font-bold text-[#111827] uppercase tracking-wider mb-2">
              Keywords
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => updateParam('search', e.target.value)}
                placeholder="Filter by title or instructor..."
                className="w-full pl-8 pr-3 py-2 text-xs bg-[#F7F9FC] border border-[#E2E8F0] rounded-lg text-[#111827] focus:outline-none focus:border-[#004AAD]"
              />
              <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-2.5 top-2.5" />
            </div>
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-xs font-bold text-[#111827] uppercase tracking-wider mb-2">
              Category
            </label>
            <div className="space-y-1">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => updateParam('category', cat.id)}
                  className={`w-full text-left px-2.5 py-1.5 text-xs rounded-md transition-colors flex items-center justify-between ${
                    categoryFilter === cat.id
                      ? 'bg-[#EBF3FF] text-[#004AAD] font-semibold'
                      : 'text-[#64748B] hover:text-[#111827] hover:bg-[#F8FAFC]'
                  }`}
                >
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty Level */}
          <div>
            <label className="block text-xs font-bold text-[#111827] uppercase tracking-wider mb-2">
              Skill Level
            </label>
            <div className="space-y-1">
              {levels.map((lvl) => (
                <button
                  key={lvl.id}
                  onClick={() => updateParam('level', lvl.id)}
                  className={`w-full text-left px-2.5 py-1.5 text-xs rounded-md transition-colors flex items-center justify-between ${
                    levelFilter.toLowerCase() === lvl.id.toLowerCase()
                      ? 'bg-[#EBF3FF] text-[#004AAD] font-semibold'
                      : 'text-[#64748B] hover:text-[#111827] hover:bg-[#F8FAFC]'
                  }`}
                >
                  <span>{lvl.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Price Range */}
          <div>
            <label className="block text-xs font-bold text-[#111827] uppercase tracking-wider mb-2">
              Pricing Options
            </label>
            <div className="space-y-1">
              {priceOptions.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => updateParam('price', opt.id)}
                  className={`w-full text-left px-2.5 py-1.5 text-xs rounded-md transition-colors ${
                    priceFilter === opt.id
                      ? 'bg-[#EBF3FF] text-[#004AAD] font-semibold'
                      : 'text-[#64748B] hover:text-[#111827] hover:bg-[#F8FAFC]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Courses Area */}
        <div className="lg:col-span-3 space-y-6">
          {/* Controls Bar: Results Count, Mobile Filter Button, View Mode, Sort */}
          <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileFilterOpen(true)}
                className="lg:hidden flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#F7F9FC] border border-[#E2E8F0] rounded-lg"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Filters</span>
              </button>
              <span className="text-xs text-[#64748B]">
                Showing <strong className="text-[#111827] tabular-nums">{courses.length}</strong> available courses
              </span>
            </div>

            <div className="flex items-center gap-3">
              {/* Sort By Dropdown */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-[#64748B] font-medium hidden sm:inline">Sort:</span>
                <select
                  value={sortOption}
                  onChange={(e) => updateParam('sort', e.target.value)}
                  aria-label="Sort courses"
                  className="bg-[#F7F9FC] border border-[#E2E8F0] text-[#111827] py-1.5 px-2.5 rounded-lg text-xs font-medium focus:outline-none focus:border-[#004AAD]"
                >
                  <option value="popular">Most Popular</option>
                  <option value="highest-rated">Highest Rated</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                </select>
              </div>

              {/* View Mode Toggle */}
              <div className="flex items-center bg-[#F1F5F9] p-0.5 rounded-lg border border-[#E2E8F0]">
                <button
                  onClick={() => setViewMode('grid')}
                  aria-label="Grid view"
                  className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-white text-[#004AAD] shadow-xs' : 'text-[#64748B]'}`}
                >
                  <Grid className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  aria-label="List view"
                  className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-white text-[#004AAD] shadow-xs' : 'text-[#64748B]'}`}
                >
                  <List className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Course List / Grid */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 py-12">
              {[1, 2, 3].map((n) => (
                <div key={n} className="bg-white rounded-xl border border-[#E2E8F0] p-4 h-72 animate-pulse space-y-3">
                  <div className="bg-slate-200 h-36 rounded-lg"></div>
                  <div className="bg-slate-200 h-4 w-3/4 rounded"></div>
                  <div className="bg-slate-200 h-3 w-1/2 rounded"></div>
                </div>
              ))}
            </div>
          ) : paginatedCourses.length === 0 ? (
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-[#EBF3FF] text-[#004AAD] flex items-center justify-center mx-auto">
                <Search className="w-6 h-6" />
              </div>
              <h3 className="font-display text-base font-bold text-[#111827]">
                No matching courses found
              </h3>
              <p className="text-xs text-[#64748B] max-w-sm mx-auto">
                Try clearing your search terms or adjusting the category filters to discover more masterclasses.
              </p>
              <button
                onClick={resetFilters}
                className="mt-2 px-4 py-2 text-xs font-semibold text-white bg-[#004AAD] rounded-lg hover:bg-[#003B8B] transition-colors"
              >
                Clear All Filters
              </button>
            </div>
          ) : (
            <div
              className={
                viewMode === 'grid'
                  ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'
                  : 'space-y-4'
              }
            >
              {paginatedCourses.map((course) => (
                <CourseCard key={course.id} course={course} viewMode={viewMode} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pt-6 border-t border-[#E2E8F0] flex items-center justify-between">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 text-xs font-semibold text-[#111827] bg-white border border-[#E2E8F0] rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#F8FAFC]"
              >
                Previous
              </button>
              <div className="text-xs text-[#64748B]">
                Page <span className="font-bold text-[#111827]">{currentPage}</span> of{' '}
                <span className="font-bold text-[#111827]">{totalPages}</span>
              </div>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 text-xs font-semibold text-[#111827] bg-white border border-[#E2E8F0] rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#F8FAFC]"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Filters Slide-over / Modal */}
      {mobileFilterOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex justify-end">
          <div className="w-80 max-w-full bg-white h-full p-6 space-y-6 overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-[#E2E8F0]">
              <h3 className="font-bold text-sm text-[#111827]">Filters</h3>
              <button onClick={() => setMobileFilterOpen(false)} className="p-1 text-[#64748B]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#111827] uppercase mb-2">Category</label>
              <div className="space-y-1">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => {
                      updateParam('category', cat.id);
                      setMobileFilterOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs rounded-lg ${
                      categoryFilter === cat.id ? 'bg-[#EBF3FF] text-[#004AAD] font-semibold' : 'text-[#64748B]'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-[#E2E8F0]">
              <button
                onClick={() => {
                  resetFilters();
                  setMobileFilterOpen(false);
                }}
                className="w-full py-2 text-xs font-semibold text-[#004AAD] bg-[#EBF3FF] rounded-lg"
              >
                Reset All Filters
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
