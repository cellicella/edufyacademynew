# Import from Adilo (Admin → Bulk lesson importer)

Browse your Adilo library from the admin panel and turn videos into lessons — new lessons, or videos attached to
existing lessons in bulk. The CSV importer is unchanged and sits next to it.

## Setup (once)
hPanel → Websites → **api.edufyacademy.com** → Node.js → Environment variables → add:
```
ADILO_PUBLIC_KEY=<public key from Adilo → Settings → API Keys>
ADILO_SECRET_KEY=<secret key>
```
Save and restart the API. Check: https://api.edufyacademy.com/api/health?check=adilo shows `"adiloLive":{"ok":true,…}`.
The keys stay on the server; the website, app and GitHub never see them.

## Use it
1. Admin → Bulk lesson importer → choose the course and the section (existing, or name a new one).
2. Switch to **Import from Adilo** → choose the project → search / tick videos (title, duration and video ID shown;
   videos already in the course are greyed out).
3. **Create new lessons** — one video lesson per video, titles editable, added in title order (1, 2, 10…).
   **Attach to existing lessons** — pick a video per lesson, or press **Match by title**; tick
   *Replace existing videos* to change lessons that already have one. Confirm.

## What is saved (existing lesson fields)
`adilo_file_id` (video ID), `adilo_project_id`, `adilo_embed_url` (player link), `video_title`, `video_duration`
(seconds), `duration_minutes`, `video_status = library`, `video_metadata.source = adilo_api`. Playback on the website
and in the app uses the same `adilo_embed_url` as before.

## How the player link is obtained (not guessed)
- Adilo’s API documentation (developers.adilo.com) and its real responses contain **no embed URL**.
- Adilo’s watch pages advertise an **oEmbed** endpoint (standard oEmbed discovery). For each video the server calls
  `https://adilo.bigcommand.com/web/oembed?format=json&url=https://adilo.bigcommand.com/watch/<video ID>` and stores
  the `src` of the iframe in Adilo’s own embed code — only if Adilo answers with a player for that same video ID.
  Videos without a player (still processing / unpublished) are reported as failed and nothing is saved.
- Verified on 18 Nov 2026: API file `NxSjM8fj` → oEmbed returned `<iframe src="https://adilo.bigcommand.com/watch/NxSjM8fj">`;
  an unknown ID returned 404. Existing production lessons use the same `…/watch/<ID>` format.

## Safety
- Admin-only; every video is re-checked with Adilo on the server before anything is written.
- Duplicates: a video already used anywhere in the course (by ID or player link) is skipped; a video selected
  twice is skipped. Lessons that already have a video are left alone unless *Replace* is ticked. Quiz/article
  lessons never get a video.
- Library videos are **never deleted from Adilo** by Edufy: the lesson editor’s “Remove” only detaches the video,
  and the server refuses Adilo deletes for videos that were not uploaded through Edufy.

## Checking the live API shape
The Adilo docs show no response examples, so fields are read defensively. After connecting, an admin can open
`GET /api/admin/adilo/inspect` (signed in) to see the field names and types of the live responses (no values).
If videos don’t show their folder, it is because the API does not return folder information for files.
