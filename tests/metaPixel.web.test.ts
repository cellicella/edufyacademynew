import { test } from 'node:test';
import assert from 'node:assert/strict';
import { META_PIXEL_ID, META_PIXEL_SRC, type PixelWindow, installMetaPixel, isPixelPath, resetPixelTracking, trackPixelPageView } from '../src/lib/metaPixel';

/** Minimal document: records inserted scripts. */
function fakeDoc() {
  const scripts: { async: boolean; src: string }[] = [];
  const doc = {
    createElement: () => ({ async: false, src: '' }),
    getElementsByTagName: () => [],
    head: { appendChild: (s: { async: boolean; src: string }) => scripts.push(s) },
  };
  return { doc: doc as unknown as Document, scripts };
}

test('pixel runs on public pages and the student area, never on sign-in callbacks, password reset or dashboards', () => {
  for (const p of ['/', '/courses', '/courses/course-1', '/blog/x', '/contact', '/login', '/register', '/student/courses', '/learn/course-1', '/instructors', '/instructors/abc']) assert.ok(isPixelPath(p), p);
  for (const p of ['/auth/callback', '/auth', '/reset-password', '/forgot-password', '/admin', '/admin/settings', '/instructor', '/instructor/courses', '/Admin/']) assert.ok(!isPixelPath(p), p);
});

test('installs the standard base code once: queue stub, async fbevents.js and init with the Edufy pixel ID', () => {
  const w: PixelWindow = {};
  const { doc, scripts } = fakeDoc();
  const fbq = installMetaPixel(w, doc);
  assert.equal(w.fbq, fbq);
  assert.equal(w._fbq, fbq);
  assert.equal(fbq.version, '2.0');
  assert.deepEqual(scripts, [{ async: true, src: META_PIXEL_SRC }]);
  assert.deepEqual(fbq.queue, [['init', META_PIXEL_ID]]);
  installMetaPixel(w, doc);
  assert.equal(scripts.length, 1, 'never loaded twice');
});

test('one PageView per page change; excluded pages send nothing and do not load the pixel', () => {
  resetPixelTracking();
  const w: PixelWindow = {};
  const { doc, scripts } = fakeDoc();
  assert.equal(trackPixelPageView('/auth/callback', w, doc), false);
  assert.equal(w.fbq, undefined);
  assert.equal(scripts.length, 0);
  assert.equal(trackPixelPageView('/', w, doc), true);
  assert.equal(trackPixelPageView('/', w, doc), false, 'same page is not counted twice');
  assert.equal(trackPixelPageView('/admin', w, doc), false);
  assert.equal(trackPixelPageView('/courses/course-1', w, doc), true);
  assert.deepEqual(w.fbq!.queue, [['init', META_PIXEL_ID], ['track', 'PageView'], ['track', 'PageView']]);
  assert.equal(scripts.length, 1);
});

test('after fbevents.js has loaded, calls go straight to Meta', () => {
  resetPixelTracking();
  const w: PixelWindow = {};
  const calls: unknown[][] = [];
  const fbq = installMetaPixel(w, fakeDoc().doc);
  fbq.callMethod = (...a: unknown[]) => calls.push(a);
  trackPixelPageView('/about', w, fakeDoc().doc);
  assert.deepEqual(calls, [['track', 'PageView']]);
});
