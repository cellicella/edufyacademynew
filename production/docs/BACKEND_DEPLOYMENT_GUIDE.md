# Backend (Express API) on Hostinger Business: api.edufyacademy.com

The API handles payments and enrollment, secure video access, admin tools, emails, certificates and push
notifications. It must run as a Node.js app; it cannot be uploaded as static files.

Package: `Edufy-Academy-Production\upload-ready\hostinger-api-nodejs.zip` (from `production\build-production.ps1`):

| File | Purpose |
|---|---|
| `server-dist/server.mjs` | the compiled server (entry file) |
| `package.json` (+ `package-lock.json`) | only 5 runtime packages: express, cors, dotenv, @supabase/supabase-js, razorpay |
| `.env.example` | list of settings with placeholders (reference only; do **not** import it as-is) |
| `README.md` | short reference |

The build script already started this package on your PC with only those packages and checked `/api/health`.

## 1. Create the Node.js app on the sub-domain
1. hPanel → **Websites** → **Add website** (Create site) → choose **Web App / Node.js app**.
2. Domain: choose **sub-domain** and enter `api` on `edufyacademy.com` → `api.edufyacademy.com`.
   (Hostinger: create the sub-domain “as its own website, not as a subfolder”.)
3. Code source: **Upload files** → select `hostinger-api-nodejs.zip`.

## 2. Build and output settings
| Setting | Value |
|---|---|
| Framework preset | **Express** (if not offered: **Other**) |
| Node.js version | **22.x** (20.x also works; never 18.x) |
| Root directory | `/` (the zip has `package.json` at its top level) |
| Package manager | npm |
| Build command | none / empty (the server is already built) |
| Output directory | empty |
| Entry file | `server-dist/server.mjs` |

Hostinger installs the packages (`npm install`) automatically during deployment.

## 3. Environment variables
At “Review build settings” (or later: website dashboard → **Environment variables** → Apply changes → **Restart**),
add these. Values come from your own accounts. Never put them in a file you upload.

| Name | Value |
|---|---|
| `NODE_ENV` | `production` |
| `CORS_ORIGINS` | `https://edufyacademy.com,https://www.edufyacademy.com` |
| `SUPABASE_URL` | `https://tyqdyfecdvclwsvcahod.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase → Project Settings → API Keys → **publishable** key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → API Keys → **secret / service_role** key (secret) |
| `SETTINGS_ENCRYPTION_KEY` | the same 32-byte key you use now (never change it once credentials are saved) |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Razorpay live keys (or save them in Admin → Payment Gateway) |
| `RAZORPAY_WEBHOOK_SECRET` | the text you set on the Razorpay webhook |
| `ADILO_PUBLIC_KEY` / `ADILO_SECRET_KEY` | Adilo → API |
| `CRON_SECRET` | 32+ letters and digits only (no `%`). Create one in PowerShell: `[guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')` (64 characters) |
| optional | `ADILO_PROJECT_ID`, `ADILO_API_BASE_URL`, `EXPO_ACCESS_TOKEN`, `SUPABASE_MANAGEMENT_TOKEN`, `SMTP_*`, `EMAIL_*` (see PRODUCTION_ENVIRONMENT_VARIABLES.md) |

Do not set `PORT`: the server uses the port Hostinger provides (and 3000 otherwise).

## 4. Deploy, start and restart
- Click **Deploy**. When it says deployed, open https://api.edufyacademy.com/api/health → JSON with `"status": "ok"`.
- After changing environment variables: **Apply changes**, then the dashboard **Restart** button (no rebuild needed).
- New version: run the build on your PC, then the app dashboard → **Deployments** → upload the new zip → Deploy.
  Every deploy replaces the files; settings live in Environment variables, so nothing is lost.
- If the deploy fails, open the deployment’s build log; a typical cause is a Node version below 20.

## 5. HTTPS and CORS
- Hostinger installs the SSL certificate for `api.edufyacademy.com` automatically after the domain connects. If it is
  missing: that website → **Security → SSL** → install (or uninstall and reinstall).
- The server already trusts Hostinger’s proxy (`trust proxy`), so HTTPS detection works and no redirect loop occurs.
- CORS: only the addresses in `CORS_ORIGINS` may call the API from a browser. The Android app is not affected by CORS.

## 6. Cron job (required: replaces always-running workers)
Hostinger stops “endless timers” on restarts, so queued emails and push notifications are also processed by a
scheduled call:
1. Website dashboard of `api.edufyacademy.com` → **Advanced → Cron Jobs**.
2. Command (one line, under 255 characters, no `%`):
   ```
   curl -s "https://api.edufyacademy.com/api/internal/cron?key=YOUR_CRON_SECRET"
   ```
3. Schedule: **every 5 minutes** (`*/5 * * * *`).
4. Test in a browser: the same URL returns `{"ok":true,"ms":…,"email":"ok","push":"ok"}`; a wrong key returns 401.

## 7. Webhooks
- **Razorpay** → Account & Settings → Webhooks → Add: URL `https://api.edufyacademy.com/api/payments/webhook`,
  secret = `RAZORPAY_WEBHOOK_SECRET`, events `payment.captured`, `order.paid`, `refund.processed`. Admin → Payment
  Gateway shows when the last verified webhook arrived.
- **Supabase Send Email hook** (optional, sends verification/reset emails through your SMTP):
  `https://api.edufyacademy.com/api/auth/email-hook` (Admin → Domain & Environment → “Enable email hook”).

## 8. Endpoint tests
| URL | Expected |
|---|---|
| `https://api.edufyacademy.com/api/health` | `status: ok`, Supabase configured |
| `https://api.edufyacademy.com/api/health?check=razorpay` | `razorpayLive.ok: true` |
| `https://api.edufyacademy.com/api/health?check=adilo` | `adiloLive.ok: true` |
| `https://api.edufyacademy.com/api/settings/public` | public settings JSON (no secrets) |
| `https://api.edufyacademy.com/api/does-not-exist` | JSON 404 |

## 9. When to move to a VPS
Not needed for launch. Consider a VPS (e.g. Hostinger KVM) if: 503 errors appear at busy times (shared process
limit), emails must go out within seconds even right after restarts, or uploads exceed the 120-second request limit.
On a VPS: install Node 22, upload the same zip, `npm ci --omit=dev`, run with PM2 (`pm2 start server-dist/server.mjs`),
put Nginx with Let’s Encrypt in front, point `api.edufyacademy.com` (A record) to the VPS IP. Same environment
variables; remove the cron job only if PM2 keeps the process running.
