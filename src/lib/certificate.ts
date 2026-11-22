/** Shared helpers for the Edufy course-completion certificate (web). Pure functions; unit-tested. */

export const CERT_BRAND = {
  blue: '#004AAD',
  blue2: '#5271FF',
  purple: '#5E17EB',
  gold: '#B8913A',
  goldLight: '#E2C47A',
  ink: '#1B2236',
  ivory: '#FFFDF7',
} as const;

/** A4 landscape at 96 dpi: 297 × 210 mm */
export const CERT_SIZE = { width: 1123, height: 794 } as const;

/** Public verification address printed on the certificate and encoded in its QR code. */
export function verificationUrl(siteUrl: string, code: string): string {
  return `${siteUrl.replace(/\/+$/, '')}/verify-certificate?code=${encodeURIComponent(code)}`;
}

/** "22 November 2026" (date-only strings are read as calendar dates, never shifted by time zone). */
export function formatCertificateDate(value: string | null | undefined): string {
  if (!value) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  const date = m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
}

/** "2.5 hours", "1 hour", "45 minutes"; null when the length is unknown or zero. */
export function formatCourseHours(hours: number | null | undefined): string | null {
  if (hours == null || !Number.isFinite(hours) || hours <= 0) return null;
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} minutes`;
  const rounded = Math.round(hours * 10) / 10;
  return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)} ${rounded === 1 ? 'hour' : 'hours'}`;
}

/**
 * Font size for a line of text that must fit a box: shrinks with length, never below `min`.
 * `avgCharEm` is the average glyph width of the font in em. Used as the starting size; the
 * component then measures the rendered text and shrinks further if needed.
 */
export function fitFontSize(text: string, opts: { max: number; min: number; width: number; lines?: number; avgCharEm?: number }): number {
  const { max, min, width, lines = 1, avgCharEm = 0.52 } = opts;
  const chars = Math.max(1, text.trim().length);
  const ideal = (width * lines * 0.92) / (chars * avgCharEm);
  return Math.max(min, Math.min(max, Math.floor(ideal)));
}

/** LinkedIn "Add licence or certification" link, prefilled. */
export function linkedInAddUrl(c: { courseTitle: string; issueDate: string; certificateCode: string }, verifyUrl: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(c.issueDate || '');
  const params = new URLSearchParams({
    startTask: 'CERTIFICATION_NAME',
    name: c.courseTitle,
    organizationName: 'Edufy Academy',
    certUrl: verifyUrl,
    certId: c.certificateCode,
  });
  if (m) {
    params.set('issueYear', m[1]);
    params.set('issueMonth', String(Number(m[2])));
  }
  return `https://www.linkedin.com/profile/add?${params.toString()}`;
}

/** File name used when the certificate is saved as a PDF. */
export function certificateFileName(c: { studentName: string; courseTitle: string }): string {
  const slug = (s: string) =>
    s
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);
  return ['Edufy-Certificate', slug(c.courseTitle), slug(c.studentName)].filter(Boolean).join('-');
}
