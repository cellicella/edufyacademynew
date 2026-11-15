# Edufy Academy — Student App (React Native + Expo)

A native Android/iOS app for **students only**. It uses the same Supabase project, accounts,
courses, enrollments, payments and lesson progress as the Edufy Academy website, and calls the
website's existing Express API for payments and video access. No instructor or admin features.

| | |
|---|---|
| Stack | Expo SDK 58 · React Native 0.88 · TypeScript · Expo Router · TanStack Query |
| Auth | Supabase Auth (session stored in the device keychain/keystore via `expo-secure-store`) |
| Data | Supabase (public publishable key + RLS) — same tables as the website |
| Payments | Existing `/api/payments/create-order` + `/api/payments/verify-payment` (Razorpay) |
| Video | Existing `/api/lessons/:id/video` (enrollment-checked Adilo link) + `/video-progress` |

---

## 1. Run it in development

```bash
cd app
npm install
npx expo install --fix      # aligns native package versions with the installed Expo SDK
cp .env.example .env        # then fill in the values (see section 3)
npx expo start
```

The website's Express server must be running (`npm run dev` in the project root) and reachable
from the phone:

* **Android emulator** → `EXPO_PUBLIC_API_URL=http://10.0.2.2:3000`
* **Real phone on the same Wi-Fi** → `EXPO_PUBLIC_API_URL=http://<your PC's LAN IP>:3000`
  (find it with `ipconfig`; allow Node through Windows Firewall when asked)

### Expo Go vs. development build (Android / iOS only — not web)

The app is **mobile-only**. Do not press `w` / open it in a browser: `expo-secure-store` (where the
login session is kept) has no web implementation, so the app shows an "Open Edufy on your phone"
screen there and the `web` platform is disabled in `app.config.ts`.

`expo-dev-client` is installed, so `npx expo start` defaults to *development build* mode.

* **Quick test in Expo Go** (install "Expo Go" from the Play Store, matching SDK 58):
  `npx expo start --go --clear` → scan the QR code with Expo Go.
  In Expo Go the native Razorpay sheet is replaced by Razorpay's web checkout (still verified on
  the server).
* **Development build** (native Razorpay, exactly like production): needs Android Studio + JDK 17
  and an emulator or USB-debugging phone:
  `npx expo run:android` (first build takes several minutes), then later just `npx expo start`.
  Cloud alternative: `eas build -p android --profile development`, install the APK, `npx expo start`.

## 2. One-time Supabase setting (password reset)

Supabase Dashboard → **Authentication → URL Configuration → Redirect URLs** → add:

```
edufyacademy://reset-password
```

The reset email then opens the app's *Choose a new password* screen. (Open the link on the same
phone that requested it.)

## 3. Environment variables

All variables are **public** and bundled into the app. Never put a Supabase secret/service-role
key or the Razorpay key secret here — those stay on the Express server.

| Variable | Example | Purpose |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` | Same project as the website |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` | Public key (RLS enforced) |
| `EXPO_PUBLIC_API_URL` | `https://edufyacademy.com` | Base URL of the Express server that serves `/api/*` |
| `EXPO_PUBLIC_WEB_URL` | `https://edufyacademy.com` | Public website (video player page origin, quiz/FAQ links) |

For EAS cloud builds, add the same variables in the EAS dashboard (Project → Environment
variables) or in `eas.json` under each profile's `env`.

> **Production must use `https://` for `EXPO_PUBLIC_API_URL`.** Plain `http://` is only allowed
> in builds made while the variable is `http://` (local testing).

## 4. Build the Android app

```bash
npm install -g eas-cli
eas login
eas init                                   # links the project, fills extra.eas.projectId
npm run build:android:apk                  # installable APK for testing  (profile: preview)
npm run build:android:aab                  # Play Store bundle            (profile: production)
```

Local alternative (no EAS): `npx expo prebuild -p android` then
`cd android && ./gradlew assembleRelease` (configure your own release keystore first).

Package name: `com.edufyacademy.student` (change in `app.config.ts` before the first store upload).

## 5. iOS

The project is iOS-ready (`bundleIdentifier: com.edufyacademy.student`, photo-library usage text,
safe areas, keyboard handling). Build with `npm run build:ios` (Apple Developer account required)
or `npx expo run:ios` on a Mac.

## 6. What's in the app

