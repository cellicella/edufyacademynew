> **For edufyacademy.com on Hostinger Business, follow `DEPLOYMENT_GUIDE_EDUFYACADEMY.md` instead.** This older guide describes the general options.

# Edufy Academy: Deployment Guide

Follow the parts in order: **0 → D → B → A → C → E**, then tick off `PRODUCTION_CHECKLIST.md`.
You don't need to be a developer. Each step says where to click and what to type.

> **Keep the live site safe.** Nothing in this guide is automatic. Before replacing anything on a domain
> that is already live, take a backup in Hostinger (hPanel → Websites → your site → **Backups**), and if you
> can, try everything first on a test sub-domain such as `test.your-domain.com`.

---

## What you need before starting

| Item | Why |
|---|---|
| Your domain (e.g. `edufyacademy.com`) | Website and API addresses |
| Hostinger **Business** or **Cloud** web hosting (or a **VPS**) | The backend is a Node.js app and does **not** run on basic/static hosting |
| Supabase project (already in use) | Database, login, storage |
| Razorpay account with **live** API keys | Payments |
| Adilo account keys | Lesson videos |
| Expo account (free): expo.dev | Builds the Android app |
| Google Play Console developer account (one-time US$25) | Publish the app |
| Firebase project (free) | Android push notifications |

**Words used below**
- **Website address**: `https://your-domain.com`
- **API address**: where the Node.js server runs. Option A: same as the website. Option B: `https://api.your-domain.com`.

---

## 0. Create the production files on your PC (one command)

1. Open the project folder in VS Code → **Terminal → New Terminal** (PowerShell).
2. Make sure you are in the project root (the folder with `package.json`, `server.ts` and `app`).
3. Run:
   ```
   powershell -ExecutionPolicy Bypass -File production\build-production.ps1
   ```
4. Wait (3–10 minutes). At the end you see a **SUMMARY** table. Every line should be `PASS`
   (`BLOCKED`/`WARN` lines are the account steps further down in this guide).
5. Results:
   - `Edufy-Academy-Production\` is the handover folder
   - `Edufy-Academy-Production.zip` is the same folder as one ZIP
   - `Edufy-Academy-Production\upload-ready\` holds the ZIPs you upload to Hostinger
   - `Edufy-Academy-Production\documentation\BUILD_RESULTS.md` is the detailed results

The script never uploads anything and never copies `.env` files, keystores or `node_modules`.

---

## Choose how to host the website and API

| | **Option A (recommended, simplest)** | **Option B (separate)** |
|---|---|---|
| Website | Served by the Node.js app | Static files in `public_html` |
| API | Same Node.js app, `https://your-domain.com/api` | Node.js app on `https://api.your-domain.com` |
| Hostinger plan | Business or Cloud | Website: any plan · API: Business/Cloud (as its own website) or VPS |
| Upload | `upload-ready\backend-with-website.zip` | `upload-ready\website-dist.zip` + `upload-ready\backend-api.zip` |
| `config.js` change | none | set `apiBaseUrl` |
| CORS setting | not critical (same address) | `CORS_ORIGINS=https://your-domain.com,https://www.your-domain.com` |

Hostinger note: a Node.js web app must be added as its **own website**. An existing PHP/WordPress/static site
on the same domain can't be converted in place: Hostinger asks you to back up and remove it first. If the domain
is live today, use **Option B** (the existing site stays until you overwrite `public_html`), or test Option A on a sub-domain first.

---

## A. Website deployment on Hostinger

### Option A: one Node.js app (website + API)
Do part **B → "Hostinger Node.js web app"** and upload `upload-ready\backend-with-website.zip`. That's all; skip to "Test the website" below.

