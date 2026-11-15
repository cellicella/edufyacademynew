# Adilo video hosting — setup

## 1. Environment (server only — `.env`, never `VITE_`)
```
ADILO_API_BASE_URL=https://adilo-api.bigcommand.com/v1
ADILO_PUBLIC_KEY=<Adilo → Settings → API keys>
ADILO_SECRET_KEY=<Adilo → Settings → API keys>
ADILO_PROJECT_ID=            # optional; auto-created as "Edufy Academy Lessons" if blank
```
Restart `npm run dev` after editing `.env`.

## 2. Database
`supabase/migrations/20261107000003_edufy_adilo_video.sql` (already applied to project tyqdyfecdvclwsvcahod):
- `lessons`: adilo_file_id, adilo_project_id, adilo_embed_url, video_title, video_duration, video_status, video_metadata, video_created_at, video_updated_at
- `adilo_uploads`: server-only log of uploads (RLS on, no client policies) — used to verify a file before it is attached to a lesson
- `lesson_progress`: watched_seconds, video_duration_seconds
- Trigger `protect_video_progress`: learners cannot mark Adilo lessons complete themselves; the server does after verifying watch time

## 3. Upload flow (per Adilo docs)
1. `POST /api/adilo/upload/start` → Adilo `POST /files/upload/start`
2. For each 10 MB part: `GET /api/adilo/upload/sign` → Adilo `GET /files/upload/get-signed-url/{uploadId}/{partNumber}?key=`; browser `PUT`s the part to the signed URL and reads the `ETag`. If storage CORS hides the ETag, the part is relayed through `POST /api/adilo/upload/part`.
3. `POST /api/adilo/upload/complete` → Adilo `POST /files/upload/complete` with `{ key, uploadId, parts:[{PartNumber, ETag}] }`
4. Save the course — the server attaches the file to the lesson only if this user uploaded it through Edufy (or is admin).

Replace = upload a new file, then the old one is deleted (`DELETE /files/{id}`). Delete removes the file from Adilo and clears the lesson.

## 4. Player
The Adilo API reference does not define an embed URL field. After upload the server looks for an `https://adilo.bigcommand.com/...` URL in the file response; if none is found, paste the embed link (or iframe code) from **Adilo → video → Share → Embed** into the lesson editor. Only `https://adilo.bigcommand.com/` links are accepted.

Recommended in Adilo: enable domain restriction to your Edufy domain so the embed cannot be played elsewhere.

## 5. Progress
The player listens to Adilo `postMessage` events from `https://adilo.bigcommand.com` (origin **and** iframe source are checked): ready, currentTime, play, paused, ended, playbackSpeedChange, resolutionChange, subtitleChange.
Only natural forward playback (≤5 s steps between `currentTime` events) counts as watched time. The server caps watch time by elapsed wall-clock time (max 2× speed) and marks the lesson complete at **90%** watched. Position is saved every 15 s, on pause, on end and when the tab is hidden.

Resume: the Adilo docs list no player command to seek, so learners see "You stopped at m:ss" and skip ahead in the player.
