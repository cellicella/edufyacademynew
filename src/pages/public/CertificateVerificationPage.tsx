import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { certificateService } from '../../services/api';
import { Certificate } from '../../types';
import { EdufyLogo } from '../../components/common/EdufyLogo';
import {
  ShieldCheck,
  Search,
  CheckCircle2,
  XCircle,
  Award,
  Calendar,
  User,
  Hash,
  ExternalLink,
} from 'lucide-react';

export const CertificateVerificationPage: React.FC = () => {
  // Supports verification links / QR codes: /verify-certificate?code=EDFY-2026-XXXXXX
  const [searchParams] = useSearchParams();
  const [certCode, setCertCode] = useState((searchParams.get('code') || '').trim().toUpperCase());
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    searched: boolean;
    valid: boolean;
    certificate: Certificate | null;
    error?: string;
  }>({
    searched: false,
    valid: false,
    certificate: null,
  });

  const runVerify = async (code: string) => {
    if (!code.trim()) return;
    setLoading(true);
    const response = await certificateService.verifyCertificate(code.trim());
    setResult({
      searched: true,
      valid: response.valid,
      certificate: response.certificate,
      error: response.error,
    });
    setLoading(false);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    await runVerify(certCode);
  };

  // Auto-verify when opened from a certificate's QR code / link
  useEffect(() => {
    const code = (searchParams.get('code') || '').trim();
    if (code) runVerify(code.toUpperCase());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
      <div className="text-center max-w-xl mx-auto space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-[#EBF3FF] text-[#004AAD] flex items-center justify-center mx-auto">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h1 className="font-display text-3xl font-extrabold text-[#111827]">
          Edufy Certificate Verification
        </h1>
        <p className="text-sm text-[#64748B] leading-relaxed">
          Verify authentic certificates issued by Edufy Academy. Enter the unique 14-character alphanumeric identifier located on any official Edufy diploma.
        </p>
      </div>

      {/* Verification Input Box */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-[#E2E8F0] shadow-sm">
        <form onSubmit={handleVerify} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              value={certCode}
              onChange={(e) => setCertCode(e.target.value.toUpperCase())}
              placeholder="e.g. EDU-2026-98421"
              aria-label="Certificate verification ID"
              className="w-full pl-10 pr-4 py-3 text-sm bg-[#F7F9FC] border border-[#E2E8F0] rounded-xl font-mono focus:outline-none focus:border-[#004AAD] focus:ring-2 focus:ring-[#004AAD]/20 uppercase"
            />
            <Search className="w-5 h-5 text-[#64748B] absolute left-3 top-3.5" />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 text-sm sm:text-sm font-semibold text-white bg-[#004AAD] hover:bg-[#003B8B] rounded-full transition-colors shadow flex items-center justify-center gap-2"
          >
            {loading ? 'Verifying...' : 'Verify Credential'}
          </button>
        </form>
        <p className="mt-3 text-[15px] text-[#64748B]">Enter the code printed on the certificate, for example EDFY-2026-XXXXXX.</p>
      </div>

      {/* Verification Result Showcase */}
      {result.searched && (
        <div>
          {result.valid && result.certificate ? (
            <div className="bg-white rounded-2xl border border-emerald-200 shadow-md p-6 sm:p-10 space-y-6">
              <div className="flex items-center gap-3 pb-6 border-b border-[#E2E8F0]">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                <div>
                  <h3 className="font-display text-lg font-bold text-emerald-950">
                    Officially Verified Edufy Credential
                  </h3>
                  <p className="text-xs text-[#64748B]">
                    This record exists in the Edufy Academy registry and was conferred upon successful completion of curriculum and proctored assessment.
                  </p>
                </div>
              </div>

              {/* Digital Certificate Render */}
              <div className="p-6 sm:p-8 bg-gradient-to-br from-slate-50 to-blue-50/40 rounded-2xl border border-[#E2E8F0] space-y-6">
                <div className="flex justify-between items-start">
                  <EdufyLogo size="sm" />
                  <div className="text-right">
                    <span className="text-[12px] uppercase font-bold text-[#64748B] tracking-wider block">Certificate ID</span>
                    <span className="font-mono font-bold text-xs text-[#111827]">{result.certificate.certificateCode}</span>
                  </div>
                </div>

                <div className="text-center py-4 space-y-2">
                  <div className="text-xs uppercase font-medium text-[#64748B] tracking-widest">
                    This certifies that
                  </div>
                  <div className="font-display text-2xl sm:text-3xl font-extrabold text-[#004AAD]">
                    {result.certificate.studentName}
                  </div>
                  <div className="text-xs text-[#64748B]">
                    has successfully demonstrated mastery and completed all curriculum modules for
                  </div>
                  <div className="font-display text-base sm:text-lg font-bold text-[#111827] max-w-lg mx-auto">
                    {result.certificate.courseTitle}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t border-[#E2E8F0] text-xs">
                  <div>
                    <span className="text-[#64748B] block text-[13px]">Conferred Date</span>
                    <span className="font-semibold text-[#111827]">{result.certificate.issueDate}</span>
                  </div>
                  <div>
                    <span className="text-[#64748B] block text-[13px]">Lead Instructor</span>
                    <span className="font-semibold text-[#111827]">{result.certificate.instructorName}</span>
                  </div>
                  <div>
                    <span className="text-[#64748B] block text-[13px]">Final Assessment Grade</span>
                    <span className="font-semibold text-emerald-600 font-mono">{result.certificate.gradeScore}% (Honors)</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#E2E8F0] flex flex-col sm:flex-row items-center justify-between text-[12px] text-[#64748B] gap-2">
                  <div className="flex items-center gap-1">
                    <Hash className="w-3 h-3" />
                    <span>Cryptographic Verification Hash: </span>
                    <span className="font-mono text-slate-800">{result.certificate.verificationHash}</span>
                  </div>
                  <span className="text-emerald-700 font-semibold">Status: Active & Valid</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-rose-200 shadow-sm p-8 text-center space-y-3">
              <XCircle className="w-10 h-10 text-rose-500 mx-auto" />
              <h3 className="font-display text-lg font-bold text-rose-950">
                Invalid or Unrecognized Certificate
              </h3>
              <p className="text-xs text-[#64748B] max-w-md mx-auto">
                {result.error || 'The entered code does not correspond to any active verified credential in our database. Please inspect the code on your diploma and try again.'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