### Option B: static website in `public_html`
1. **Where the files are:** `Edufy-Academy-Production\website\dist\` (also zipped as `upload-ready\website-dist.zip`).
2. **Open File Manager:** hPanel → **Websites** → your domain → **Dashboard** → **File Manager**.
3. **Find the document root:** open `public_html` (for a sub-domain, Hostinger shows its folder, e.g. `public_html/test` or `domains/test.your-domain.com/public_html`).
4. **Back up what's there:** select everything in `public_html` → **Compress** → download the ZIP.
5. **Upload:** click **Upload** → choose `website-dist.zip` → right-click it → **Extract** → extract **into `public_html`**.
   Then delete the ZIP. You should now see `index.html`, `config.js`, `.htaccess`, `assets/`, `brand/` directly inside `public_html`
   (not inside a `dist` sub-folder).
   - `.htaccess` starts with a dot. If you can't see it, turn on **Show hidden files** in File Manager settings.
6. **Page refresh / SPA routing:** the included `.htaccess` sends every route to `index.html`, so refreshing
   `/courses/...` or `/admin/blog` never shows 404. If you already had an `.htaccess`, keep a copy and use the new one.
7. **Environment settings:** the public Supabase settings are already built in (from your PC's `.env.local` / `.env`).
   Secret keys are **never** put in the website.
8. **Connect the website to the API:** in File Manager open `public_html/config.js` → **Edit** → set:
   ```js
   window.EDUFY_CONFIG = {
     apiBaseUrl: "https://api.your-domain.com/api",
     siteUrl: "https://your-domain.com"
   };
   ```
   Save. (No rebuild needed. To change the API address later, edit this file again.)
9. **HTTPS:** hPanel → **Websites** → your site → **Security → SSL** → install the free SSL certificate (if not
   already active) and turn on **Force HTTPS**. Wait until the padlock shows in the browser.
10. **Test the website** (both options):
    - Open `https://your-domain.com`. The homepage should load with the logo.
    - Open `https://your-domain.com/courses` and press **F5**. It must not show 404.
    - Open `https://your-domain.com/blog` and `/admin` (log in as admin). Admin pages must not show the yellow "API not reachable" banner.
    - Open `https://<api-address>/api/health`. It must show JSON containing `"status":"ok"`, not the website.
    - Then go through `PRODUCTION_CHECKLIST.md`.

---

## B. Backend (Express API) deployment

The backend must run on a Node.js runtime. It **will not work** on basic/static shared hosting, and it is **not** inside `dist`.

### B1. Hostinger Node.js web app (Business / Cloud plans)
1. hPanel → **Websites** → **Add website** → **Node.js web app** (Hostinger may call it "Web App").
2. Domain:
   - Option A: your main domain (or a test sub-domain first).
   - Option B: create `api.your-domain.com` (a sub-domain must be its own website in Hostinger).
3. Choose **Upload your files** and upload:
   - Option A: `upload-ready\backend-with-website.zip`
   - Option B: `upload-ready\backend-api.zip`
   Never include `node_modules` (Hostinger installs packages itself; the ZIPs already exclude it).
4. Build settings:

   | Field | Value |
   |---|---|
   | Framework preset | **Express** (or "Other") |
   | Node.js version | **22** |
   | Package manager | **npm** |
   | Build command | `verify:prebuilt` (only checks the prebuilt server is present; nothing is compiled on Hostinger) |
   | Entry file | `server-dist/server.mjs` |
   | Output directory | leave empty |