| Area | Screens |
|---|---|
| Auth | Splash → Onboarding → Login · Register (always *student*) · Forgot password · Reset password · Logout · Persistent session |
| Splash | Animated logo + "Learn. Grow. Achieve.", restores the session, prefetches Home, max 8 s |
| Home | Avatar, greeting, bell with live unread badge, search, admin-managed auto-sliding banners, learning progress overview, Continue learning, Featured, Special offers, Bundles, Popular, Trending, Recommended, New, Recently viewed, categories |
| Explore | Search, category / level / price filters, sorting |
| Course | Banner, preview video, outcomes, description, curriculum, requirements, audience, instructor, price/discount, Buy / Enroll free / Start learning |
| Checkout | Order summary → Razorpay → server verification → enrollment |
| My Learning | In progress / Completed with progress, lessons done/total, Continue |
| Player | Adilo video (16:9, fullscreen), article & external video lessons, prev/next, auto-completion at 90% watched, manual completion for non-video lessons, resume, curriculum |
| Dashboard | Profile, totals, overall progress, recently accessed, purchase history |
| Profile | Photo upload, name, email, phone, edit profile, my courses, payment history, change password, settings, logout |
| Notifications | Real push notifications (Expo Push → FCM/APNs), notification centre (read / unread / delete / clear), deep links, per-topic preferences, daily learning reminder, activity (enrollments & purchases) — see **PUSH_NOTIFICATIONS.md** |
| Offers | Special offers list and detail with countdown (only live offers are shown) |

## 7. Project structure

```
app/
├─ app.config.ts          Expo config (name, icons, splash, package ids, plugins)
├─ eas.json               Build profiles (development / preview APK / production AAB)
├─ assets/images/         App icon, adaptive icon, splash, logo (Edufy brand mark)
└─ src/
   ├─ app/                Expo Router routes
   │  ├─ (auth)/          login, register, forgot-password, reset-password
   │  ├─ (tabs)/          Home, Explore, My Learning, Profile (bottom navigation)
   │  ├─ course/[id]      course details          ├─ learn/[courseId]  video player
   │  ├─ checkout/[id]    purchase                ├─ dashboard, payments, notifications
   │  └─ settings, edit-profile, change-password, onboarding, index (splash/router)
   ├─ components/         UI kit, course cards, curriculum, video player, Razorpay fallback
   ├─ context/            AuthContext (Supabase session + profile)
   ├─ hooks/              React Query hooks, Adilo watch-time tracking
   ├─ services/           courses, learning, payments, profile, notifications
   ├─ lib/                config, Supabase client, secure storage, API client, types
   ├─ theme/              colours, typography, spacing (Edufy brand)
   └─ utils/              formatting, safe video-link parsing
```

See **API_INTEGRATION.md** for every backend call and the security model.

## 8. Known limitations

* **Quizzes** open on the website (the website grades them client-side; a secure server-side quiz
  endpoint would be needed before moving them into the app).
* **Video resume**: the Adilo player cannot be told to seek from outside, so the app shows
  "You stopped at m:ss" (same as the website).
* **Push notifications** need a development/production build, an EAS project id and Firebase (FCM V1)
  credentials — Expo Go can't receive them. Setup: **PUSH_NOTIFICATIONS.md**.
* **Adilo domain restrictions**: if you restrict where your Adilo videos may be embedded, allow the
  domain set in `EXPO_PUBLIC_WEB_URL` (the player page uses it as its origin).
* Lessons created by the CSV importer (link-only Adilo lessons) need the server version that
  includes that importer — restart the Express server after updating it.

## 9. Quality checks

```bash
npm test                    # unit tests for core logic (video links, API errors, auth messages,
                            # progress, resume/next-lesson, payments, watch time, secure storage, config)
npx tsc --noEmit            # TypeScript
npx expo install --check    # native package versions match the Expo SDK
npx expo-doctor             # project health
npx expo export --platform android   # production JS bundle builds without errors
```

Pure, testable logic lives in `src/logic/` (no React Native imports). `npm test` transpiles it with
the project's TypeScript and runs Node's built-in test runner — no device needed.

## 10. Reliability rules built into the app

* Every request has a timeout (API 20 s, payments 30 s, Supabase 20 s) and honours cancellation.
* Read queries retry only network/timeout/5xx failures, at most twice with backoff. 4xx are never retried.
* Payment calls are never retried automatically. If Razorpay succeeded but verification failed because
  of the network, the app keeps the Razorpay result and offers **Retry verification** (the server's
  verification is idempotent) instead of charging again. Before a new attempt it re-checks enrollment
  (the Razorpay webhook may have already granted access).
* A 401 triggers one token refresh and a single retry; if that fails the student is asked to sign in.
* Logging out signs out **this device only** (the website session is unaffected).
* No tokens, passwords or keys are logged; secure-storage warnings include key names only.
