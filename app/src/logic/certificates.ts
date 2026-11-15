import { EDUFY_LOGO_DATA_URI } from './brandLogo';
/** Pure certificate helpers. Certificates are issued only by the server (/api/certificates/claim). */
export interface Certificate {
  id: string;
  code: string;
  courseId: string;
  courseTitle: string;
  studentName: string;
  instructorName: string | null;
  issueDate: string;
  verificationHash: string | null;
}

export function mapCertificate(row: any): Certificate {
  return {
    id: String(row.id || row.certificate_code),
    code: String(row.certificate_code || '').toUpperCase(),
    courseId: String(row.course_id || ''),
    courseTitle: row.course_title || 'Edufy course',
    studentName: row.student_name || 'Edufy Learner',
    instructorName: row.instructor_name || null,
    issueDate: row.issue_date || row.created_at || '',
    verificationHash: row.verification_hash || null,
  };
}

/** Same rule the server enforces: every lesson in the current curriculum completed. */
export const isCourseComplete = (p: { completed: number; total: number } | null | undefined) => !!p && p.total > 0 && p.completed >= p.total;

export const CERT_CODE_RE = /^[A-Z0-9][A-Z0-9-]{5,40}$/;
export const normaliseCertCode = (input: string) => input.trim().toUpperCase().replace(/\s+/g, '');

/** Public verification link on the Edufy website (the page reads ?code= and verifies it). */
export function verificationUrl(webUrl: string, code: string) {
  return `${webUrl.replace(/\/+$/, '')}/verify-certificate?code=${encodeURIComponent(code)}`;
}

export const escapeHtml = (s: string) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export function formatIssueDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Printable A4-landscape certificate (used for PDF export). All dynamic text is HTML-escaped. */
/** Edufy brand mark (official emblem) for the printable certificate. */
export const EDUFY_LOGO_SVG = `<img src="${EDUFY_LOGO_DATA_URI}" alt="Edufy Academy" />`;

export function certificateHtml(c: Certificate, opts: { verifyUrl: string; qrSvg?: string }) {
  const e = escapeHtml;
  return `<!doctype html><html><head><meta charset="utf-8">
<style>
@page { size: A4 landscape; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; width: 297mm; height: 210mm; font-family: 'Helvetica Neue', Arial, sans-serif; color: #111827; }
.page { width: 297mm; height: 210mm; padding: 12mm; background: #ffffff; }
.frame { position: relative; width: 100%; height: 100%; border: 2.5mm solid #004AAD; border-radius: 6mm; padding: 14mm 18mm; overflow: hidden;
  background: linear-gradient(135deg, #ffffff 0%, #F5F8FF 55%, #EEF1FF 100%); }
.frame:before { content: ''; position: absolute; inset: 3mm; border: 0.6mm solid #5271FF; border-radius: 4mm; opacity: .5; }
.ribbon { position: absolute; right: -30mm; top: -30mm; width: 90mm; height: 90mm; border-radius: 50%; background: radial-gradient(circle, rgba(94,23,235,.12), rgba(94,23,235,0) 70%); }
.brand { display: flex; align-items: center; gap: 4mm; }
.brand img { width: 16mm; height: 16mm; object-fit: contain; }
.brand .name { font-size: 7mm; font-weight: 800; letter-spacing: -.2mm; }
.brand .name span { color: #5271FF; }
.brand .tag { font-size: 2.6mm; letter-spacing: .8mm; color: #64748B; font-weight: 600; }
.title { margin-top: 12mm; font-size: 4mm; letter-spacing: 1.6mm; text-transform: uppercase; color: #5E17EB; font-weight: 700; }
.h1 { font-size: 6mm; font-weight: 700; margin: 3mm 0 0; color: #004AAD; }
.lead { margin-top: 8mm; font-size: 4.2mm; color: #475569; }
.student { margin-top: 3mm; font-size: 15mm; font-weight: 800; color: #111827; border-bottom: .5mm solid #CBD5E1; display: inline-block; padding-bottom: 2mm; min-width: 140mm; }
.course { margin-top: 6mm; font-size: 6.4mm; font-weight: 700; color: #111827; max-width: 190mm; line-height: 1.25; }
.footer { position: absolute; left: 18mm; right: 18mm; bottom: 14mm; display: flex; align-items: flex-end; justify-content: space-between; gap: 8mm; }
.meta div { font-size: 3.2mm; color: #475569; margin-top: 1.4mm; }
.meta b { color: #111827; }
.sign { text-align: center; }
.sign .line { width: 60mm; border-top: .5mm solid #111827; margin: 0 auto 2mm; }
.sign .who { font-size: 3.6mm; font-weight: 700; }
.sign .role { font-size: 3mm; color: #64748B; }
.qr { text-align: center; font-size: 2.6mm; color: #64748B; }
.qr svg, .qr img { width: 30mm; height: 30mm; display: block; margin: 0 auto 1.5mm; }
</style></head><body><div class="page"><div class="frame"><div class="ribbon"></div>
<div class="brand">${EDUFY_LOGO_SVG}<div><div class="name">Edufy <span>Academy</span></div><div class="tag">EXCELLENCE IN LEARNING</div></div></div>
<div class="title">Certificate of Completion</div>
<div class="h1">This certifies that</div>
<div class="student">${e(c.studentName)}</div>
<div class="lead">has successfully completed all lessons of the course</div>
<div class="course">${e(c.courseTitle)}</div>
<div class="footer">
  <div class="meta">
    <div>Completed on <b>${e(formatIssueDate(c.issueDate))}</b></div>
    <div>Certificate ID <b>${e(c.code)}</b></div>
    <div>Issued by <b>Edufy Academy</b> (Educurist Learning Solutions)</div>
    <div>Verify at ${e(opts.verifyUrl)}</div>
  </div>
  <div class="sign"><div class="line"></div><div class="who">${e(c.instructorName || 'Edufy Academy')}</div><div class="role">Course Instructor · Edufy Academy</div></div>
  <div class="qr">${opts.qrSvg || ''}Scan to verify</div>
</div></div></div></body></html>`;
}
