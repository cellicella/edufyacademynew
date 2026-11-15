# Settings & Configuration: Testing Report

Date: 2026-11-13.

Statuses: **IMPLEMENTED & VERIFIED** (automated tests ran and passed) · **CONFIGURATION REQUIRED** · **REBUILD REQUIRED** ·
**BLOCKED** · **NOT TESTED** (not run on a device, browser or live server yet).

## Automated tests that were run

| Suite | Where | Result |
|---|---|---|
| Database migration on a Postgres 16 replica, run twice (idempotent), plus the combined `RUN_IN_SQL_EDITOR.sql` | cloud workspace | **21/21 PASS**. Covers RLS, the public RPC, credential isolation, the banner audit trigger and constraints |
| Backend unit tests: validation, defaults, public filtering, encryption round trip and tamper detection, image sniffing, SVG safety, SEO HTML injection, robots.txt, diff and masking | `tests/settings.test.ts` | **15/15 PASS** |
| Settings API end-to-end, with all routes running against an in-memory database (Razorpay and Supabase Auth stubbed) | cloud workspace harness | **9/9 PASS** (scenarios below) |
| Website settings helpers | `tests/siteSettings.web.test.ts` | **2/2 PASS** |
| Mobile app logic: settings merge, version gate, maintenance window, support contacts, blog banner links | `app/tests/siteSettings.test.ts` | **6/6 PASS** (the full app suite is 79/79) |
| Existing tests (course utils, backend, push logic) | | **19/19 PASS**. No regressions |
| Server type check (Node types, stubbed libraries) | | no errors in new or changed code |
| Website type check (stubbed libraries) | | no errors in new or changed code |
| App type check (stubbed libraries) | | no errors in new or changed code |

The end-to-end scenarios checked:

- **Public endpoint:** has no private sections; a repeat request with the ETag returns 304.
- **Access:** anonymous gets 401; student gets 403; instructor without a grant gets 403; an admin with no restrictions gets full access.
- **Validation:** invalid values get 400 with per-field errors, recorded in the audit as a failure. A valid save shows in the public endpoint immediately, and the audit records the diff and the actor.
- **Permissions:**
  - A restricted admin sees only the sections granted.
  - A restricted admin cannot touch payment keys or permissions.
  - A super admin cannot demote themselves.
  - An instructor never receives payment access.
- **Razorpay credentials:**
  - Live keys without a password: 401. Wrong password: 401. Key/mode mismatch: 400.
  - Saved keys are stored encrypted (no plain secret in the database) and masked in responses.
  - Activation before a test is refused.
  - The test runs all 6 steps.
  - Activation needs the password again.
  - After activation the gateway switches to the new keys with no restart; the previous secret is still accepted for verification.
  - No secret appears in any API response or the audit log.
- **Bad Razorpay keys:** the test fails and activation is refused. Reverting to environment keys needs the password.
- **Media:**
  - Too small or not really an image: rejected.
  - Upload produces a server-generated path.
  - An image in use cannot be deleted (409).
  - Replace gives a new URL and repoints the settings that used it; the old file is removed.
  - Once unused, delete succeeds.
- **Email:** preview renders sample data. The provider key is saved, tested and activated. The welcome email is sent exactly once to the right address, and the key is not in the audit log.
- **Audit log:** visible to super admins, refused (403) for restricted admins.

## Feature status

