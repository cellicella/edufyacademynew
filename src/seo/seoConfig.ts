/**
 * Search-engine metadata for Edufy Academy — shared by the browser (src/lib/seo.ts, RouteSeo) and the build-time
 * prerender (scripts/seo/prerender.ts) so crawlers and visitors see the same titles, descriptions, canonical
 * URLs and structured data. Pure functions only (no DOM, no network).
 *
 * Rules: facts come from the database or from Edufy's own settings — no invented ratings, reviews, student
 * counts, certifications or providers.
 */
import { LEAD_INSTRUCTOR, isPlatformAccount } from '../config/leadInstructor';

export const SITE_URL = 'https://edufyacademy.com';
export const SITE_NAME = 'Edufy Academy';
export const DEFAULT_OG_IMAGE = `${SITE_URL}/brand/edufy-logo-512.png`;

export interface PageSeo {
  path: string;
  title: string;
  description: string;
  /** Visible heading used by the prerendered page (the React page has its own H1). */
  h1: string;
  priority: number;
  changefreq: 'daily' | 'weekly' | 'monthly' | 'yearly';
  keywords: string[];
}

/** Public, indexable pages with fixed content. Titles ≈ 50–60 characters, descriptions ≈ 150–160. */
export const STATIC_PAGES: PageSeo[] = [
  {
    path: '/',
    title: 'Edufy Academy – Affordable Online Courses with Certificates',
    description: 'Learn new skills online with Edufy Academy: affordable, self-paced courses with video lessons, quizzes and certificates anyone can verify. Start learning today.',
    h1: 'Learn new skills online with Edufy Academy',
    priority: 1,
    changefreq: 'daily',
    keywords: ['Edufy Academy', 'online courses', 'online learning platform', 'affordable online courses', 'learn new skills online'],
  },
  {
    path: '/courses',
    title: 'Online Courses – Browse All Courses | Edufy Academy',
    description: 'Browse Edufy Academy’s online courses for career and professional skills. Self-paced video lessons, quizzes and a certificate of completion when you finish.',
    h1: 'Online courses',
    priority: 0.9,
    changefreq: 'daily',
    keywords: ['online courses', 'professional online courses', 'career development courses', 'certification courses online'],
  },
  {
    path: '/categories',
    title: 'Course Categories – Skill Development Courses | Edufy',
    description: 'Explore Edufy Academy course categories and find skill development courses for your career, from business and communication skills to technology topics.',
    h1: 'Course categories',
    priority: 0.7,
    changefreq: 'weekly',
    keywords: ['skill development courses', 'technology courses', 'online course categories'],
  },
  {
    path: '/bundles',
    title: 'Course Bundles – Learn More for Less | Edufy Academy',
    description: 'Save with Edufy Academy course bundles: several online courses together at one bundle price, with the same video lessons, quizzes and certificates.',
    h1: 'Course bundles',
    priority: 0.7,
    changefreq: 'weekly',
    keywords: ['course bundles', 'affordable online courses'],
  },
  {
    path: '/instructors',
    title: 'Our Instructors – Meet Your Teachers | Edufy Academy',
    description: 'Meet the instructors who teach at Edufy Academy and explore the online courses they lead. Learn practical skills with guided video lessons.',
    h1: 'Our instructors',
    priority: 0.5,
    changefreq: 'monthly',
    keywords: ['online course instructors', 'Edufy Academy instructors'],
  },
  {
    path: '/blog',
    title: 'Edufy Academy Blog – Articles on Learning and Skills',
    description: 'Read the Edufy Academy blog for articles on online learning, skill development and growing your career with practical, self-paced courses.',
    h1: 'Edufy Academy blog',
    priority: 0.6,
    changefreq: 'weekly',
    keywords: ['online learning blog', 'skill development', 'career development'],
  },
  {
    path: '/about',
    title: 'About Edufy Academy – Online Learning Platform',
    description: 'Edufy Academy is an online learning platform by Educurist Learning Solutions offering practical courses with video lessons and verifiable certificates.',
    h1: 'About Edufy Academy',
    priority: 0.5,
    changefreq: 'monthly',
    keywords: ['online learning platform', 'Edufy Academy', 'Educurist Learning Solutions'],
  },
  {
    path: '/contact',
    title: 'Contact Edufy Academy – Course and Support Enquiries',
    description: 'Contact Edufy Academy for questions about online courses, enrollment, payments or teaching on Edufy. Our student support team is here to help.',
    h1: 'Contact Edufy Academy',
    priority: 0.5,
    changefreq: 'yearly',
    keywords: ['contact Edufy Academy', 'online course support'],
  },
  {
    path: '/faq',
    title: 'Frequently Asked Questions – Online Courses | Edufy',
    description: 'Answers to common questions about Edufy Academy online courses: enrollment, payments, course access, certificates and getting help from our team.',
    h1: 'Frequently asked questions',
    priority: 0.4,
    changefreq: 'monthly',
    keywords: ['online courses FAQ', 'Edufy Academy help'],
  },
  {
    path: '/verify-certificate',
    title: 'Verify an Edufy Academy Certificate of Completion',
    description: 'Check that an Edufy Academy certificate is genuine: enter the certificate code to see the learner’s name, the course completed and the issue date.',
    h1: 'Verify a certificate',
    priority: 0.4,
    changefreq: 'yearly',
    keywords: ['verify certificate', 'Edufy Academy certificate'],
  },
  {
    path: '/become-instructor',
    title: 'Teach Online – Become an Instructor at Edufy Academy',
    description: 'Share your expertise with learners: apply to become an Edufy Academy instructor and publish online courses with video lessons, quizzes and certificates.',
    h1: 'Become an instructor',
    priority: 0.4,
    changefreq: 'yearly',
    keywords: ['teach online', 'become an online instructor'],
  },
  {
    path: '/privacy',
    title: 'Privacy Policy | Edufy Academy',
    description: 'How Edufy Academy and Educurist Learning Solutions collect, use and protect personal information when you browse the website and take online courses.',
    h1: 'Privacy policy',
    priority: 0.2,
    changefreq: 'yearly',
    keywords: [],
  },
  {
    path: '/terms',
    title: 'Terms of Service | Edufy Academy',
    description: 'The terms that apply when you use the Edufy Academy website, create an account, enroll in online courses and use course materials and certificates.',
    h1: 'Terms of service',
    priority: 0.2,
    changefreq: 'yearly',
    keywords: [],
  },
  {
    path: '/refund',
    title: 'Refund Policy | Edufy Academy',
    description: 'Read the Edufy Academy refund policy: which course purchases can be refunded, how to request a refund and what happens after you request one.',
    h1: 'Refund policy',
    priority: 0.2,
    changefreq: 'yearly',
    keywords: [],
  },
];

