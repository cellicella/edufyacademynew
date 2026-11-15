# SMTP, automated email, Google sign-in and Domain & Environment: delivery report

Status key: FIXED & VERIFIED · IMPLEMENTED & VERIFIED · CONFIGURATION REQUIRED · REBUILD REQUIRED · BLOCKED · NOT TESTED

"Verified" means automated tests were run in the development sandbox (local SMTP servers including real
TLS/STARTTLS, a fresh PostgreSQL 16 with all migrations, the settings API against an in-memory database
double, unit tests). Nothing has been sent through your real SMTP provider, Google or Supabase project yet:
those need your credentials and are marked CONFIGURATION REQUIRED.

## Results

| # | Item | Status | Evidence |
|---|---|---|---|
| 20 | SMTP configuration (host, port, SSL/TLS/STARTTLS, user, password, sender, reply-to, support) | IMPLEMENTED & VERIFIED | API e2e: validation, super-admin only, encrypted (no plaintext in DB/API/audit), masked hint, password needed to activate |
| 20 | Send Test Email: success only when the server accepts | IMPLEMENTED & VERIFIED | SMTP tests: wrong password → fails at Authentication; 550 → fails at Recipient; success shows the server's `250` reply |
| 20 | SMTP client (implicit TLS, STARTTLS, AUTH PLAIN/LOGIN, refuses password over plain text) | IMPLEMENTED & VERIFIED | 10/10 tests against local servers with a self-signed cert (rejected by default) |
| 20 | Queue, retries with backoff, duplicate prevention, logs, admin retry | IMPLEMENTED & VERIFIED | unit + API e2e + SQL (`FOR UPDATE SKIP LOCKED`, stale rows requeued, unique event keys) |
| 20 | Enrollment never blocked by email failure | IMPLEMENTED & VERIFIED | SQL test with the queue table removed: enrollment still inserted |
| 20 | Welcome (email + Google sign-ups, exactly once) | IMPLEMENTED & VERIFIED | SQL: one row however often confirmed; Google sign-up queued with provider=google |
| 20 | Purchase / bundle purchase (name, course(s), order, amount, date, transaction id, links) | IMPLEMENTED & VERIFIED | outbox e2e renders all values; one email per order (verify + webhook both fire) |
| 20 | Enrollment (free/admin), certificate, completion, refund, announcement | IMPLEMENTED & VERIFIED (refund: code path, not run against Razorpay) | SQL trigger tests; announcement e2e; refund needs `refund.processed` in Razorpay webhooks |
| 20 | Verification / reset / magic link via your SMTP on the correct domain | IMPLEMENTED & VERIFIED · CONFIGURATION REQUIRED | Hook signature + link tests (localhost replaced by production callback, open redirects blocked). Needs the Supabase Send Email hook enabled |
| 20 | Email templates: edit, preview, enable/disable, restore default, placeholders, validation, no code execution | IMPLEMENTED & VERIFIED | unknown placeholders rejected; scripts/handlers stripped; values escaped; prototype keys ignored |
| 21 | Login methods settings + lock-out protection | IMPLEMENTED & VERIFIED | server refuses "no method"; `/login?method=email` always works |
| 21 | Google provider in Supabase + Client Secret handling | IMPLEMENTED & VERIFIED · CONFIGURATION REQUIRED | secret encrypted, never returned/logged; Apply patches Supabase (tested against the real client over a fake API) |
| 21 | Website "Continue with Google", OR divider, One Tap, sign-out, callback | IMPLEMENTED (type-checked) · NOT TESTED in a browser | needs a real Google client and the site running |
| 21 | App Google sign-in (browser OAuth + PKCE, Expo SDK 58) | IMPLEMENTED & VERIFIED (logic) · REBUILD REQUIRED | 3 new app tests; needs a new app build/update and `edufyacademy://**` in Supabase |
| 21 | Native Android Google picker (Credential Manager, SHA-1) | BLOCKED | new native dependency + development build; cannot be installed from this environment. Documented |
| 22 | Domain & Environment profiles, validation, safe switching, sync status | IMPLEMENTED & VERIFIED | https-only prod/staging, dev refused on production server, safe paths, only the active profile is public |
| 23 | 20-item settings menu | IMPLEMENTED (type-checked) · NOT TESTED in a browser | old `/admin/settings/email` link redirects to SMTP |
| 24 | Automated tests | see below | |

## Test runs

