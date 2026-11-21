# Edufy Academy – SEO guide

How search engine optimisation works on https://edufyacademy.com, what to do before and after each deploy, and how to set up Google Search Console.

Nothing here guarantees rankings or indexing. Google decides what to index and when. The setup makes every public page easy to crawl and understand. Treat indexing as confirmed only after you see it in Google Search Console.

---

## 1. How it works

| Part | File | What it does |
|---|---|---|
| Page text (titles, descriptions, H1s, keywords) | `src/seo/seoConfig.ts` | One list for the build and the browser, so both always use the same text |
| Build-time prerender | `scripts/seo/prerender.ts` (Vite plugin in `vite.config.ts`) | After `vite build`, reads published content from Supabase with the public key and writes the files below |
| | `dist/seo/<page>.html` | One HTML file per public page, containing its own title, description, canonical URL, Open Graph/Twitter tags, JSON-LD and readable text (headings, links, course facts) for crawlers. The React app starts from this file and looks the same as before |
| | `dist/sitemap.xml` | All public pages with `lastmod`. Private areas are never listed |
| | `dist/404.html` | Served with a real HTTP 404 status for unknown addresses; marked noindex |
| Server rules | `public/.htaccess` | Serves `/seo/<page>.html` for public pages, gives unknown top-level paths a 404, and falls back to the normal app shell |
| Crawl rules | `public/robots.txt` | Allows the site, blocks the dashboards, admin, player, `/auth/` and `/api/`, and points to the sitemap. CSS, JS and images are not blocked |
| In-browser tags | `src/lib/seo.ts`, `src/components/seo/RouteSeo.tsx` | Keep the same tags correct while visitors move around the app. There is only ever one canonical tag, one robots tag and one JSON-LD block |
| Dynamic pages | Course, bundle, blog-post and instructor pages | Set their tags from their own data with `useSeo()`. A missing item gets `noindex` |

**Important:** the prerendered pages and the sitemap are made when the site is **built**. After you publish, edit or unpublish a course, bundle or blog post, redeploy the website (push to GitHub) to refresh them. Until then:

- new pages still work and are indexable, because the app sets their tags in the browser;
- they are not listed in the sitemap yet.

### Indexable pages
- **Fixed pages:** `/`, `/courses`, `/categories`, `/bundles`, `/instructors`, `/blog`, `/about`, `/contact`, `/faq`, `/verify-certificate`, `/become-instructor`, `/privacy`, `/terms`, `/refund`.
- **Dynamic pages:**
  - `/courses/<id>` for every published, non-demo course;
  - `/blog/<slug>` for every published post whose date has passed;
  - `/bundles/<slug>` for bundles with at least one published course;
  - `/instructors/<id>`.

### Not indexed (noindex and/or blocked in robots.txt, never in the sitemap)
`/login`, `/register`, `/forgot-password`, `/reset-password`, `/auth/*`, `/learn/*`, `/student/*`, `/instructor` (dashboard), `/admin/*`, the 404 page, missing courses/posts/bundles, and bundles with no published courses.

### Structured data (JSON-LD)
All structured data uses real data only. There are no invented ratings, reviews, student counts or prices.

| Page | Schema |
|---|---|
| Home | `EducationalOrganization` (name, legal name, logo, phone/email/social links from Admin → Settings), `WebSite`, `Person` (lead instructor) |
| Course | `Course`: name, description, provider, INR `Offer` with the real price, `CourseInstance` (online, workload from course duration), plus `BreadcrumbList` |
| Blog post | `BlogPosting`, plus `BreadcrumbList` |
| Bundle, other public pages | `BreadcrumbList` |
| Instructor | `Person`, plus `BreadcrumbList` |

---

## 2. Keyword map

There is one main topic per page, so pages don't compete with each other. Use these phrases naturally in page copy. Don't repeat them unnaturally.

| Page | Primary keyword | Supporting keywords | Title |
|---|---|---|---|
| `/` | online courses with certificates | Edufy Academy, affordable online courses, learn new skills online, online learning platform | Edufy Academy – Affordable Online Courses with Certificates |
| `/courses` | online courses | professional online courses, career development courses, certification courses online | Online Courses – Browse All Courses \| Edufy Academy |
| `/categories` | skill development courses | online course categories, technology courses | Course Categories – Skill Development Courses \| Edufy |
| `/bundles` | course bundles | affordable online courses | Course Bundles – Learn More for Less \| Edufy Academy |
| `/instructors` | online course instructors | Edufy Academy instructors | Our Instructors – Meet Your Teachers \| Edufy Academy |
| `/blog` | online learning blog | skill development, career development | Edufy Academy Blog – Articles on Learning and Skills |
| `/about` | online learning platform | Edufy Academy, Educurist Learning Solutions | About Edufy Academy – Online Learning Platform |
| `/contact` | contact Edufy Academy | online course support | Contact Edufy Academy – Course and Support Enquiries |
| `/faq` | online courses FAQ | Edufy Academy help | Frequently Asked Questions – Online Courses \| Edufy |
| `/verify-certificate` | verify certificate | Edufy Academy certificate | Verify an Edufy Academy Certificate of Completion |
| `/become-instructor` | teach online | become an online instructor | Teach Online – Become an Instructor at Edufy Academy |
| `/courses/<id>` | the course's own topic (from its title) | online course, certificate of completion, self-paced | Course title (+ "\| Edufy Academy" when it fits) |
| `/blog/<slug>` | the post's topic | – | SEO title from the blog editor, otherwise the post title |