/** Never indexed: sign-in, account, learning area, dashboards, admin and auth callbacks. */
const PRIVATE = [/^\/(login|register|forgot-password|reset-password)\/?$/, /^\/auth(\/|$)/, /^\/learn(\/|$)/, /^\/student(\/|$)/, /^\/instructor(\/|$)/, /^\/admin(\/|$)/];
export const isPrivatePath = (path: string) => PRIVATE.some((re) => re.test(path));

export const staticPage = (path: string): PageSeo | undefined => {
  const p = path.replace(/\/+$/, '') || '/';
  return STATIC_PAGES.find((s) => s.path === p);
};

/* ------------------------------------------------------------------ text helpers */
export function stripHtml(html: string | null | undefined): string {
  return String(html || '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** Cuts at a word boundary and adds an ellipsis when needed. */
export function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const i = cut.lastIndexOf(' ');
  return `${(i > max * 0.6 ? cut.slice(0, i) : cut).replace(/[\s,.;:–-]+$/, '')}…`;
}

const SMALL = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'vs', 'via', 'with']);
/** "MASTERING THE ART OF WRITING: TIPS" → "Mastering the Art of Writing: Tips" (only for all-caps titles). */
export function readableTitle(title: string): string {
  const t = title.replace(/\s+/g, ' ').trim();
  const letters = t.replace(/[^A-Za-z]/g, '');
  if (!letters || letters !== letters.toUpperCase()) return t;
  let startOfClause = true;
  return t
    .toLowerCase()
    .split(' ')
    .map((w) => {
      const keepSmall = SMALL.has(w) && !startOfClause;
      startOfClause = /[:–—-]$/.test(w);
      return keepSmall ? w : w.replace(/^([^a-z]*)([a-z])/, (_, p, c) => p + c.toUpperCase());
    })
    .join(' ');
}

