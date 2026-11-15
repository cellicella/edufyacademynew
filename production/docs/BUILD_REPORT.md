# Edufy Academy: Build Report (pre-production audit)

Audit date: 2026-11-13. Build and test results from your PC are in `BUILD_RESULTS.md`
(written by `production/build-production.ps1` each time it runs).

Statuses: **READY** = generated and verified · **BLOCKED** = needs credentials/external setup ·
**NOT BUILT** = not executed · **NOT TESTED** = could not be verified.

## 1. Project layout found
| Part | Location | Stack |
|---|---|---|
| Website (frontend) | project root: `src/`, `index.html`, `vite.config.ts`, `public/` | React 19 + Vite 8 + Tailwind 4 + React Router 7 |
| Backend | project root: `server.ts`, `server/` | Express 4 (TypeScript), Supabase service client, Razorpay, Adilo, Expo push |
| Mobile app | `app/` | Expo SDK 58, React Native 0.88, Expo Router, TypeScript |
| Database | `supabase/` | migrations + `RUN_IN_SQL_EDITOR.sql`, email template |
| Not used for deployment | `edufy-web/`, `metadata.json`, `.aistudio/`, `bun.lock`, old ZIP backups | excluded from the package |

## 2. Problems found and fixed in this pass
| # | Severity | Problem | Fix |
|---|---|---|---|
| 1 | **Critical** | Website payments called `/api/payments/...` with a fixed path, so on a separate API address (website in `public_html`, API on a sub-domain) every purchase would fail | Payments now use the configured API address like every other call (`CartWishlistContext.tsx`) |
| 2 | **Critical** | Production start used `tsx server.ts`, but `tsx` is a dev-only package and missing after a production install, so the server would not start | New `npm run build` also compiles the server to `server-dist/server.mjs`; production start is `node server-dist/server.mjs` (`npm run start:prod`) |
| 3 | High | The API address was fixed at build time, but the domain isn't known yet, so a rebuild would be needed for every address change | `config.js` in the website root (edit after upload, no rebuild). Falls back to `VITE_API_BASE_URL`, then same-address `/api` |
| 4 | High | No SPA rule for Hostinger/Apache: refreshing `/courses/...` would 404 | `public/.htaccess` (SPA fallback, caching, security headers) is shipped inside `dist` |
| 5 | High | Server crashed on every page request if `dist/` was missing (API-only hosting) | Serves `dist/` only when present, otherwise runs API-only. Fingerprinted assets cached for 1 year, `index.html` no-cache |
| 6 | High | Mobile release builds could be made with a PC/emulator API address (`10.0.2.2`, LAN IP) and ship a broken app | `app.config.ts` stops preview/production EAS builds unless API, website and Supabase addresses are public https |
| 7 | Medium | CORS allowed every origin | `CORS_ORIGINS` allowlist (empty = previous behaviour). `trust proxy` set; `x-powered-by` removed |
| 8 | Medium | `eas.json` did not load EAS environment variables | `environment` set per profile (development/preview/production); `submit` defaults to the internal track as a draft |
| 9 | Medium | Env templates mixed website, server and app settings; `APP_URL` pointed to localhost | Separate `website/`, `backend/`, `mobile-app/` `.env.example` files (placeholders only) |
| 10 | Medium | `expo` had been changed to SDK 52 in `app/package.json` (bundler crash) | Restored to SDK 58 earlier in this session; lockfile now resolves `expo@58.0.25` |

Unchanged on purpose: payment verification (HMAC signature on the server; test orders only when `NODE_ENV` is not production), enrollment logic, RLS, secure token storage in the app (SecureStore), video access checks.

## 3. Configuration audit
| Area | Finding | Status |
|---|---|---|
| Supabase (website) | `VITE_SUPABASE_URL` + publishable key read at build; secret keys never read by frontend code | READY (values verified by the build script on your PC) |
| Supabase (server) | Service-role client when `SUPABASE_SERVICE_ROLE_KEY` is set; otherwise falls back to the anon key (admin/payment features then fail) | Set the key on the server: BLOCKED until deployed |
| Razorpay | Order creation + HMAC-SHA256 signature verification + webhook (`payment.captured`, `order.paid`) with constant-time compare; simulated orders disabled in production | READY in code; live keys + webhook: BLOCKED (your Razorpay account) |
| Auth redirects | Email links → `<site>/auth/callback`; app reset → `edufyacademy://reset-password`; no localhost in code | Supabase Site URL/Redirect URLs: BLOCKED (dashboard) |
| Google OAuth | Not implemented in website or app (email + password only) | N/A |
| Emovur | Not present in the codebase; video hosting is Adilo | N/A |
| Video player | Website: protected lesson URLs from the API; App: WebView player using `EXPO_PUBLIC_WEB_URL` as origin, next-lesson autoplay | NOT TESTED on production hosting |
| Push | Expo push via backend worker; tokens in `push_devices` (needs SQL migration); FCM needs `google-services.json` + FCM V1 key | BLOCKED (Expo/Firebase setup) |
| Android config | id `com.edufyacademy.student`, name "Edufy Academy", official icon/adaptive icon/splash/notification icon, permissions INTERNET + POST_NOTIFICATIONS, cleartext only for dev | READY |
| Secrets in source | none in code; `.env*`, keystores, `google-services.json` are git-ignored and excluded from the package | READY |

## 4. Checks run
| Check | Where | Result |
|---|---|---|
| Mobile unit tests (73) | cloud workspace | PASS |
| Backend push-logic tests (7) | cloud workspace | PASS |
| Website + backend unit tests (12: course utils, payment/backend logic) | cloud workspace | PASS |
| Server compiles (esbuild bundle, 114 KB) | cloud workspace | PASS |
| Edited files transpile | cloud workspace | PASS |
| TypeScript (website + app), ESLint* | your PC via build script | see `BUILD_RESULTS.md` |
| `vite build` (minified, no source maps) | your PC via build script | see `BUILD_RESULTS.md` |
| Bundle scan: secret keys/values, localhost, source maps | your PC via build script | see `BUILD_RESULTS.md` |
| Built server smoke test (`/api/health`, SPA routes, JSON 404) | your PC via build script | see `BUILD_RESULTS.md` |
| `npx expo-doctor`, `npx expo install --check` | your PC via build script | see `BUILD_RESULTS.md` |
| EAS Android builds (AAB/APK) | Expo cloud | BLOCKED: Expo login, project id, production env vars, production API address |

\* ESLint is not configured in this project (no ESLint config/dependency). TypeScript (`tsc --noEmit`) is the lint step (`npm run lint`).

## 5. Deliverable status
| Deliverable | Status | Location |
|---|---|---|
| Website `dist` | **NOT BUILT** until you run the build script → then READY if the summary is all PASS | `Edufy-Academy-Production/website/dist/` |
| Backend package | **NOT BUILT** until you run the build script | `Edufy-Academy-Production/backend/` + `upload-ready/backend-api.zip` |
| Backend + website (single app) | **NOT BUILT** until you run the build script | `Edufy-Academy-Production/backend-with-website/` + `upload-ready/backend-with-website.zip` |
| Android AAB | **BLOCKED** (Expo account + production API address) | `android-builds/` after `eas build --profile production` |
| Android APK | **BLOCKED** (same) | `android-builds/` after `eas build --profile preview` |
| Deployment | **NOT DONE**: nothing has been uploaded or changed on any live server | DEPLOYMENT_GUIDE.md |