| # | Feature | Status | Notes |
|---|---|---|---|
| 1 | Settings & Configuration dashboard (14 sections + Media + Audit + Permissions) | IMPLEMENTED & VERIFIED (API) / NOT TESTED (browser) | Type-checks; not yet viewed in a browser |
| 2 | General settings → website and app | IMPLEMENTED & VERIFIED (API) / NOT TESTED (UI) | |
| 3 | Branding: 8 logo slots, preview, validation, replace/remove, fallback | IMPLEMENTED & VERIFIED (upload/validation) / NOT TESTED (UI) | App icon / native splash: **REBUILD REQUIRED** |
| 4 | Website banners (slider, desktop + mobile image, CTA, course/bundle/blog/URL, schedule, order) | IMPLEMENTED / NOT TESTED | DB constraints and RLS verified |
| 5 | App banners (placement, CTA, blog links, schedule, cache) | IMPLEMENTED & VERIFIED (logic) / NOT TESTED (device) | |
| 6 | Media library (multi-upload, search, filter, replace everywhere, in-use protection, copy URL, optimisation) | IMPLEMENTED & VERIFIED (API) / NOT TESTED (browser optimisation) | Supabase Storage `site-assets` |
| 7 | Contact information → footer, contact page, WhatsApp, app | IMPLEMENTED / NOT TESTED (UI) | The contact page's previous placeholder US address/phone is replaced by your settings. Empty fields are hidden |
| 8 | Social media manager (9 platforms + custom, order, on/off) | IMPLEMENTED & VERIFIED (logic) / NOT TESTED (UI) | Official URLs seeded; YouTube/Telegram off until you add URLs |
| 9 | Razorpay credentials (encrypted, masked, re-auth, test, activate, audit) | IMPLEMENTED & VERIFIED (API, stubbed Razorpay) / **CONFIGURATION REQUIRED** | Needs `SETTINGS_ENCRYPTION_KEY`. A real test needs your Razorpay keys |
| 10 | Payment gateway test (keys, connection, order, verification, webhook, enrollment) | IMPLEMENTED & VERIFIED (stubbed) / NOT TESTED (live Razorpay) | Enrollment end to end needs one real purchase |
| 11 | WhatsApp settings (button, number, messages) | IMPLEMENTED / NOT TESTED (UI) | |
| 12 | Emovur credentials | IMPLEMENTED (secure storage) / **BLOCKED** (messaging) | No Emovur integration exists in the codebase; API documentation needed |
| 13 | Email (sender, 4 templates, preview, test, Resend/Brevo, sent once) | IMPLEMENTED & VERIFIED (API) / **CONFIGURATION REQUIRED** | Needs a Resend/Brevo account and a verified sender. Registration confirmation stays in Supabase (external) |
| 14 | SEO (title, description, keywords, OG image, robots, GA, GSC, favicon) | IMPLEMENTED & VERIFIED (HTML injection) / NOT TESTED (browser) | Server-side tags only when Node serves the site |
| 15 | App configuration (support, sections, notice, min/latest version, store links) | IMPLEMENTED & VERIFIED (logic) / NOT TESTED (device) | Version number itself: **REBUILD REQUIRED** |
| 16 | Notification settings (global and per-category switches, reuses push system) | IMPLEMENTED / NOT TESTED (live push) | The worker pauses when off; disabled categories are cancelled with a reason |
| 17 | Maintenance mode (website page with admin bypass, app announcement with Continue, schedule, push announcement) | IMPLEMENTED & VERIFIED (logic) / NOT TESTED (UI/device) | |
| 18 | Central API: public + admin + credentials, validation, caching, ETag, invalidation, fallback RPC | IMPLEMENTED & VERIFIED | |
| 19 | Permissions + audit log | IMPLEMENTED & VERIFIED | |
| 20 | Persistence across restarts | IMPLEMENTED (all settings in Supabase; app/web cache) / NOT TESTED (live restart) | |
| 21 | Existing courses, bundles, enrollments, certificates, payments, blog, auth | Existing automated tests still pass / NOT TESTED (live) | Payment verification logic is unchanged apart from the key source |

## Still to do on real systems
1. Run `supabase/RUN_IN_SQL_EDITOR.sql` in Supabase.
2. Set `SETTINGS_ENCRYPTION_KEY` on the server; deploy the backend and website.
3. Run `production/build-production.ps1` on the PC. It now also smoke-tests `/api/settings/public` and `/robots.txt`.
4. In the browser:
   1. Change the logo, phone, WhatsApp number and social links.
   2. Add website and app banners.
   3. Upload course and blog images.
   4. Turn maintenance on and off.
   5. Check desktop and phone views.
5. Razorpay **test mode**:
   1. Save the keys, test, activate.
   2. Buy a course with a Razorpay test card and confirm the enrollment.
   3. Then switch to live keys.
6. Android app (`npx expo start` or a preview build): banners, social links, support rows, notice, maintenance announcement, and the minimum-version gate.
