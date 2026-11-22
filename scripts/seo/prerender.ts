/**
 * Build-time SEO for the static Vite site (Hostinger serves `dist/` with public/.htaccess).
 *
 * After `vite build` this writes:
 *   dist/sitemap.xml            – every public, published page (canonical https://edufyacademy.com URLs, lastmod)
 *   dist/seo/<route>.html       – one HTML file per public page with its own title, description, canonical,
 *                                 Open Graph / Twitter tags, JSON-LD and readable content (served by .htaccess
 *                                 to visitors and crawlers; the React app then takes over as usual)
 *   dist/404.html               – the app shell marked noindex, served with HTTP 404 for unknown addresses
 *
 * Data comes from the same public Supabase endpoints the website already reads (publishable key, row-level
 * security: only published content). If the data cannot be loaded the build still succeeds with the fixed pages.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';
import {
  DEFAULT_OG_IMAGE,
  SITE_NAME,
  SITE_URL,
  STATIC_PAGES,
  SeoBundle,
  SeoCourse,
  SeoPost,
  SitemapEntry,
  absoluteUrl,
  breadcrumbLd,
  bundlePath,
  bundleSeo,
  clip,
  courseInstructor,
  courseLd,
  coursePath,
  courseSeo,
  jsonLdScript,
  leadInstructorLd,
  organizationLd,
  postLd,
  postPath,
  postSeo,
  readableTitle,
  sitemapXml,
  stripHtml,
  websiteLd,
} from '../../src/seo/seoConfig';
import { LEAD_INSTRUCTOR } from '../../src/config/leadInstructor';

/* ------------------------------------------------------------------ data */
export interface SeoCategory {
  slug: string;
  name: string;
  description?: string | null;
}
export interface SeoInstructor {
  id: string;
  name: string;
  headline?: string | null;
  bio?: string | null;
  avatar?: string | null;
}
export interface SeoData {
  courses: SeoCourse[];
  posts: SeoPost[];
  bundles: SeoBundle[];
  categories: SeoCategory[];
  instructors: SeoInstructor[];
  settings: { robots?: string; gscVerification?: string; companyName?: string; description?: string; telephone?: string; email?: string; sameAs?: string[] };
  ok: boolean;
}

const arr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x.trim() && !x.startsWith('__')) : []);
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** Raw rows as returned by the Supabase REST API (only the selected columns). */
type Str = string | null | undefined;
interface CourseRow {
  id: string | number; title?: Str; subtitle?: Str; description?: Str; category?: Str; level?: Str; language?: Str;
  price?: unknown; original_price?: unknown; duration_hours?: unknown; total_lessons?: unknown; thumbnail_url?: Str;
  learning_outcomes?: unknown; prerequisites?: unknown; updated_at?: Str; created_at?: Str; is_demo?: boolean | null;
  slug?: Str; target_audience?: unknown; seo_title?: Str; seo_description?: Str;
  course_sections?: { title?: Str; description?: Str; section_order?: number | null; lessons?: { title?: Str; lesson_order?: number | null; duration_minutes?: number | null; is_free_preview?: boolean | null }[] | null }[] | null;
  profiles?: { full_name?: Str; headline?: Str } | { full_name?: Str; headline?: Str }[] | null;
}
interface PostRow {
  slug?: Str; title?: Str; excerpt?: Str; content_html?: Str; cover_image_url?: Str; category?: Str; author_name?: Str;
  published_at?: Str; updated_at?: Str; seo_title?: Str; seo_description?: Str;
}
interface BundleRow { slug?: Str; title?: Str; subtitle?: Str; description?: Str; thumbnail_url?: Str; price?: unknown; updated_at?: Str; bundle_courses?: { course_id?: Str }[] | null }
interface CategoryRow { slug?: Str; name?: Str; description?: Str }
interface InstructorRow { id?: Str; full_name?: Str; headline?: Str; bio?: Str; avatar_url?: Str }
interface SocialLink { enabled?: boolean; url?: Str }
interface SettingsRow {
  settings?: {
    seo?: { robots?: string; gscVerification?: string };
    general?: { companyName?: string; description?: string };
    contact?: { primaryPhone?: string; supportEmail?: string };
    social?: { links?: SocialLink[] };
  };
}

