import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { certificateService } from '../../services/api';
import { Certificate } from '../../types';
import { CertificateFrame } from '../../components/certificate/CertificateDocument';
import { formatCertificateDate, formatCourseHours } from '../../lib/certificate';
import { siteUrl } from '../../lib/siteUrl';
import { ShieldCheck, Search, CheckCircle2, XCircle, ShieldAlert, Loader2 } from 'lucide-react';

type Result =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'valid' | 'revoked'; certificate: Certificate }
  | { state: 'not-found'; message: string };

/**
 * Public certificate verification: /verify-certificate?code=EDFY-2026-XXXX-XXXX-XXXX (the QR code on every
 * certificate opens this). Shows only what is printed on the certificate, plus its current status.
 */
export const CertificateVerificationPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [code, setCode] = useState((searchParams.get('code') || '').trim().toUpperCase());
  const [result, setResult] = useState<Result>({ state: 'idle' });

  const verify = async (raw: string) => {
    const clean = raw.trim().toUpperCase();
    if (!clean) return;
    setResult({ state: 'loading' });
    const res = await certificateService.verifyCertificate(clean);
    if (res.certificate) setResult({ state: res.revoked ? 'revoked' : 'valid', certificate: res.certificate });
    else setResult({ state: 'not-found', message: res.error || 'No certificate matches this ID.' });
  };

  useEffect(() => {
    const fromLink = (searchParams.get('code') || '').trim();
    if (fromLink) verify(fromLink);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = code.trim().toUpperCase();
    if (!clean) return;
    setSearchParams({ code: clean }, { replace: true });
    verify(clean);
  };

  const cert = result.state === 'valid' || result.state === 'revoked' ? result.certificate : null;
  const hours = cert ? formatCourseHours(cert.courseHours) : null;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-8">
      <div className="text-center max-w-xl mx-auto space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-[#EBF3FF] text-[#004AAD] flex items-center justify-center mx-auto">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h1 className="font-display text-3xl font-extrabold text-[#111827]">Verify an Edufy certificate</h1>
        <p className="text-sm text-[#64748B] leading-relaxed">
          Enter the certificate ID printed at the bottom left of an Edufy Academy certificate, or scan its QR code.
        </p>
      </div>

      <form onSubmit={onSubmit} className="bg-white p-5 sm:p-6 rounded-2xl border border-[#E2E8F0] shadow-sm flex flex-col sm:flex-row gap-3 max-w-2xl mx-auto">
        <label htmlFor="certificate-id" className="sr-only">Certificate ID</label>
        <div className="relative flex-1">
          <input
            id="certificate-id"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="EDFY-2026-XXXX-XXXX-XXXX"
            autoComplete="off"
            spellCheck={false}
            className="w-full pl-10 pr-4 py-3 text-sm bg-[#F7F9FC] border border-[#E2E8F0] rounded-xl font-mono uppercase focus:outline-none focus:border-[#004AAD] focus:ring-2 focus:ring-[#004AAD]/20"
          />
          <Search className="w-5 h-5 text-[#64748B] absolute left-3 top-3" aria-hidden="true" />
        </div>
        <button
          type="submit"
          disabled={result.state === 'loading'}
          className="px-6 py-3 text-sm font-semibold text-white bg-[#004AAD] hover:bg-[#003B8B] disabled:opacity-60 rounded-full transition-colors inline-flex items-center justify-center gap-2"
        >
          {result.state === 'loading' && <Loader2 className="w-4 h-4 animate-spin" />}
          {result.state === 'loading' ? 'Checking…' : 'Verify certificate'}
        </button>
      </form>

      {result.state === 'not-found' && (
        <div className="bg-white rounded-2xl border border-rose-200 p-8 text-center space-y-2 max-w-2xl mx-auto" role="status">
          <XCircle className="w-10 h-10 text-rose-500 mx-auto" />
          <h2 className="font-display text-lg font-bold text-rose-950">Certificate not found</h2>
          <p className="text-sm text-[#64748B]">{result.message}</p>
        </div>
      )}

      {cert && (
        <div className="space-y-6" role="status">
          {result.state === 'valid' ? (
            <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h2 className="font-display text-lg font-bold text-emerald-950">Valid certificate</h2>
                <p className="text-sm text-emerald-900/80">
                  Edufy Academy issued this certificate to <strong>{cert.studentName}</strong> for completing{' '}
                  <strong>{cert.courseTitle}</strong> on {formatCertificateDate(cert.issueDate)}.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4">
              <ShieldAlert className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
              <div>
                <h2 className="font-display text-lg font-bold text-red-950">This certificate has been revoked</h2>
                <p className="text-sm text-red-900/80">
                  Edufy Academy issued certificate {cert.certificateCode} but has since revoked it, so it is no longer valid.
                </p>
              </div>
            </div>
          )}

          <div className="grid lg:grid-cols-[1fr_280px] gap-6 items-start">
            <div className="rounded-2xl bg-[#EEF1F7] p-3 sm:p-5">
              <div className="shadow-lg overflow-hidden rounded-sm">
                <CertificateFrame certificate={cert} siteUrl={siteUrl()} />
              </div>
            </div>
            <dl className="bg-white rounded-2xl border border-[#E2E8F0] p-5 grid grid-cols-1 gap-4 text-sm">
              {[
                ['Status', result.state === 'valid' ? 'Valid' : 'Revoked'],
                ['Certificate ID', cert.certificateCode],
                ['Awarded to', cert.studentName],
                ['Course', cert.courseTitle],
                ['Completion date', formatCertificateDate(cert.issueDate)],
                ['Instructor', cert.instructorName],
                ...(hours ? [['Course duration', hours]] : []),
                ['Issued by', 'Edufy Academy'],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">{label}</dt>
                  <dd
                    className={`mt-0.5 font-semibold break-words ${
                      label === 'Status' ? (result.state === 'valid' ? 'text-emerald-700' : 'text-red-700') : 'text-[#111827]'
                    } ${label === 'Certificate ID' ? 'font-mono text-[13px]' : ''}`}
                  >
                    {value}
                  </dd>
                </div>
              ))}
              {cert.courseId && (
                <Link to={`/courses/${cert.courseId}`} className="text-sm font-semibold text-[#004AAD] hover:underline">
                  View the course
                </Link>
              )}
            </dl>
          </div>
        </div>
      )}
    </div>
  );
};
