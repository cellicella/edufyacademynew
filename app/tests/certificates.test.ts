import { test } from 'node:test';
import assert from 'node:assert/strict';
import { certificateHtml, escapeHtml, isCourseComplete, mapCertificate, normaliseCertCode, verificationUrl, CERT_CODE_RE } from '../src/logic/certificates';

const row = { id: 'u-1', certificate_code: 'edfy-2026-a1b2c3', course_id: 'course-1', course_title: 'React <Basics>', student_name: 'Surya "S" Kumar', instructor_name: null, issue_date: '2026-11-10', verification_hash: 'abc' };

test('mapCertificate normalises the code and fills defaults', () => {
  const c = mapCertificate(row);
  assert.equal(c.code, 'EDFY-2026-A1B2C3');
  assert.equal(c.courseId, 'course-1');
  assert.equal(c.instructorName, null);
});

test('completion rule matches the server: every lesson done, and the course has lessons', () => {
  assert.equal(isCourseComplete({ completed: 13, total: 13 }), true);
  assert.equal(isCourseComplete({ completed: 12, total: 13 }), false);
  assert.equal(isCourseComplete({ completed: 0, total: 0 }), false);
  assert.equal(isCourseComplete(null), false);
});

test('verification code input and URL', () => {
  assert.equal(normaliseCertCode('  edfy-2026-a1b2c3 '), 'EDFY-2026-A1B2C3');
  assert.equal(CERT_CODE_RE.test('EDFY-2026-A1B2C3'), true);
  assert.equal(CERT_CODE_RE.test('<script>'), false);
  assert.equal(verificationUrl('https://edufy.in/', 'EDFY-2026-A1B2C3'), 'https://edufy.in/verify-certificate?code=EDFY-2026-A1B2C3');
});

test('certificate HTML escapes student/course text (no HTML injection into the PDF)', () => {
  const html = certificateHtml(mapCertificate(row), { verifyUrl: 'https://edufy.in/verify-certificate?code=X' });
  assert.ok(html.includes('React &lt;Basics&gt;'));
  assert.ok(html.includes('Surya &quot;S&quot; Kumar'));
  assert.ok(!html.includes('<Basics>'));
  assert.ok(html.includes('EDFY-2026-A1B2C3'));
  assert.equal(escapeHtml(`<a href='x'>&`), '&lt;a href=&#39;x&#39;&gt;&amp;');
});