export function mapCourseRow(r: CourseRow): SeoCourse {
  const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
  return {
    id: String(r.id),
    slug: r.slug ? String(r.slug).trim() || null : null,
    seoTitle: r.seo_title || null,
    seoDescription: r.seo_description || null,
    title: String(r.title || '').trim() || 'Untitled course',
    subtitle: r.subtitle || null,
    description: r.description || null,
    category: r.category || null,
    level: r.level || null,
    language: r.language || null,
    price: num(r.price),
    originalPrice: num(r.original_price),
    durationHours: num(r.duration_hours),
    totalLessons: num(r.total_lessons),
    thumbnail: r.thumbnail_url || null,
    learningOutcomes: arr(r.learning_outcomes),
    requirements: arr(r.prerequisites),
    updatedAt: r.updated_at || r.created_at || null,
    instructorName: p?.full_name || null,
    instructorTitle: p?.headline || null,
    audience: arr(r.target_audience),
    sections: [...(r.course_sections || [])]
      .sort((a, b) => (a.section_order || 0) - (b.section_order || 0))
      .map((s) => ({
        title: String(s.title || '').trim(),
        description: s.description ? String(s.description) : null,
        lessons: [...(s.lessons || [])]
          .sort((a, b) => (a.lesson_order || 0) - (b.lesson_order || 0))
          .map((l) => ({ title: String(l.title || '').trim(), minutes: num(l.duration_minutes), freePreview: !!l.is_free_preview }))
          .filter((l) => l.title),
      }))
      .filter((s) => s.title && s.lessons.length),
  };
}

/** Categories that at least one published course belongs to (matched by slug or name). */
export function categoriesWithCourses(d: Pick<SeoData, 'categories' | 'courses'>): SeoCategory[] {
  const used = new Set(d.courses.map((c) => (c.category || '').trim().toLowerCase()).filter(Boolean));
  return d.categories.filter((c) => used.has(c.slug.toLowerCase()) || used.has(c.name.trim().toLowerCase()));
}

