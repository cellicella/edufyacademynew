# Edufy Academy — launch setup (client feedback fixes)

These steps need your Supabase / hosting accounts. Code changes are already in the project.

## 1. Run the database changes (once)

Supabase → **SQL Editor** → New query → paste the whole of `supabase/RUN_IN_SQL_EDITOR.sql` → **Run**.

It adds:
- push-notification rules and functions
- managed categories (seeded from your existing courses, so nothing is lost)
- the blog table

It is safe to run again. Until it has run:
- the admin Categories, Blog and Push notifications pages show a "run the migration" message
- the website falls back to categories taken from your courses
- the blog shows "coming soon"

## 2. Email verification redirect (fixes the `localhost:3000` link)

**Cause.** The website called `signUp()` without `emailRedirectTo`, so Supabase used its **Site URL** setting. That setting is still `http://localhost:3000`, so the confirmation link pointed at the developer's PC.

**What the code does now.**
- The website sends `emailRedirectTo = <the site's own address>/auth/callback`. It uses `VITE_SITE_URL` if set, otherwise the address the student is actually on.
- The new `/auth/callback` page verifies the link, signs the student in, and sends them to their dashboard. If the link has expired, it shows "This link has expired" with a resend button.
- The registration page has a **Resend email** button.
- The mobile app sends its confirmations to `EXPO_PUBLIC_WEB_URL/auth/callback`, but only when that is an https address.

**What you must set in Supabase** (Authentication → **URL Configuration**):

| Setting | Value |
|---|---|
| Site URL | `https://<your test website>` (for example `https://edufy.example.hostingersite.com`). Replace it with the production domain at launch. |
| Redirect URLs | `https://<your test website>/**` |
| | `https://<your production website>/**` (when you have it) |
| | `http://localhost:3000/**` (local development only) |
| | `edufyacademy://reset-password` (app password reset) |

Supabase **ignores** any redirect that isn't in this list and falls back to the Site URL. That is why both settings matter.

**Optional build variable** (website): `VITE_SITE_URL=https://<your website>`. Set it in the build environment if the site is ever served from more than one address.

**Email template** (Authentication → Emails → Confirm signup):
- The template must use `{{ .ConfirmationURL }}`, not `{{ .SiteURL }}`, for the button link.
- A branded template using the official logo is in `supabase/email-templates/confirm-signup.html`.

**Test:** register with a new email on the deployed site, then open the email. The link should go to `https://<site>/auth/callback`, show "Email verified", and then open `/student`.

## 3. "Unexpected token '<' … is not valid JSON" on admin pages

**Cause.** The Course Bundles page also loads the course list from the Express server at `/api/courses/admin/all`. When only the built `dist` folder is uploaded to the host (no Node.js server), or `VITE_API_BASE_URL` points to the wrong place, the host answers `/api/...` with the website's `index.html`. Reading that as JSON produces exactly this error, on every device.

**What the code does now.**
- The admin and instructor course lists read Supabase directly, the same way bundles already did. The **Course Bundles page now works without the Express server**.
- Every API call goes through a safe JSON reader. If HTML comes back, the message says the server isn't reachable, instead of showing a parsing error.
- Admin pages show a yellow banner when `/api` isn't reachable. The banner lists which features need the server.
- On the server, an unknown `/api/...` route or an Express error now always returns JSON, never the HTML page.

**What still needs the Node.js server (server.ts):**
- saving and publishing courses, and media uploads
- lesson import
- payments (Razorpay order and verify)
- video access
- certificate claim
- push notifications

**Deploy it on Hostinger.** Use a plan that supports Node.js apps (hPanel → Websites → Node.js) and set:
- Entry file: `server.ts`
- Start command: `npm start` (runs `tsx server.ts`)
- `NODE_ENV=production`
- Server environment variables: everything in `.env` (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, …)
- Run `npm run build` first so `dist/` exists. The Express server serves the website and `/api` from one address.

If the API is hosted on a different address than the website, build the website with `VITE_API_BASE_URL=https://<api-address>/api`.

**Check:** open `https://<your site>/api/health`. It must show JSON with `"status":"ok"`, not the website.

## 4. New admin sections

- **Admin → Categories:** create, edit, hide/show, reorder, add images or icons, assign courses, and see course counts. A category that still has courses can't be deleted (the database enforces this too).
- **Admin → Blog:**
  - editor with formatting, images and links
  - save as draft, publish, unpublish or schedule
  - featured image, author, category, tags, SEO title and description
  - preview before publishing

  Only published posts whose publish time has passed are visible on the website (`/blog`) and in the app.

## 5. Brand assets

- Official logo files: `public/brand/edufy-logo-{32,64,128,192,256,512}.png` (+ `.webp`).
- Favicon and Apple touch icon: `public/favicon.ico` and `public/apple-touch-icon.png`.
- App assets are in `app/assets/images/`: `logo.png`, `icon.png`, `adaptive-icon.png`, `splash-icon.png` and `notification-icon.png`.
- Rebuild the app (`eas build`) to see the new icon and splash on phones.
- Only one logo file was supplied. It reads well on both light and dark backgrounds, so the same file is used everywhere. Send a separate dark-background version if you want one.

## 6. Social links

All six official profiles are set in one file each:
- Website: `src/config/social.ts`
- App: `app/src/logic/social.ts`
