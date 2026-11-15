import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import {
  validateSection, publicSettings, withDefaults, diffSettings, maskSecret, renderIndexHtml, robotsTxt, maintenanceActive,
  compareVersions, isPhone, sanitizeEmailHtml, DEFAULTS,
} from '../server/settingsSchema';
import { deriveKey, encryptJson, decryptJson } from '../server/credentials';
import { sniffImage, svgProblem, validateUpload, safeFileStem } from '../server/mediaLogic';
import { render } from '../server/emailTemplates';
import { KEY_ID_RE, modeOf } from '../server/paymentLogic';

test('general: required fields, https URL, unknown keys dropped', () => {
  const bad = validateSection('general', { siteName: '', appName: 'App', siteUrl: 'http://insecure.com', hacker: '<script>' });
  assert.equal(bad.ok, false);
  if (!bad.ok) {
    assert.ok(bad.errors.siteName);
    assert.ok(bad.errors.siteUrl);
  }
  const good = validateSection('general', { siteName: '  Edufy   Academy ', appName: 'Edufy', siteUrl: 'https://edufy.example', hacker: 'x' });
  assert.equal(good.ok, true);
  if (good.ok) {
    assert.equal(good.value.siteName, 'Edufy Academy');
    assert.equal('hacker' in good.value, false);
  }
});

test('contact: phone and email validation', () => {
  assert.equal(isPhone('+91 99169 58480'), true);
  assert.equal(isPhone('12345'), false);
  assert.equal(isPhone('+91 abc 58480'), false);
  const r = validateSection('contact', { primaryPhone: '99', supportEmail: 'not-an-email' });
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.ok(r.errors.primaryPhone);
    assert.ok(r.errors.supportEmail);
  }
});

test('social: enabled link needs https URL; disabled empty allowed; order kept', () => {
  const r = validateSection('social', { links: [
    { platform: 'youtube', label: 'YouTube', url: '', enabled: false },
    { platform: 'facebook', label: 'Facebook', url: 'http://facebook.com/x', enabled: true },
  ] });
  assert.equal(r.ok, false);
  const ok = validateSection('social', { links: [
    { platform: 'youtube', label: 'YouTube', url: 'https://youtube.com/@edufy', enabled: true },
    { platform: 'weird', label: 'Blog', url: 'https://blog.example', enabled: true },
  ] });
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.value.links[1].platform, 'custom');
    assert.deepEqual(ok.value.links.map((l: any) => l.position), [0, 1]);
  }
});

test('public settings: private email section removed, disabled social links hidden, defaults filled', () => {
  const pub = publicSettings({ email: { senderEmail: 'a@b.co' }, general: { siteName: 'X' } }) as any;
  assert.equal(pub.email, undefined);
  assert.equal(pub.general.siteName, 'X');
  assert.equal(pub.general.appName, DEFAULTS.general.appName);
  assert.ok(pub.social.links.every((l: any) => l.enabled && l.url.startsWith('https://')));
  assert.equal(pub.social.links.some((l: any) => l.id === 'youtube'), false); // disabled by default
  // seeded official URLs present
  assert.ok(pub.social.links.find((l: any) => l.url === 'https://x.com/edufyacademy247'));
});

test('payment section never accepts secrets; currency fixed to INR', () => {
  const r = validateSection('payment', { enabled: true, keySecret: 'shh', currency: 'USD' });
  assert.equal(r.ok, false); // USD rejected
  const ok = validateSection('payment', { enabled: false, keySecret: 'shh', currency: 'INR' });
  assert.equal(ok.ok, true);
  if (ok.ok) assert.equal(JSON.stringify(ok.value).includes('shh'), false);
});

