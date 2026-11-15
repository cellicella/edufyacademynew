import React, { useEffect, useState } from 'react';
import { IndianRupee, Receipt, Users, Layers, Percent, Save } from 'lucide-react';
import { adminConsoleService, RevenueSummary } from '../../services/api';
import { AdminPageHeader, StatCard, inr, formatDate, EmptyState, ErrorBanner } from '../../components/admin/AdminUI';
import { useCartWishlist } from '../../context/CartWishlistContext';

export const AdminRevenuePage: React.FC = () => {
  const [data, setData] = useState<RevenueSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [share, setShare] = useState('70');
  const [savingShare, setSavingShare] = useState(false);
  const { showToast } = useCartWishlist();

  const load = () =>
    adminConsoleService
      .getRevenueSummary()
      .then((d) => {
        setData(d);
        setShare(String(Math.round(d.instructor_share * 100)));
      })
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  const saveShare = async () => {
    const pct = Number(share);
    if (!(pct >= 0 && pct <= 100)) return showToast('Enter a percentage between 0 and 100', 'warning');
    setSavingShare(true);
    try {
      await adminConsoleService.setInstructorShare(pct / 100);
      showToast('Revenue share updated', 'success');
      await load();
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setSavingShare(false);
    }
  };

  const instructorPayout = data ? data.gross_revenue * data.instructor_share : 0;
  const platformRevenue = data ? data.gross_revenue - instructorPayout : 0;
  const maxMonth = data ? Math.max(1, ...data.by_month.map((m) => m.revenue)) : 1;

  return (
    <div>
      <AdminPageHeader eyebrow="Finance" title="Revenue" description="Captured Razorpay payments, split between Edufy and instructors." />
      {error && <ErrorBanner message={error} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Gross revenue" value={inr(data?.gross_revenue || 0)} hint={`${data?.transactions || 0} successful payments`} icon={IndianRupee} />
        <StatCard label="Edufy share" value={inr(platformRevenue)} hint={`${100 - Number(share)}% of gross`} icon={Percent} tone="ink" />
        <StatCard label="Instructor earnings" value={inr(instructorPayout)} hint={`${share}% of gross`} icon={Users} tone="purple" />
        <StatCard label="Bundle revenue" value={inr(data?.bundle_revenue || 0)} hint={`${data?.paying_students || 0} paying students`} icon={Layers} tone="green" />
      </div>

      <div className="mt-6 grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Monthly chart */}
        <section className="xl:col-span-2 bg-white rounded-[20px] border border-[#E2E8F0] p-6">
          <h2 className="font-display text-[20px] font-bold text-[#111827]">Last 12 months</h2>
          {!data || data.by_month.length === 0 ? (
            <EmptyState title="No revenue yet" body="Captured payments will be charted here." />
          ) : (
            <div className="mt-6 flex items-end gap-3 h-56">
              {data.by_month.map((m) => (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-2 min-w-0" title={`${m.month}: ${inr(m.revenue)} (${m.transactions})`}>
                  <span className="text-[12px] text-[#64748B] tabular-nums">{inr(m.revenue)}</span>
                  <div className="w-full max-w-[44px] rounded-t-lg bg-[#004AAD]" style={{ height: `${(m.revenue / maxMonth) * 100}%`, minHeight: 4 }} />
                  <span className="text-[12px] text-[#64748B]">{m.month.slice(5)}/{m.month.slice(2, 4)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Revenue share settings */}
        <section className="bg-white rounded-[20px] border border-[#E2E8F0] p-6">
          <h2 className="font-display text-[20px] font-bold text-[#111827]">Instructor revenue share</h2>
          <p className="mt-2 text-[15px] text-[#64748B]">Percentage of each sale credited to the course instructor. Applies to all reports.</p>
          <div className="mt-5 flex items-center gap-3">
            <div className="relative w-32">
              <input type="number" min={0} max={100} value={share} onChange={(e) => setShare(e.target.value)} className="ed-field pr-9" />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#64748B]">%</span>
            </div>
            <button onClick={saveShare} disabled={savingShare} className="ed-btn ed-btn-filled ed-btn-sm">
              <Save className="w-4 h-4" /> Save
            </button>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 text-[14px]">
            <div className="rounded-xl bg-[#F1EAFE] p-3"><div className="text-[#5E17EB] font-semibold">Instructor</div><div className="font-display text-[20px] font-bold">{share}%</div></div>
            <div className="rounded-xl bg-[#F1F5F9] p-3"><div className="text-[#334155] font-semibold">Edufy</div><div className="font-display text-[20px] font-bold">{100 - Number(share || 0)}%</div></div>
          </div>
          {data && (
            <div className="mt-6 text-[14px] text-[#64748B] space-y-1">
              <div>Refunded: {inr(data.refunded)}</div>
              <div>Failed attempts: {data.failed_transactions}</div>
            </div>
          )}
        </section>
      </div>

      {/* Revenue by course */}
      <section className="mt-6 bg-white rounded-[20px] border border-[#E2E8F0] overflow-hidden">
        <div className="p-6 pb-3"><h2 className="font-display text-[20px] font-bold text-[#111827]">Revenue by course</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[15px]">
            <thead className="bg-[#F7F9FC] text-[13px] uppercase tracking-wide text-[#64748B]">
              <tr><th className="px-6 py-3">Course</th><th className="px-6 py-3">Instructor</th><th className="px-6 py-3 text-right">Sales</th><th className="px-6 py-3 text-right">Revenue</th><th className="px-6 py-3 text-right">Instructor earns</th></tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2F7]">
              {(data?.by_course || []).map((c) => (
                <tr key={c.course_id}>
                  <td className="px-6 py-3 font-medium text-[#111827]">{c.title}</td>
                  <td className="px-6 py-3 text-[#64748B]">{c.instructor || '—'}</td>
                  <td className="px-6 py-3 text-right tabular-nums">{c.sales}</td>
                  <td className="px-6 py-3 text-right tabular-nums font-semibold">{inr(c.revenue)}</td>
                  <td className="px-6 py-3 text-right tabular-nums text-[#5E17EB]">{inr(c.revenue * (data?.instructor_share || 0.7))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data && data.by_course.length === 0 && <EmptyState title="No courses yet" />}
        </div>
      </section>

      {/* Recent transactions */}
      <section className="mt-6 bg-white rounded-[20px] border border-[#E2E8F0] overflow-hidden">
        <div className="p-6 pb-3 flex items-center gap-2"><Receipt className="w-5 h-5 text-[#004AAD]" /><h2 className="font-display text-[20px] font-bold text-[#111827]">Recent transactions</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[15px]">
            <thead className="bg-[#F7F9FC] text-[13px] uppercase tracking-wide text-[#64748B]">
              <tr><th className="px-6 py-3">Date</th><th className="px-6 py-3">Student</th><th className="px-6 py-3">Item</th><th className="px-6 py-3">Order</th><th className="px-6 py-3">Status</th><th className="px-6 py-3 text-right">Amount</th></tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2F7]">
              {(data?.recent || []).map((r) => (
                <tr key={r.id}>
                  <td className="px-6 py-3 whitespace-nowrap">{formatDate(r.created_at)}</td>
                  <td className="px-6 py-3"><div className="font-medium text-[#111827]">{r.student}</div><div className="text-[13px] text-[#64748B]">{r.email}</div></td>
                  <td className="px-6 py-3">{r.item}</td>
                  <td className="px-6 py-3 font-mono text-[13px] text-[#64748B]">{r.order_id}</td>
                  <td className="px-6 py-3">
                    <span className={`px-2.5 h-7 inline-flex items-center rounded-full text-[13px] font-semibold ${r.status === 'captured' ? 'bg-emerald-50 text-emerald-700' : r.status === 'failed' ? 'bg-rose-50 text-rose-700' : 'bg-[#F1F5F9] text-[#475569]'}`}>{r.status}</span>
                  </td>
                  <td className="px-6 py-3 text-right tabular-nums font-semibold">{inr(r.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data && data.recent.length === 0 && <EmptyState title="No transactions yet" body="Payments appear here as soon as learners check out." />}
        </div>
      </section>
    </div>
  );
};
