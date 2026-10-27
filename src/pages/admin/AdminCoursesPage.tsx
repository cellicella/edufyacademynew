import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { courseService } from '../../services/api';
import { Course } from '../../types';
import { useCartWishlist } from '../../context/CartWishlistContext';
import {
  Check,
  X,
  ShieldAlert,
  BookOpen,
  Plus,
  Edit3,
  Trash2,
  Eye,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

export const AdminCoursesPage: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'pending' | 'draft'>('all');
  const { showToast } = useCartWishlist();

  const loadCourses = async () => {
    try {
      setLoading(true);
      const data = await courseService.getAdminCourses();
      setCourses(data);
    } catch (err: any) {
      console.error('Failed to load admin courses:', err);
      showToast('Could not load course catalog from database.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCourses();
  }, []);

  const handleTogglePublish = async (course: Course, targetPublished: boolean) => {
    try {
      setActionInProgress(course.id);
      const newStatus = targetPublished ? 'published' : 'draft';
      const res = await courseService.publishCourse(course.id, targetPublished, newStatus);

      setCourses((prev) =>
        prev.map((c) =>
          c.id === course.id
            ? { ...c, isPublished: targetPublished, status: newStatus }
            : c
        )
      );
      showToast(res.message, 'success');
    } catch (err: any) {
      console.error('Publish error:', err);
      showToast(err.message || 'Failed to update publication status.', 'error');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDeleteCourse = async (course: Course) => {
    if (!window.confirm(`Are you sure you want to permanently delete "${course.title}"?`)) {
      return;
    }

    try {
      setActionInProgress(course.id);
      await courseService.deleteCourse(course.id);
      setCourses((prev) => prev.filter((c) => c.id !== course.id));
      showToast(`Course "${course.title}" deleted from database.`, 'success');
    } catch (err: any) {
      console.error('Delete error:', err);
      showToast(err.message || 'Failed to delete course.', 'error');
    } finally {
      setActionInProgress(null);
    }
  };

  const filteredCourses = courses.filter((c) => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'published') return c.isPublished || c.status === 'published';
    if (statusFilter === 'pending') return c.status === 'pending_review';
    if (statusFilter === 'draft') return !c.isPublished && c.status !== 'pending_review';
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#111827]">Catalog Governance & Publishing</h1>
          <p className="text-xs text-[#64748B] mt-0.5">
            Audit instructor curriculum, approve submissions, set market pricing, and publish live to marketplace.
          </p>
        </div>

        <Link
          to="/admin/courses/new"
          className="px-4 py-2 text-xs font-bold text-white bg-[#004AAD] hover:bg-[#003B8B] rounded-lg transition-colors flex items-center gap-1.5 self-start sm:self-auto shadow"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Course</span>
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-[#E2E8F0] pb-2 text-xs font-bold">
        {[
          { key: 'all', label: `All Courses (${courses.length})` },
          { key: 'published', label: `Published (${courses.filter((c) => c.isPublished || c.status === 'published').length})` },
          { key: 'pending', label: `Pending Review (${courses.filter((c) => c.status === 'pending_review').length})` },
          { key: 'draft', label: `Drafts (${courses.filter((c) => !c.isPublished && c.status !== 'pending_review').length})` },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key as any)}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              statusFilter === tab.key
                ? 'bg-[#004AAD] text-white shadow-xs'
                : 'text-[#64748B] hover:text-[#111827] hover:bg-[#F1F5F9]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center text-xs text-[#64748B] space-y-3">
            <div className="w-8 h-8 border-4 border-[#004AAD] border-t-transparent rounded-full animate-spin mx-auto" />
            <p>Loading catalog from Supabase database...</p>
          </div>
        ) : filteredCourses.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#64748B] space-y-3">
            <BookOpen className="w-8 h-8 text-[#64748B] mx-auto opacity-40" />
            <h3 className="font-display text-sm font-bold text-[#111827]">No courses found</h3>
            <p>There are no courses matching the selected filter.</p>
            <Link
              to="/admin/courses/new"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#004AAD] rounded-lg shadow mt-2"
            >
              <Plus className="w-4 h-4" />
              <span>Create Course</span>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B]">
                  <th className="p-4 font-semibold">Course Title</th>
                  <th className="p-4 font-semibold">Instructor</th>
                  <th className="p-4 font-semibold">Category</th>
                  <th className="p-4 font-semibold">Price (INR)</th>
                  <th className="p-4 font-semibold">Status</th>
                  <th className="p-4 font-semibold text-right">Governance Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {filteredCourses.map((course) => {
                  const isLive = course.isPublished || course.status === 'published';
                  const isPending = course.status === 'pending_review';
                  const isBusy = actionInProgress === course.id;

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
                      <td className="p-4 text-[#111827] whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <img
                            src={course.instructor.avatar}
                            alt=""
                            className="w-5 h-5 rounded-full object-cover shrink-0"
                          />
                          <span className="font-semibold">{course.instructor.name}</span>
                        </div>
                      </td>
                      <td className="p-4 text-[#64748B] whitespace-nowrap">{course.category}</td>
                      <td className="p-4 font-mono tabular-nums font-semibold whitespace-nowrap">
                        {course.price === 0 ? 'FREE' : `₹${course.price.toLocaleString('en-IN')}`}
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        {isLive ? (
                          <span className="bg-emerald-50 text-emerald-700 font-bold px-2.5 py-1 rounded-full text-[10px] inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Live on Marketplace
                          </span>
                        ) : isPending ? (
                          <span className="bg-amber-50 text-amber-800 font-bold px-2.5 py-1 rounded-full text-[10px] inline-flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-600" />
                            Needs Review
                          </span>
                        ) : (
                          <span className="bg-slate-100 text-slate-700 font-bold px-2.5 py-1 rounded-full text-[10px] inline-flex items-center gap-1">
                            <AlertCircle className="w-3 h-3 text-slate-500" />
                            Draft
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right space-x-1.5 whitespace-nowrap">
                        {/* Approve & Publish or Unpublish */}
                        {isLive ? (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleTogglePublish(course, false)}
                            className="px-2.5 py-1 text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded transition-colors disabled:opacity-50"
                          >
                            Unpublish
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleTogglePublish(course, true)}
                            className="px-2.5 py-1 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded transition-colors shadow-xs disabled:opacity-50"
                          >
                            Approve & Publish
                          </button>
                        )}

                        <Link
                          to={`/courses/${course.id}`}
                          className="p-1.5 text-[#64748B] hover:text-[#004AAD] hover:bg-[#EBF3FF] rounded inline-flex"
                          title="View Student Page"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Link>

                        <Link
                          to={`/admin/courses/${course.id}/edit`}
                          className="p-1.5 text-[#004AAD] hover:bg-[#EBF3FF] rounded inline-flex"
                          title="Edit in Course Creator"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </Link>

                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleDeleteCourse(course)}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded inline-flex disabled:opacity-50"
                          title="Delete Course"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
