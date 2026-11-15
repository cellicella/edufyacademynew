# Final handover report: UI cleanup, mobile auth redesign, Hostinger deployment

Statuses: READY – BUILT AND VERIFIED · CONFIGURATION REQUIRED · HOSTING LIMITATION · REBUILD REQUIRED · BLOCKED · NOT TESTED

Builds could not be produced in the development environment (no access to the npm registry, and the Linux workspace on
your PC cannot start because hardware virtualization is off). Everything below marked "build" is produced by
`production\build-production.ps1` on your PC. Nothing was deployed and no DNS was changed.

| # | Item | Status | Notes |
|---|---|---|---|
| 1 | Demo person switcher removed | READY (code) · REBUILD REQUIRED | Removed from the navbar (desktop, account menu, mobile menu) and the student/admin/instructor sidebars; client-side role switching (`switchRole`) deleted; demo-account buttons on the login page and the fake “Proceed to Reset Screen” link removed. Real login, roles and server-side permission checks unchanged. Type check clean; not viewed in a browser. |
| 2 | Mobile sign-in / sign-up redesign | READY (code, 85/85 app tests) · REBUILD REQUIRED · NOT TESTED on devices | Brand gradient header with logo, animated entrance (respects reduce-motion), Google first, email/password with show/hide, inline validation, phone with country code (saved to the profile), password strength, terms/privacy links, duplicate-email “Sign in instead”, keyboard-aware scrolling. Google button shows “not set up yet” when Supabase reports the provider off. Official Google “G”: CONFIGURATION REQUIRED (see ANDROID_APP_BUILD_GUIDE.md §8). |
| 3 | Website production build path | REBUILD REQUIRED | `Edufy-Academy-Production\upload-ready\hostinger-website-public_html.zip` (dist + `.htaccess` + production `config.js` + `robots.txt`) |
| 4 | Backend package path | REBUILD REQUIRED | `Edufy-Academy-Production\upload-ready\hostinger-api-nodejs.zip` (prebuilt server, 5 runtime packages; startup is checked by the script) |
| 5 | Hostinger compatibility | HOSTING LIMITATION (manageable) | Business plan runs Node.js web apps (up to 5; Node 18–24). Limits: no guaranteed always-running timers → added `/api/internal/cron` + Hostinger cron every 5 min; 120 s request limit; shared process limit. |
| 6 | VPS needed? | No (for launch) | Move the API to a VPS later if 503s or heavy traffic appear. Plan in BACKEND_DEPLOYMENT_GUIDE.md §9. |
| 7 | DNS records | CONFIGURATION REQUIRED | Domain at Hostinger: nothing. Elsewhere: Hostinger nameservers from hPanel, or A `@` and A `www` → hosting IP shown in hPanel. `api` sub-domain is created as its own website in hPanel. |
| 8 | SSL | CONFIGURATION REQUIRED | hPanel → Security → SSL for edufyacademy.com, www, api; `.htaccess` redirects to https://edufyacademy.com (reviewed, not run on a live server). |
| 9 | Supabase production settings | CONFIGURATION REQUIRED | Site URL `https://edufyacademy.com`; Redirect URLs `https://edufyacademy.com/**`, `https://www.edufyacademy.com/**`, `edufyacademy://**`; Google provider; optional email hook. |
| 10 | Android AAB | BLOCKED here → run `npx eas-cli build -p android --profile production` | Needs your Expo login, EAS environment variables and `google-services.json`. |
| 11 | Android APK | BLOCKED here → run `npx eas-cli build -p android --profile preview` | Same prerequisites. |
| 12 | Deployment sequence | — | DEPLOYMENT_GUIDE_EDUFYACADEMY.md |
| 13 | Remaining configuration | CONFIGURATION REQUIRED | Hostinger Node app + env vars + cron; website upload; SSL; Supabase URLs; Google OAuth client; Razorpay webhook (+ `refund.processed`); SMTP in admin; EAS variables; Play Console listing. |

## Testing (development environment)
| Suite | Result |
|---|---|
| Backend/website tests (`tests/*.test.ts`, incl. new cron endpoint tests) | 60/60 pass |
| App unit tests (incl. phone validation, Google availability) | 85/85 pass |
| Type checks (server, website, app; changed files) | no new errors |
| `.htaccess` on Apache/LiteSpeed | NOT TESTED (Apache unavailable in the sandbox) |
| Website/app in a browser or on phones, live Hostinger, live Supabase/Razorpay/Google | NOT TESTED: use PRODUCTION_TESTING_CHECKLIST.md after deployment |

## Files changed
Website: `src/components/layout/Navbar.tsx`, `src/layouts/StudentLayout.tsx`, `src/layouts/AdminLayout.tsx`,
`src/layouts/InstructorLayout.tsx`, `src/components/common/RoleSwitcher.tsx` (emptied; safe to delete),
`src/context/AuthContext.tsx`, `src/pages/auth/LoginPage.tsx`, `src/pages/auth/ForgotPasswordPage.tsx`,
`src/lib/googleIdentity.ts`, `src/components/auth/GoogleSignIn.tsx`, `index.html`.
Server: `server.ts`, `server/push.ts`, `server/cron.ts` (new), `tests/cron.test.ts` (new), `package.json` (test list).
App: `app/src/components/AuthShell.tsx`, `app/src/components/GoogleButton.tsx`, `app/src/components/PhoneField.tsx` (new),
`app/src/components/ui.tsx`, `app/src/app/(auth)/login.tsx`, `app/src/app/(auth)/register.tsx`,
`app/src/context/AuthContext.tsx`, `app/src/services/profile.ts`, `app/src/services/authProviders.ts` (new),
`app/src/logic/phone.ts` (new), `app/src/logic/authProviders.ts` (new), `app/tests/authScreens.test.ts` (new).
Deployment: `production/build-production.ps1`, `production/hostinger/website.htaccess`, `production/hostinger/backend-package.json`,
`production/readme/hostinger-api-README.md`, `production/templates/backend.env.example`, and in `production/docs/`:
`DEPLOYMENT_GUIDE_EDUFYACADEMY.md`, `HOSTINGER_SHARED_HOSTING_GUIDE.md`, `BACKEND_DEPLOYMENT_GUIDE.md`,
`ANDROID_APP_BUILD_GUIDE.md`, `PRODUCTION_ENVIRONMENT_VARIABLES.md`, `PRODUCTION_TESTING_CHECKLIST.md`, this report,
plus a pointer added to `DEPLOYMENT_GUIDE.md`.

## Sources (Hostinger documentation used for the compatibility result)
- How to add a Node.js web app: https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/
- Node.js limits for web and cloud plans: https://www.hostinger.com/support/hostinger-node-js-limits-for-web-and-cloud-plans/
- Cron jobs for Node.js websites: https://www.hostinger.com/support/how-to-run-cron-jobs-for-node-js-websites-at-hostinger/
- Custom domain for Node.js apps: https://www.hostinger.com/support/how-to-connect-a-custom-domain-to-a-node-js-application/
- Environment variables after deployment: https://www.hostinger.com/support/how-to-edit-or-add-environment-variables-after-deployment/
- Plan parameters and limits: https://www.hostinger.com/support/6976044-parameters-and-limits-of-hosting-plans-in-hostinger/
- Nameservers / pointing a domain: https://www.hostinger.com/support/1583247-where-to-find-hostinger-nameservers/ , https://www.hostinger.com/support/1863967-how-to-point-a-domain-to-hostinger/
