import React, { useEffect, useMemo, useState } from 'react';
import { Search, X, Users, BookOpen, Award, Activity } from 'lucide-react';
import { adminConsoleService, StudentDetail, StudentOverviewRow } from '../../services/api';
import { AdminPageHeader, StatCard, inr, formatDate, EmptyState, ErrorBanner, ProgressBar } from '../../components/admin/AdminUI';

export const AdminStudentsPage: React.FC = () => {
  const [rows, setRows] = useState<StudentOverviewRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'recent' | 'active' | 'progress' | 'spent'>('recent');
  const [selected, setSelected] = useState<StudentOverviewRow | null>(null);
  const [detail, setDetail] = useState<StudentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    adminConsoleService.getStudents().then(setRows).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!selected) return;
    setDetail(null);
    setDetailLoading(true);
    adminConsoleService
      .getStudentDetail(selected.id)
      .then(setDetail)
      .catch((e) => setError(e.message))
      .finally(() => setDetailLoading(false));
  }, [selected]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = rows.filter((r) => !q || r.full_name?.toLowerCase().includes(q) || r.email?.toLowerCase().includes(q));
    const by = {
      recent: (a: StudentOverviewRow, b: StudentOverviewRow) => +new Date(b.joined_at) - +new Date(a.joined_at),
      active: (a: StudentOverviewRow, b: StudentOverviewRow) => +new Date(b.last_active || 0) - +new Date(a.last_active || 0),
      progress: (a: StudentOverviewRow, b: StudentOverviewRow) => b.avg_progress - a.avg_progress,
      spent: (a: StudentOverviewRow, b: StudentOverviewRow) => b.total_spent - a.total_spent,
    }[sort];
    return [...list].sort(by);
  }, [rows, query, sort]);

  const weekAgo = Date.now() - 7 * 864e5;
  const activeThisWeek = rows.filter((r) => r.last_active && +new Date(r.last_active) > weekAgo).length;
  const totalEnrollments = rows.reduce((s, r) => s + r.enrollments, 0);
  const certificates = rows.reduce((s, r) => s + r.completed_courses, 0);

  return (
    <div>
      <AdminPageHeader eyebrow="People" title="Students" description="Every learner's enrolments, progress, quiz results, certificates and payments." />
      {error && <ErrorBanner message={error} />}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard label="Students" value={rows.length} icon={Users} />
        <StatCard label="Active in last 7 days" value={activeThisWeek} icon={Activity} tone="green" />
        <StatCard label="Enrolments" value={totalEnrollments} icon={BookOpen} tone="purple" />
        <StatCard label="Certificates issued" value={certificates} icon={Award} tone="ink" />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="w-5 h-5 text-[#94A3B8] absolute left-4 top-1/2 -translate-y-1/2" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or email" className="ed-field pl-12" />
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value as any)} className="ed-field sm:w-60">
          <option value="recent">Newest first</option>
          <option value="active">Recently active</option>
          <option value="progress">Highest progress</option>
          <option value="spent">Highest spend</option>
        </select>
      </div>

      <section className="bg-white rounded-[20px] border border-[#E2E8F0] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[15px]">
            <thead className="bg-[#F7F9FC] text-[13px] uppercase tracking-wide text-[#64748B]">
              <tr>
                <th className="px-6 py-3">Student</th>
                <th className="px-6 py-3 text-right">Courses</th>
                <th className="px-6 py-3 w-48">Avg. progress</th>
                <th className="px-6 py-3 text-right">Lessons done</th>
                <th className="px-6 py-3 text-right">Certificates</th>
                <th className="px-6 py-3 text-right">Spent</th>
                <th className="px-6 py-3">Last active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2F7]">
              {filtered.map((r) => (
                <tr key={r.id} onClick={() => setSelected(r)} className="cursor-pointer hover:bg-[#F7F9FC]">
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-3">
                      <img src={r.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover bg-[#E8EFFB]" />
                      <div className="min-w-0"><div className="font-semibold text-[#111827]">{r.full_name}</div><div className="text-[13px] text-[#64748B] truncate">{r.email}</div></div>
                    </div>
                  </td>
                  <td className="px-6 py-3 text-right tabular-nums">{r.enrollments}</td>
                  <td className="px-6 py-3"><ProgressBar value={r.avg_progress} /></td>
                  <td className="px-6 py-3 text-right tabular-nums">{r.lessons_completed}</td>
                  <td className="px-6 py-3 text-right tabular-nums">{r.completed_courses}</td>
                  <td className="px-6 py-3 text-right tabular-nums">{inr(r.total_spent)}</td>
                  <td className="px-6 py-3 whitespace-nowrap">{formatDate(r.last_active)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <EmptyState title="No students found" />}
        </div>
      </section>

      {/* Student detail drawer */}
      {selected && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Student details">
          <div className="absolute inset-0 bg-[#111827]/40" onClick={() => setSelected(null)} />
          <aside className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-2xl flex flex-col edufy-slide">
            <div className="flex items-start justify-between gap-4 p-6 border-b border-[#EEF2F7]">
              <div className="flex items-center gap-4 min-w-0">
                <img src={selected.avatar_url} alt="" className="w-14 h-14 rounded-full object-cover bg-[#E8EFFB]" />
                <div className="min-w-0">
                  <div className="font-display text-[22px] font-bold text-[#111827] truncate">{selected.full_name}</div>
                  <div className="text-[15px] text-[#64748B] truncate">{selected.email}{detail?.profile?.phone ? ` · ${detail.profile.phone}` : ''}</div>
                  <div className="text-[13px] text-[#94A3B8]">Joined {formatDate(selected.joined_at)}</div>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="w-10 h-10 rounded-full hover:bg-[#F1F5F9] flex items-center justify-center" aria-label="Close"><X className="w-5 h-5" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {detailLoading && <div className="text-[#64748B]">Loading learner activity…</div>}
              {detail && (
                <>
                  <section>
                    <h3 className="font-display text-[18px] font-bold text-[#111827] mb-3">Course progress</h3>
                    {detail.courses.length === 0 ? (
                      <div className="text-[15px] text-[#64748B]">Not enrolled in any course yet.</div>
                    ) : (
                      <ul className="space-y-3">
                        {detail.courses.map((c) => {
                          const pct = c.total_lessons ? Math.min(100, (c.completed_lessons / c.total_lessons) * 100) : 0;
                          return (
                            <li key={c.course_id} className="p-4 rounded-2xl border border-[#E2E8F0]">
                              <div className="flex gap-4">
                                <img src={c.thumbnail_url} alt="" className="w-20 h-14 rounded-lg object-cover bg-[#E8EFFB]" />
                                <div className="flex-1 min-w-0">
                                  <div className="font-semibold text-[#111827] truncate">{c.title}</div>
                                  <div className="text-[13px] text-[#64748B]">
                                    Enrolled {formatDate(c.enrolled_at)}{c.via_bundle ? ` · via “${c.via_bundle}”` : ''} · last activity {formatDate(c.last_activity)}
                                  </div>
                                  <div className="mt-2"><ProgressBar value={pct} /></div>
                                  <div className="mt-2 flex flex-wrap gap-2 text-[13px]">
                                    <span className="px-2 h-6 inline-flex items-center rounded-md bg-[#F1F5F9]">{c.completed_lessons}/{c.total_lessons} lessons</span>
                                    {c.best_quiz_score !== null && <span className="px-2 h-6 inline-flex items-center rounded-md bg-[#F1EAFE] text-[#5E17EB]">Best quiz {c.best_quiz_score}%</span>}
                                    {c.certificate_code && <span className="px-2 h-6 inline-flex items-center rounded-md bg-emerald-50 text-emerald-700">Certificate {c.certificate_code}</span>}
                                    {c.status !== 'active' && <span className="px-2 h-6 inline-flex items-center rounded-md bg-rose-50 text-rose-700">{c.status}</span>}
                                  </div>
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </section>

                  <section>
                    <h3 className="font-display text-[18px] font-bold text-[#111827] mb-3">Payments</h3>
                    {detail.payments.length === 0 ? (
                      <div className="text-[15px] text-[#64748B]">No payments.</div>
                    ) : (
                      <ul className="divide-y divide-[#EEF2F7] border-y border-[#EEF2F7]">
                        {detail.payments.map((p) => (
                          <li key={p.order_id} className="py-3 flex items-center justify-between gap-3 text-[15px]">
                            <div className="min-w-0"><div className="font-medium text-[#111827] truncate">{p.item}</div><div className="text-[13px] text-[#64748B]">{formatDate(p.created_at)} · {p.order_id}</div></div>
                            <div className="text-right shrink-0"><div className="font-semibold tabular-nums">{inr(p.amount)}</div><div className="text-[13px] text-[#64748B]">{p.status}</div></div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
};
