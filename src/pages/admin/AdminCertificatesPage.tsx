import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Award, Download, ExternalLink, RotateCcw, Search, ShieldAlert, ShieldCheck, X } from 'lucide-react';
import { AdminCertificate, CertificateAuditEntry, certificateService } from '../../services/api';
import { AdminPageHeader, EmptyState, ErrorBanner, StatCard, formatDate } from '../../components/admin/AdminUI';
import { CertificateFrame } from '../../components/certificate/CertificateDocument';
import { CertificatePrintPortal, printCertificate } from '../../components/certificate/CertificatePrint';
import { formatCertificateDate } from '../../lib/certificate';
import { siteUrl } from '../../lib/siteUrl';

const ACTION_LABEL: Record<CertificateAuditEntry['action'], string> = {
  issued: 'Issued',
  revoked: 'Revoked',
  reinstated: 'Reinstated',
};

/** Admin → Certificates: search issued certificates, preview, download, verify, revoke or reinstate. */
export const AdminCertificatesPage: React.FC = () => {
  const [rows, setRows] = useState<AdminCertificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<AdminCertificate | null>(null);
  const [audit, setAudit] = useState<CertificateAuditEntry[]>([]);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const site = siteUrl();

  const load = useCallback(async (term: string) => {
    setLoading(true);
    setError(null);
    try {
      setRows(await certificateService.adminListCertificates(term));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load certificates.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Search as you type (debounced)
  useEffect(() => {
    const t = window.setTimeout(() => load(query), 250);
    return () => window.clearTimeout(t);
  }, [query, load]);

  const open = async (cert: AdminCertificate) => {
    setSelected(cert);
    setReason('');
    setActionError(null);
    setAudit([]);
    try {
      setAudit(await certificateService.adminGetAudit(cert.id));
    } catch {
      /* the audit trail is optional in the preview */
    }
  };

  const changeStatus = async (revoke: boolean) => {
    if (!selected) return;
    if (revoke && !reason.trim()) {
      setActionError('Give a reason for revoking this certificate. It is recorded in the audit trail.');
      return;
    }
    setSaving(true);
    setActionError(null);
    try {
      const updated = await certificateService.adminSetRevoked(selected.id, revoke, reason.trim());
      const merged: AdminCertificate = { ...selected, revokedAt: updated.revokedAt, revokeReason: updated.revokeReason };
      setSelected(merged);
      setRows((list) => list.map((r) => (r.id === merged.id ? merged : r)));
      setReason('');
      setAudit(await certificateService.adminGetAudit(selected.id));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not change the certificate status.');
    } finally {
      setSaving(false);
    }
  };

  const revokedCount = rows.filter((r) => r.revokedAt).length;

  return (
    <div>
      <AdminPageHeader
        eyebrow="Learning"
        title="Certificates"
        description="Every course-completion certificate issued to students. Preview, download, verify, or revoke one with a recorded reason."
      />
      {error && <ErrorBanner message={error} />}

      <div className="grid grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
        <StatCard label={query.trim() ? 'Matching certificates' : 'Certificates issued'} value={rows.length} icon={Award} />
        <StatCard label="Valid" value={rows.length - revokedCount} icon={ShieldCheck} tone="green" />
        <StatCard label="Revoked" value={revokedCount} icon={ShieldAlert} tone="ink" />
      </div>

      <div className="relative mb-4">
        <label htmlFor="certificate-search" className="sr-only">Search certificates</label>
        <Search className="w-5 h-5 text-[#94A3B8] absolute left-4 top-1/2 -translate-y-1/2" aria-hidden="true" />
        <input
          id="certificate-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by student name, course or certificate ID"
          className="ed-field pl-12"
        />
      </div>

      <section className="bg-white rounded-[20px] border border-[#E2E8F0] overflow-hidden">
        {loading && rows.length === 0 ? (
          <div className="p-6 space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-10 rounded-lg bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            title={query.trim() ? 'No certificates match your search' : 'No certificates issued yet'}
            body={query.trim() ? 'Try part of the student name, the course title or the certificate ID.' : 'Certificates appear here when students complete every lesson of a course.'}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[15px]">
              <thead className="bg-[#F7F9FC] text-[13px] uppercase tracking-wide text-[#64748B]">
                <tr>
                  <th className="px-6 py-3">Student</th>
                  <th className="px-6 py-3">Course</th>
                  <th className="px-6 py-3">Certificate ID</th>
                  <th className="px-6 py-3">Issued</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEF2F7]">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-[#FAFBFD]">
                    <td className="px-6 py-3">
                      <div className="font-semibold text-[#111827]">{r.studentName}</div>
                      {r.studentEmail && <div className="text-[13px] text-[#64748B]">{r.studentEmail}</div>}
                    </td>
                    <td className="px-6 py-3 max-w-[320px]">
                      <div className="text-[#111827] line-clamp-2">{r.courseTitle}</div>
                    </td>
                    <td className="px-6 py-3 font-mono text-[13px] whitespace-nowrap">{r.certificateCode}</td>
                    <td className="px-6 py-3 whitespace-nowrap text-[#475569]">{formatDate(r.issueDate)}</td>
                    <td className="px-6 py-3">
                      {r.revokedAt ? (
                        <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-red-700 bg-red-50 px-2.5 py-1 rounded-full">Revoked</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">Valid</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <button type="button" onClick={() => open(r)} className="text-[14px] font-semibold text-[#004AAD] hover:underline">
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selected && (
        <div
          className="fixed inset-0 z-50 bg-[#0B1020]/70 backdrop-blur-sm flex items-start justify-center p-3 sm:p-6 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label={`Certificate ${selected.certificateCode}`}
          onClick={(e) => e.target === e.currentTarget && setSelected(null)}
        >
          <div className="bg-white rounded-2xl w-full max-w-5xl shadow-2xl my-4">
            <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-3 border-b border-[#E2E8F0]">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-[#64748B] font-mono">{selected.certificateCode}</div>
                <div className="font-display font-bold text-[#111827] truncate">
                  {selected.studentName} · {selected.courseTitle}
                </div>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="p-2 text-[#64748B] hover:text-[#111827] rounded-lg hover:bg-slate-100" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid lg:grid-cols-[1fr_300px]">
              <div className="p-3 sm:p-5 bg-[#EEF1F7]">
                <div className="shadow-lg overflow-hidden rounded-sm">
                  <CertificateFrame certificate={selected} siteUrl={site} />
                </div>
                <div className="flex flex-wrap gap-2.5 mt-4">
                  <button
                    type="button"
                    onClick={() => printCertificate(selected)}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#004AAD] hover:bg-[#003B8B] rounded-full"
                  >
                    <Download className="w-4 h-4" /> Download PDF
                  </button>
                  <Link
                    to={`/verify-certificate?code=${encodeURIComponent(selected.certificateCode)}`}
                    target="_blank"
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-[#004AAD] bg-white hover:bg-blue-50 rounded-full border border-[#D6E2F5]"
                  >
                    Verify <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>

              <aside className="p-5 space-y-5 text-sm">
                <dl className="space-y-3">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Status</dt>
                    <dd className={`font-semibold ${selected.revokedAt ? 'text-red-700' : 'text-emerald-700'}`}>
                      {selected.revokedAt ? `Revoked on ${formatDate(selected.revokedAt)}` : 'Valid'}
                    </dd>
                  </div>
                  {selected.revokeReason && (
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Reason</dt>
                      <dd className="text-[#111827]">{selected.revokeReason}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Student</dt>
                    <dd className="text-[#111827]">
                      {selected.studentName}
                      {selected.studentEmail && <span className="block text-[#64748B]">{selected.studentEmail}</span>}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Completion date</dt>
                    <dd className="text-[#111827]">{formatCertificateDate(selected.issueDate)}</dd>
                  </div>
                </dl>

                <div className="border-t border-[#E2E8F0] pt-4 space-y-2.5">
                  {selected.revokedAt ? (
                    <>
                      <label htmlFor="reinstate-note" className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Note (optional)</label>
                      <textarea id="reinstate-note" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="ed-field text-sm" placeholder="Why it is being reinstated" />
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => changeStatus(false)}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-60 rounded-full"
                      >
                        <RotateCcw className="w-4 h-4" /> {saving ? 'Saving…' : 'Reinstate certificate'}
                      </button>
                    </>
                  ) : (
                    <>
                      <label htmlFor="revoke-reason" className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Reason for revoking</label>
                      <textarea id="revoke-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="ed-field text-sm" placeholder="For example: payment refunded" />
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => changeStatus(true)}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-60 rounded-full"
                      >
                        <ShieldAlert className="w-4 h-4" /> {saving ? 'Saving…' : 'Revoke certificate'}
                      </button>
                      <p className="text-xs text-[#64748B]">The verification page will show it as revoked. You can reinstate it later.</p>
                    </>
                  )}
                  {actionError && <p className="text-xs text-red-700">{actionError}</p>}
                </div>

                <div className="border-t border-[#E2E8F0] pt-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-[#64748B] mb-2">Audit trail</h3>
                  {audit.length === 0 ? (
                    <p className="text-xs text-[#64748B]">No entries yet.</p>
                  ) : (
                    <ol className="space-y-2">
                      {audit.map((a) => (
                        <li key={a.id} className="text-xs">
                          <span className="font-semibold text-[#111827]">{ACTION_LABEL[a.action]}</span>
                          <span className="text-[#64748B]"> · {formatDate(a.createdAt)}{a.actorName ? ` · ${a.actorName}` : ''}</span>
                          {a.reason && <div className="text-[#475569]">{a.reason}</div>}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </aside>
            </div>
          </div>
          <CertificatePrintPortal certificate={selected} siteUrl={site} />
        </div>
      )}
    </div>
  );
};