test('maintenance + app cross-field rules and active window', () => {
  const m = validateSection('maintenance', { websiteEnabled: true, startsAt: '2026-11-20T10:00:00Z', endsAt: '2026-11-20T09:00:00Z' });
  assert.equal(m.ok, false);
  const a = validateSection('app', { minVersion: '2.0.0', latestVersion: '1.5.0' });
  assert.equal(a.ok, false);
  const now = Date.parse('2026-11-20T10:30:00Z');
  assert.equal(maintenanceActive({ websiteEnabled: true, startsAt: '2026-11-20T10:00:00Z', endsAt: '2026-11-20T11:00:00Z' }, 'website', now), true);
  assert.equal(maintenanceActive({ websiteEnabled: true, endsAt: '2026-11-20T10:00:00Z' }, 'website', now), false);
  assert.equal(maintenanceActive({ websiteEnabled: true }, 'app', now), false);
  assert.equal(compareVersions('1.10.0', '1.9.9'), 1);
  assert.equal(compareVersions('1.0.0', '1.0.0'), 0);
});

test('seo: GA id and Search Console token validated; keywords normalised', () => {
  assert.equal(validateSection('seo', { gaId: 'GTM-ABC' }).ok, false);
  assert.equal(validateSection('seo', { gscVerification: '<meta name=x>' }).ok, false);
  const r = validateSection('seo', { gaId: 'G-ABC123XYZ', keywords: ' a, b ,, c ', robots: 'index,follow' });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.value.keywords, 'a, b, c');
});

test('email templates are sanitised and require subject+body when enabled', () => {
  const html = sanitizeEmailHtml('<p onclick="x()">Hi</p><script>alert(1)</script><a href="javascript:alert(1)">x</a>');
  assert.equal(/script|onclick|javascript/.test(html), false);
  const r = validateSection('email', { templates: { welcome: { enabled: true, subject: '', html: '' } } });
  assert.equal(r.ok, false);
  assert.equal(render('Hi {{student_name}} {{missing}}', { student_name: '<b>Priya</b>' }, 'html'), 'Hi &lt;b&gt;Priya&lt;/b&gt; ');
});

test('audit diff and secret masking', () => {
  const d = diffSettings({ a: 1, b: 'x', same: true }, { a: 2, b: 'x', same: true, c: 'new' });
  assert.deepEqual(Object.keys(d).sort(), ['a', 'c']);
  assert.equal(maskSecret('abcd1234efgh5678'), '••••••••5678');
  assert.equal(maskSecret('short'), '••••••••');
  assert.equal(maskSecret(''), '');
});

test('credentials: AES-256-GCM round trip, tamper detection, key derivation', () => {
  assert.equal(deriveKey(''), null);
  assert.equal(deriveKey('too-short'), null);
  const key = deriveKey(crypto.randomBytes(32).toString('base64'))!;
  assert.equal(key.length, 32);
  const passKey = deriveKey('a long passphrase with more than thirty-two characters')!;
  assert.equal(passKey.length, 32);
  const enc = encryptJson(key, { keySecret: 'super-secret-value' });
  assert.equal(enc.includes('super-secret'), false);
  assert.deepEqual(decryptJson(key, enc), { keySecret: 'super-secret-value' });
  const raw = Buffer.from(enc.slice(3), 'base64');
  raw[raw.length - 1] ^= 1;
  assert.throws(() => decryptJson(key, `v1:${raw.toString('base64')}`));
  assert.throws(() => decryptJson(passKey, enc));
});

test('razorpay key format and mode', () => {
  assert.equal(KEY_ID_RE.test('rzp_live_AbCdEf123456'), true);
  assert.equal(KEY_ID_RE.test('rzp_prod_x'), false);
  assert.equal(modeOf('rzp_live_AbCdEf123456'), 'live');
  assert.equal(modeOf('rzp_test_AbCdEf123456'), 'test');
});

// minimal valid image headers
const png = (w: number, h: number) => {
  const b = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8);
  b.write('IHDR', 12, 'ascii');
  b.writeUInt32BE(w, 16);
  b.writeUInt32BE(h, 20);
  return b;
};
const jpeg = (w: number, h: number) => Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, h >> 8, h & 255, w >> 8, w & 255, 0x03, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
const gif = (w: number, h: number) => { const b = Buffer.alloc(16); b.write('GIF89a', 0, 'ascii'); b.writeUInt16LE(w, 6); b.writeUInt16LE(h, 8); return b; };
const webpX = (w: number, h: number) => {
  const b = Buffer.alloc(32);
  b.write('RIFF', 0, 'ascii'); b.write('WEBP', 8, 'ascii'); b.write('VP8X', 12, 'ascii');
  b.writeUIntLE(w - 1, 24, 3); b.writeUIntLE(h - 1, 27, 3);
  return b;
};

