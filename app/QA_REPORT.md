# Edufy Student App — QA Report (Feature set 15)

Date: 11 Nov 2026 · Scope: Certificates, Bundles, Automatic next video

Status legend: **FIXED** / **VERIFIED** (evidence below) / **NOT TESTED** (needs a phone) / **BLOCKED**

---

## A. Course completion certificates

| Item | Status |
|---|---|
| My Certificates list (earned + "ready to claim") | Implemented · NOT TESTED on device |
| Certificate preview (native, A4 proportions, logo, QR) | Implemented · NOT TESTED on device |
| PDF download (`expo-print`, save as PDF) and PDF share (`expo-sharing`) | Implemented · NOT TESTED on device |
| Share verification link, verify by code/URL, QR → website verify page | Implemented · NOT TESTED on device |
| Server only issues a certificate when **every lesson** is completed | **FIXED** (security bug) · VERIFIED by code review + real-data SQL |
| No duplicates (existing cert returned; unique-key race handled) | **FIXED** · VERIFIED by code review |
| No certificate without enrollment | VERIFIED (existing check kept; now `maybeSingle`) |
| Public verify endpoint returns only certificate fields (no user ids) | **FIXED** |
| Website verify page auto-verifies `?code=` links, no fake default code | **FIXED** |

**Security bug found and fixed:** before this change, `/api/certificates/claim` issued a
certificate to any enrolled student without checking lesson completion. It now counts distinct
completed lessons that belong to the course and returns 403 with "x of y completed" until all
are done.

## B. Bundles

| Item | Status |
|---|---|
| Bundles rail on Home and Explore, Bundles list, Bundle detail | Implemented · NOT TESTED on device |
| Price, "bought separately" value, savings %, included courses | Implemented · VERIFIED by unit tests (`bundleSavings`) |
| Owned courses marked; ownership note at checkout | Implemented · VERIFIED by unit tests (`bundleOwnership`) |
| Purchase via existing `/create-order {bundleId}` + `/verify-payment` | Implemented · NOT TESTED (no test payment made) |
| Enrollment in all courses only after server verification | VERIFIED by code review (app never grants access; server does) |
| Purchased bundles in My Learning (Bundles tab, progress per course) | Implemented · NOT TESTED on device |
| Reuses `bundles`, `bundle_courses`, `enrollments.bundle_id` — nothing hardcoded | VERIFIED |

## C. Automatic next video

| Item | Status |
|---|---|
| Overlay: next title + thumbnail, 5 s countdown, Cancel, Play next now | Implemented · NOT TESTED on device |
| Autoplay toggle (overlay + Settings → Playback), saved on device | Implemented · NOT TESTED on device |
| Triggers only on the player's real `ended` event (Adilo / file video) | VERIFIED by code review |
| Never on pause, exit, or elapsed time; one trigger per lesson | VERIFIED by code review |
| Progress saved before moving on (`save('ended')` then navigate) | VERIFIED by code review |
| Countdown stops when the app goes to background or screen unmounts | Implemented · NOT TESTED on device |
| No skipping: always the immediate next lesson; locked → no autoplay | VERIFIED by unit tests (`decideAfterEnd`) |
| Last lesson → "Course complete" + Get certificate | VERIFIED by unit tests |

---

## Files changed

**Backend / website (minimal, validation only)**
- `server.ts` — certificate claim completion check, duplicate handling, verify field list
- `src/pages/public/CertificateVerificationPage.tsx` — `?code=` auto-verify, no fake default

**App — new**
- Logic: `src/logic/bundles.ts`, `autoplay.ts`, `certificates.ts`
- Services: `src/services/bundles.ts`, `certificates.ts`
- Hooks: `src/hooks/usePurchase.ts`, `useAutoplayPref.ts`
- Lib: `src/lib/qr.ts`
- Components: `BundleCard.tsx`, `CertificateView.tsx`, `QRCode.tsx`, `NextLessonOverlay.tsx`
- Screens: `bundles.tsx`, `bundle/[id].tsx`, `certificates.tsx`, `certificate/[id].tsx`, `verify-certificate.tsx`
- Tests: `tests/bundles.test.ts`, `autoplay.test.ts`, `certificates.test.ts`

