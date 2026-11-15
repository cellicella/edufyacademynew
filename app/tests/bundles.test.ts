import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bundleOwnership, bundleSavings, mapBundle } from '../src/logic/bundles';

const row = {
  id: 'bundle-1', slug: 'full-stack', title: ' Full Stack Pack ', price: '1499', thumbnail_url: null,
  bundle_courses: [
    { position: 2, courses: { id: 'c2', title: 'Two', price: 999, thumbnail_url: 'https://x/2.jpg', is_published: true } },
    { position: 1, courses: { id: 'c1', title: 'One', price: '1499', thumbnail_url: 'https://x/1.jpg', is_published: true } },
    { position: 3, courses: null },
    { position: 4, courses: { id: 'c4', title: 'Draft', price: 500, is_published: false } },
  ],
};

test('mapBundle orders courses by position and drops missing/unpublished ones', () => {
  const b = mapBundle(row);
  assert.equal(b.title, 'Full Stack Pack');
  assert.deepEqual(b.courses.map((c) => c.id), ['c1', 'c2']);
  assert.equal(b.price, 1499);
  assert.equal(b.coursesValue, 2498);
  assert.equal(b.thumbnail, 'https://x/1.jpg'); // falls back to first course image
});

test('savings: amount and percent, never negative', () => {
  assert.deepEqual(bundleSavings({ price: 1499, coursesValue: 2498 }), { amount: 999, percent: 40 });
  assert.deepEqual(bundleSavings({ price: 3000, coursesValue: 2498 }), { amount: 0, percent: 0 });
  assert.deepEqual(bundleSavings({ price: 0, coursesValue: 0 }), { amount: 0, percent: 0 });
});

test('ownership summary identifies owned and missing courses', () => {
  const b = mapBundle(row);
  const s = bundleOwnership(b, new Set(['c2', 'zzz']));
  assert.equal(s.ownedCount, 1);
  assert.equal(s.ownsAll, false);
  assert.deepEqual(s.missing.map((c) => c.id), ['c1']);
  assert.equal(bundleOwnership(b, new Set(['c1', 'c2'])).ownsAll, true);
  assert.equal(bundleOwnership({ courses: [] }, new Set()).ownsAll, false);
});