test('image sniffing reads real type and size', () => {
  assert.deepEqual(sniffImage(png(1920, 600)), { mime: 'image/png', ext: 'png', width: 1920, height: 600 });
  assert.deepEqual(sniffImage(jpeg(1280, 720)), { mime: 'image/jpeg', ext: 'jpg', width: 1280, height: 720 });
  assert.deepEqual(sniffImage(gif(640, 360)), { mime: 'image/gif', ext: 'gif', width: 640, height: 360 });
  assert.deepEqual(sniffImage(webpX(1200, 630)), { mime: 'image/webp', ext: 'webp', width: 1200, height: 630 });
  const svg = sniffImage(Buffer.from('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 256"><path d="M0 0"/></svg>'));
  assert.equal(svg?.mime, 'image/svg+xml');
  assert.equal(svg?.width, 512);
  assert.equal(sniffImage(Buffer.from('<html><script>alert(1)</script></html>')), null);
  assert.equal(sniffImage(Buffer.from('%PDF-1.7 not an image at all')), null);
});

test('upload rules: size, dimensions, SVG safety', () => {
  assert.equal(validateUpload(png(1920, 600), 'website_banner').ok, true);
  assert.equal(validateUpload(png(800, 200), 'website_banner').ok, false); // too small
  assert.equal(validateUpload(png(9000, 9000), 'other').ok, false); // too large
  const evil = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>');
  assert.equal(validateUpload(evil, 'logo').ok, false);
  const ext = '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://evil.example/x.png"/></svg>';
  assert.ok(svgProblem(ext));
  const safe = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><use href="#a"/></svg>');
  assert.equal(validateUpload(safe, 'logo').ok, true);
  assert.equal(validateUpload(safe, 'website_banner').ok, false); // SVG only for logos/icons
  assert.equal(safeFileStem('../../My Logo (final).PNG'), 'my-logo-final');
});

test('index.html SEO injection is escaped and complete', () => {
  const html = '<html><head><title>Old</title><meta name="description" content="old" /><link rel="icon" href="/favicon.ico" /></head><body></body></html>';
  const out = renderIndexHtml(html, {
    seo: { title: 'Edufy "Best" <Academy>', description: 'Learn', keywords: 'a, b', ogImage: 'https://cdn.example/og.png', robots: 'noindex,nofollow', gaId: 'G-ABC123XYZ', gscVerification: 'abcdefghij12345' },
    branding: { favicon: 'https://cdn.example/fav.png' },
    general: { siteName: 'Edufy' },
  });
  assert.ok(out.includes('<title>Edufy &quot;Best&quot; &lt;Academy&gt;</title>'));
  assert.ok(out.includes('<meta name="description" content="Learn" />'));
  assert.ok(out.includes('content="abcdefghij12345"'));
  assert.ok(out.includes('gtag/js?id=G-ABC123XYZ'));
  assert.ok(out.includes('href="https://cdn.example/fav.png"'));
  assert.equal(out.includes('/favicon.ico'), false);
  assert.ok(robotsTxt({ robots: 'noindex,nofollow' }).includes('Disallow: /\n'));
  assert.ok(robotsTxt({ robots: 'index,follow' }).includes('Disallow: /admin'));
  // invalid GA id is never injected
  assert.equal(renderIndexHtml(html, { seo: { gaId: "G-1');alert(1);//" }, branding: {}, general: {} }).includes('alert'), false);
});

test('withDefaults keeps template defaults when only some are stored', () => {
  const all = withDefaults({ email: { templates: { welcome: { enabled: true, subject: 'Hi', html: '<p>x</p>' } } } });
  assert.equal(all.email.templates.welcome.subject, 'Hi');
  assert.ok(all.email.templates.certificate.subject.length > 0);
});
