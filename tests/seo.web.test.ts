import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSeoFiles, categoriesWithCourses, mapCourseRow, renderPage, type SeoData } from '../scripts/seo/prerender';
import { STATIC_PAGES, courseLd, isPrivatePath, jsonLdScript, readableTitle, sitemapXml } from '../src/seo/seoConfig';

const TEMPLATE = `<!doctype html><html lang="en"><head><meta charset="UTF-8" />
<title>Edufy Academy – Affordable Online Courses with Certificates</title>
<meta name="description" content="default" />
<meta property="og:title" content="default" /><meta name="twitter:card" content="summary_large_image" />
</head><body><div id="root"></div><script type="module" src="/assets/index.js"></script></body></html>`;

const course = mapCourseRow({
  id: 'c-1', title: 'EXCEL FOR BEGINNERS', subtitle: 'Formulas & charts <fast>', description: '<p>Learn Excel step by step.</p>', category: 'Office',
  level: 'Beginner', language: 'English', price: 499, original_price: 1999, total_lessons: 12, duration_hours: 3, thumbnail_url: 'https://cdn.example.com/x.jpg',
  learning_outcomes: ['Build formulas', '__placeholder'], prerequisites: ['A computer'], updated_at: '2026-10-01T00:00:00Z', profiles: { full_name: 'Someone', headline: null },
});