5. **Environment variables** (same screen or the app's **Environment variables** page). Add every line from
   `backend\.env.example` with your real values, at least:
   `NODE_ENV=production`, `CORS_ORIGINS`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
   `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `ADILO_PUBLIC_KEY`, `ADILO_SECRET_KEY`.
   Copy the values from your PC's `.env` file (open it in VS Code). Use Razorpay **live** keys for real payments.
   Don't add `PORT`; Hostinger provides it.
6. **Deploy**. When the build is green, open `https://<api-address>/api/health`. You should see `"status":"ok"`,
   `"supabase":...` and Razorpay configured. If it fails: check the deployment logs (usually a missing environment variable), fix, then **Restart**.
7. **HTTPS:** Hostinger issues SSL for the website/sub-domain. Turn on Force HTTPS as in part A step 9.
8. **Updating later:** on your PC run the build script again, then redeploy the new ZIP. (Files on the server are replaced at each deploy; settings live in the environment variables, so they are kept.)

### B2. VPS (Hostinger VPS or any Ubuntu server)
```bash
# 1. Node.js 22 + process manager + web server
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs nginx
sudo npm install -g pm2

# 2. Upload backend-api.zip (or backend-with-website.zip) to the server, e.g. with WinSCP/FileZilla, then:
sudo mkdir -p /var/www/edufy && sudo chown $USER /var/www/edufy
cd /var/www/edufy && unzip ~/backend-api.zip

# 3. Production dependencies only
npm ci --omit=dev

# 4. Settings: copy the template and fill in real values (nano: Ctrl+O save, Ctrl+X exit)
cp .env.example .env && nano .env && chmod 600 .env

# 5. Start + restart automatically on reboot
pm2 start server-dist/server.mjs --name edufy-api
pm2 save && pm2 startup     # run the command it prints
```
Nginx (`/etc/nginx/sites-available/edufy-api`, then `sudo ln -s` it into `sites-enabled` and `sudo nginx -t && sudo systemctl reload nginx`):
```nginx
server {
  server_name api.your-domain.com;
  client_max_body_size 50m;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```
DNS: add an **A record** `api` → your VPS IP. HTTPS: `sudo apt install -y certbot python3-certbot-nginx && sudo certbot --nginx -d api.your-domain.com`.
Logs: `pm2 logs edufy-api`. Restart after changes: `pm2 restart edufy-api`.

### B3. CORS
- Option B: `CORS_ORIGINS=https://your-domain.com,https://www.your-domain.com` (exact addresses, no trailing slash).
- Option A: optional (same address).
- The mobile app is never blocked by CORS.

### B4. Razorpay webhook (backup for enrollment if the browser closes after paying)
Razorpay Dashboard → **Account & Settings → Webhooks → Add New Webhook**
- URL: `https://<api-address>/api/payments/webhook`
- Secret: choose a long random text; put the **same** text in `RAZORPAY_WEBHOOK_SECRET`
- Active events: **payment.captured** and **order.paid**
- Create it **in Live mode** (and separately in Test mode if you test with test keys)

### B5. Test the API
| Test | Expected |
|---|---|
| `https://<api-address>/api/health` | JSON, `"status":"ok"` |
| `https://<api-address>/api/health?check=razorpay` | `"razorpayLive":{"ok":true,"mode":"live"}` |
| `https://<api-address>/api/does-not-exist` | JSON `404` (not an HTML page) |
| Log in on the website → admin pages | no yellow "API not reachable" banner |
| Buy a low-priced course with a real card/UPI | course appears in **My Learning**; payment shows "captured" in Admin |

---

## C. Android app: build and publish

### C1. One-time setup (on your PC)
1. Node.js 22 LTS is already installed (check: `node --version`).
2. Open a terminal **in the `app` folder**:
   ```
   cd app
   npx eas-cli login                 # sign in with your Expo account (you type the password)
   npx eas-cli init                  # links the app to an Expo project; prints a projectId
   ```
3. Copy the printed **projectId** into `app\.env` as `EAS_PROJECT_ID=...` (for local dev builds).

### C2. Production settings (expo.dev, no files needed)
expo.dev → your project **edufy-academy** → **Project settings → Environment variables → Add variables**.
Create each of these for the **production** and **preview** environments, visibility **Plain text** or **Sensitive**
(never "Secret" for `EXPO_PUBLIC_` values):

| Name | Value |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | `https://<your-ref>.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | your Supabase publishable key |
| `EXPO_PUBLIC_API_URL` | API address **without** `/api`, e.g. `https://api.your-domain.com` (Option A: `https://your-domain.com`) |
| `EXPO_PUBLIC_WEB_URL` | `https://your-domain.com` |
| `EAS_PROJECT_ID` | the projectId from C1 |
| `GOOGLE_SERVICES_JSON` | **File** variable, visibility **Secret**: upload `google-services.json` from Firebase (part E) |

The preview and production builds **stop with a clear message** if any address is missing, not https, or a localhost/LAN address.
That way you can never ship an app that points at your PC.

### C3. Build
```
npx eas-cli build -p android --profile preview        # APK, for installing directly on phones
npx eas-cli build -p android --profile production     # AAB, for Google Play
```
- First production build: EAS asks **"Generate a new Android Keystore?"**.
  - If the app has **never** been on Google Play: answer **Yes**. EAS stores the keystore safely.
  - If an older version of this app is **already** on Google Play with your own keystore: answer **No**, then run
    `npx eas-cli credentials` → Android → production → **Upload a keystore** with the existing file. Never replace an existing keystore.
- Back up the keystore: `npx eas-cli credentials` → Android → production → Keystore → **Download**. Keep it private (not in the project, not in the ZIP).
- Each build takes about 10–25 minutes. Follow it on expo.dev → **Builds**.

### C4. Download
expo.dev → **Builds** → the finished build → **Download**. Save it in `Edufy-Academy-Production\android-builds\`.
- **APK** (preview): send it to testers or open the build page on a phone and tap **Install** (allow "Install unknown apps").
- **AAB** (production): for Google Play only (an AAB cannot be installed directly).

### C5. Google Play Console
1. play.google.com/console → **Create app** → name *Edufy Academy*, language, **App**, **Free**, accept declarations.
2. **Dashboard → Set up your app.** Complete every item:
   - Privacy policy URL (e.g. `https://your-domain.com/privacy`)
   - App access (give a test student login for reviewers)
   - Ads (No)
   - Content rating questionnaire
   - Target audience
   - Data safety (account info, purchase history, device ID for notifications)
   - Government apps (No)
   - Financial features (No)
3. **Store listing:**
   - Short and full description
   - App icon 512×512 (`app/assets/images/icon.png` exported at 512 px)
   - Feature graphic 1024×500
   - At least 2 phone screenshots
4. **Testing → Internal testing → Create new release.**
   - Play App Signing: keep the default (Google manages the app-signing key; your EAS keystore becomes the *upload* key).
   - Upload the **.aab**, add release notes, then **Save → Review release → Start rollout**.
   - Add testers (email list) and open the opt-in link on a phone to install from Play.
5. Test the app from the internal track (checklist "Mobile app" section).
6. **Production:**
   - Personal developer accounts created recently must first run a **closed test with at least 12 testers for 14 days** before Google allows production. Plan for this.
   - Then **Production → Create new release** → use the same AAB (or a newer build) → **Send for review**. Review usually takes a few days.
7. Optional: automatic upload with `npx eas-cli submit -p android --profile production`. It needs a Google service-account JSON key; the default in `eas.json` sends to the internal track as a draft.

**New versions later:** change code → `npx eas-cli build -p android --profile production` (the version code increases automatically) → upload the new AAB as a new release.

---

## D. Supabase production configuration

Supabase Dashboard → your project:

1. **SQL Editor:** if not done yet, paste and run all of `supabase/RUN_IN_SQL_EDITOR.sql` (push notifications, categories, blog).
   It is safe to run again. Without it the admin Categories/Blog/Notifications pages show "run the migration".
2. **Authentication → URL Configuration**
   - **Site URL:** `https://your-domain.com` (never `localhost`)
   - **Redirect URLs:** add
     - `https://your-domain.com/**`
     - `https://www.your-domain.com/**` (if you use www)
     - `edufyacademy://reset-password` (app password reset)
     - your test sub-domain, e.g. `https://test.your-domain.com/**` (while testing)
     - remove `http://localhost:3000/**` when you no longer develop locally (or keep it, it's harmless)
3. **Email confirmation:** Authentication → **Emails → Confirm signup**
   - Subject: *Confirm your Edufy Academy account*
   - Body: paste `supabase/email-templates/confirm-signup.html`. It uses `{{ .ConfirmationURL }}`, which lands on `https://your-domain.com/auth/callback`.
4. **Production auth callback:** `/auth/callback` on the website verifies the email and signs the student in. Nothing else to set.
5. **Custom SMTP (strongly recommended):** Authentication → **Emails → SMTP Settings**. Use your domain mailbox (Hostinger email) so verification emails aren't limited or sent to spam. Supabase's built-in sender is rate-limited.
6. **Google sign-in:** the current website and app **do not have a "Sign in with Google" button**; login is email + password.
   If you want Google login later, it needs a code change plus Google Cloud OAuth credentials. Redirect URI: `https://<your-ref>.supabase.co/auth/v1/callback`.
7. **Security (RLS):** all Edufy tables have Row Level Security on. Check Dashboard → **Advisors → Security** and fix anything marked *error*.
   Never share the service-role key; it belongs only on the backend server.
8. **Backups:** Database → Backups. Paid plans have daily backups. Take one before big changes.

---

## E. Push notifications

| Piece | Where | Status / action |
|---|---|---|
| Expo project | `npx eas-cli init` (C1) | needed for push tokens |
| `EAS_PROJECT_ID` | expo.dev env vars + `app\.env` | set it |
| Firebase Android app | console.firebase.google.com → Add project → **Add app → Android**, package `com.edufyacademy.student` → download **google-services.json** | upload as EAS file variable `GOOGLE_SERVICES_JSON` (C2) |
| FCM V1 server key | Firebase → Project settings → **Service accounts → Generate new private key** (JSON) → `npx eas-cli credentials` → Android → production → **Google Service Account → FCM V1** → upload | lets Expo deliver to Android |
| Android 13+ permission | the app asks "Allow notifications?" after login (`POST_NOTIFICATIONS`) | nothing to do |
| Device registration | automatic after login (stored in Supabase `push_devices`) | requires the SQL from part D1 |
| Backend sender | runs inside the API (`PUSH_WORKER_ENABLED=true`) | optional `EXPO_ACCESS_TOKEN` if you enable "Enhanced security for push" on expo.dev |

**Real-device test:**
1. Install the **preview APK** (not Expo Go; Expo Go can't receive push).
2. Log in and allow notifications.
3. Admin → **Push notifications** → send a test to "All students". It arrives within about a minute.
4. Check **History** for delivered / failed counts.

Automatic notifications (new course, new bundle, completion, certificate) need the SQL from D1 and the backend running.

---

## Order of work (summary)
1. Run `production\build-production.ps1` and confirm the summary is all PASS.
2. Supabase: run SQL, set Site URL + Redirect URLs, email template (part D).
3. Deploy the backend (B), set environment variables, check `/api/health`.
4. Deploy the website (A). Option B: edit `config.js`.
5. Turn on SSL / Force HTTPS for website and API.
6. Razorpay: live keys + webhook (B4); do one real low-value payment.
7. Expo: login, init, environment variables, Firebase (C1, C2, E).
8. Build the preview APK → test on phones → build the production AAB.
9. Google Play: internal testing → closed testing (if required) → production review.
10. Tick everything in `PRODUCTION_CHECKLIST.md`.