/** Adds " | Edufy Academy" when it fits in ~60 characters. */
export const withBrand = (title: string, max = 62) => (title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`.length <= max ? `${title} | ${SITE_NAME}` : title);

export const absoluteUrl = (pathOrUrl: string | null | undefined): string | null => {
  if (!pathOrUrl) return null;
  if (/^https:\/\//i.test(pathOrUrl)) return pathOrUrl;
  if (pathOrUrl.startsWith('/')) return `${SITE_URL}${pathOrUrl}`;
  return null;
};

/* ------------------------------------------------------------------ data shapes (from the database / app) */
export interface SeoCourse {
  id: string;
  /** Readable URL slug (used for the public address when present). */
  slug?: string | null;
  title: string;
  /** Optional search-result title / description set for the course. */
  seoTitle?: string | null;
  seoDescription?: string | null;
  subtitle?: string | null;
  description?: string | null;
  category?: string | null;
  level?: string | null;
  language?: string | null;
  price: number;
  originalPrice?: number | null;
  durationHours?: number | null;
  totalLessons?: number | null;
  thumbnail?: string | null;
  learningOutcomes?: string[];
  requirements?: string[];
  updatedAt?: string | null;
  instructorName?: string | null;
  instructorTitle?: string | null;
  /** Who the course is for (readable list on the prerendered page). */
  audience?: string[];
  /** Curriculum for the prerendered page: sections in order with their lessons. */
  sections?: { title: string; description?: string | null; lessons: { title: string; minutes: number; freePreview?: boolean }[] }[];
}

export interface SeoPost {
  slug: string;
  title: string;
  excerpt?: string | null;
  contentHtml?: string | null;
  coverImage?: string | null;
  authorName?: string | null;
  publishedAt?: string | null;
  updatedAt?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  category?: string | null;
}

export interface SeoBundle {
  slug: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  thumbnail?: string | null;
  price: number;
  courseCount: number;
  updatedAt?: string | null;
}

/** Public address of a course: its readable slug when it has one (e.g. /courses/salary-negotiation-course), else its id. */
export const coursePath = (c: { id: string; slug?: string | null }) => `/courses/${encodeURIComponent((c.slug || '').trim() || c.id)}`;
export const postPath = (p: Pick<SeoPost, 'slug'>) => `/blog/${encodeURIComponent(p.slug)}`;
export const bundlePath = (b: Pick<SeoBundle, 'slug'>) => `/bundles/${encodeURIComponent(b.slug)}`;

/** The instructor shown publicly (Edufy's own courses show the lead instructor). */
export function courseInstructor(c: SeoCourse): { name: string; title: string } | null {
  if (!c.instructorName) return null;
  if (isPlatformAccount({ name: c.instructorName, title: c.instructorTitle || '' })) return { name: LEAD_INSTRUCTOR.name, title: LEAD_INSTRUCTOR.designation };
  return { name: c.instructorName, title: c.instructorTitle || '' };
}

export function courseSeo(c: SeoCourse): { title: string; description: string } {
  const name = readableTitle(c.title);
  const level = c.level && !/all levels/i.test(c.level) ? `${c.level.toLowerCase()} ` : '';
  const base = stripHtml(c.subtitle) || stripHtml(c.description) || `${name} — an online course by Edufy Academy.`;
  const facts = [`Self-paced ${level}online course`, c.totalLessons ? `${c.totalLessons} ${c.totalLessons === 1 ? 'lesson' : 'lessons'}` : '', c.price > 0 ? `₹${Math.round(c.price).toLocaleString('en-IN')}` : 'free'].filter(Boolean).join(' · ');
  const seoTitle = stripHtml(c.seoTitle);
  const seoDescription = stripHtml(c.seoDescription);
  return {
    title: seoTitle ? withBrand(seoTitle) : withBrand(name),
    description: seoDescription ? clip(seoDescription, 160) : withFacts(base, `${facts}.`),
  };
}

/** "<text> <facts>" within 160 characters: the text is shortened (never the facts), ending as a sentence. */
function withFacts(text: string, facts: string, max = 160): string {
  const t = clip(text, max - facts.length - 1);
  return `${/[.!?…]$/.test(t) ? t : `${t}.`} ${facts}`;
}

export function postSeo(p: SeoPost): { title: string; description: string } {
  const title = withBrand(readableTitle(p.seoTitle || p.title));
  const description = clip(stripHtml(p.seoDescription) || stripHtml(p.excerpt) || stripHtml(p.contentHtml) || `${p.title} — Edufy Academy blog.`, 160);
  return { title, description };
}

export function bundleSeo(b: SeoBundle): { title: string; description: string } {
  const name = readableTitle(b.title);
  const base = stripHtml(b.subtitle) || stripHtml(b.description) || `${b.courseCount} Edufy Academy online courses together in one bundle.`;
  return { title: withBrand(`${name} – Course Bundle`), description: withFacts(base, `${b.courseCount} courses · ₹${Math.round(b.price).toLocaleString('en-IN')} for the bundle.`) };
}

/* ------------------------------------------------------------------ structured data (JSON-LD) */
export interface OrgInfo {
  name?: string;
  legalName?: string;
  description?: string;
  telephone?: string;
  email?: string;
  sameAs?: string[];
}

export function organizationLd(o: OrgInfo = {}) {
  const ld: Record<string, unknown> = {
    '@type': 'EducationalOrganization',
    '@id': `${SITE_URL}/#organization`,
    name: o.name || SITE_NAME,
    url: `${SITE_URL}/`,
    logo: DEFAULT_OG_IMAGE,
  };
  if (o.legalName) ld.legalName = o.legalName;
  if (o.description) ld.description = o.description;
  if (o.sameAs?.length) ld.sameAs = o.sameAs;
  if (o.telephone || o.email) {
    ld.contactPoint = { '@type': 'ContactPoint', contactType: 'customer support', ...(o.telephone ? { telephone: o.telephone } : {}), ...(o.email ? { email: o.email } : {}) };
  }
  return ld;
}

