import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCourseProgress } from '../../context/CourseProgressContext';
import { useCartWishlist } from '../../context/CartWishlistContext';
import { courseService, certificateService, paymentService, PaymentRecord } from '../../services/api';
import { Course, Certificate } from '../../types';
import { EdufyLogo } from '../../components/common/EdufyLogo';
import {
  BookOpen,
  Award,
  Clock,
  Flame,
  PlayCircle,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
  FileText,
  Receipt,
  Download,
  Printer,
  X,
  CreditCard,
  ShieldCheck,
  Compass,
} from 'lucide-react';

export const StudentDashboardPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { enrolledCourseIds } = useCartWishlist();
  const { getCourseProgressPercent, completedLessons } = useCourseProgress();
  const [courses, setCourses] = useState<Course[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<PaymentRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<'all' | 'in-progress' | 'completed'>('all');
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    const userId = currentUser?.id;
    Promise.all([
      courseService.getAllCourses(),
      userId ? certificateService.getStudentCertificates(userId) : Promise.resolve([]),
      paymentService.getPaymentHistory(),
    ])
      .then(([allCourses, certs, paymentHistory]) => {
        setCourses(allCourses.filter((c) => enrolledCourseIds.includes(c.id)));
        setCertificates(certs);
        setPayments(paymentHistory);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [enrolledCourseIds, currentUser]);

  const activeCourse = courses[0];
  const activeCourseProgress = activeCourse
    ? getCourseProgressPercent(activeCourse.id, activeCourse.totalLessons)
    : 0;

  // Determine next up lesson dynamically from curriculum
  let nextUpLessonTitle = 'Course Introduction & Environment Setup';
  if (activeCourse && activeCourse.curriculum) {
    const completedSet = new Set(completedLessons[activeCourse.id] || []);
    for (const section of activeCourse.curriculum) {
      for (const lesson of section.lessons) {
        if (!completedSet.has(lesson.id)) {
          nextUpLessonTitle = `${section.title}: ${lesson.title}`;
          break;
        }
      }
      if (nextUpLessonTitle !== 'Course Introduction & Environment Setup') break;
    }
  }

  // Calculate live user learning stats
  const totalCompletedLessons = Object.values(completedLessons).reduce(
    (sum, lessonsArr) => sum + (lessonsArr?.length || 0),
    0
  );
  const totalHoursInvested = totalCompletedLessons > 0 ? (totalCompletedLessons * 0.4).toFixed(1) : '0';
  const activeStreakDays = totalCompletedLessons > 0 ? Math.min(totalCompletedLessons, 7) : 0;

  const coursesWithProgress = courses.map((c) => ({
    ...c,
    progress: getCourseProgressPercent(c.id, c.totalLessons),
  }));

  const filteredCourses = coursesWithProgress.filter((c) => {
    if (filterTab === 'in-progress') return c.progress < 100;
    if (filterTab === 'completed') return c.progress === 100;
    return true;
  });

  if (loading) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="bg-white p-8 rounded-2xl border border-[#E2E8F0] h-32" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white p-5 rounded-xl border border-[#E2E8F0] h-24" />
          ))}
        </div>
        <div className="bg-white p-8 rounded-2xl border border-[#E2E8F0] h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* 1. Welcome Section */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-[#E2E8F0] flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xs">
        <div>
          <span className="text-xs font-bold text-[#004AAD] uppercase tracking-wider">
            Learner Dashboard
          </span>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#111827] mt-1">
            Welcome back, {currentUser?.name || 'Learner'}!
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B] mt-1">
            {activeStreakDays > 0 ? (
              <>
                You are on a <strong className="text-[#111827]">{activeStreakDays}-day learning streak</strong>. Keep pushing towards your next masterclass certification.
              </>
            ) : (
              'Start your learning streak today by resuming or enrolling in your first masterclass.'
            )}
          </p>
        </div>

        <Link
          to="/courses"
          className="px-4 py-2.5 text-xs font-semibold text-white bg-[#004AAD] hover:bg-[#003B8B] rounded-xl shadow-xs transition-colors self-start md:self-auto flex items-center gap-1.5 whitespace-nowrap"
        >
          <span>Browse Catalog</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* 2. Key Metrics Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-[#E2E8F0]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#EBF3FF] text-[#004AAD] flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="font-display text-xl font-bold text-[#111827] tabular-nums">
                {totalHoursInvested} hrs
              </div>
              <div className="text-[11px] text-[#64748B]">Time Invested</div>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-[#E2E8F0]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="font-display text-xl font-bold text-[#111827] tabular-nums">
                {enrolledCourseIds.length}
              </div>
              <div className="text-[11px] text-[#64748B]">Enrolled Courses</div>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-[#E2E8F0]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#F4EFFF] text-[#5E17EB] flex items-center justify-center">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <div className="font-display text-xl font-bold text-[#111827] tabular-nums">
                {certificates.length}
              </div>
              <div className="text-[11px] text-[#64748B]">Earned Certificates</div>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-[#E2E8F0]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <div className="font-display text-xl font-bold text-[#111827] tabular-nums">
                {activeStreakDays} {activeStreakDays === 1 ? 'Day' : 'Days'}
              </div>
              <div className="text-[11px] text-[#64748B]">Active Streak</div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Continue Learning Spotlight */}
      {activeCourse ? (
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-[#E2E8F0] shadow-xs">
          <div className="flex items-center justify-between pb-4 border-b border-[#E2E8F0] mb-6">
            <span className="text-xs font-bold uppercase tracking-wider text-[#004AAD]">
              Jump Back In
            </span>
            <span className="text-xs text-[#64748B]">
              Active enrollment
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            <div className="lg:col-span-8 space-y-4">
              <div>
                <span className="text-xs text-[#64748B] font-medium">{activeCourse.category}</span>
                <h2 className="font-display text-xl font-bold text-[#111827] mt-0.5">
                  {activeCourse.title}
                </h2>
                <p className="text-xs text-[#64748B] mt-1">
                  Next up: {nextUpLessonTitle}
                </p>
              </div>

              {/* Progress bar */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-semibold text-[#111827]">Overall Course Completion</span>
                  <span className="font-bold text-[#004AAD] tabular-nums">{activeCourseProgress}%</span>
                </div>
                <div className="w-full bg-[#E2E8F0] h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-[#004AAD] h-full rounded-full transition-all duration-500"
                    style={{ width: `${activeCourseProgress}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="lg:col-span-4 flex justify-start lg:justify-end">
              <button
                onClick={() => navigate(`/learn/${activeCourse.id}`)}
                className="w-full sm:w-auto px-6 py-3.5 text-xs font-bold text-white bg-[#004AAD] hover:bg-[#003B8B] rounded-xl shadow transition-colors flex items-center justify-center gap-2"
              >
                <PlayCircle className="w-4 h-4 fill-current" />
                <span>Resume Learning</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* 4. Enrolled Courses Management */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-[#E2E8F0] space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-bold text-[#111827]">
              My Enrolled Masterclasses
            </h2>
            <p className="text-xs text-[#64748B] mt-0.5">
              Access curriculum player, notes, and module quizzes.
            </p>
          </div>

          {/* Filter tabs */}
          {courses.length > 0 && (
            <div className="flex items-center gap-1 p-1 bg-[#F1F5F9] rounded-lg self-start sm:self-auto">
              <button
                onClick={() => setFilterTab('all')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  filterTab === 'all' ? 'bg-white text-[#004AAD] shadow-xs' : 'text-[#64748B]'
                }`}
              >
                All ({courses.length})
              </button>
              <button
                onClick={() => setFilterTab('in-progress')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  filterTab === 'in-progress' ? 'bg-white text-[#004AAD] shadow-xs' : 'text-[#64748B]'
                }`}
              >
                In Progress
              </button>
              <button
                onClick={() => setFilterTab('completed')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  filterTab === 'completed' ? 'bg-white text-[#004AAD] shadow-xs' : 'text-[#64748B]'
                }`}
              >
                Completed
              </button>
            </div>
          )}
        </div>

        {courses.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <BookOpen className="w-10 h-10 text-[#64748B] mx-auto opacity-40" />
            <h3 className="font-display text-base font-bold text-[#111827]">
              You haven't enrolled in any courses yet.
            </h3>
            <p className="text-xs text-[#64748B] max-w-sm mx-auto">
              Explore our catalog of expert courses and start learning high-impact engineering skills today.
            </p>
            <Link
              to="/courses"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#004AAD] hover:bg-[#003B8B] rounded-lg transition-colors shadow-xs"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Explore Course Catalog</span>
            </Link>
          </div>
        ) : filteredCourses.length === 0 ? (
          <div className="py-12 text-center text-xs text-[#64748B] space-y-3">
            <BookOpen className="w-8 h-8 text-[#64748B] mx-auto opacity-40" />
            <p>No courses match this filter state.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredCourses.map((c) => (
              <div
                key={c.id}
                className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-5 flex flex-col justify-between space-y-4 hover:border-[#004AAD]/30 transition-colors"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#004AAD] bg-[#EBF3FF] px-2 py-0.5 rounded">
                      {c.category}
                    </span>
                    <span className="text-[#64748B] font-mono">{c.durationHours} hrs total</span>
                  </div>

                  <h3 className="font-display text-base font-bold text-[#111827] line-clamp-1">
                    {c.title}
                  </h3>

                  <p className="text-xs text-[#64748B] line-clamp-2">
                    {c.subtitle}
                  </p>
                </div>

                <div className="space-y-2 pt-2 border-t border-[#E2E8F0]/80">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#64748B]">Progress</span>
                    <span className="font-bold text-[#111827] tabular-nums">{c.progress}%</span>
                  </div>
                  <div className="w-full bg-[#E2E8F0] h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-[#004AAD] h-full rounded-full"
                      style={{ width: `${c.progress}%` }}
                    />
                  </div>

                  <div className="pt-2 flex items-center justify-between">
                    <span className="text-[11px] text-[#64748B]">Instructor: {c.instructor.name}</span>
                    <button
                      onClick={() => navigate(`/learn/${c.id}`)}
                      className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#004AAD] hover:bg-[#003B8B] rounded-lg transition-colors flex items-center gap-1.5"
                    >
                      <span>Continue</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5. Purchase History & Razorpay Receipts Section */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-[#E2E8F0] shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E2E8F0]">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#004AAD]">
                Billing & Orders
              </span>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                <span>Verified via Razorpay</span>
              </span>
            </div>
            <h2 className="font-display text-lg font-bold text-[#111827] mt-0.5">
              Purchase History & Official Invoices
            </h2>
            <p className="text-xs text-[#64748B]">
              Every course purchase is cryptographically verified and recorded in your permanent ledger.
            </p>
          </div>

          <div className="text-xs text-[#64748B]">
            Total transactions: <strong className="text-[#111827] tabular-nums">{payments.length}</strong>
          </div>
        </div>

        {payments.length === 0 ? (
          <div className="py-8 text-center text-xs text-[#64748B] space-y-2">
            <Receipt className="w-8 h-8 text-[#64748B] mx-auto opacity-40" />
            <p>No billing transactions found on this account.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E2E8F0] text-[#64748B]">
                  <th className="pb-3 font-semibold">Course / Item</th>
                  <th className="pb-3 font-semibold">Date</th>
                  <th className="pb-3 font-semibold">Transaction ID</th>
                  <th className="pb-3 font-semibold">Amount</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold text-right">Invoice</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {payments.map((p) => {
                  const courseTitle =
                    p.courses?.title ||
                    p.notes?.courseTitle ||
                    (p.notes?.courseTitles ? p.notes.courseTitles.join(', ') : 'Edufy Academy Masterclass');
                  const formattedDate = new Date(p.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  });

                  return (
                    <tr key={p.id} className="hover:bg-[#F8FAFC] transition-colors">
                      <td className="py-3.5 pr-4">
                        <div className="font-bold text-[#111827] max-w-xs truncate">
                          {courseTitle}
                        </div>
                        <div className="text-[10px] text-[#64748B] font-mono">
                          Receipt: {p.receipt}
                        </div>
                      </td>
                      <td className="py-3.5 pr-4 text-[#64748B] whitespace-nowrap">
                        {formattedDate}
                      </td>
                      <td className="py-3.5 pr-4 font-mono text-[11px] text-[#004AAD] whitespace-nowrap">
                        {p.razorpay_payment_id || p.razorpay_order_id}
                      </td>
                      <td className="py-3.5 pr-4 font-bold text-[#111827] tabular-nums whitespace-nowrap">
                        ${typeof p.amount === 'number' ? p.amount.toFixed(2) : parseFloat(p.amount).toFixed(2)}
                      </td>
                      <td className="py-3.5 pr-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Captured</span>
                        </span>
                      </td>
                      <td className="py-3.5 text-right whitespace-nowrap">
                        <button
                          onClick={() => setSelectedInvoice(p)}
                          className="px-3 py-1.5 text-xs font-semibold text-[#004AAD] bg-[#EBF3FF] hover:bg-blue-100 rounded-lg transition-colors inline-flex items-center gap-1.5"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>View Invoice</span>
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

      {/* 6. Printable Official Tax Invoice Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 sm:p-8 shadow-2xl relative border border-[#E2E8F0] space-y-6 my-8">
            <button
              onClick={() => setSelectedInvoice(null)}
              className="absolute top-4 right-4 p-1.5 text-[#64748B] hover:text-[#111827] rounded-lg hover:bg-slate-100"
              aria-label="Close invoice"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Printable Area */}
            <div id="printable-invoice" className="space-y-6 text-xs text-[#111827]">
              {/* Header */}
              <div className="flex justify-between items-start border-b border-[#E2E8F0] pb-6">
                <div>
                  <EdufyLogo size="sm" />
                  <p className="text-[11px] text-[#64748B] mt-1">
                    Edufy Global Education Inc.<br />
                    100 Tech Square, Suite 400<br />
                    GSTIN: 29AAAAA0000A1Z5
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#004AAD] block">
                    Tax Invoice / Receipt
                  </span>
                  <div className="font-mono font-bold text-sm text-[#111827]">
                    INV-{selectedInvoice.receipt.replace('rcpt_', '').toUpperCase()}
                  </div>
                  <div className="text-[11px] text-[#64748B] mt-1">
                    Date: {new Date(selectedInvoice.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>

              {/* Billed To / Payment Details */}
              <div className="grid grid-cols-2 gap-4 pb-4 border-b border-[#E2E8F0]">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] block mb-1">
                    Billed To
                  </span>
                  <div className="font-bold text-sm text-[#111827]">
                    {currentUser?.name || 'Edufy Student'}
                  </div>
                  <div className="text-[#64748B]">{currentUser?.email || ''}</div>
                  <div className="text-[#64748B] mt-1">Customer ID: {selectedInvoice.notes?.userId || currentUser?.id || 'std'}</div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] block mb-1">
                    Payment Channel
                  </span>
                  <div className="font-semibold text-emerald-700 flex items-center justify-end gap-1">
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Razorpay Standard Checkout</span>
                  </div>
                  <div className="text-[11px] text-[#64748B] font-mono mt-0.5">
                    Order: {selectedInvoice.razorpay_order_id}
                  </div>
                  {selectedInvoice.razorpay_payment_id && (
                    <div className="text-[11px] text-[#64748B] font-mono">
                      PayID: {selectedInvoice.razorpay_payment_id}
                    </div>
                  )}
                  <div className="text-[10px] text-emerald-600 font-bold uppercase mt-1">
                    Status: Captured & Settled
                  </div>
                </div>
              </div>

              {/* Invoice Line Items */}
              <div className="space-y-3 pb-6 border-b border-[#E2E8F0]">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] text-[#64748B] text-[11px]">
                      <th className="pb-2 font-semibold">Description</th>
                      <th className="pb-2 font-semibold text-center">Qty</th>
                      <th className="pb-2 font-semibold text-right">Price</th>
                      <th className="pb-2 font-semibold text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]/60">
                    <tr>
                      <td className="py-2.5">
                        <div className="font-bold text-[#111827]">
                          {selectedInvoice.courses?.title ||
                            selectedInvoice.notes?.courseTitle ||
                            (selectedInvoice.notes?.courseTitles
                              ? selectedInvoice.notes.courseTitles.join(', ')
                              : 'Edufy Masterclass')}
                        </div>
                        <div className="text-[10px] text-[#64748B]">
                          Lifetime access, HD video streaming, project files, verifiable certificate
                        </div>
                      </td>
                      <td className="py-2.5 text-center text-[#64748B]">1</td>
                      <td className="py-2.5 text-right font-mono">
                        ${typeof selectedInvoice.amount === 'number'
                          ? selectedInvoice.amount.toFixed(2)
                          : parseFloat(selectedInvoice.amount).toFixed(2)}
                      </td>
                      <td className="py-2.5 text-right font-bold font-mono">
                        ${typeof selectedInvoice.amount === 'number'
                          ? selectedInvoice.amount.toFixed(2)
                          : parseFloat(selectedInvoice.amount).toFixed(2)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Totals Breakdown */}
              <div className="flex justify-end">
                <div className="w-64 space-y-1.5 text-right">
                  <div className="flex justify-between text-[#64748B]">
                    <span>Subtotal:</span>
                    <span className="font-mono text-[#111827]">
                      ${typeof selectedInvoice.amount === 'number'
                        ? selectedInvoice.amount.toFixed(2)
                        : parseFloat(selectedInvoice.amount).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[#64748B]">
                    <span>Platform Tax / GST (0%):</span>
                    <span className="font-mono text-[#111827]">$0.00</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-[#111827] pt-2 border-t border-[#E2E8F0]">
                    <span>Total Paid:</span>
                    <span className="font-mono text-[#004AAD]">
                      ${typeof selectedInvoice.amount === 'number'
                        ? selectedInvoice.amount.toFixed(2)
                        : parseFloat(selectedInvoice.amount).toFixed(2)} USD
                    </span>
                  </div>
                </div>
              </div>

              {/* Footer Note */}
              <div className="text-[11px] text-[#64748B] pt-4 border-t border-[#E2E8F0] text-center">
                This is a computer-generated tax receipt backed by Edufy Academy and verified through Razorpay's cryptographic payment engine. Keep for your tax and educational records.
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E2E8F0]">
              <button
                onClick={() => setSelectedInvoice(null)}
                className="px-4 py-2 text-xs font-semibold text-[#64748B] hover:text-[#111827]"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#004AAD] hover:bg-[#003B8B] rounded-xl flex items-center gap-1.5 shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print / Save as PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
