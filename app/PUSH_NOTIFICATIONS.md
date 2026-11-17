# Push notifications — setup & architecture

Edufy uses **Expo Notifications + the Expo Push Service**. Expo delivers to Firebase Cloud
Messaging (Android) and APNs (iOS). The app only registers its Expo push token. Sending happens
on the Edufy Express server, and no provider credentials are ever in the app.

```
Admin panel ──► Express /api/admin/push/*  ──► push_notifications (queue)
                                                  │  background worker (every 20 s, in server.ts)
Course/bundle published ─► DB trigger ────────────┤
Course completed ────────► DB trigger ─► user_notifications (push_status = pending)
                                                  ▼
                       Expo Push Service ─► FCM / APNs ─► phone
                       user_notifications (notification centre, read/unread, history)
```

## 1. One-time setup (needs your accounts — can't be done for you)

### a) Database
Apply `supabase/migrations/20261111000001_edufy_push_notifications.sql` (Supabase SQL editor or
`supabase db push`). It is safe to run more than once.

### b) Expo / EAS project
```bash
npm install -g eas-cli
cd app
eas login
npx eas-cli project:info   # confirms the link
```
The project id (`37cb3efb-c3fa-4181-8486-0f5161c535e6`) is set in `app.config.ts` → `extra.eas.projectId`;
no `EAS_PROJECT_ID` variable is needed. The id is not a secret.

### c) Firebase (Android delivery)
1. Firebase console → create a project → **Add app → Android**, package name `com.edufyacademy.student`.
2. Download **google-services.json** and save it as `app/google-services.json`. It is git-ignored.
   For EAS cloud builds, upload it as a *file* environment variable named `GOOGLE_SERVICES_JSON`.
3. Firebase → Project settings → **Service accounts → Generate new private key** (JSON).
4. `eas credentials` → Android → *production/development* → **Google Service Account → FCM V1** →
   upload that JSON. Expo stores it on its servers. **Never put this file in the app or in git.**

### d) Build a development or production app (Expo Go can't receive push)
```bash
eas build -p android --profile development     # or: npx expo run:android
eas build -p android --profile preview         # installable APK
```

### e) Server environment (`.env` next to server.ts)
| Variable | Needed | Purpose |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | **yes** | The sender writes notification records and reads device tokens |
| `EXPO_ACCESS_TOKEN` | only if you turn on *Enhanced push security* on expo.dev | Authorises sends |
| `PUSH_WORKER_ENABLED` | optional | `false` disables the background sender (e.g. on a second server) |

The worker runs inside the Express process. **The server must stay running** for scheduled and
automatic notifications to go out. Deploy it on an always-on host (VM, Render/Railway "web
service", etc.), not a serverless function that sleeps. Several instances are safe: jobs are
claimed with `FOR UPDATE SKIP LOCKED`.

## 2. Android notification permission
* Android 13+ asks the student to allow notifications (`POST_NOTIFICATIONS` is declared). The app
  asks only when the student taps **Turn on** (Home card, Notification centre or Notification settings).
* If the student denied it, the app links to the phone's settings. It does not keep asking.
* Channels created by the app: Important announcements, New courses & bundles, Offers & discounts,
  Your learning, Learning reminders. Students can change each channel in Android settings.
* Delivery while the app is closed depends on the phone. Battery savers on some brands (Xiaomi,
  Oppo, Vivo, etc.) can delay or block pushes for apps that were swiped away.

## 3. What each status means (admin dashboard)
| Shown | Meaning | Source |
|---|---|---|
| Students targeted | Students in the audience after their notification preferences | database |
| Notification centre | In-app records created (works even without push) | database |
| Devices attempted | Registered phones a push was sent to | ticket log |
| Accepted by Expo | Expo Push Service accepted the message (push ticket `ok`) | Expo ticket |
| Handed to Google/Apple | Expo passed it to FCM/APNs (push receipt `ok`, checked ~15 min later) | Expo receipt |
| Opened in app | Student opened it in the notification centre (`read_at`) | database |

Android does not report whether a notification was displayed, so "delivered to the screen" is
not shown. Nothing on the dashboard is estimated.

## 4. Safety rules built in
* Only admins (`profiles.role = 'admin'`) can create, schedule, send or cancel notifications. Every
  admin route checks this on the server, and RLS blocks direct table writes.
* Students can read, mark read and delete **only their own** notifications. They can change only `read_at`.
* Payloads are validated on the server and again by database CHECK constraints (length, https-only
  images and links, whitelisted in-app routes). The app re-validates every link before opening it.
* No duplicate sends:
  * Each (notification, device) pair is reserved before sending, so a resumed send never pushes twice.
  * Each course or bundle is announced once ever (`push_announced`).
  * A form submitted twice returns the original (idempotency key).
* Expo errors: 429/5xx are retried with backoff; other errors are not retried. `DeviceNotRegistered`
  tokens are deleted. Interrupted sends resume up to 3 times and are then marked failed.
* Logout removes the device token before signing out, and the token moves to whichever account
  signs in next on that phone.
* Admin write endpoints are rate limited (30/min per admin; test sends 5/min).

## 5. Manual test checklist (real Android phone, development build)
- [ ] Sign in → Home shows "Never miss a new course" → Turn on → allow → device appears in Admin → Push notifications (Registered devices +1)
- [ ] Deny permission → Notification settings shows "turned off" + Open phone settings
- [ ] Admin → Automation → **Send test to my devices** (sign in to the app with the admin account)
- [ ] App open: send → banner appears + bell badge updates
- [ ] App in background: send → system notification → tap opens the right screen
- [ ] App swiped away: send → tap → app starts, splash, then the right screen
- [ ] Signed out: tap → sign-in → after sign-in the right screen opens
- [ ] Image notification shows the picture when expanded
- [ ] Mark read / mark all / delete / clear all in the notification centre
- [ ] Two phones on one account both receive; sign out on one → it stops receiving
- [ ] Schedule for +3 min → arrives; schedule another → Cancel → never arrives
- [ ] Publish a new course → "New Course Available!" after the delay; edit the course → nothing new
- [ ] Publish a bundle → "New Course Bundle Available!"
- [ ] Create an offer with "Announce" → arrives; expired offer → app shows "This offer has ended"
- [ ] Turn off "Offers & promotions" in the app → next offer push is not received
- [ ] Complete every lesson of a course → "Course completed!" push → opens certificates
