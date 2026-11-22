import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const head = html.split('</head>')[0];
const gtmCode = [...head.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).find((c) => c.includes('gtm.js?id='));

/** Runs the Google Tag Manager snippet from index.html as a browser would for a page address. */
function runGtm(pathname: string) {
  assert.ok(gtmCode, 'GTM snippet is inline in <head>');
  const added: { async: boolean; src: string }[] = [];
  const doc = { createElement: () => ({ async: false, src: '' }), head: { appendChild: (s: { async: boolean; src: string }) => added.push(s) } };
  const win: { dataLayer?: unknown[]; gtag?: unknown } = {};
  vm.runInNewContext(gtmCode, { window: win, document: doc, location: { pathname } });
  return { win, added };
}

test('Google Tag Manager GTM-PD3JV5QC loads once, async, from <head>', () => {
  const { win, added } = runGtm('/');
  assert.deepEqual(added.map((s) => [s.src, s.async]), [['https://www.googletagmanager.com/gtm.js?id=GTM-PD3JV5QC', true]]);
  assert.equal((head.match(/googletagmanager\.com\/gtm\.js/g) || []).length, 1, 'only one container snippet');
  assert.equal(typeof win.gtag, 'function');
  assert.equal(win.dataLayer!.length, 1);
  const first = win.dataLayer![0] as ArrayLike<unknown>;
  assert.equal(Object.prototype.toString.call(first), '[object Arguments]', "gtag pushes an arguments object, as Google's snippet does");
  assert.equal(first[0], 'js');
  assert.equal(Object.prototype.toString.call(first[1]), '[object Date]');
});

test('Tag Manager runs on public pages and the student area, never on sign-in callback, password reset or dashboards', () => {
  for (const p of ['/', '/courses', '/courses/course-1', '/blog/x', '/login', '/register', '/student/courses', '/instructors']) assert.equal(runGtm(p).added.length, 1, p);
  for (const p of ['/auth/callback', '/reset-password', '/forgot-password', '/admin', '/admin/settings', '/instructor', '/instructor/courses']) {
    const { win, added } = runGtm(p);
    assert.equal(added.length, 0, p);
    assert.equal(win.dataLayer, undefined, p);
  }
});

test('the app sends no page views of its own (GA4 records page changes through the container)', () => {
  const src = ['src/App.tsx', 'src/components/common/MetaPixel.tsx', 'src/lib/metaPixel.ts', 'src/lib/metaEvents.ts']
    .map((f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8'))
    .join('\n');
  assert.ok(!/dataLayer\.push|gtag\(/.test(src));
});
