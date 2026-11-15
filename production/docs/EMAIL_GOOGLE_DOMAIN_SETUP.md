# Email (SMTP), Google Sign-In and Domain setup

What runs where:

| Piece | Where it lives | Changed from the admin panel? |
|---|---|---|
| SMTP account, sender, templates | `secure_credentials` (encrypted) + `site_settings.email` | Yes: Settings → SMTP & Email Configuration / Email Templates |
| Automatic email queue and logs | `email_outbox` table + the server's email worker | Logs and retry: Settings → SMTP & Email Configuration |
| Login methods (Google / One Tap / email / magic link) | `site_settings.auth` | Yes: Settings → Authentication & Login Methods |
| Website / API addresses per environment | `site_settings.domain` | Yes: Settings → Domain & Environment |
| Supabase **Site URL, Redirect URLs, Google provider, Send Email hook** | Supabase project settings (not the database) | Only with `SUPABASE_MANAGEMENT_TOKEN` (“Apply to Supabase” buttons). Otherwise by hand in the Supabase dashboard |
| Google OAuth client | Google Cloud Console | No, always by hand |
| App API / website addresses | Built into the app (EAS variables) | No, needs a new build |

A database setting alone never changes Supabase Auth or Google. The admin panel shows each item as
**Configured**, **Needs Supabase update**, **Check Google Cloud Console** or **Needs deployment / rebuild**.

---

## 1. Database

Supabase → SQL Editor → paste `supabase/RUN_IN_SQL_EDITOR.sql` → Run (safe to run again). It adds part 4:
the `email_outbox` table, the queue functions and the triggers that queue the welcome, free-enrollment,
certificate and course-completion emails. Every trigger catches its own errors, so sign-ups and
enrollments can never fail because of email.

## 2. Server environment

Required already: `SETTINGS_ENCRYPTION_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
New, optional (see ENVIRONMENT_VARIABLES.md):

- `SUPABASE_MANAGEMENT_TOKEN`: recommended. Create at supabase.com/dashboard/account/tokens. Enables the
  “Apply to Supabase” buttons and live status checks.
- `SMTP_*`: only as a fallback if you prefer not to save the SMTP account in the admin panel.
- `EMAIL_WORKER_ENABLED=true` on at least one server copy.

Restart the server after changing environment variables.

## 3. SMTP (Settings → SMTP & Email Configuration, super admin)

1. **Sender**: sender name, sender email (must be allowed by your SMTP account), reply-to, support email,
   brand colour, footer. Save.
2. **SMTP server**: method “SMTP server”, host, port, encryption (`465` = SSL/TLS, `587` = STARTTLS), username,
   password → **Save securely**. The password is encrypted with `SETTINGS_ENCRYPTION_KEY`, shown only masked,
   never returned by any API and never written to logs.
3. Enter your own address next to **Test configuration** and run it. Each step is reported: connection,
   encryption, authentication, sender, recipient, and “message accepted for delivery” with the server’s
   reply. The test passes **only** when the mail server accepts the message.
4. **Activate** (asks for your password). From now on every email uses this account.
5. **Email log** (same page): every email with status, attempts, server reply/error, and **Retry**.
   Temporary failures (4xx, timeouts, rate limits) retry automatically after 1 min, 5 min, 15 min, 1 h, 3 h.

Which emails are sent, and when:

| Email | Trigger | Duplicate protection |
|---|---|---|
| Welcome | account confirmed (email verified, or first Google sign-in) | one per account (`welcome:<user>`) |
| Verify email / password reset / magic link / email change / admin invite / re-auth code | Supabase Auth, through the Send Email hook (step 5) | one per token |
| Course purchase / bundle purchase | payment verified on the server (checkout verify or Razorpay webhook) | one per order (`purchase:<order>`) |
| Enrollment | free course or admin-granted enrollment | one per student + course |
| Certificate | certificate issued | one per certificate |
| Course completion | course completed (same event as the push notification) | one per student + course |
| Refund | Razorpay `refund.processed` webhook | one per refund |
| Announcement | Settings → Email Templates → Send an announcement | one per student per announcement |

Add `refund.processed` to the Razorpay webhook events (Razorpay → Webhooks) to get refund emails.

## 4. Domain & Environment (Settings → Domain & Environment, super admin)

1. Enter the **Production** website URL (and API URL if the API runs on another address). Production and
   staging accept only `https://` public addresses; development accepts `http://` only for localhost/LAN.
   The development profile cannot be activated while the server runs with `NODE_ENV=production`.