const data = (over: Partial<SeoData> = {}): SeoData => ({
  courses: [course, mapCourseRow({ id: 'c-2', title: 'Word basics', category: 'Office', price: 0 })],
  posts: [{ slug: 'study-tips', title: 'Study tips "that work"', excerpt: 'Five tips', contentHtml: '<p>Body</p>', publishedAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-02T00:00:00Z' }],
  bundles: [{ slug: 'office-pack', title: 'Office pack', price: 999, courseCount: 2 }],
  categories: [{ slug: 'office', name: 'Office' }, { slug: 'x', name: 'x' }],
  instructors: [],
  settings: { robots: 'index, follow' },
  ok: true,
  ...over,
});

const count = (html: string, re: RegExp) => (html.match(re) || []).length;

test('every prerendered page has one title, one canonical, one robots tag and at most one JSON-LD block', () => {
  const files = buildSeoFiles(TEMPLATE, data());
  const titles = new Set<string>();
  for (const [name, html] of files) {
    if (!name.endsWith('.html')) continue;
    assert.equal(count(html, /<title>/g), 1, name);
    assert.equal(count(html, /<meta name="description"/g), 1, name);
    assert.equal(count(html, /<meta name="robots"/g), 1, name);
    assert.ok(count(html, /application\/ld\+json/g) <= 1, name);
    assert.equal(count(html, /<h1>/g), 1, `${name} should have exactly one H1`);
    if (name === '404.html') continue;
    assert.equal(count(html, /<link rel="canonical"/g), 1, name);
    const title = html.match(/<title>(.*?)<\/title>/)![1];
    assert.ok(!titles.has(title), `duplicate title ${title}`);
    titles.add(title);
  }
});

test('static, course, blog and bundle pages are written with absolute canonical URLs', () => {
  const files = buildSeoFiles(TEMPLATE, data());
  assert.ok(files.has('seo/index.html'));
  for (const s of STATIC_PAGES) assert.ok(files.has(s.path === '/' ? 'seo/index.html' : `seo${s.path}.html`), s.path);
  const c = files.get('seo/courses/c-1.html')!;
  assert.match(c, /<link rel="canonical" href="https:\/\/edufyacademy\.com\/courses\/c-1" \/>/);
  assert.match(c, /<title>Excel for Beginners/);
  assert.match(c, /"@type":"Course"/);
  assert.match(c, /"@type":"BreadcrumbList"/);
  assert.ok(!c.includes('__placeholder'));
  assert.match(files.get('seo/blog/study-tips.html')!, /"@type":"BlogPosting"/);
  assert.ok(files.has('seo/bundles/office-pack.html'));
  const home = files.get('seo/index.html')!;
  assert.match(home, /<link rel="canonical" href="https:\/\/edufyacademy\.com\/" \/>/);
  for (const t of ['EducationalOrganization', 'WebSite', 'Person']) assert.ok(home.includes(`"@type":"${t}"`), t);
});

test('text from the database is escaped in HTML and JSON-LD', () => {
  const files = buildSeoFiles(TEMPLATE, data());
  const c = files.get('seo/courses/c-1.html')!;
  assert.ok(!c.includes('<fast>'));
  assert.ok(c.includes('Formulas &amp; charts'));
  const post = files.get('seo/blog/study-tips.html')!;
  assert.ok(post.includes('Study tips &quot;that work&quot;'));
  assert.ok(!jsonLdScript([{ name: '</script><script>alert(1)</script>' }]).includes('</script><script>'));
});

test('404 page is noindex and has no canonical URL', () => {
  const html = buildSeoFiles(TEMPLATE, data()).get('404.html')!;
  assert.match(html, /<meta name="robots" content="noindex, follow" \/>/);
  assert.ok(!html.includes('rel="canonical"'));
  assert.ok(!html.includes('og:url'));
});

test('sitemap lists public pages only, with absolute URLs and no duplicates', () => {
  const xml = buildSeoFiles(TEMPLATE, data()).get('sitemap.xml')!;
  assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>/);
  const locs = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
  assert.equal(new Set(locs).size, locs.length);
  for (const l of locs) assert.ok(l.startsWith('https://edufyacademy.com/'), l);
  for (const p of ['/courses/c-1', '/courses/c-2', '/blog/study-tips', '/bundles/office-pack', '/about']) assert.ok(locs.includes(`https://edufyacademy.com${p}`), p);
  for (const l of locs) assert.ok(!/\/(login|register|admin|student|learn|auth|instructor\/|forgot-password|reset-password)/.test(l), l);
  assert.match(xml, /<lastmod>2026-10-01<\/lastmod>/);
  const manual = sitemapXml([{ path: '/admin' }, { path: '/login' }, { path: '/about?x=1&y=2' }, { path: '/about?x=1&y=2' }]);
  assert.ok(!manual.includes('/admin') && !manual.includes('/login'));
  assert.equal(count(manual, /<loc>/g), 1);
  assert.ok(manual.includes('&amp;'));
});

test('private areas are recognised', () => {
  for (const p of ['/login', '/register', '/forgot-password', '/reset-password', '/auth/callback', '/learn/c-1', '/student', '/student/courses', '/instructor', '/instructor/courses', '/admin', '/admin/settings']) assert.ok(isPrivatePath(p), p);
  for (const p of ['/', '/courses', '/courses/c-1', '/instructors', '/instructors/abc', '/blog/x', '/about']) assert.ok(!isPrivatePath(p), p);
});

test('admin noindex setting is applied to every built page', () => {
  const files = buildSeoFiles(TEMPLATE, data({ settings: { robots: 'noindex,nofollow' } }));
  for (const [name, html] of files) if (name.startsWith('seo/')) assert.match(html, /<meta name="robots" content="noindex, nofollow" \/>/, name);
});

test('only categories that contain published courses are listed', () => {
  assert.deepEqual(categoriesWithCourses(data()).map((c) => c.slug), ['office']);
  assert.ok(!buildSeoFiles(TEMPLATE, data()).get('seo/categories.html')!.includes('category=x'));
});

test('build still produces the fixed pages when content could not be loaded', () => {
  const files = buildSeoFiles(TEMPLATE, { courses: [], posts: [], bundles: [], categories: [], instructors: [], settings: {}, ok: false });
  assert.ok(files.has('seo/index.html') && files.has('404.html') && files.has('sitemap.xml'));
  assert.equal(count(files.get('sitemap.xml')!, /<loc>/g), STATIC_PAGES.length);
});

test('renderPage keeps the app shell intact and replaces default tags', () => {
  const html = renderPage(TEMPLATE, { path: '/about', title: 'About | Edufy Academy', description: 'About us', robots: 'index, follow', ld: [], body: '<h1>About</h1>' });
  assert.ok(html.includes('<script type="module" src="/assets/index.js"></script>'));
  assert.ok(html.includes('<div id="root"><div data-prerender><h1>About</h1></div></div>'));
  assert.equal(count(html, /og:title/g), 1);
  assert.ok(!html.includes('content="default"'));
});

test('course structured data uses only real course fields', () => {
  const ld = courseLd(course);
  assert.equal(ld['@type'], 'Course');
  assert.ok(!('aggregateRating' in ld) && !('review' in ld), 'no ratings or reviews are invented');
  assert.equal(readableTitle('EXCEL FOR BEGINNERS'), 'Excel for Beginners');
});
