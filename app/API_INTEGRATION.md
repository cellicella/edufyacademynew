# API & data integration

The app adds **no new backend endpoints and no database changes**. It reuses the website's
Supabase tables (through RLS) and the existing Express routes.

## Supabase (publishable key, user JWT, RLS)

| Feature | Table / RPC | Access rule (existing RLS) |
|---|---|---|
| Catalogue | `courses` + `profiles:instructor_id` | Published courses are public |
| Curriculum outline | `rpc get_course_outline(p_course_ids)` | Titles/durations/types only — public |
| Lesson content | `course_sections → lessons(*)` | Returned only for free previews, enrolled students, course instructor, admins (`is_enrolled`) |
| Categories | derived from `courses.category / category_slug` | (no categories table exists) |
| Enrollments | `enrollments` (status = active) | Own rows only |
| Progress | `lesson_progress` | Own rows only; trigger `protect_video_progress` blocks self-completing Adilo video lessons |
| Profile | `profiles` | Read public, update own; trigger blocks role changes |
| Avatar | Storage bucket `avatars/<user-id>/…` | Users write only their own folder |
| Notifications | `enrollments`, `payments` (captured), latest `courses` | Own rows / public |

Sign-up sends `role: 'student'` metadata, exactly like the website; if no `profiles` row exists
after sign-in the app creates it with role `student` (same as the website's AuthContext).

## Express API (`EXPO_PUBLIC_API_URL` + `Authorization: Bearer <Supabase access token>`)

| Method & path | Used for | Server-side checks |
|---|---|---|
| `POST /api/payments/create-order` `{ courseId }` | Start a purchase | Auth; course must be published; price read from DB; already-enrolled rejected; free courses enrolled directly |
| `POST /api/payments/verify-payment` `{ razorpay_order_id, razorpay_payment_id, razorpay_signature }` | Finish a purchase | HMAC signature verified with the Razorpay secret; courses granted from the server-side payment row; idempotent enrollment upsert |
| `GET /api/payments/history` | Payment history | Own payments only |
| `GET /api/lessons/:id/video` | Adilo player link + saved progress | Free preview of a published course, or active enrollment / instructor / admin |
| `POST /api/lessons/:id/video-progress` | Watch-time reporting | Active enrollment; watch time capped by wall-clock time; completes the lesson at 90% |

### Purchase flow

1. App → `create-order` → `{ orderId, amount, currency, keyId }` (public key id only).
2. App opens Razorpay (native SDK in dev/production builds; checkout.js in a WebView in Expo Go).
3. Razorpay returns `payment_id / order_id / signature` → app → `verify-payment`.
4. Server verifies the signature, marks the payment captured and creates the enrollment.
   The app never grants access itself; it refreshes enrollments after the server confirms.
   (The existing Razorpay webhook continues to work as a backup.)

### Video flow

1. `GET /api/lessons/:id/video` returns the validated `https://adilo.bigcommand.com/...` link.
2. The app renders it in a small HTML page inside `react-native-webview` (16:9, fullscreen
   allowed) and forwards the Adilo player's `postMessage` events (`ready`, `play`,
   `currentTime`, `paused`, `ended`) to React Native — only events from the Adilo origin.
3. Forward playback time (seeks ignored) is posted to `/video-progress` every 15 s and on
   pause / end / leaving the lesson / app backgrounding — same algorithm as the website.

## Security notes

* Only public values are in the app (`EXPO_PUBLIC_*`). Service-role keys and the Razorpay
  secret remain on the server.
* Sessions are stored in the OS keychain/keystore (chunked `expo-secure-store`).
* Lesson content, video links, payments and progress are all protected server-side (RLS +
  Express checks); hiding UI in the app is never the only protection.
* The app has no screens or calls for instructor/admin APIs; those routes check roles on the
  server regardless.
* Video/preview links are parsed to a validated URL; HTML from the database is never rendered.
