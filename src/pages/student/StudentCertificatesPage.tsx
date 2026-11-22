import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCartWishlist } from '../../context/CartWishlistContext';
import { useCourseProgress } from '../../context/CourseProgressContext';
import { certificateService, courseService } from '../../services/api';
import { Certificate } from '../../types';
import { CertificateFrame } from '../../components/certificate/CertificateDocument';
import { CertificatePrintPortal, printCertificate } from '../../components/certificate/CertificatePrint';
import { formatCertificateDate, linkedInAddUrl, verificationUrl } from '../../lib/certificate';
import { siteUrl } from '../../lib/siteUrl';
import { Award, BookOpen, Check, Compass, Copy, Download, ExternalLink, Eye, Loader2, Share2, ShieldAlert, X } from 'lucide-react';

export const StudentCertificatesPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { enrolledCourseIds } = useCartWishlist();
  const { getCourseProgressPercent } = useCourseProgress();
  const [searchParams, setSearchParams] = useSearchParams();
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [selected, setSelected] = useState<Certificate | null>(null);
  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState(false);
  const [issueNote, setIssueNote] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const autoClaimed = useRef(false);
  const site = siteUrl();

  const load = useCallback(async () => {
    if (!currentUser?.id) return [];
    const list = await certificateService.getStudentCertificates(currentUser.id);
    setCertificates(list);
    return list;
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser?.id) {
      setCertificates([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [currentUser?.id, load]);

  // Issue certificates automatically for enrolled courses that are 100% complete but have none yet.
  // The API re-checks enrolment and lesson completion and never issues twice.
  useEffect(() => {
    if (loading || autoClaimed.current || !currentUser?.id || enrolledCourseIds.length === 0) return;
    autoClaimed.current = true;
    const have = new Set(certificates.map((c) => c.courseId));
    (async () => {
      const courses = (await courseService.getAllCourses()).filter(
        (c) => enrolledCourseIds.includes(c.id) && !have.has(c.id) && c.totalLessons > 0 && getCourseProgressPercent(c.id, c.totalLessons) >= 100,
      );
      if (courses.length === 0) return;
      setIssuing(true);
      let issued = 0;
      let lastError: string | null = null;
      for (const course of courses) {
        const res = await certificateService.claimCertificate(course.id);
        if (res.success) issued += 1;
        else lastError = res.error || null;
      }
      setIssuing(false);
      if (issued > 0) await load();
      if (lastError) setIssueNote(lastError);
    })().catch(() => setIssuing(false));
  }, [loading, certificates, currentUser?.id, enrolledCourseIds, getCourseProgressPercent, load]);

  // Open a certificate from a link: /student/certificates?open=<id or certificate ID>
  useEffect(() => {
    const open = searchParams.get('open');
    if (!open || certificates.length === 0) return;
    const match = certificates.find((c) => c.id === open || c.certificateCode === open.toUpperCase());
    if (match) setSelected(match);
  }, [searchParams, certificates]);

  const closePreview = () => {
    setSelected(null);
    setCopied(false);
    if (searchParams.get('open')) {
      searchParams.delete('open');
      setSearchParams(searchParams, { replace: true });
    }
  };

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closePreview();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const verifyUrl = useMemo(() => (selected ? verificationUrl(site, selected.certificateCode) : ''), [selected, site]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(verifyUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy your verification link', verifyUrl);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="h-8 bg-slate-200 rounded-md w-64 animate-pulse" />
          <div className="h-4 bg-slate-100 rounded-md w-96 max-w-full mt-2 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-[#E2E8F0] h-72 animate-pulse" />
          <div className="bg-white rounded-2xl border border-[#E2E8F0] h-72 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#111827]">My certificates</h1>
          <p className="text-sm text-[#64748B] mt-1">
            You get a certificate automatically when you complete every lesson of a course. Download it as a PDF or add it to LinkedIn.
          </p>
        </div>
        {issuing && (
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-[#004AAD] bg-[#EBF3FF] px-3 py-1.5 rounded-full">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Issuing your new certificate…
          </span>
        )}
      </div>

      {issueNote && (
        <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">{issueNote}</div>
      )}

      {certificates.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-[#E2E8F0] text-center space-y-3">
          <Award className="w-10 h-10 text-[#64748B] mx-auto opacity-40" />
          <h2 className="font-display text-base font-bold text-[#111827]">No certificates yet</h2>
          <p className="text-sm text-[#64748B] max-w-sm mx-auto">
            Complete every lesson in a course and your certificate appears here, ready to download and share.
          </p>
          <div className="pt-2 flex flex-wrap justify-center gap-3">
            <Link
              to="/student/courses"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-[#004AAD] hover:bg-[#003B8B] rounded-full transition-colors"
            >
              <BookOpen className="w-4 h-4" /> Continue learning
            </Link>
            <Link
              to="/courses"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-[#004AAD] bg-[#EBF3FF] hover:bg-blue-100 rounded-full transition-colors"
            >
              <Compass className="w-4 h-4" /> Explore courses
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {certificates.map((cert) => (
            <article key={cert.id} className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden flex flex-col hover:border-[#5271FF]/50 hover:shadow-md transition-all">
              <button type="button" onClick={() => setSelected(cert)} className="block bg-[#EEF1F7] p-3 text-left" aria-label={`Preview certificate for ${cert.courseTitle}`}>
                <div className="rounded-md overflow-hidden shadow-sm pointer-events-none">
                  <CertificateFrame certificate={cert} siteUrl={site} />
                </div>
              </button>
              <div className="p-5 flex flex-col gap-3 flex-1">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-mono font-semibold text-[#5E17EB] bg-[#F4EFFF] px-2 py-0.5 rounded">{cert.certificateCode}</span>
                  {cert.revokedAt ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
                      <ShieldAlert className="w-3.5 h-3.5" /> Revoked
                    </span>
                  ) : (
                    <span className="text-[#64748B]">{formatCertificateDate(cert.issueDate)}</span>
                  )}
                </div>
                <h2 className="font-display text-base font-bold text-[#111827] leading-snug">{cert.courseTitle}</h2>
                <div className="mt-auto flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelected(cert)}
                    className="flex-1 py-2 text-sm font-semibold text-[#004AAD] bg-[#EBF3FF] hover:bg-blue-100 rounded-lg transition-colors inline-flex items-center justify-center gap-1.5"
                  >
                    <Eye className="w-4 h-4" /> Preview
                  </button>
                  <button
                    type="button"
                    disabled={!!cert.revokedAt}
                    onClick={() => setSelected(cert)}
                    className="flex-1 py-2 text-sm font-semibold text-white bg-[#004AAD] hover:bg-[#003B8B] disabled:opacity-40 rounded-lg transition-colors inline-flex items-center justify-center gap-1.5"
                  >
                    <Download className="w-4 h-4" /> Download PDF
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-50 bg-[#0B1020]/70 backdrop-blur-sm flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label={`Certificate for ${selected.courseTitle}`}
          onClick={(e) => e.target === e.currentTarget && closePreview()}
        >
          <div className="bg-white rounded-2xl w-full max-w-5xl shadow-2xl my-4">
            <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-[#E2E8F0]">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-[#64748B]">Certificate preview</div>
                <div className="font-display font-bold text-[#111827] truncate">{selected.courseTitle}</div>
              </div>
              <button type="button" onClick={closePreview} className="p-2 text-[#64748B] hover:text-[#111827] rounded-lg hover:bg-slate-100" aria-label="Close preview">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 sm:p-6 bg-[#EEF1F7]">
              <div className="shadow-lg rounded-sm overflow-hidden">
                <CertificateFrame certificate={selected} siteUrl={site} />
              </div>
            </div>

            {selected.revokedAt ? (
              <div className="px-4 sm:px-6 py-4 text-sm text-red-800 bg-red-50 rounded-b-2xl">
                This certificate has been revoked by Edufy Academy and can't be downloaded. Contact support if you think this is a mistake.
              </div>
            ) : (
              <div className="px-4 sm:px-6 py-4 flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => printCertificate(selected)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#004AAD] hover:bg-[#003B8B] rounded-full shadow-sm"
                >
                  <Download className="w-4 h-4" /> Download PDF
                </button>
                <a
                  href={linkedInAddUrl(selected, verifyUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-[#0A66C2] bg-[#E8F1FB] hover:bg-[#D6E7F8] rounded-full"
                >
                  <Share2 className="w-4 h-4" /> Add to LinkedIn
                </a>
                <button
                  type="button"
                  onClick={copyLink}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-[#334155] bg-slate-100 hover:bg-slate-200 rounded-full"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Link copied' : 'Copy verification link'}
                </button>
                <Link
                  to={`/verify-certificate?code=${encodeURIComponent(selected.certificateCode)}`}
                  target="_blank"
                  className="inline-flex items-center gap-1.5 px-2 py-2.5 text-sm font-semibold text-[#004AAD] hover:underline sm:ml-auto"
                >
                  Verification page <ExternalLink className="w-3.5 h-3.5" />
                </Link>
                <p className="w-full text-xs text-[#64748B]">
                  Download PDF opens your browser's print window. Choose <strong>Save as PDF</strong> as the destination; the page is set to A4 landscape.
                </p>
              </div>
            )}
          </div>
          <CertificatePrintPortal certificate={selected} siteUrl={site} />
        </div>
      )}
    </div>
  );
};