export const websiteLd = () => ({
  '@type': 'WebSite',
  '@id': `${SITE_URL}/#website`,
  url: `${SITE_URL}/`,
  name: SITE_NAME,
  publisher: { '@id': `${SITE_URL}/#organization` },
  inLanguage: 'en',
});

export const breadcrumbLd = (items: { name: string; path: string }[]) => ({
  '@type': 'BreadcrumbList',
  itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: `${SITE_URL}${it.path === '/' ? '/' : it.path}` })),
});

export const leadInstructorLd = () => ({
  '@type': 'Person',
  '@id': `${SITE_URL}/#lead-instructor`,
  name: LEAD_INSTRUCTOR.name,
  jobTitle: LEAD_INSTRUCTOR.designation,
  image: `${SITE_URL}${LEAD_INSTRUCTOR.portraitJpg}`,
  worksFor: { '@id': `${SITE_URL}/#organization` },
});

export function courseLd(c: SeoCourse) {
  const seo = courseSeo(c);
  const instructor = courseInstructor(c);
  const instance: Record<string, unknown> = { '@type': 'CourseInstance', courseMode: 'Online' };
  if (c.durationHours && c.durationHours > 0) instance.courseWorkload = `PT${Math.max(1, Math.round(c.durationHours * 60))}M`;
  if (instructor) instance.instructor = { '@type': 'Person', name: instructor.name, ...(instructor.title ? { jobTitle: instructor.title } : {}) };
  const image = absoluteUrl(c.thumbnail);
  return {
    '@type': 'Course',
    '@id': `${SITE_URL}${coursePath(c)}#course`,
    name: readableTitle(c.title),
    description: clip(stripHtml(c.description) || stripHtml(c.subtitle) || seo.description, 500),
    url: `${SITE_URL}${coursePath(c)}`,
    ...(image ? { image } : {}),
    inLanguage: /hindi/i.test(c.language || '') ? 'hi' : /tamil/i.test(c.language || '') ? 'ta' : 'en',
    ...(c.level ? { educationalLevel: c.level } : {}),
    ...(c.category ? { about: c.category } : {}),
    ...(c.learningOutcomes?.length ? { teaches: c.learningOutcomes.slice(0, 10) } : {}),
    provider: { '@type': 'Organization', '@id': `${SITE_URL}/#organization`, name: SITE_NAME, sameAs: `${SITE_URL}/` },
    offers: {
      '@type': 'Offer',
      category: c.price > 0 ? 'Paid' : 'Free',
      price: Math.max(0, Number(c.price) || 0).toFixed(2),
      priceCurrency: 'INR',
      availability: 'https://schema.org/InStock',
      url: `${SITE_URL}${coursePath(c)}`,
    },
    hasCourseInstance: [instance],
  };
}

