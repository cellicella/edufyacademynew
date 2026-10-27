import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCartWishlist } from '../../context/CartWishlistContext';
import { useCourseProgress } from '../../context/CourseProgressContext';
import { courseService } from '../../services/api';
import { Course } from '../../types';
import { BookOpen, PlayCircle, CheckCircle2, ArrowRight, Compass } from 'lucide-react';

export const MyCoursesPage: React.FC = () => {
  const { enrolledCourseIds } = useCartWishlist();
  const { getCourseProgressPercent } = useCourseProgress();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'all' | 'in-progress' | 'completed'>('all');
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    courseService
      .getAllCourses()
      .then((data) => {
        setCourses(data.filter((c) => enrolledCourseIds.includes(c.id)));
      })
      .finally(() => setLoading(false));
  }, [enrolledCourseIds]);

  const coursesWithProgress = courses.map((c) => ({
    ...c,
    progress: getCourseProgressPercent(c.id, c.totalLessons),
  }));

  const filtered = coursesWithProgress.filter((c) => {
    if (tab === 'in-progress') return c.progress < 100;
    if (tab === 'completed') return c.progress === 100;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#111827]">My Enrolled Courses</h1>
          <p className="text-xs text-[#64748B] mt-0.5">
            Continue where you left off or review completed modules.
          </p>
        </div>

        {courses.length > 0 && (
          <div className="flex items-center gap-1 p-1 bg-[#F1F5F9] rounded-lg">
            <button
              onClick={() => setTab('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md ${
                tab === 'all' ? 'bg-white text-[#004AAD] shadow-xs' : 'text-[#64748B]'
              }`}
            >
              All ({courses.length})
            </button>
            <button
              onClick={() => setTab('in-progress')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md ${
                tab === 'in-progress' ? 'bg-white text-[#004AAD] shadow-xs' : 'text-[#64748B]'
              }`}
            >
              In Progress
            </button>
            <button
              onClick={() => setTab('completed')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md ${
                tab === 'completed' ? 'bg-white text-[#004AAD] shadow-xs' : 'text-[#64748B]'
              }`}
            >
              Completed
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden animate-pulse">
              <div className="aspect-video bg-slate-200" />
              <div className="p-5 space-y-3">
                <div className="h-4 bg-slate-200 rounded w-24" />
                <div className="h-5 bg-slate-200 rounded w-full" />
                <div className="h-3 bg-slate-100 rounded w-1/2" />
                <div className="h-8 bg-slate-200 rounded-lg mt-4" />
              </div>
            </div>
          ))}
        </div>
      ) : courses.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-[#E2E8F0] text-center space-y-3">
          <BookOpen className="w-10 h-10 text-[#64748B] mx-auto opacity-40" />
          <h3 className="font-display text-base font-bold text-[#111827]">
            You haven't enrolled in any courses yet.
          </h3>
          <p className="text-xs text-[#64748B] max-w-sm mx-auto">
            Explore the Edufy catalog to enroll in high-impact engineering masterclasses.
          </p>
          <div className="pt-2">
            <Link
              to="/courses"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#004AAD] hover:bg-[#003B8B] rounded-lg transition-colors shadow-xs"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Explore Course Catalog</span>
            </Link>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-[#E2E8F0] text-center space-y-3">
          <BookOpen className="w-8 h-8 text-[#64748B] mx-auto opacity-40" />
          <h3 className="font-display text-sm font-bold text-[#111827]">No courses in this filter</h3>
          <p className="text-xs text-[#64748B]">
            Switch to the "All" tab to view all of your active enrollments.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((course) => (
            <div
              key={course.id}
              className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow"
            >
              <div className="aspect-video w-full bg-slate-900 relative">
                <img
                  src={course.thumbnail}
                  alt={course.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div>
                  <div className="text-xs text-[#004AAD] font-semibold mb-1">{course.category}</div>
                  <h3 className="font-display text-sm font-bold text-[#111827] line-clamp-2">
                    {course.title}
                  </h3>
                  <div className="text-xs text-[#64748B] mt-1">Instructor: {course.instructor.name}</div>
                </div>

                <div className="space-y-3 pt-2">
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-[#64748B]">Completion</span>
                      <span className="font-bold text-[#111827] tabular-nums">{course.progress}%</span>
                    </div>
                    <div className="w-full bg-[#E2E8F0] h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          course.progress === 100 ? 'bg-emerald-600' : 'bg-[#004AAD]'
                        }`}
                        style={{ width: `${course.progress}%` }}
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => navigate(`/learn/${course.id}`)}
                    className="w-full py-2.5 text-xs font-semibold text-white bg-[#004AAD] hover:bg-[#003B8B] rounded-lg transition-colors flex items-center justify-center gap-1.5"
                  >
                    <PlayCircle className="w-4 h-4" />
                    <span>{course.progress > 0 ? 'Resume Course' : 'Start Course'}</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
