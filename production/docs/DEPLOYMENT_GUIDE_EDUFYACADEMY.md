# Edufy Academy: deployment guide for edufyacademy.com

Start here. This page gives the order of work; each step links to the detailed guide.

## The setup (verified for your Hostinger Business plan)

| Part | Address | Where it runs | How |
|---|---|---|---|
| Website (React) | https://edufyacademy.com (www redirects here) | Hostinger Business, regular website, `public_html` | upload `hostinger-website-public_html.zip` |
| API (Express) | https://api.edufyacademy.com | Hostinger Business, **separate Node.js web app** | upload `hostinger-api-nodejs.zip` |
| Database, login, storage | `https://tyqdyfecdvclwsvcahod.supabase.co` | Supabase (unchanged) | settings in the Supabase Dashboard |
| Payments | Razorpay | Razorpay | webhook to the API |
| Videos | Adilo | Adilo (unchanged) | keys on the API |
| Android app | Google Play | your phone | EAS build (AAB) |

Why two websites: Hostinger runs Node.js only as its **own** website and cannot convert an existing site, so the
API goes on the `api.` sub-domain and your current site stays where it is. Hostinger’s Business plan allows up to
5 Node.js apps. Single and Premium plans do not support Node.js at all.

> `api.edufyacademy.com` is the proposed API address. It becomes real once you create it in step 3. If you choose
> another address, use it everywhere below instead (and pass it to the build: `-ApiUrl https://...`).

## Order of work (about 2 hours, plus DNS/SSL waiting time)

1. **Build on your PC** (10 min)
   Open PowerShell in the project folder (`edufyacademynew-main`) and run:
   ```
   powershell -ExecutionPolicy Bypass -File production\build-production.ps1
   ```
   Result: `Edufy-Academy-Production\upload-ready\hostinger-website-public_html.zip` and `hostinger-api-nodejs.zip`,
   plus `documentation\BUILD_RESULTS.md`. Every line must say PASS (WARN/BLOCKED lines explain what to fix).
2. **Database**: Supabase → SQL Editor → paste `supabase/RUN_IN_SQL_EDITOR.sql` → Run. Safe to run again.
3. **API on Hostinger**: follow BACKEND_DEPLOYMENT_GUIDE.md (create `api.edufyacademy.com` as a Node.js web app,
   upload the zip, enter environment variables, add the cron job). Check `https://api.edufyacademy.com/api/health`.
4. **Website on Hostinger**: follow HOSTINGER_SHARED_HOSTING_GUIDE.md (back up `public_html`, upload the website zip,
   SSL, www → non-www). Check `https://edufyacademy.com`.
5. **Supabase Auth settings**: PRODUCTION_ENVIRONMENT_VARIABLES.md → “Supabase Dashboard” (Site URL, Redirect URLs,
   Google provider, email hook).
6. **Razorpay webhook**: `https://api.edufyacademy.com/api/payments/webhook`, events `payment.captured`, `order.paid`,
   `refund.processed`, same secret as `RAZORPAY_WEBHOOK_SECRET`.
7. **Admin panel** (log in at https://edufyacademy.com/login?method=email as admin):
   - Settings → Domain & Environment → Production: Website URL `https://edufyacademy.com`, API URL
     `https://api.edufyacademy.com` → Save → apply/copy the Supabase items it lists.
   - Settings → SMTP & Email Configuration → enter SMTP → Test → Activate.
   - Settings → Payment Gateway → Test configuration (live keys).
8. **Android app**: ANDROID_APP_BUILD_GUIDE.md (EAS environment variables → preview APK → test → production AAB →
   Play Console).
9. **Test everything**: PRODUCTION_TESTING_CHECKLIST.md.

## Things that are never needed
- Uploading `node_modules`, `src/`, `.env` files or keystores to Hostinger.
- Changing Supabase to another database. Existing users, courses and enrollments stay where they are.
- Putting any secret key in `config.js` or in an `EXPO_PUBLIC_` / `VITE_` variable.

## If something goes wrong
- Website shows the old site: clear the browser cache, or check that the files went into `public_html` itself (not a sub-folder).
- Website loads but nothing works (“Failed to fetch”): `config.js` API address, API health URL, `CORS_ORIGINS`.
- API returns 503: Hostinger dashboard of `api.edufyacademy.com` → Deployments → build/runtime logs; check `NODE_ENV=production` and the entry file.
- Rollback: re-upload your `public_html` backup; for the API, Hostinger keeps the last two successful builds (redeploy the previous one).