export function postLd(p: SeoPost) {
  const image = absoluteUrl(p.coverImage);
  return {
    '@type': 'BlogPosting',
    '@id': `${SITE_URL}${postPath(p)}#article`,
    headline: clip(readableTitle(p.title), 110),
    description: postSeo(p).description,
    url: `${SITE_URL}${postPath(p)}`,
    mainEntityOfPage: `${SITE_URL}${postPath(p)}`,
    ...(image ? { image } : {}),
    ...(p.publishedAt ? { datePublished: p.publishedAt } : {}),
    ...(p.updatedAt || p.publishedAt ? { dateModified: p.updatedAt || p.publishedAt } : {}),
    author: p.authorName ? { '@type': 'Person', name: p.authorName } : { '@id': `${SITE_URL}/#organization` },
    publisher: { '@id': `${SITE_URL}/#organization` },
  };
}

/** One <script type="application/ld+json"> with an @graph (no duplicate blocks). `<` is escaped. */
export function jsonLdScript(nodes: Record<string, unknown>[]): string {
  const json = JSON.stringify({ '@context': 'https://schema.org', '@graph': nodes }).replace(/</g, '\\u003c');
  return `<script type="application/ld+json" data-seo="ld">${json}</script>`;
}

/* ------------------------------------------------------------------ sitemap */
export interface SitemapEntry {
  path: string;
  lastmod?: string | null;
  changefreq?: PageSeo['changefreq'];
  priority?: number;
}

const xmlEsc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const day = (d?: string | null) => {
  if (!d) return null;
  const t = new Date(d);
  return Number.isNaN(t.getTime()) ? null : t.toISOString().slice(0, 10);
};

export function sitemapXml(entries: SitemapEntry[]): string {
  const seen = new Set<string>();
  const rows = entries
    .filter((e) => e.path.startsWith('/') && !isPrivatePath(e.path) && !seen.has(e.path) && seen.add(e.path))
    .map((e) => {
      const lm = day(e.lastmod);
      return `  <url>\n    <loc>${xmlEsc(`${SITE_URL}${e.path === '/' ? '/' : e.path}`)}</loc>${lm ? `\n    <lastmod>${lm}</lastmod>` : ''}${e.changefreq ? `\n    <changefreq>${e.changefreq}</changefreq>` : ''}${e.priority !== undefined ? `\n    <priority>${e.priority.toFixed(1)}</priority>` : ''}\n  </url>`;
    });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join('\n')}\n</urlset>\n`;
}

/* ------------------------------------------------------------------ keyword map (documentation + prerender links) */
export const COURSE_KEYWORD_HINTS = ['online course', 'certificate of completion', 'self-paced', 'Edufy Academy'];