### Current courses (from published data)

| Course page | Primary keyword | Supporting keywords |
|---|---|---|
| Mastering the Art of Writing: Effective Techniques for Beginners | writing course for beginners | creative writing techniques, improve writing skills |
| Mastering the Power Interview Framework | job interview preparation course | interview skills, answering interview questions |

### Writing tips for new courses and posts

- Put the main topic in the course title, then explain it in the subtitle in a sentence. The subtitle becomes the search snippet.
- Fill in "What you'll learn" and the prerequisites. They are shown to Google as readable text.
- Upload a thumbnail; it becomes the share image.
- For blog posts, fill in **SEO title** and **SEO description** in the blog editor.

---

## 3. Before every deploy (checklist)

1. **Admin → Settings → SEO → Robots** must be `index, follow`. If it says `noindex`, every page is built with noindex and Google drops the whole site. The build log prints a WARNING when this happens.
2. Unpublish test content that should not appear in Google. Current examples:
   - courses "sfsdfs" and "demo course for meeting";
   - blog posts "demo" and "hii";
   - category "x".

   Bundles with no published courses are excluded automatically.
3. Run `production\checks\website-check.cmd` (TypeScript and build), then push to GitHub.
4. After the deploy, open:
   - `https://edufyacademy.com/sitemap.xml`, which lists the pages;
   - `https://edufyacademy.com/robots.txt`, which shows the new rules and the Sitemap line;
   - `https://edufyacademy.com/some-wrong-address`, which shows the "Page not found" page. In DevTools → Network, its status must be 404.

---

## 4. Google Search Console – manual steps

### 4.1 Add and verify the site (once)
1. Go to https://search.google.com/search-console and sign in with the Google account that should own the site.
2. **Add property → Domain** → enter `edufyacademy.com`. This covers https/http and www.
3. Google shows a TXT record (`google-site-verification=…`). In **hPanel → Domains → edufyacademy.com → DNS / Nameservers → DNS records**, add:
   - **Type:** TXT
   - **Name:** `@`
   - **Value:** the full string from Google
   - **TTL:** default
4. Back in Search Console, click **Verify**. DNS can take a few minutes to a few hours.

   *Alternative:* a **URL-prefix** property (`https://edufyacademy.com/`) with the **HTML tag** method. Paste only the code part of the tag into **Admin → Settings → SEO → Google Search Console verification code**, then redeploy so the tag is built into the home page.

### 4.2 Submit the sitemap
1. Search Console → **Sitemaps**.
2. Enter `sitemap.xml` and click **Submit**.
3. The status should become **Success**, with the number of discovered pages. If it says "Couldn't fetch", check that `https://edufyacademy.com/sitemap.xml` opens in a browser.

### 4.3 Check and request indexing for key pages
1. Use **URL Inspection** at the top of Search Console and paste `https://edufyacademy.com/`.
2. Click **Test live URL**, then **View tested page**. Check:
   - the screenshot shows the real page;
   - under **More info**, nothing important is blocked.
3. Click **Request indexing**. Repeat for `/courses` and each course page. There is a daily limit, so do the most important pages first.

### 4.4 Monitor (weekly at first)
- **Pages (Indexing):**
  - "Indexed" should grow over days or weeks.
  - "Excluded by noindex" should list only the private pages and test items.
  - "Not found (404)" should only list addresses that really don't exist.
- **Enhancements:** check for structured-data errors (for example breadcrumbs). Use https://search.google.com/test/rich-results on a course URL to check its Course data.
- **Performance:** queries, clicks and positions. Data appears a few days after the first pages are indexed.
- **Core Web Vitals:** needs enough real traffic before it shows data.

### 4.5 Bing (optional)
At https://www.bing.com/webmasters, use **Import from Google Search Console**. This copies the verified site and sitemap.

---

## 5. Known limits
- The sitemap and prerendered pages refresh only when the site is rebuilt.
- Course URLs use the course ID (`/courses/course-c3f139cd`), not a readable slug. Changing that would need a database field and route changes, so it was left as is.
- Blog post body HTML comes from the blog editor. Use H2/H3 headings in posts, not H1; the page already has the post title as H1.
- Ratings and reviews are not added to structured data until real reviews are collected.
