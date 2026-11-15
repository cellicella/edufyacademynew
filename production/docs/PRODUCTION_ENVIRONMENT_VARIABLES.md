# Production settings for edufyacademy.com

Rule: anything starting with `VITE_` or `EXPO_PUBLIC_`, and everything in `config.js`, is **public**. Secrets go only
into the Hostinger Node.js app’s Environment variables.

## 1. Website (public)
The website build reads the API address at runtime from `config.js` (created by the build script):
```js
window.EDUFY_CONFIG = { apiBaseUrl: "https://api.edufyacademy.com/api", siteUrl: "https://edufyacademy.com" };
```
Build-time values (in `.env.local` on the PC that runs the build):

| Name | Production value |
|---|---|
| `VITE_SUPABASE_URL` | `https://tyqdyfecdvclwsvcahod.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key (`sb_publishable_…`) |
| `VITE_API_BASE_URL` | optional (config.js wins): `https://api.edufyacademy.com/api` |
| `VITE_SITE_URL` | optional: `https://edufyacademy.com` |

Admin → Settings → Domain & Environment → Production also sets the site address used in emails and redirects
(no rebuild).

## 2. API (Hostinger Node.js app → Environment variables)

| Name | Required | Secret | Value / where to get it |
|---|---|---|---|
| `NODE_ENV` | yes | no | `production` |
| `CORS_ORIGINS` | yes | no | `https://edufyacademy.com,https://www.edufyacademy.com` |
| `SUPABASE_URL` | yes | no | `https://tyqdyfecdvclwsvcahod.supabase.co` |
| `SUPABASE_ANON_KEY` | yes | no | publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | **yes** | Supabase → Project Settings → API Keys → secret key |
| `SETTINGS_ENCRYPTION_KEY` | yes | **yes** | keep your existing value; changing it makes saved credentials unreadable |
| `RAZORPAY_KEY_ID` | yes* | no | `rzp_live_…` (*or saved in Admin → Payment Gateway) |
| `RAZORPAY_KEY_SECRET` | yes* | **yes** | Razorpay → API Keys |
| `RAZORPAY_WEBHOOK_SECRET` | recommended | **yes** | same as on the Razorpay webhook |
| `ADILO_PUBLIC_KEY` / `ADILO_SECRET_KEY` | yes (videos) | secret: **yes** | Adilo → API |
| `ADILO_PROJECT_ID`, `ADILO_API_BASE_URL` | no | no | optional |
| `CRON_SECRET` | yes on Hostinger | **yes** | 32+ letters/digits, no `%`; used by the cron job |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURITY`, `SMTP_USERNAME`, `SMTP_PASSWORD` | no | password: **yes** | only if not saved in Admin → SMTP |
| `EMAIL_PROVIDER`, `EMAIL_API_KEY` | no | key: **yes** | Resend/Brevo alternative |
| `EMAIL_WORKER_ENABLED`, `PUSH_WORKER_ENABLED` | no | no | `true` (default) |
| `SUPABASE_MANAGEMENT_TOKEN` | no (recommended) | **yes** | supabase.com/dashboard/account/tokens: enables “Apply to Supabase” buttons |
| `SUPABASE_AUTH_HOOK_SECRET` | no | **yes** | only for a hand-made Send Email hook |
| `EXPO_ACCESS_TOKEN` | no | **yes** | only if Expo “enhanced push security” is on |
| `PORT` | no | no | do not set on Hostinger |

## 3. Android app (EAS → project → Environment variables, environment **production** and **preview**)

| Name | Value | Visibility |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | `https://api.edufyacademy.com` (**no `/api`**) | Plain text |
| `EXPO_PUBLIC_WEB_URL` | `https://edufyacademy.com` | Plain text |
| `EXPO_PUBLIC_SUPABASE_URL` | `https://tyqdyfecdvclwsvcahod.supabase.co` | Plain text |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | publishable key | Plain text |
| `EAS_PROJECT_ID` | from `npx eas-cli init` | Plain text |
| `GOOGLE_SERVICES_JSON` | Firebase `google-services.json` (file variable) | Secret |

The preview/production build stops automatically if any of the first three is not a public https address.

## 4. Supabase Dashboard (manual; or “Apply to Supabase” in Admin with `SUPABASE_MANAGEMENT_TOKEN`)
Project `tyqdyfecdvclwsvcahod`:

| Where | Setting | Value |
|---|---|---|
| Authentication → URL Configuration | Site URL | `https://edufyacademy.com` |
| Authentication → URL Configuration | Redirect URLs (add each) | `https://edufyacademy.com/**`, `https://www.edufyacademy.com/**`, `edufyacademy://**` |
| Authentication → Sign In / Providers → Google | Enabled, Client ID(s), Client Secret | from Google Cloud Console |
| Authentication → Hooks → Send Email (optional) | HTTPS URL | `https://api.edufyacademy.com/api/auth/email-hook` |

Routes these values serve (checked in the code): email confirmation and magic links → `/auth/callback`; password
reset → `/reset-password`; app password reset → `edufyacademy://reset-password`; app Google sign-in →
`edufyacademy://auth/callback`. Remove any `localhost` entries from Site URL; keep them in Redirect URLs only if you
still test locally.

**Email templates** (Authentication → Emails → Templates): the buttons in “Confirm signup”, “Reset password”,
“Magic link” and “Invite user” must use `{{ .ConfirmationURL }}`. A template that links to `{{ .SiteURL }}` ignores
the page the website asked for and always sends people to the Site URL.

**Why confirmation emails opened `localhost:3000`:** Supabase uses the address the website asks for
(`https://edufyacademy.com/auth/callback`, `https://edufyacademy.com/reset-password`) only when it matches a
Redirect URL; otherwise it falls back to the Site URL. With Site URL `http://localhost:3000` and no production
Redirect URLs, every link fell back to localhost. Links sent before the change keep the old address: request a new
one after fixing the settings. The website now also forwards a link that lands on the home page to the right page.

## 5. Google Cloud Console (OAuth client, Web application)
- Authorised JavaScript origins: `https://edufyacademy.com`, `https://www.edufyacademy.com`
- Authorised redirect URI: `https://tyqdyfecdvclwsvcahod.supabase.co/auth/v1/callback`
- OAuth consent screen: published; privacy policy `https://edufyacademy.com/privacy`, terms `https://edufyacademy.com/terms`.

## 6. Razorpay
Webhook URL `https://api.edufyacademy.com/api/payments/webhook`; events `payment.captured`, `order.paid`,
`refund.processed`. Live keys only after Razorpay activates the account.
