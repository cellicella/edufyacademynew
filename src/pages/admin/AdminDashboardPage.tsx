import React, { useState, useEffect } from 'react';
import { adminService } from '../../services/api';
import { Link } from 'react-router-dom';
import {
  Users,
  BookCheck,
  TrendingUp,
  DollarSign,
  ShieldCheck,
  Activity,
  ArrowUpRight,
  Award,
} from 'lucide-react';

export const AdminDashboardPage: React.FC = () => {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    adminService
      .getPlatformAnalytics()
      .then(setAnalytics)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8">
      {/* Top Banner */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-emerald-900 gap-2">
        <div>
          <strong className="font-bold">Edufy Academy Super-Admin Console:</strong> Platform governance, student moderation, catalog compliance, and billing reconciliation.
        </div>
        <Link to="/admin/reports" className="font-bold text-emerald-800 underline">
          Financial Statement →
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-xl border border-[#E2E8F0]">
          <div className="text-xs text-[#64748B]">Platform Registered Users</div>
          <div className="font-display text-2xl font-bold text-[#111827] mt-1 tabular-nums">
            {loading ? '...' : (analytics?.totalUsers ?? 0).toLocaleString()}
          </div>
          <div className="text-[11px] text-[#64748B] mt-1">
            {analytics?.activeStudents ?? 0} students · {analytics?.certifiedInstructors ?? 0} instructors
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-[#E2E8F0]">
          <div className="text-xs text-[#64748B]">Captured Gross Revenue</div>
          <div className="font-display text-2xl font-bold text-[#004AAD] mt-1 tabular-nums">
            ${loading ? '...' : (analytics?.monthlyGrossRevenue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-[#64748B] mt-1">Processed through Razorpay</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-[#E2E8F0]">
          <div className="text-xs text-[#64748B]">Published Masterclasses</div>
          <div className="font-display text-2xl font-bold text-[#111827] mt-1 tabular-nums">
            {loading ? '...' : (analytics?.totalCourses ?? 0).toLocaleString()}
          </div>
          <div className="text-[11px] text-[#64748B] mt-1">Active database courses</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-[#E2E8F0]">
          <div className="text-xs text-[#64748B]">Curriculum Completion Rate</div>
          <div className="font-display text-2xl font-bold text-emerald-600 mt-1 tabular-nums">
            {loading ? '...' : (analytics?.averageCompletionRate ?? 0)}%
          </div>
          <div className="text-[11px] text-[#64748B] mt-1">Across enrolled learners</div>
        </div>
      </div>

      {/* Admin Action Strips */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          to="/admin/users"
          className="p-6 bg-white rounded-xl border border-[#E2E8F0] hover:border-emerald-500/50 hover:shadow-md transition-all flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="font-display text-base font-bold text-[#111827]">User Management</h3>
            <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
              Inspect user roles, audit student enrollments, suspend fraudulent accounts, and approve instructors.
            </p>
          </div>
          <span className="text-xs font-bold text-emerald-700 mt-4 block">Manage User Accounts →</span>
        </Link>

        <Link
          to="/admin/courses"
          className="p-6 bg-white rounded-xl border border-[#E2E8F0] hover:border-blue-500/50 hover:shadow-md transition-all flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-lg bg-[#EBF3FF] text-[#004AAD] flex items-center justify-center mb-3">
              <BookCheck className="w-5 h-5" />
            </div>
            <h3 className="font-display text-base font-bold text-[#111827]">Catalog Governance</h3>
            <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
              Audit submitted course curricula, verify prerequisite standards, and manage marketplace listings.
            </p>
          </div>
          <span className="text-xs font-bold text-[#004AAD] mt-4 block">Review Published Courses →</span>
        </Link>

        <Link
          to="/admin/reports"
          className="p-6 bg-white rounded-xl border border-[#E2E8F0] hover:border-purple-500/50 hover:shadow-md transition-all flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-lg bg-[#F4EFFF] text-[#5E17EB] flex items-center justify-center mb-3">
              <DollarSign className="w-5 h-5" />
            </div>
            <h3 className="font-display text-base font-bold text-[#111827]">Financial Audits</h3>
            <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
              Export monthly payout reports, dispute records, transaction receipts, and revenue splits.
            </p>
          </div>
          <span className="text-xs font-bold text-[#5E17EB] mt-4 block">Generate Financial CSV →</span>
        </Link>
      </div>
    </div>
  );
};
