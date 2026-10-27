import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { courseService } from '../../services/api';
import { Course } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useCartWishlist } from '../../context/CartWishlistContext';
import { Plus, Edit3, Trash2, Eye, BookOpen, Layers, Clock, AlertCircle } from 'lucide-react';

export const InstructorCoursesPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { showToast } = useCartWishlist();
  const navigate = useNavigate();

  const loadCourses = async () => {
    try {
      setLoading(true);
      const data = await courseService.getInstructorCourses();
      setCourses(data);
    } catch (err: any) {
      console.error('Failed to load instructor courses:', err);
      showToast('Could not load course catalog. Please refresh.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCourses();
  }, []);

  const handleDeleteCourse = async (course: Course) => {
    if (!window.confirm(`Are you sure you want to delete "${course.title}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setDeletingId(course.id);
      await courseService.deleteCourse(course.id);
      setCourses((prev) => prev.filter((c) => c.id !== course.id));
      showToast(`Course "${course.title}" deleted successfully.`, 'success');
    } catch (err: any) {
      console.error('Delete error:', err);
      showToast(err.message || 'Failed to delete course.', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#111827]">Course Catalog Manager</h1>
          <p className="text-xs text-[#64748B] mt-0.5">
            Manage your courses, curriculum, videos, and track student reviews and approval status.
          </p>
        </div>

        <Link
          to="/instructor/courses/new"
          className="px-4 py-2 text-xs font-bold text-white bg-[#004AAD] hover:bg-[#003B8B] rounded-lg transition-colors flex items-center gap-1.5 self-start sm:self-auto shadow"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Course</span>
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center text-xs text-[#64748B] space-y-3">
            <div className="w-8 h-8 border-4 border-[#004AAD] border-t-transparent rounded-full animate-spin mx-auto" />
            <p>Loading your courses from database...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B]">
                  <th className="p-4 font-semibold">Course Title</th>
                  <th className="p-4 font-semibold">Category</th>
                  <th className="p-4 font-semibold">Publication Status</th>
                  <th className="p-4 font-semibold">Enrollments</th>
                  <th className="p-4 font-semibold">Price (INR)</th>
                  <th className="p-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {courses.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-xs text-[#64748B] space-y-3">
                      <BookOpen className="w-8 h-8 text-[#64748B] mx-auto opacity-40" />
                      <p className="font-bold text-[#111827]">No courses authored yet.</p>
                      <p>Start your instructor journey by creating your first course curriculum.</p>
                      <Link
                        to="/instructor/courses/new"
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#004AAD] rounded-lg shadow mt-2"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Launch Course Creator</span>
                      </Link>
                    </td>
                  </tr>
                ) : (
                  courses.map((course) => {
                    const isLive = course.isPublished || course.status === 'published';
                    const isPending = course.status === 'pending_review';

                    return (
                      <tr key={course.id} className="hover:bg-[#F8FAFC] transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={course.thumbnail}
                              alt=""
                              className="w-12 h-8 rounded object-cover border border-[#E2E8F0] shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="font-bold text-[#111827] max-w-sm truncate">{course.title}</div>
                              <div className="text-[11px] text-[#64748B]">
                                {course.totalLessons} lessons · {course.durationHours}h · {course.level}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-[#64748B] whitespace-nowrap">{course.category}</td>
                        <td className="p-4 whitespace-nowrap">
                          {isLive ? (
                            <span className="bg-emerald-50 text-emerald-700 font-bold px-2.5 py-1 rounded-full text-[10px] inline-flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Published
                            </span>
                          ) : isPending ? (
                            <span className="bg-amber-50 text-amber-800 font-bold px-2.5 py-1 rounded-full text-[10px] inline-flex items-center gap-1">
                              <Clock className="w-3 h-3 text-amber-600" />
                              Under Review
                            </span>
                          ) : (
                            <span className="bg-slate-100 text-slate-700 font-bold px-2.5 py-1 rounded-full text-[10px] inline-flex items-center gap-1">
                              <AlertCircle className="w-3 h-3 text-slate-500" />
                              Draft Mode
                            </span>
                          )}
                        </td>
                        <td className="p-4 font-mono tabular-nums">{course.enrolledCount.toLocaleString()}</td>
                        <td className="p-4 font-mono tabular-nums font-semibold">
                          {course.price === 0 ? 'FREE' : `₹${course.price.toLocaleString('en-IN')}`}
                        </td>
                        <td className="p-4 text-right space-x-1 whitespace-nowrap">
                          <Link
                            to={`/courses/${course.id}`}
                            className="p-1.5 text-[#64748B] hover:text-[#004AAD] hover:bg-[#EBF3FF] rounded inline-flex"
                            title="Preview Student Page"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Link>
                          <Link
                            to={`/instructor/courses/${course.id}/edit`}
                            className="p-1.5 text-[#004AAD] hover:bg-[#EBF3FF] rounded inline-flex"
                            title="Edit Course in Creator"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </Link>
                          <button
                            type="button"
                            disabled={deletingId === course.id}
                            onClick={() => handleDeleteCourse(course)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded inline-flex disabled:opacity-50"
                            title="Delete Course"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
