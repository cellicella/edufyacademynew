import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { qrMatrix, qrSvgPath } from '../src/lib/qr';
import {
  certificateFileName,
  fitFontSize,
  formatCertificateDate,
  formatCourseHours,
  linkedInAddUrl,
  verificationUrl,
} from '../src/lib/certificate';

const hash = (m: boolean[][]) => createHash('sha256').update(m.map((r) => r.map((d) => (d ? 1 : 0)).join('')).join('\n')).digest('hex');

test('QR codes match versions decoded and verified with OpenCV (v1, v5 verification link, v7 with version info)', () => {
  // These matrices were rendered and decoded back to the exact text with OpenCV's QRCodeDetector.
  const link = 'https://edufyacademy.com/verify-certificate?code=EDFY-2026-7KQ4-M9XT-2HDP';
  assert.equal(qrMatrix(link).length, 37);
  assert.equal(hash(qrMatrix(link)), 'd4996e9bf42306cc987c8ae2bfc9979ca16e011846eb68a13017a05d82676e89');
  assert.equal(hash(qrMatrix('x'.repeat(110))), '1fc0b5f1273847bfdc50100f139ec46f6d584078234406409dde9e20a6410ae0');
  assert.equal(hash(qrMatrix('hi')), '81240590f3a630b03aa70a8aaf521ec30c4911af3307da27eeb2126afcb5b39a');
});

test('QR matrix has finder patterns, a valid level-M format code and the dark module', () => {
  const m = qrMatrix('EDFY-2026-ABCD-EFGH-JKMN');
  const n = m.length;
  const finderAt = (r: number, c: number) => {
    for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) {
      const ring = Math.max(Math.abs(x - 3), Math.abs(y - 3));
      assert.equal(m[r + y][c + x], ring !== 2, `finder module ${r + y},${c + x}`);
    }
  };
  finderAt(0, 0);
  finderAt(0, n - 7);
  finderAt(n - 7, 0);
  assert.equal(m[n - 8][8], true, 'dark module');
  // Format bits around the top-left finder: (8,0..5), (8,7), (8,8), (7,8), (5..0,8)
  const bits = [0, 1, 2, 3, 4, 5].map((i) => m[i][8]).concat([m[7][8], m[8][8], m[8][7]], [5, 4, 3, 2, 1, 0].map((i) => m[8][i]));
  const value = bits.reduce((acc, b, i) => acc | ((b ? 1 : 0) << i), 0) ^ 0x5412;
  const data = value >>> 10;
  assert.equal(data >>> 3, 0b00, 'error correction level M');
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  assert.equal(((data << 10) | rem) & 0x7fff, value, 'format code BCH check');
  assert.throws(() => qrMatrix('x'.repeat(400)), /too long/);
  assert.ok(qrSvgPath(m).path.startsWith('M'));
});

test('certificate helpers: verification link, dates, duration, file name', () => {
  assert.equal(verificationUrl('https://edufyacademy.com/', 'EDFY-2026-AB12'), 'https://edufyacademy.com/verify-certificate?code=EDFY-2026-AB12');
  assert.equal(formatCertificateDate('2026-11-22'), '22 November 2026');
  assert.equal(formatCertificateDate('2026-01-01T23:30:00Z'), '1 January 2026');
  assert.equal(formatCertificateDate(''), '');
  assert.equal(formatCertificateDate('not a date'), '');
  assert.equal(formatCourseHours(4.5), '4.5 hours');
  assert.equal(formatCourseHours(1), '1 hour');
  assert.equal(formatCourseHours(2.04), '2 hours');
  assert.equal(formatCourseHours(0.75), '45 minutes');
  assert.equal(formatCourseHours(0), null, 'unknown duration is left off the certificate');
  assert.equal(formatCourseHours(null), null);
  assert.equal(certificateFileName({ studentName: 'Priya Raman', courseTitle: 'Creative Writing: Beginners' }), 'Edufy-Certificate-Creative-Writing-Beginners-Priya-Raman');
  assert.equal(certificateFileName({ studentName: 'José Ñúñez', courseTitle: 'Public Speaking' }), 'Edufy-Certificate-Public-Speaking-Jose-Nunez');
});