2. Save. The website uses these addresses at runtime for email links and redirects (no rebuild).
3. **Apply Site URL & redirect URLs** (needs `SUPABASE_MANAGEMENT_TOKEN`), or by hand:
   Supabase → Authentication → URL Configuration
   - Site URL: your production website URL
   - Redirect URLs: `https://<your-site>/**` and `edufyacademy://**` (existing entries are kept)

## 5. Verification and reset emails through your SMTP (Supabase Send Email hook)

Without this step Supabase keeps sending its own sign-up and reset emails (with its own limits and look).

- Automatic: Domain & Environment → **Enable email hook**. Needs an active SMTP account and an `https://` API
  address. A secret is generated, stored encrypted, and set in Supabase.
- By hand: Supabase → Authentication → Hooks → **Send Email** → HTTPS → URL
  `https://<api-address>/api/auth/email-hook` → generate secret → paste the secret (v1,whsec_…) into
  Domain & Environment → “Supabase email hook secret” → Save → Activate.

The hook checks Supabase’s signature, builds the link on your configured domain (never localhost in
production, unknown redirect targets are replaced), and queues the email at top priority. If SMTP is not
configured the hook answers 503, so Supabase reports the error instead of silently dropping the email.

## 6. Google Cloud Console (by hand)

console.cloud.google.com → APIs & Services:

1. **OAuth consent screen**: app name, support email, logo, authorised domain = your website domain; scopes
   `openid`, `email`, `profile`. Publish (in Testing mode only listed test users can sign in).
2. **Credentials → Create OAuth client ID → Web application**
   - Authorised JavaScript origins: `https://<your-site>` (and `http://localhost:5173` for local testing only)
   - Authorised redirect URI: `https://tyqdyfecdvclwsvcahod.supabase.co/auth/v1/callback`
3. Optional, for a future native Android button: **Android** client with package `com.edufyacademy.student`
   and the SHA-1 of (a) the debug keystore and (b) the Play App Signing key (Play Console → Setup → App signing).

## 7. Supabase Google provider

- Automatic: Settings → Google OAuth Configuration → save Web Client ID + Client Secret (+ Android client IDs)
  → Activate → **Apply Google provider to Supabase**.
- By hand: Supabase → Authentication → Sign In / Providers → Google → enable; Client IDs = web client ID first,
  then Android IDs, comma separated; Client Secret; Save.

Then Settings → Authentication & Login Methods: keep Google on, paste the **Web Client ID** (enables Google’s
official button and One Tap on the website), choose the preferred method, Save.

## 8. Website behaviour

- Login: “Continue with Google” → “OR continue with email” → email form → Forgot password → Register.
- With the Web Client ID set, Google renders its own button (Google branding rules) and the sign-in happens in a
  popup (ID token + nonce → Supabase). Without it, the button uses the Supabase redirect flow.
- One Tap shows on public pages for signed-out visitors only, never on login/admin/learning pages, and never
  blocks the normal button.
- `/login?method=email` always shows the email form (administrator lock-out protection).

## 9. Mobile app

- Google sign-in opens the system browser (Supabase OAuth with PKCE) and returns to
  `edufyacademy://auth/callback`. Works in Expo Go and in builds; no native module needed.
  Supabase Redirect URLs must include `edufyacademy://**` (and `exp://**` while testing in Expo Go).
- The native Google account picker (Android Credential Manager, `@react-native-google-signin/google-signin`)
  is **not** included: it needs a new native dependency, a development build (it does not run in Expo Go),
  and the SHA-1 fingerprints above. It can be added later without changing the backend: the Android client IDs
  are already passed to Supabase.
- Login methods follow Settings → Authentication & Login Methods (refreshed within a few minutes).

## 10. Account linking

Supabase links a Google sign-in to an existing account with the same **confirmed** email, so enrollments,
progress and certificates (all keyed by the user id) stay on that account. Roles are never taken from Google
profile data (`handle_new_user` creates students only). If a student reports a second account, check
Supabase → Authentication → Users for an unconfirmed duplicate.

## 11. Troubleshooting

| Symptom | Check |
|---|---|
| Test email fails at “Authentication” | username/password; some providers need an app password |
| Fails at “Encryption” | port and encryption must match (465 ↔ SSL/TLS, 587 ↔ STARTTLS) |
| Fails at “Sender address” | the sender email must be allowed by the SMTP account / verified domain |
| Emails “skipped” in the log | sending switched off, template switched off, or no active SMTP |
| Emails “failed: Missing values: login_url” | set the website URL in Domain & Environment, then Retry |
| “Google sign-in is not switched on” | step 7 |
| Google “redirect_uri_mismatch” | the Supabase callback URL in step 6 |
| App returns to the login screen after Google | add `edufyacademy://**` to Supabase Redirect URLs |