| Suite | Result |
|---|---|
| Root/backend suite (`tests/*.test.ts`): settings, SMTP, email system, backend, push, web settings | 57 / 57 pass |
| Settings API end-to-end (cloud harness, in-memory DB, local SMTP): 12 scenarios incl. SMTP, logs/retry, announcement, domain/auth/Google/hook | 12 / 12 pass |
| SQL on PostgreSQL 16 (all migrations): email triggers/security (10 groups) + earlier settings suite | 10 / 10, 21 / 21 pass; bundle `RUN_IN_SQL_EDITOR.sql` runs twice without error |
| App unit tests | 82 / 82 pass |
| Type checks (server, website, app; changed files) | no new errors (remaining ones are pre-existing stub artefacts) |
| Website/app in a real browser/device, real SMTP, real Google, real Supabase | NOT TESTED |

## Manual configuration still required

Supabase (or use the "Apply to Supabase" buttons after setting `SUPABASE_MANAGEMENT_TOKEN`):
1. Run `supabase/RUN_IN_SQL_EDITOR.sql`.
2. Authentication → URL Configuration: Site URL = production site; Redirect URLs `https://<site>/**`, `edufyacademy://**`.
3. Authentication → Sign In / Providers → Google: Client ID(s), Client Secret.
4. Authentication → Hooks → Send Email → `https://<api>/api/auth/email-hook` (or "Enable email hook").

Google Cloud Console: OAuth consent screen (published); Web client with JavaScript origin `https://<site>` and
redirect URI `https://tyqdyfecdvclwsvcahod.supabase.co/auth/v1/callback`; optional Android client
(`com.edufyacademy.student` + SHA-1).

Razorpay: add `refund.processed` to the webhook events.

Production environment variables (new, optional): `SUPABASE_MANAGEMENT_TOKEN`, `SMTP_HOST`, `SMTP_PORT`,
`SMTP_SECURITY`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `EMAIL_WORKER_ENABLED`, `SUPABASE_AUTH_HOOK_SECRET`.

Deployment: rebuild/redeploy the website and server (`production/build-production.ps1`), and publish a new app
build for the app's Google button.

## Files

New: `server/smtp.ts`, `server/emailTemplates.ts`, `server/domain.ts`, `server/supabaseManagement.ts`,
`server/authHook.ts`, `supabase/migrations/20261114000001_edufy_email_auth.sql`, `tests/smtp.test.ts`,
`tests/emailSystem.test.ts`, `src/lib/googleIdentity.ts`, `src/components/auth/GoogleSignIn.tsx`,
`src/pages/admin/settings/panelsEmailAuth.tsx`, `app/src/logic/oauth.ts`, `app/src/services/googleAuth.ts`,
`app/src/components/GoogleButton.tsx`, `app/src/app/auth/callback.tsx`, `app/tests/oauth.test.ts`,
`production/docs/EMAIL_GOOGLE_DOMAIN_SETUP.md`, this report.

Changed: `server.ts`, `server/email.ts` (rewritten), `server/settings.ts`, `server/settingsSchema.ts`,
`server/credentials.ts`, `tests/settings.test.ts`, `supabase/RUN_IN_SQL_EDITOR.sql`, `src/App.tsx`,
`src/config/siteSettings.ts`, `src/lib/siteUrl.ts`, `src/context/SettingsContext.tsx`, `src/context/AuthContext.tsx`,
`src/pages/auth/LoginPage.tsx`, `src/pages/auth/RegisterPage.tsx`, `src/pages/auth/AuthCallbackPage.tsx`,
`src/services/settingsAdmin.ts`, `src/pages/admin/settings/AdminSettingsPage.tsx`, `src/pages/admin/settings/panelsSecure.tsx`,
`app/src/logic/siteSettings.ts`, `app/src/context/AuthContext.tsx`, `app/src/app/(auth)/login.tsx`,
`app/src/app/(auth)/register.tsx`, `production/templates/backend.env.example`, `production/templates/mobile.env.example`,
`production/docs/ENVIRONMENT_VARIABLES.md`.

## Known limits

- The SMTP client was written in-house (no new npm dependency could be installed or locked from this
  environment); it is covered by tests against real TLS servers but not yet against your provider.
- With the hook disabled, Supabase sends its own verification/reset emails (its templates and rate limits).
- Nothing here claims the system is bug-free; browser, device and live-provider checks remain to be done.