async function getJson(url: string, key: string, init: RequestInit = {}): Promise<unknown> {
  const res = await fetch(url, { ...init, headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json', ...(init.headers || {}) }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`${res.status} ${url.split('?')[0]}`);
  return res.json();
}

export async function fetchSeoData(supabaseUrl: string, key: string): Promise<SeoData> {
  const base = `${supabaseUrl.replace(/\/+$/, '')}/rest/v1`;
  const empty: SeoData = { courses: [], posts: [], bundles: [], categories: [], instructors: [], settings: {}, ok: false };
  const settled = await Promise.allSettled([
    getJson(`${base}/courses?select=*,profiles:instructor_id(full_name,headline),course_sections(*,lessons(title,lesson_order,duration_minutes,is_free_preview))&is_published=eq.true&order=created_at.desc`, key),
    getJson(`${base}/blog_posts?select=slug,title,excerpt,content_html,cover_image_url,category,author_name,published_at,updated_at,seo_title,seo_description&status=eq.published&published_at=lte.${encodeURIComponent(new Date().toISOString())}&order=published_at.desc&limit=500`, key),
    getJson(`${base}/bundles?select=slug,title,subtitle,description,thumbnail_url,price,updated_at,bundle_courses(course_id)&is_published=eq.true`, key),
    getJson(`${base}/categories?select=slug,name,description&is_active=eq.true&order=position`, key),
    getJson(`${base}/profiles?select=id,full_name,headline,bio,avatar_url&role=eq.instructor`, key),
    getJson(`${base}/rpc/get_public_settings`, key, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }),
  ]);
  const val = <T,>(i: number): T | null => (settled[i].status === 'fulfilled' ? ((settled[i] as PromiseFulfilledResult<unknown>).value as T) : null);
  settled.forEach((s, i) => s.status === 'rejected' && console.warn(`[seo] could not load ${['courses', 'blog', 'bundles', 'categories', 'instructors', 'settings'][i]}: ${(s.reason as Error)?.message}`));
  const courseRows = val<CourseRow[]>(0);
  if (!Array.isArray(courseRows)) return empty;
  const list = <T,>(i: number): T[] => {
    const v = val<T[]>(i);
    return Array.isArray(v) ? v : [];
  };

  const courses = courseRows.filter((r) => !r.is_demo).map(mapCourseRow);
  const published = new Set(courses.map((c) => c.id));
  const posts: SeoPost[] = list<PostRow>(1).filter((r) => r.slug && r.title).map((r) => ({
    slug: String(r.slug), title: String(r.title), excerpt: r.excerpt, contentHtml: r.content_html, coverImage: r.cover_image_url, authorName: r.author_name,
    publishedAt: r.published_at, updatedAt: r.updated_at, seoTitle: r.seo_title, seoDescription: r.seo_description, category: r.category,
  }));
  const bundles: SeoBundle[] = list<BundleRow>(2).filter((r) => r.slug && r.title).map((r) => ({
    slug: String(r.slug), title: String(r.title), subtitle: r.subtitle, description: r.description, thumbnail: r.thumbnail_url, price: num(r.price),
    courseCount: (r.bundle_courses || []).filter((bc) => !!bc.course_id && published.has(bc.course_id)).length, updatedAt: r.updated_at,
  })).filter((b) => b.courseCount > 0);
  const categories: SeoCategory[] = list<CategoryRow>(3).filter((r) => r.slug && r.name).map((r) => ({ slug: String(r.slug), name: String(r.name), description: r.description }));
  const instructors: SeoInstructor[] = list<InstructorRow>(4).filter((r) => r.id && r.full_name).map((r) => ({ id: String(r.id), name: String(r.full_name), headline: r.headline, bio: r.bio, avatar: r.avatar_url }));
  const s = val<SettingsRow>(5)?.settings || {};
  const social = Array.isArray(s.social?.links) ? s.social.links.filter((l) => l?.enabled && /^https:\/\//.test(l.url || '')).map((l) => String(l.url)) : [];
  return {
    courses, posts, bundles, categories, instructors, ok: true,
    settings: {
      robots: s.seo?.robots, gscVerification: s.seo?.gscVerification, companyName: s.general?.companyName, description: s.general?.description,
      telephone: s.contact?.primaryPhone, email: s.contact?.supportEmail, sameAs: social,
    },
  };
}

/* ------------------------------------------------------------------ HTML */
const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export interface PageInput {
  path: string;
  title: string;
  description: string;
  image?: string | null;
  type?: 'website' | 'article';
  robots: string;
  ld: Record<string, unknown>[];
  body: string;
  extraHead?: string;
}

/** Puts the page's head tags and readable content into the built app shell. */
export function renderPage(template: string, p: PageInput): string {
  const url = `${SITE_URL}${p.path === '/' ? '/' : p.path}`;
  const image = absoluteUrl(p.image) || DEFAULT_OG_IMAGE;
  let html = template
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(p.title)}</title>`)
    .replace(/\s*<meta\s+name="description"[^>]*>/i, '')
    .replace(/\s*<meta\s+name="robots"[^>]*>/gi, '')
    .replace(/\s*<link\s+rel="canonical"[^>]*>/gi, '')
    .replace(/\s*<meta\s+(property|name)="(og|twitter):[^"]*"[^>]*>/gi, '');
  const head = [
    `<meta name="description" content="${esc(p.description)}" />`,
    `<meta name="robots" content="${esc(p.robots)}" />`,
    `<link rel="canonical" href="${esc(url)}" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:type" content="${p.type || 'website'}" />`,
    `<meta property="og:title" content="${esc(p.title)}" />`,
    `<meta property="og:description" content="${esc(p.description)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:image" content="${esc(image)}" />`,
    `<meta property="og:locale" content="en_IN" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(p.title)}" />`,
    `<meta name="twitter:description" content="${esc(p.description)}" />`,
    `<meta name="twitter:image" content="${esc(image)}" />`,
    p.extraHead || '',
    p.ld.length ? jsonLdScript(p.ld) : '',
    // Readable content for crawlers without JavaScript; hidden as soon as the app starts (no layout jump)
    `<script>document.documentElement.classList.add('js')</script><style>.js [data-prerender]{display:none}</style>`,
  ].filter(Boolean).join('\n    ');
  html = html.replace(/<\/head>/i, `    ${head}\n  </head>`);
  return html.replace(/<div id="root"><\/div>/, `<div id="root"><div data-prerender>${p.body}</div></div>`);
}