test('long names and titles get smaller type, within limits', () => {
  const short = fitFontSize('Li Na', { max: 64, min: 30, width: 860 });
  const long = fitFontSize('Venkata Subramaniam Lakshminarayanan Chidambaram Iyer', { max: 64, min: 30, width: 860, avgCharEm: 0.48 });
  const huge = fitFontSize('x'.repeat(400), { max: 64, min: 30, width: 860 });
  assert.equal(short, 64);
  assert.ok(long < 64 && long >= 30, `long name size ${long}`);
  assert.equal(huge, 30);
  assert.ok(fitFontSize('A long course title that wraps', { max: 34, min: 20, width: 860, lines: 2 }) <= 34);
});

test('LinkedIn link pre-fills the certification', () => {
  const url = new URL(linkedInAddUrl({ courseTitle: 'Public Speaking', issueDate: '2026-11-22', certificateCode: 'EDFY-2026-AB12' }, 'https://edufyacademy.com/verify-certificate?code=EDFY-2026-AB12'));
  assert.equal(url.hostname, 'www.linkedin.com');
  assert.equal(url.searchParams.get('name'), 'Public Speaking');
  assert.equal(url.searchParams.get('organizationName'), 'Edufy Academy');
  assert.equal(url.searchParams.get('issueYear'), '2026');
  assert.equal(url.searchParams.get('issueMonth'), '11');
  assert.equal(url.searchParams.get('certId'), 'EDFY-2026-AB12');
});

test('certificate never shows invented details and the claim endpoint refuses placeholders', () => {
  const doc = fs.readFileSync('src/components/certificate/CertificateDocument.tsx', 'utf8');
  for (const phrase of ['accredited', 'Accredited', 'university', 'government', 'signature', 'Signature']) {
    assert.ok(!doc.includes(phrase), `certificate must not contain "${phrase}"`);
  }
  assert.ok(doc.includes('/brand/edufy-logo-512.png'), 'uses the official logo file');
  assert.ok(doc.includes('This certificate verifies the successful completion of the above-mentioned course.'));
  const server = fs.readFileSync('server.ts', 'utf8');
  assert.ok(!server.includes("'Edufy Graduate'") && !server.includes("'Edufy Master Faculty'"), 'no placeholder names on certificates');
  assert.ok(server.includes('Complete every lesson to earn this certificate'), 'completion is still enforced');
  assert.ok(server.includes("enrollment.status !== 'active'"), 'enrolment is still enforced');
});

test('certificate API calls go to the API server, not the website', () => {
  const api = fs.readFileSync('src/services/api.ts', 'utf8');
  assert.ok(!/fetch\(['`]\/api\//.test(api), 'every fetch uses API_BASE_URL');
  assert.ok(api.includes("supabase.rpc('verify_certificate'"));
});

test('certificates migration keeps records private and audits revocation', () => {
  const sql = fs.readFileSync('supabase/migrations/20261122000001_certificates_revocation.sql', 'utf8');
  assert.ok(sql.includes('drop policy if exists "Certificates are publicly verifiable by code"'));
  assert.ok(sql.includes('auth.uid() = user_id or public.is_admin()'));
  assert.ok(/verify_certificate[\s\S]*security definer/.test(sql));
  assert.ok(!/verify_certificate\(p_code text\)[\s\S]*?returns table \([^)]*user_id/.test(sql), 'verification never returns the user id');
  assert.ok(sql.includes("raise exception 'Give a reason for revoking this certificate.'"));
  assert.ok(sql.includes("insert into public.certificate_audit (certificate_id, action, reason, actor_id) values (r.id, 'revoked'"));
});
