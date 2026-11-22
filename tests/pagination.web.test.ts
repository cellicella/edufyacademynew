import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { COURSES_PER_PAGE, pageItems, pageRange, parsePage, resultSummary, sanitizeSearch, totalPages } from '../src/lib/pagination';

test('12 courses per page with exact database ranges', () => {
  assert.equal(COURSES_PER_PAGE, 12);
  assert.deepEqual(pageRange(1), { from: 0, to: 11 });
  assert.deepEqual(pageRange(3), { from: 24, to: 35 });
  assert.equal(totalPages(0), 1);
  assert.equal(totalPages(12), 1);
  assert.equal(totalPages(13), 2);
  assert.equal(totalPages(36), 3);
});

test('pages cover every course exactly once', () => {
  const ids = Array.from({ length: 37 }, (_, i) => i);
  const seen: number[] = [];
  for (let p = 1; p <= totalPages(ids.length); p++) {
    const { from, to } = pageRange(p);
    seen.push(...ids.slice(from, to + 1));
  }
  assert.deepEqual(seen, ids);
});

test('page number from the address is always valid', () => {
  assert.equal(parsePage('3'), 3);
  for (const bad of [null, '', '0', '-2', '1.5', 'abc', undefined]) assert.equal(parsePage(bad), 1);
});

test('result count reads naturally', () => {
  assert.equal(resultSummary(1, 36), 'Showing 1–12 of 36 courses');
  assert.equal(resultSummary(3, 36), 'Showing 25–36 of 36 courses');
  assert.equal(resultSummary(2, 13), 'Showing 13 of 13 courses');
  assert.equal(resultSummary(1, 1), 'Showing 1 of 1 course');
  assert.equal(resultSummary(1, 0), 'No courses found');
});

test('page buttons: first, last, current with neighbours, gaps', () => {
  assert.deepEqual(pageItems(1, 1), [1]);
  assert.deepEqual(pageItems(1, 3), [1, 2, 3]);
  assert.deepEqual(pageItems(6, 12), [1, 'gap', 5, 6, 7, 'gap', 12]);
  assert.deepEqual(pageItems(1, 12), [1, 2, 'gap', 12]);
  assert.deepEqual(pageItems(3, 12), [1, 2, 3, 4, 'gap', 12], 'no gap that hides a single page');
  assert.deepEqual(pageItems(12, 12), [1, 'gap', 11, 12]);
});

test('search text is safe inside a database filter', () => {
  assert.equal(sanitizeSearch('  public, speaking (beginners)% '), 'public speaking beginners');
  assert.equal(sanitizeSearch(''), '');
  assert.ok(sanitizeSearch('a'.repeat(200)).length <= 80);
});

test('catalogue page uses database pagination and resets to page 1 on filter changes', () => {
  const page = fs.readFileSync('src/pages/public/MarketplacePage.tsx', 'utf8');
  assert.ok(page.includes('getCoursesPage('));
  assert.ok(page.includes("params.delete('page'); // new search or filter: back to page 1"));
  assert.ok(page.includes('xl:grid-cols-3'));
  const api = fs.readFileSync('src/services/api.ts', 'utf8');
  assert.ok(/getCoursesPage[\s\S]*\{ count: 'exact' \}[\s\S]*\.range\(from, to\)/.test(api));
  assert.ok(api.includes(".order('created_at', { ascending: true }).order('id', { ascending: true })"), 'stable order: no duplicates across pages');
});

test('course page shows the whole thumbnail (contained, 16:9) and no unverifiable promises', () => {
  const page = fs.readFileSync('src/pages/public/CourseDetailsPage.tsx', 'utf8');
  assert.ok(page.includes('aspect-video') && page.includes('object-contain'));
  assert.ok(!page.includes('aspect-[4/3]'));
  for (const claim of ['lifetime access', 'Money-Back', 'Lifetime']) assert.ok(!page.includes(claim), claim);
  assert.ok(page.includes('courseLd(seoCourse)') && page.includes('canonicalPath: coursePath(seoCourse)'), 'SEO kept');
});