const link = (href: string, text: string) => `<a href="${esc(href)}">${esc(text)}</a>`;
const NAV = `<header><nav aria-label="Main">${[['/', SITE_NAME], ['/courses', 'Courses'], ['/categories', 'Categories'], ['/bundles', 'Bundles'], ['/blog', 'Blog'], ['/about', 'About'], ['/contact', 'Contact']].map(([h, t]) => link(h, t)).join(' · ')}</nav></header>`;
const FOOTER = `<footer><nav aria-label="Footer">${[['/faq', 'FAQ'], ['/verify-certificate', 'Verify a certificate'], ['/become-instructor', 'Teach on Edufy'], ['/privacy', 'Privacy'], ['/terms', 'Terms'], ['/refund', 'Refunds']].map(([h, t]) => link(h, t)).join(' · ')}</nav><p>© Educurist Learning Solutions Private Limited · ${SITE_NAME}</p></footer>`;
const crumbs = (items: { name: string; path: string }[]) => `<nav aria-label="Breadcrumb">${items.map((i, n) => (n === items.length - 1 ? esc(i.name) : link(i.path, i.name))).join(' › ')}</nav>`;
const price = (v: number) => (v > 0 ? `₹${Math.round(v).toLocaleString('en-IN')}` : 'Free');
const courseItem = (c: SeoCourse) => `<li>${link(coursePath(c), readableTitle(c.title))}${c.subtitle ? ` — ${esc(clip(stripHtml(c.subtitle), 140))}` : ''} (${price(c.price)})</li>`;
const page = (main: string) => `${NAV}<main>${main}</main>${FOOTER}`;

/** Marker in public/.htaccess where the build writes permanent redirects from old course addresses. */
export const REDIRECT_MARKER = '# @EDUFY_COURSE_REDIRECTS';
const regexEscape = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** 301 redirects from /courses/<id> to the course's readable address (only where the two differ). */
export function courseRedirectRules(courses: Pick<SeoCourse, 'id' | 'slug'>[]): string[] {
  return courses
    .filter((c) => c.slug && c.slug !== c.id && /^[A-Za-z0-9_-]+$/.test(c.id) && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(c.slug))
    .map((c) => `RewriteRule ^courses/${regexEscape(c.id)}/?$ ${coursePath(c)} [R=301,L]`);
}

/** Puts the redirect rules into the built .htaccess at the marker (unchanged when the marker is missing). */
export function withCourseRedirects(htaccess: string, rules: string[]): string {
  if (!htaccess.includes(REDIRECT_MARKER)) return htaccess;
  const block = rules.length ? rules.map((r) => `  ${r}`).join('\n') : '  # (no course redirects)';
  return htaccess.replace(REDIRECT_MARKER, `${REDIRECT_MARKER} (generated at build time)\n${block}`);
}

