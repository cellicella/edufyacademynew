import React, { useEffect, useState } from 'react';
import { Check, X, ExternalLink, UserMinus, Clock, GraduationCap } from 'lucide-react';
import { adminConsoleService, InstructorApplication, InstructorOverviewRow } from '../../services/api';
import { AdminPageHeader, StatCard, inr, formatDate, EmptyState, ErrorBanner } from '../../components/admin/AdminUI';
import { useCartWishlist } from '../../context/CartWishlistContext';

type Tab = 'applications' | 'instructors';

export const AdminInstructorsPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>('applications');
  const [applications, setApplications] = useState<InstructorApplication[]>([]);
  const [instructors, setInstructors] = useState<InstructorOverviewRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [statusFilter, setStatusFilter] = useState<'pending' | 'all'>('pending');
  const { showToast } = useCartWishlist();

  const load = async () => {
    try {
      const [apps, insts] = await Promise.all([adminConsoleService.getApplications(), adminConsoleService.getInstructors()]);
      setApplications(apps);
      setInstructors(insts);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const review = async (app: InstructorApplication, approve: boolean) => {
    if (!approve && !window.confirm(`Reject ${app.applicant?.full_name || 'this applicant'}?`)) return;
    setBusy(app.id);
    try {
      await adminConsoleService.reviewApplication(app.id, approve, notes[app.id]);
      showToast(approve ? 'Instructor approved — they get access on next sign-in' : 'Application rejected', approve ? 'success' : 'info');
      await load();
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const revoke = async (row: InstructorOverviewRow) => {
    if (!window.confirm(`Remove instructor access for ${row.full_name}? Their courses stay in the catalogue.`)) return;
    setBusy(row.id);
    try {
      await adminConsoleService.setUserRole(row.id, 'student');
      showToast('Instructor access removed', 'info');
      await load();
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const pending = applications.filter((a) => a.status === 'pending');
  const visibleApps = statusFilter === 'pending' ? pending : applications;
  const totalEarnings = instructors.reduce((s, i) => s + i.instructor_earnings, 0);

  return (
    <div>
      <AdminPageHeader eyebrow="People" title="Instructors" description="Review applications, approve new instructors and track each instructor's courses, students and earnings." />
      {error && <ErrorBanner message={error} />}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Pending applications" value={pending.length} icon={Clock} tone="purple" />
        <StatCard label="Active instructors" value={instructors.length} icon={GraduationCap} />
        <StatCard label="Instructor earnings (all time)" value={inr(totalEarnings)} tone="green" />
      </div>

      <div role="tablist" className="inline-flex gap-1 p-1.5 bg-[#F1F5F9] rounded-full mb-6">
        {(['applications', 'instructors'] as Tab[]).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`h-11 px-5 rounded-full text-[15px] font-semibold capitalize ${tab === t ? 'bg-white text-[#004AAD] shadow-sm' : 'text-[#475569]'}`}>
            {t}{t === 'applications' && pending.length > 0 ? ` (${pending.length})` : ''}
          </button>
        ))}
      </div>

      {tab === 'applications' ? (
        <section className="space-y-4">
          <div className="flex gap-2">
            <button onClick={() => setStatusFilter('pending')} className={`ed-chip ${statusFilter === 'pending' ? '!bg-[#E8EFFB] !text-[#003B8B]' : ''}`}>Pending</button>
            <button onClick={() => setStatusFilter('all')} className={`ed-chip ${statusFilter === 'all' ? '!bg-[#E8EFFB] !text-[#003B8B]' : ''}`}>All</button>
          </div>
          {visibleApps.length === 0 && (
            <div className="bg-white rounded-[20px] border border-[#E2E8F0]"><EmptyState title="No applications" body="New instructor applications will show up here." /></div>
          )}
          {visibleApps.map((app) => (
            <article key={app.id} className="bg-white rounded-[20px] border border-[#E2E8F0] p-6">
              <div className="flex flex-col lg:flex-row gap-6">
                <div className="flex items-start gap-4 lg:w-80 shrink-0">
                  <img src={app.applicant?.avatar_url} alt="" className="w-14 h-14 rounded-full object-cover bg-[#E8EFFB]" />
                  <div className="min-w-0">
                    <div className="font-display text-[19px] font-bold text-[#111827]">{app.applicant?.full_name || 'Applicant'}</div>
                    <div className="text-[15px] text-[#64748B] truncate">{app.applicant?.email}</div>
                    <div className="text-[13px] text-[#94A3B8] mt-1">Applied {formatDate(app.created_at)}</div>
                    <span className={`mt-2 inline-flex px-2.5 h-7 items-center rounded-full text-[13px] font-semibold ${app.status === 'pending' ? 'bg-amber-50 text-amber-700' : app.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{app.status}</span>
                  </div>
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="text-[17px] font-semibold text-[#111827]">{app.headline || '—'}</div>
                  {app.expertise && <div className="text-[15px] text-[#004AAD]">Expertise: {app.expertise}</div>}
                  <p className="text-[16px] leading-relaxed text-[#475569] whitespace-pre-line">{app.bio || 'No bio provided yet.'}</p>
                  {app.website && (
                    <a href={app.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[15px] text-[#004AAD] underline underline-offset-4">
                      Portfolio <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                  {app.admin_note && <div className="text-[14px] text-[#64748B]">Reviewer note: {app.admin_note}</div>}
                </div>
                {app.status === 'pending' && (
                  <div className="lg:w-72 shrink-0 space-y-3">
                    <textarea
                      rows={2}
                      placeholder="Note to applicant (optional)"
                      value={notes[app.id] || ''}
                      onChange={(e) => setNotes({ ...notes, [app.id]: e.target.value })}
                      className="ed-field !h-auto py-3"
                    />
                    <div className="flex gap-2">
                      <button disabled={busy === app.id} onClick={() => review(app, true)} className="ed-btn ed-btn-filled ed-btn-sm flex-1"><Check className="w-4 h-4" /> Approve</button>
                      <button disabled={busy === app.id} onClick={() => review(app, false)} className="ed-btn ed-btn-outlined ed-btn-sm flex-1"><X className="w-4 h-4" /> Reject</button>
                    </div>
                  </div>
                )}
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="bg-white rounded-[20px] border border-[#E2E8F0] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[15px]">
              <thead className="bg-[#F7F9FC] text-[13px] uppercase tracking-wide text-[#64748B]">
                <tr>
                  <th className="px-6 py-3">Instructor</th>
                  <th className="px-6 py-3 text-right">Courses</th>
                  <th className="px-6 py-3 text-right">Students</th>
                  <th className="px-6 py-3 text-right">Gross sales</th>
                  <th className="px-6 py-3 text-right">Earnings</th>
                  <th className="px-6 py-3 text-right">Rating</th>
                  <th className="px-6 py-3">Joined</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEF2F7]">
                {instructors.map((i) => (
                  <tr key={i.id}>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <img src={i.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover bg-[#E8EFFB]" />
                        <div className="min-w-0"><div className="font-semibold text-[#111827]">{i.full_name}</div><div className="text-[13px] text-[#64748B] truncate">{i.email}</div></div>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-right tabular-nums">
                      {i.courses}
                      <div className="text-[12px] text-[#64748B]">{i.published_courses} live{i.pending_courses ? ` · ${i.pending_courses} in review` : ''}</div>
                    </td>
                    <td className="px-6 py-3 text-right tabular-nums">{i.students}</td>
                    <td className="px-6 py-3 text-right tabular-nums">{inr(i.gross_revenue)}</td>
                    <td className="px-6 py-3 text-right tabular-nums font-semibold text-[#5E17EB]">{inr(i.instructor_earnings)}</td>
                    <td className="px-6 py-3 text-right tabular-nums">{i.avg_rating ? i.avg_rating.toFixed(1) : '—'}</td>
                    <td className="px-6 py-3 whitespace-nowrap">{formatDate(i.joined_at)}</td>
                    <td className="px-6 py-3 text-right">
                      <button disabled={busy === i.id} onClick={() => revoke(i)} className="ed-btn ed-btn-text ed-btn-sm !text-rose-600"><UserMinus className="w-4 h-4" /> Revoke</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {instructors.length === 0 && <EmptyState title="No instructors yet" body="Approve an application to add your first instructor." />}
          </div>
        </section>
      )}
    </div>
  );
};
