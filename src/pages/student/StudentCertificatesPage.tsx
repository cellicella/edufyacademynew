import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { certificateService } from '../../services/api';
import { Certificate } from '../../types';
import { EdufyLogo } from '../../components/common/EdufyLogo';
import { Award, Download, CheckCircle2, Hash, ExternalLink, X, BookOpen, Compass } from 'lucide-react';

export const StudentCertificatesPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [selectedCert, setSelectedCert] = useState<Certificate | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentUser?.id) {
      setLoading(true);
      certificateService
        .getStudentCertificates(currentUser.id)
        .then(setCertificates)
        .finally(() => setLoading(false));
    } else {
      setCertificates([]);
      setLoading(false);
    }
  }, [currentUser?.id]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="h-8 bg-slate-200 rounded-md w-64 animate-pulse" />
          <div className="h-4 bg-slate-100 rounded-md w-96 mt-2 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 h-56 animate-pulse" />
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 h-56 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#111827]">
          My Verified Certificates
        </h1>
        <p className="text-xs text-[#64748B] mt-0.5">
          Official credentials minted upon 100% curriculum completion and verified assessment grades.
        </p>
      </div>

      {certificates.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-[#E2E8F0] text-center space-y-3">
          <Award className="w-10 h-10 text-[#64748B] mx-auto opacity-40" />
          <h3 className="font-display text-base font-bold text-[#111827]">
            You haven't earned any certificates yet.
          </h3>
          <p className="text-xs text-[#64748B] max-w-sm mx-auto">
            Complete 100% of your course lessons and pass the final evaluation quiz to mint your verifiable cryptographic credential.
          </p>
          <div className="pt-2 flex justify-center gap-3">
            <Link
              to="/student/courses"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#004AAD] hover:bg-[#003B8B] rounded-lg transition-colors shadow-xs"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Go to My Courses</span>
            </Link>
            <Link
              to="/courses"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#004AAD] bg-[#EBF3FF] hover:bg-blue-100 rounded-lg transition-colors"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Explore Catalog</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {certificates.map((cert) => (
            <div
              key={cert.id}
              className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-xs flex flex-col justify-between space-y-4 hover:border-[#5E17EB]/40 transition-colors"
            >
              <div>
                <div className="flex items-center justify-between text-xs mb-3">
                  <span className="font-mono font-bold text-[#5E17EB] bg-[#F4EFFF] px-2 py-0.5 rounded">
                    {cert.certificateCode}
                  </span>
                  <span className="text-[#64748B]">{cert.issueDate}</span>
                </div>

                <h2 className="font-display text-base font-bold text-[#111827] leading-snug">
                  {cert.courseTitle}
                </h2>

                <div className="text-xs text-[#64748B] mt-2 space-y-1">
                  <div>
                    Conferred to: <strong className="text-[#111827]">{cert.studentName}</strong>
                  </div>
                  <div>Instructor: {cert.instructorName}</div>
                  <div>
                    Assessment Grade:{' '}
                    <strong className="text-emerald-600 font-mono">{cert.gradeScore}% (Passed)</strong>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-[#E2E8F0] flex items-center gap-2.5">
                <button
                  onClick={() => setSelectedCert(cert)}
                  className="flex-1 py-2 text-xs font-semibold text-[#004AAD] bg-[#EBF3FF] hover:bg-blue-100 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                >
                  <Award className="w-3.5 h-3.5" />
                  <span>View Digital Diploma</span>
                </button>

                <button
                  onClick={() => setSelectedCert(cert)}
                  className="p-2 border border-[#E2E8F0] rounded-lg text-[#64748B] hover:text-[#111827] hover:bg-[#F8FAFC]"
                  title="View & Print PDF"
                  aria-label="View & Print PDF"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Diploma Modal */}
      {selectedCert && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-8 shadow-2xl relative border border-[#E2E8F0] space-y-6 my-8">
            <button
              onClick={() => setSelectedCert(null)}
              className="absolute top-4 right-4 p-1.5 text-[#64748B] hover:text-[#111827] rounded-lg hover:bg-slate-100"
              aria-label="Close certificate"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Certificate Canvas / Card */}
            <div className="border-8 border-double border-[#004AAD]/20 rounded-xl p-8 text-center space-y-6 bg-gradient-to-b from-white to-slate-50 relative overflow-hidden">
              <div className="flex justify-center">
                <EdufyLogo size="md" />
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-widest text-[#004AAD]">
                  Certificate of Professional Achievement
                </span>
                <p className="text-xs text-[#64748B]">This is to certify that</p>
                <div className="font-display text-2xl font-black text-[#111827] pt-1">
                  {selectedCert.studentName}
                </div>
                <p className="text-xs text-[#64748B]">
                  has successfully mastered the accredited syllabus and completed all requirements for
                </p>
                <div className="font-display text-lg font-bold text-[#004AAD] pt-1 max-w-md mx-auto">
                  {selectedCert.courseTitle}
                </div>
              </div>

              <div className="pt-4 flex items-center justify-between text-xs text-[#64748B] border-t border-slate-200">
                <div className="text-left">
                  <div className="font-semibold text-[#111827]">{selectedCert.instructorName}</div>
                  <div className="text-[10px]">Lead Faculty Instructor</div>
                </div>

                <div className="text-center">
                  <div className="w-12 h-12 mx-auto rounded-full bg-[#EBF3FF] border border-[#004AAD]/30 flex items-center justify-center text-[#004AAD]">
                    <Award className="w-6 h-6" />
                  </div>
                  <div className="text-[9px] font-bold text-[#004AAD] mt-1">VERIFIED CREDENTIAL</div>
                </div>

                <div className="text-right">
                  <div className="font-semibold text-[#111827]">{selectedCert.issueDate}</div>
                  <div className="text-[10px]">Date of Conformance</div>
                </div>
              </div>

              {/* Verification Barcode / Hash Info */}
              <div className="bg-slate-100 p-3 rounded-lg text-left text-[10px] text-[#64748B] font-mono space-y-0.5">
                <div className="flex justify-between">
                  <span>Credential ID: {selectedCert.certificateCode}</span>
                  <span>Assessment Score: {selectedCert.gradeScore}%</span>
                </div>
                <div className="truncate">SHA-256 Hash: {selectedCert.verificationHash}</div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <Link
                to={`/verify?code=${selectedCert.certificateCode}`}
                className="text-xs font-semibold text-[#004AAD] hover:underline flex items-center gap-1"
                target="_blank"
              >
                <span>Public Verification URL</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedCert(null)}
                  className="px-4 py-2 text-xs font-semibold text-[#64748B] hover:text-[#111827]"
                >
                  Close
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#004AAD] hover:bg-[#003B8B] rounded-lg shadow-xs flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Print Certificate</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