**App — updated**
- `checkout/[id].tsx` (course or bundle), `learn/[courseId].tsx` (autoplay, certificate button),
  `(tabs)/index.tsx`, `explore.tsx`, `learning.tsx`, `profile.tsx`, `_layout.tsx`, `dashboard.tsx`,
  `settings.tsx`, `notifications.tsx`, `payments.tsx`
- `hooks/queries.ts`, `hooks/useAdiloTracking.ts` (`onEnded`), `services/payments.ts`,
  `services/learning.ts`, `lib/types.ts`, `components/RazorpayWebCheckout.tsx`
- `package.json` (+ `expo-print`, `expo-sharing`, `qrcode-generator`), `app.config.ts`

## Backend dependencies

- **Restart the Express server** (`npm run dev` in the project root) — the certificate fix only
  takes effect after a restart.
- Endpoints used: `/api/payments/create-order` (`courseId` | `bundleId`), `/verify-payment`,
  `/api/certificates/claim`, `/api/certificates/verify/:code`, `/api/lessons/:id/video`,
  `/video-progress`, `/api/health`.
- Supabase tables (unchanged schema): `certificates`, `bundles`, `bundle_courses`, `enrollments`,
  `lesson_progress`. No migrations were needed.
- No secrets in the app: only the Supabase publishable key and public URLs.

## Tests executed (with evidence)

| Test | Result |
|---|---|
| `npm test` — 59 unit tests (incl. new bundles, autoplay, certificates) | **59 / 59 pass** |
| Strict TypeScript check of `src/logic` | Pass |
| Certificate HTML rendered to PDF in a headless browser (layout, escaping, QR) | Pass |
| Real data (Supabase): 12 published courses, 1 published bundle, 1 certificate | Read OK |
| Real data: eligibility SQL — only the existing certificate holder has 12/12 lessons | Matches server rule |
| Real data: 3 enrollments carry `bundle_id` (bundle grouping in My Learning) | Confirmed |
| Razorpay health check | Configured, test mode |

**Not executed here:** full `npx tsc --noEmit` and `npx expo install --check` for the whole app
(new packages could not be installed in this environment), and any run on a phone/emulator.

## Remaining blockers / known limits

1. **No device testing yet** — certificates UI, PDF/share, bundle purchase, and autoplay must be
   checked on a phone (checklist below).
2. **Phone must reach the Express server** — `EXPO_PUBLIC_API_URL=http://<PC LAN IP>:3000` and
   allow Node through Windows Firewall. Payments and certificate claims fail without it.
3. **YouTube / Vimeo lessons** don't send an `ended` event to the app, so they don't autoplay
   (the student taps Next). Adilo and direct video files do.
4. **Partly owned bundles** are still charged the full bundle price (existing website rule). The
   app says so clearly before payment.
5. **Quizzes** remain website-only.
6. Unused tables from the removed Adilo importer are still in the database (harmless).

## Device test checklist

- [ ] Finish the last lesson of a course → overlay shows "Course complete" → Get certificate → claim works
- [ ] Try to claim with a lesson unfinished → clear "x of y completed" message, no certificate
- [ ] Claim twice → same certificate, no duplicate
- [ ] Certificate: Download PDF, Share PDF, Share link, scan QR → website shows "Verified"
- [ ] Verify screen: valid code → details; random code → "not found"
- [ ] Bundle detail shows price, savings, courses, Owned marks
- [ ] Buy bundle with Razorpay **test** card → all courses appear in My Learning → Bundles tab
- [ ] Cancel Razorpay → no enrollment, clear message
- [ ] Video ends → 5 s countdown → next lesson plays; Cancel stops it; toggle off → no countdown
- [ ] Pause / leave the player mid-video → no overlay, lesson not completed
- [ ] Put the app in background during countdown → countdown stops
