import React, { useState, useEffect } from 'react';
import { instructorService, courseService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Course } from '../../types';
import {
  DollarSign,
  Users,
  Star,
  BookOpen,
  TrendingUp,
  PlusCircle,
  Clock,
  ArrowUpRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const InstructorDashboardPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [metrics, setMetrics] = useState<any>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      instructorService.getDashboardMetrics(currentUser?.id),
      courseService.getAllCourses(),
    ])
      .then(([m, allCourses]) => {
        setMetrics(m);
        const myCourses = currentUser?.id
          ? allCourses.filter((c) => c.instructor?.id === currentUser.id)
          : allCourses;
        setCourses(myCourses.slice(0, 5));
      })
      .finally(() => setLoading(false));
  }, [currentUser?.id]);

  return (
    <div className="space-y-8">
      {/* Top Banner */}
      <div className="bg-[#EBF3FF] border border-blue-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-[#004AAD] gap-2">
        <div>
          <strong className="font-bold">Edufy Instructor Studio:</strong> Manage published masterclasses, monitor enrolled students, and track revenue disbursements.
        </div>
        <Link
          to="/instructor/courses"
          className="font-bold underline whitespace-nowrap self-start sm:self-auto"
        >
          Manage Catalog →
        </Link>
      </div>

      {/* KPI Metrics Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-xl border border-[#E2E8F0]">
          <div className="text-xs text-[#64748B] font-medium">Total Lifetime Earnings</div>
          <div className="font-display text-2xl font-bold text-[#111827] mt-1 tabular-nums">
            ${loading ? '...' : (metrics?.totalEarnings ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-[#64748B] mt-1">
            From captured student enrollments
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-[#E2E8F0]">
          <div className="text-xs text-[#64748B] font-medium">Active Students</div>
          <div className="font-display text-2xl font-bold text-[#111827] mt-1 tabular-nums">
            {loading ? '...' : (metrics?.activeStudents ?? 0).toLocaleString()}
          </div>
          <div className="text-[11px] text-[#64748B] mt-1">
            Across {courses.length} published {courses.length === 1 ? 'course' : 'courses'}
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-[#E2E8F0]">
          <div className="text-xs text-[#64748B] font-medium">Instructor Rating</div>
          <div className="font-display text-2xl font-bold text-[#111827] mt-1 flex items-center gap-1 tabular-nums">
            <span>{loading ? '...' : (metrics?.averageCourseRating ?? 5.0)}</span>
            <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
          </div>
          <div className="text-[11px] text-[#64748B] mt-1">Verified course average</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-[#E2E8F0]">
          <div className="text-xs text-[#64748B] font-medium">Total Course Enrollments</div>
          <div className="font-display text-2xl font-bold text-[#111827] mt-1 tabular-nums">
            {loading ? '...' : (metrics?.totalEnrollments ?? 0).toLocaleString()}
          </div>
          <div className="text-[11px] text-[#64748B] mt-1">Direct enrollments recorded</div>
        </div>
      </div>

      {/* Main Grid: Authored Courses Table + Recent Sales Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Authored Courses */}
        <div className="lg:col-span-8 bg-white rounded-xl border border-[#E2E8F0] p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
            <div>
              <h2 className="font-display text-base font-bold text-[#111827]">Published Masterclasses</h2>
              <p className="text-xs text-[#64748B]">Manage syllabus, view enrollment counts, and edit pricing</p>
            </div>
            <Link
              to="/instructor/courses"
              className="px-3 py-1.5 text-xs font-semibold text-white bg-[#004AAD] hover:bg-[#003B8B] rounded-lg transition-colors flex items-center gap-1"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Create New Course</span>
            </Link>
          </div>

          {loading ? (
            <div className="py-8 text-center text-xs text-[#64748B]">Loading courses...</div>
          ) : courses.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#64748B] space-y-3">
              <BookOpen className="w-8 h-8 text-[#64748B] mx-auto opacity-40" />
              <p className="font-semibold text-sm text-[#111827]">No courses authored yet</p>
              <p>Create and publish your first curriculum to start enrolling students.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E2E8F0] text-[#64748B]">
                    <th className="pb-3 font-semibold">Course Title</th>
                    <th className="pb-3 font-semibold">Category</th>
                    <th className="pb-3 font-semibold">Price</th>
                    <th className="pb-3 font-semibold">Enrolled</th>
                    <th className="pb-3 font-semibold">Rating</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {courses.map((c) => (
                    <tr key={c.id} className="hover:bg-[#F8FAFC]">
                      <td className="py-3 font-bold text-[#111827] max-w-xs truncate">{c.title}</td>
                      <td className="py-3 text-[#64748B]">{c.category}</td>
                      <td className="py-3 font-mono font-bold text-[#111827]">${c.price.toFixed(2)}</td>
                      <td className="py-3 font-mono">{c.enrolledCount.toLocaleString()}</td>
                      <td className="py-3 flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                        <span className="font-bold text-[#111827]">{c.rating}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Sales Feed */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-[#E2E8F0] p-6 space-y-4">
          <div className="pb-3 border-b border-[#E2E8F0]">
            <h2 className="font-display text-base font-bold text-[#111827]">Recent Sales</h2>
            <p className="text-xs text-[#64748B]">Live transactions from learners</p>
          </div>

          {!metrics?.recentSales || metrics.recentSales.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#64748B] space-y-2">
              <TrendingUp className="w-6 h-6 text-[#64748B] mx-auto opacity-40" />
              <p>No enrollment sales recorded yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {metrics.recentSales.map((sale: any) => (
                <div key={sale.id} className="p-3 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0]/60 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#111827]">{sale.studentName}</span>
                    <span className="font-mono font-bold text-emerald-600">+${sale.amount.toFixed(2)}</span>
                  </div>
                  <div className="text-[11px] text-[#64748B] truncate">{sale.courseTitle}</div>
                  <div className="text-[10px] text-[#94A3B8]">{sale.date}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
