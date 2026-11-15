# Edufy Academy: Environment Variables

Three separate places, three templates. **Real values are never stored in the handover package.**

| Template | Used by | Where real values go |
|---|---|---|
| `website/.env.example` | Website build (Vite) | Your PC: `.env.local` / `.env.production.local` in the project root (read when you run the build) |
| `backend/.env.example` | Express API server | Hostinger Node.js app → Environment variables (or `.env` on a VPS, `chmod 600`) |
| `mobile-app/.env.example` | Student app | Local dev: `app/.env` · Store builds: expo.dev → Project settings → Environment variables |

## Public vs secret

| Kind | Rule |
|---|---|
| **Public**: `VITE_*`, `EXPO_PUBLIC_*`, `RAZORPAY_KEY_ID`, Supabase publishable key | Built into the website/app; anyone can read them. They are designed for that. |
| **Secret**: service-role key, Razorpay key secret, webhook secret, Adilo secret, Expo access token | **Backend server only.** Never with a `VITE_` or `EXPO_PUBLIC_` prefix, never in `config.js`, never in the app, never in the ZIP. |

---

## 1. Website: public, build-time

| Variable | Required | Example | Notes |
|---|---|---|---|
| `VITE_SUPABASE_URL` | Yes | `https://abcd1234.supabase.co` | Supabase → Project Settings → API |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Yes | `sb_publishable_…` | Public key (legacy name `VITE_SUPABASE_ANON_KEY` also works) |
| `VITE_API_BASE_URL` | No | `https://api.your-domain.com/api` | Empty = same address (`/api`). Can be set after upload in `config.js` |
| `VITE_SITE_URL` | No | `https://your-domain.com` | Email-link address. Empty = current address. Also settable in `config.js` |

**After upload, no rebuild needed.** `config.js` in the website root:
```js
window.EDUFY_CONFIG = { apiBaseUrl: "https://api.your-domain.com/api", siteUrl: "https://your-domain.com" };
```
`config.js` wins over the build-time values. Leave both `""` for Option A (website and API on one address).

## 2. Backend: server only

| Variable | Required | Secret | Example / notes |
|---|---|---|---|
| `SETTINGS_ENCRYPTION_KEY` | **Yes** (to save credentials in the admin panel) | **YES** | 32 random bytes, base64 (`openssl rand -base64 32`). Encrypts Razorpay/email/Emovur keys saved in Admin → Settings. **Never change it after first use.** |
| `NODE_ENV` | **Yes** | no | `production`. Disables test payments; serves `dist/` if present |
| `PORT` | VPS only | no | `3000`. Hostinger sets it automatically |
| `CORS_ORIGINS` | Option B | no | `https://your-domain.com,https://www.your-domain.com` |
| `SUPABASE_URL` | Yes | no | same as `VITE_SUPABASE_URL` |
| `SUPABASE_ANON_KEY` | Yes | no | the publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | **YES** | Supabase → API Keys → secret/service_role. Needed for payments, enrollment, admin, push |
| `RAZORPAY_KEY_ID` | Yes* | no | `rzp_live_…` (production). *Or manage keys in Admin → Settings → Payment gateway (those take priority after a successful test) |
| `RAZORPAY_KEY_SECRET` | Yes | **YES** | verifies payment signatures |
| `RAZORPAY_WEBHOOK_SECRET` | Recommended | **YES** | same text as in the Razorpay webhook |
| `ADILO_API_BASE_URL` | No | no | `https://adilo-api.bigcommand.com/v1` |
| `ADILO_PUBLIC_KEY` / `ADILO_SECRET_KEY` | For video upload/import | **YES** (secret) | Adilo account → API |
| `ADILO_PROJECT_ID` | No | no | existing Adilo project, otherwise created automatically |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURITY` / `SMTP_USERNAME` / `SMTP_PASSWORD` | No | password: **YES** | Fallback SMTP account. Normally entered in Admin → Settings → SMTP & Email Configuration (encrypted, takes priority). `SMTP_SECURITY` = `ssl` (465) or `starttls` (587) |
| `EMAIL_PROVIDER` / `EMAIL_API_KEY` | No | key: **YES** | Alternative to SMTP: `resend` or `brevo` + API key |
| `EMAIL_WORKER_ENABLED` | No | no | `true` (default). Sends queued emails with retries. Keep on at least one server |
| `SUPABASE_MANAGEMENT_TOKEN` | No (recommended) | **YES** | Supabase personal access token. Lets super admins apply Site URL, redirect URLs, Google provider and the Send Email hook from Admin → Settings. Without it the panel shows manual steps |
| `SUPABASE_AUTH_HOOK_SECRET` | No | **YES** | `v1,whsec_…` only if the Supabase Send Email hook was set up by hand. Not needed when the hook is enabled from the admin panel |
| `EXPO_ACCESS_TOKEN` | No | **YES** | only if "Enhanced push security" is on at expo.dev |
| `PUSH_WORKER_ENABLED` | No | no | `true` (default). Keep on exactly one server |

Not used by the current code (safe to omit): `GEMINI_API_KEY`, `APP_URL`, `DEMO_PASSWORD` (demo seeding script only).

## 3. Mobile app: public, built into the app

| Variable | Required | Production example | Notes |
|---|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Yes | `https://abcd1234.supabase.co` | |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | `sb_publishable_…` | never the service-role key (the app refuses it) |
| `EXPO_PUBLIC_API_URL` | Yes | `https://api.your-domain.com` | **no `/api` at the end**. Must be https for preview/production builds |
| `EXPO_PUBLIC_WEB_URL` | Yes | `https://your-domain.com` | email verification page + video player origin |
| `EAS_PROJECT_ID` | Yes (push) | `xxxxxxxx-xxxx-…` | from `eas init`; not secret |
| `GOOGLE_SERVICES_JSON` | Yes (Android push) | *(file)* | EAS **file** variable, visibility Secret |
| `EXPO_PUBLIC_APP_ENV` | automatic | `production` / `preview` | set by `eas.json` |

Local development values (`http://10.0.2.2:3000` for the emulator, `http://<PC-IP>:3000` for a phone) belong only in `app/.env`.
Preview/production builds are blocked if `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_WEB_URL` or `EXPO_PUBLIC_SUPABASE_URL` is not a public https address.

## 4. Other services

| Service | Setting | Where |
|---|---|---|
| Supabase Auth | Site URL, Redirect URLs, email template, SMTP | Supabase dashboard (DEPLOYMENT_GUIDE part D) |
| Razorpay | Live keys, webhook `https://<api>/api/payments/webhook` (`payment.captured`, `order.paid`) | Razorpay dashboard |
| Google OAuth | **Not used**: there is no Google sign-in in the current code | (no setup needed) |
| Firebase / FCM | `google-services.json` + FCM V1 service-account key | EAS env var + `eas credentials` |
| Emovur | **Not found in this project.** Video hosting uses **Adilo** (variables above) | Tell us if Emovur should be integrated |