export function buildSeoFiles(template: string, d: SeoData): Map<string, string> {
  const files = new Map<string, string>();
  const robots = /noindex/i.test(d.settings.robots || '') ? 'noindex, nofollow' : 'index, follow, max-image-preview:large';
  const org = organizationLd({ legalName: d.settings.companyName, description: d.settings.description, telephone: d.settings.telephone, email: d.settings.email, sameAs: d.settings.sameAs });
  const gsc = d.settings.gscVerification && /^[A-Za-z0-9_-]{10,100}$/.test(d.settings.gscVerification) ? `<meta name="google-site-verification" content="${esc(d.settings.gscVerification)}" />` : '';
  const out = (route: string, html: string) => files.set(route === '/' ? 'seo/index.html' : `seo${route}.html`, html);
  const sitemap: SitemapEntry[] = [];
  const newest = (dates: (string | null | undefined)[]) => dates.filter(Boolean).sort().pop() || null;

  for (const s of STATIC_PAGES) {
    let main = `<h1>${esc(s.h1)}</h1><p>${esc(s.description)}</p>`;
    const ld: Record<string, unknown>[] = [];
    let lastmod: string | null = null;
    if (s.path === '/') {
      ld.push(org, websiteLd(), leadInstructorLd());
      main += `<section><h2>Online courses</h2><ul>${d.courses.map(courseItem).join('')}</ul>${link('/courses', 'Browse all courses')}</section>`;
      if (d.bundles.length) main += `<section><h2>Course bundles</h2><ul>${d.bundles.map((b) => `<li>${link(bundlePath(b), readableTitle(b.title))} (${b.courseCount} courses)</li>`).join('')}</ul></section>`;
      main += `<section><h2>Meet your lead tutor</h2><p>${esc(LEAD_INSTRUCTOR.name)}, ${esc(LEAD_INSTRUCTOR.designation)} at ${esc(LEAD_INSTRUCTOR.organisation)}.</p></section>`;
      if (d.posts.length) main += `<section><h2>From the blog</h2><ul>${d.posts.slice(0, 6).map((p) => `<li>${link(postPath(p), p.title)}</li>`).join('')}</ul></section>`;
      lastmod = newest([...d.courses.map((c) => c.updatedAt), ...d.posts.map((p) => p.updatedAt)]);
    } else {
      ld.push(breadcrumbLd([{ name: 'Home', path: '/' }, { name: s.h1, path: s.path }]));
      if (s.path === '/courses') {
        main += `<ul>${d.courses.map(courseItem).join('')}</ul>`;
        lastmod = newest(d.courses.map((c) => c.updatedAt));
      } else if (s.path === '/categories') main += `<ul>${categoriesWithCourses(d).map((c) => `<li>${link(`/courses?category=${encodeURIComponent(c.slug)}`, c.name)}${c.description ? ` — ${esc(c.description)}` : ''}</li>`).join('')}</ul>`;
      else if (s.path === '/bundles') main += `<ul>${d.bundles.map((b) => `<li>${link(bundlePath(b), readableTitle(b.title))} — ${b.courseCount} courses, ${price(b.price)}</li>`).join('')}</ul>`;
      else if (s.path === '/blog') {
        main += `<ul>${d.posts.map((p) => `<li>${link(postPath(p), p.title)}${p.excerpt ? ` — ${esc(clip(stripHtml(p.excerpt), 140))}` : ''}</li>`).join('')}</ul>`;
        lastmod = newest(d.posts.map((p) => p.updatedAt || p.publishedAt));
      } else if (s.path === '/instructors') main += `<ul><li>${esc(LEAD_INSTRUCTOR.name)} — ${esc(LEAD_INSTRUCTOR.designation)}</li>${d.instructors.map((i) => `<li>${link(`/instructors/${encodeURIComponent(i.id)}`, i.name)}${i.headline ? ` — ${esc(i.headline)}` : ''}</li>`).join('')}</ul>`;
    }
    out(s.path, renderPage(template, { path: s.path, title: s.title, description: s.description, robots, ld, body: page(main), extraHead: s.path === '/' ? gsc : '' }));
    sitemap.push({ path: s.path, lastmod, changefreq: s.changefreq, priority: s.priority });
  }

  for (const c of d.courses) {
    const p = coursePath(c);
    const seo = courseSeo(c);
    const name = readableTitle(c.title);
    const inst = courseInstructor(c);
    const related = d.courses.filter((o) => o.id !== c.id && o.category && o.category === c.category).slice(0, 4);
    const main =
      crumbs([{ name: 'Home', path: '/' }, { name: 'Courses', path: '/courses' }, { name, path: p }]) +
      `<article><h1>${esc(name)}</h1>${c.subtitle ? `<p>${esc(stripHtml(c.subtitle))}</p>` : ''}` +
      `<ul><li>Price: ${price(c.price)}${c.originalPrice && c.originalPrice > c.price ? ` (was ₹${Math.round(c.originalPrice).toLocaleString('en-IN')})` : ''}</li>${c.level ? `<li>Level: ${esc(c.level)}</li>` : ''}${c.language ? `<li>Language: ${esc(c.language)}</li>` : ''}${c.totalLessons ? `<li>${c.totalLessons} ${c.totalLessons === 1 ? 'lesson' : 'lessons'}</li>` : ''}${c.category ? `<li>Category: ${esc(c.category)}</li>` : ''}${inst ? `<li>Instructor: ${esc(inst.name)}${inst.title ? `, ${esc(inst.title)}` : ''}</li>` : ''}</ul>` +
      (c.learningOutcomes?.length ? `<section><h2>What you’ll learn</h2><ul>${c.learningOutcomes.map((o) => `<li>${esc(o)}</li>`).join('')}</ul></section>` : '') +
      (stripHtml(c.description) ? `<section><h2>About this course</h2><p>${esc(stripHtml(c.description))}</p></section>` : '') +
      (c.requirements?.length ? `<section><h2>Prerequisites</h2><ul>${c.requirements.map((o) => `<li>${esc(o)}</li>`).join('')}</ul></section>` : '') +
      (c.audience?.length ? `<section><h2>Who this course is for</h2><ul>${c.audience.map((o) => `<li>${esc(o)}</li>`).join('')}</ul></section>` : '') +
      (c.sections?.length
        ? `<section><h2>Course curriculum</h2>${c.sections.map((s) => `<h3>${esc(s.title)}</h3>${s.description ? `<p>${esc(s.description)}</p>` : ''}<ol>${s.lessons.map((l) => `<li>${esc(l.title)}${l.minutes ? ` (${l.minutes} min)` : ''}${l.freePreview ? ' – free preview' : ''}</li>`).join('')}</ol>`).join('')}</section>`
        : '') +
      `<p>${link(p, `Enroll in ${name}`)}</p></article>` +
      (related.length ? `<section><h2>More courses in ${esc(c.category)}</h2><ul>${related.map(courseItem).join('')}</ul></section>` : '') +
      `<p>${link('/courses', 'Browse all online courses')}</p>`;
    out(p, renderPage(template, { path: p, title: seo.title, description: seo.description, image: c.thumbnail, robots, body: page(main), ld: [courseLd(c), breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Courses', path: '/courses' }, { name, path: p }])] }));
    sitemap.push({ path: p, lastmod: c.updatedAt, changefreq: 'weekly', priority: 0.8 });
  }

  for (const post of d.posts) {
    const p = postPath(post);
    const seo = postSeo(post);
    const others = d.posts.filter((o) => o.slug !== post.slug).slice(0, 4);
    const main =
      crumbs([{ name: 'Home', path: '/' }, { name: 'Blog', path: '/blog' }, { name: post.title, path: p }]) +
      `<article><h1>${esc(post.title)}</h1>${post.authorName ? `<p>By ${esc(post.authorName)}${post.publishedAt ? ` · ${esc(post.publishedAt.slice(0, 10))}` : ''}</p>` : ''}<p>${esc(stripHtml(post.contentHtml) || stripHtml(post.excerpt))}</p></article>` +
      (others.length ? `<section><h2>More articles</h2><ul>${others.map((o) => `<li>${link(postPath(o), o.title)}</li>`).join('')}</ul></section>` : '') +
      `<p>${link('/courses', 'Explore Edufy Academy online courses')}</p>`;
    out(p, renderPage(template, { path: p, title: seo.title, description: seo.description, image: post.coverImage, type: 'article', robots, body: page(main), ld: [postLd(post), breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Blog', path: '/blog' }, { name: clip(post.title, 80), path: p }])] }));
    sitemap.push({ path: p, lastmod: post.updatedAt || post.publishedAt, changefreq: 'monthly', priority: 0.6 });
  }

  for (const b of d.bundles) {
    const p = bundlePath(b);
    const seo = bundleSeo(b);
    const name = readableTitle(b.title);
    const main =
      crumbs([{ name: 'Home', path: '/' }, { name: 'Bundles', path: '/bundles' }, { name, path: p }]) +
      `<article><h1>${esc(name)}</h1>${b.subtitle ? `<p>${esc(stripHtml(b.subtitle))}</p>` : ''}${stripHtml(b.description) ? `<p>${esc(stripHtml(b.description))}</p>` : ''}<p>${b.courseCount} courses for ${price(b.price)}.</p></article>`;
    out(p, renderPage(template, { path: p, title: seo.title, description: seo.description, image: b.thumbnail, robots, body: page(main), ld: [breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Bundles', path: '/bundles' }, { name, path: p }])] }));
    sitemap.push({ path: p, lastmod: b.updatedAt, changefreq: 'weekly', priority: 0.6 });
  }

  for (const i of d.instructors) {
    const p = `/instructors/${encodeURIComponent(i.id)}`;
    const title = `${i.name} – Instructor | ${SITE_NAME}`;
    const description = clip(stripHtml(i.bio) || `${i.name}${i.headline ? `, ${i.headline}` : ''} — instructor at Edufy Academy. Explore the online courses they teach.`, 160);
    const main = crumbs([{ name: 'Home', path: '/' }, { name: 'Instructors', path: '/instructors' }, { name: i.name, path: p }]) + `<article><h1>${esc(i.name)}</h1>${i.headline ? `<p>${esc(i.headline)}</p>` : ''}${i.bio ? `<p>${esc(stripHtml(i.bio))}</p>` : ''}</article>`;
    const person = { '@type': 'Person', name: i.name, ...(i.headline ? { jobTitle: i.headline } : {}), url: `${SITE_URL}${p}`, worksFor: { '@id': `${SITE_URL}/#organization` } };
    out(p, renderPage(template, { path: p, title, description, image: i.avatar, robots, body: page(main), ld: [person, breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Instructors', path: '/instructors' }, { name: i.name, path: p }])] }));
    sitemap.push({ path: p, changefreq: 'monthly', priority: 0.4 });
  }

  // Unknown addresses: the app shell (it shows its "page not found" view), never indexed, served with HTTP 404
  files.set('404.html', renderPage(template, { path: '/404', title: `Page not found | ${SITE_NAME}`, description: 'The page you are looking for could not be found on Edufy Academy.', robots: 'noindex, follow', ld: [], body: page(`<h1>Page not found</h1><p>${link('/', 'Go to the Edufy Academy home page')} or ${link('/courses', 'browse all courses')}.</p>`) }).replace(/\s*<link rel="canonical"[^>]*>/i, '').replace(/\s*<meta property="og:url"[^>]*>/i, ''));
  files.set('sitemap.xml', sitemapXml(sitemap));
  return files;
}

/* ------------------------------------------------------------------ Vite plugin */
export function seoPrerender(opts: { supabaseUrl?: string; supabaseKey?: string } = {}): Plugin {
  let outDir = 'dist';
  return {
    name: 'edufy-seo-prerender',
    apply: 'build',
    configResolved(cfg) {
      outDir = path.resolve(cfg.root, cfg.build.outDir);
    },
    async closeBundle() {
      try {
        const indexFile = path.join(outDir, 'index.html');
        if (!fs.existsSync(indexFile)) return;
        const template = fs.readFileSync(indexFile, 'utf8');
        let data: SeoData = { courses: [], posts: [], bundles: [], categories: [], instructors: [], settings: {}, ok: false };
        if (opts.supabaseUrl && opts.supabaseKey) {
          try {
            data = await fetchSeoData(opts.supabaseUrl, opts.supabaseKey);
          } catch (e) {
            console.warn(`[seo] content could not be loaded, writing the fixed pages only: ${(e as Error).message}`);
          }
        }
        const files = buildSeoFiles(template, data);
        for (const [rel, content] of files) {
          const file = path.join(outDir, rel);
          fs.mkdirSync(path.dirname(file), { recursive: true });
          fs.writeFileSync(file, content);
        }
        // Old /courses/<id> addresses → permanent redirect to the readable course address
        const htaccessFile = path.join(outDir, '.htaccess');
        if (fs.existsSync(htaccessFile)) {
          fs.writeFileSync(htaccessFile, withCourseRedirects(fs.readFileSync(htaccessFile, 'utf8'), courseRedirectRules(data.courses)));
        }
        const urls = (files.get('sitemap.xml')!.match(/<loc>/g) || []).length;
        if (/noindex/i.test(data.settings.robots || '')) {
          console.warn('[seo] WARNING: Admin → Settings → SEO → robots is set to noindex. Every page is built with "noindex" and Google will not index the site. Change it to "index, follow" and rebuild.');
        }
        console.log(`[seo] ${files.size - 2} pages prerendered, sitemap.xml with ${urls} URLs (${data.courses.length} courses, ${data.posts.length} posts, ${data.bundles.length} bundles)${data.ok ? '' : ' — content not loaded'}`);
      } catch (e) {
        // SEO output must never break the website build
        console.warn(`[seo] prerender skipped: ${(e as Error).message}`);
      }
    },
  };
}

