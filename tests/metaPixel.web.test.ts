import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { META_PIXEL_ID, META_PIXEL_SRC, type PixelWindow, installMetaPixel, isPixelPath, resetPixelTracking, trackPixelPageView } from '../src/lib/metaPixel';

type FakeScript = { async: boolean; src: string };

/** Queue entries are `arguments` objects from another JS realm; compare them as plain arrays. */
const plain = (q: unknown[]): unknown[][] => Array.from(q, (a) => JSON.parse(JSON.stringify(Array.from(a as ArrayLike<unknown>))));

/** Minimal document: records inserted scripts. */
function fakeDoc(existingScript = false) {
  const scripts: FakeScript[] = [];
  const first = { parentNode: { insertBefore: (s: FakeScript) => scripts.push(s) } };
  const doc = {
    createElement: () => ({ async: false, src: '' }),
    getElementsByTagName: () => (existingScript ? [first] : []),
    head: { appendChild: (s: FakeScript) => scripts.push(s) },
  };
  return { doc: doc as unknown as Document, scripts };
}

/** The inline Meta base code from index.html, run as a browser would for a page address. */
function runBaseCode(pathname: string) {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const code = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).find((c) => c.includes('fbevents.js'));
  assert.ok(code, 'base code is inline in index.html');
  const { doc, scripts } = fakeDoc(true);
  const win: PixelWindow & Record<string, unknown> = {};
  vm.runInNewContext(code, { window: win, document: doc, location: { pathname } });
  return { win, scripts, html };
}

test('base code in index.html initialises the Edufy pixel and sends PageView on page load', () => {
  const { win, scripts, html } = runBaseCode('/');
  assert.ok(html.indexOf('fbevents.js') < html.indexOf('</head>'), 'base code is in <head>');
  assert.deepEqual(scripts.map((s) => [s.src, s.async]), [[META_PIXEL_SRC, true]]);
  assert.equal(win.fbq!.version, '2.0');
  assert.equal(win.fbq!.disablePushState, true, "Meta's own history tracking is off (the app sends page changes)");
  const calls = plain(win.fbq!.queue);
  assert.deepEqual(calls, [['init', META_PIXEL_ID], ['track', 'PageView']], 'init first, then PageView');
  assert.equal(win.edufyPixelPageView, '/');
  assert.match(html, /<noscript><img[^>]+facebook\.com\/tr\?id=2722451508224726&amp;ev=PageView&amp;noscript=1/);
});

test('base code does nothing on sign-in callback, password reset and dashboard pages', () => {
  for (const p of ['/auth/callback', '/reset-password', '/forgot-password', '/admin', '/admin/settings', '/instructor', '/instructor/courses']) {
    const { win, scripts } = runBaseCode(p);
    assert.equal(win.fbq, undefined, p);
    assert.equal(scripts.length, 0, p);
  }
  for (const p of ['/courses/course-1', '/instructors', '/login', '/student/courses']) assert.ok(runBaseCode(p).win.fbq, p);
});

test('pixel runs on public pages and the student area, never on token-bearing or dashboard pages', () => {
  for (const p of ['/', '/courses', '/courses/course-1', '/blog/x', '/contact', '/login', '/register', '/student/courses', '/learn/course-1', '/instructors', '/instructors/abc']) assert.ok(isPixelPath(p), p);
  for (const p of ['/auth/callback', '/auth', '/reset-password', '/forgot-password', '/admin', '/admin/settings', '/instructor', '/instructor/courses', '/Admin/']) assert.ok(!isPixelPath(p), p);
});

test('app route changes: first page is not counted twice, every later page sends exactly one PageView', () => {
  resetPixelTracking();
  const { win } = runBaseCode('/'); // page load on the home page
  const { doc, scripts } = fakeDoc();
  assert.equal(trackPixelPageView('/', win, doc), false, 'initial PageView already sent by the base code');
  assert.equal(trackPixelPageView('/courses', win, doc), true);
  assert.equal(trackPixelPageView('/courses', win, doc), false);
  assert.equal(trackPixelPageView('/admin', win, doc), false, 'excluded page');
  assert.equal(trackPixelPageView('/about', win, doc), true);
  assert.equal(trackPixelPageView('/', win, doc), true, 'returning to the home page counts again');
  const calls = plain(win.fbq!.queue);
  const pv = ['trackSingle', META_PIXEL_ID, 'PageView'];
  assert.deepEqual(calls, [['init', META_PIXEL_ID], ['track', 'PageView'], pv, pv, pv], 'page load PageView, then one trackSingle PageView per page change');
  assert.equal(scripts.length, 0, 'never loaded a second time');
});

test('arriving on an excluded page and then opening a public page loads the pixel once and sends PageView', () => {
  resetPixelTracking();
  const { win } = runBaseCode('/auth/callback');
  const { doc, scripts } = fakeDoc();
  assert.equal(trackPixelPageView('/auth/callback', win, doc), false);
  assert.equal(win.fbq, undefined);
  assert.equal(trackPixelPageView('/courses/course-1', win, doc), true);
  assert.deepEqual(scripts, [{ async: true, src: META_PIXEL_SRC }]);
  assert.equal(win.fbq!.disablePushState, true);
  assert.deepEqual(win.fbq!.queue, [['init', META_PIXEL_ID], ['trackSingle', META_PIXEL_ID, 'PageView']]);
  installMetaPixel(win, doc);
  assert.equal(scripts.length, 1);
});

test('after fbevents.js has loaded, calls go straight to Meta', () => {
  resetPixelTracking();
  const w: PixelWindow = {};
  const calls: unknown[][] = [];
  const fbq = installMetaPixel(w, fakeDoc().doc);
  fbq.callMethod = (...a: unknown[]) => calls.push(a);
  trackPixelPageView('/about', w, fakeDoc().doc);
  assert.deepEqual(calls, [['trackSingle', META_PIXEL_ID, 'PageView']]);
});
