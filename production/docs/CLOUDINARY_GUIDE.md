# Cloudinary image CDN

All images uploaded from the admin panel, the media library and the app's profile screen are stored in
Cloudinary (cloud `j2sjtw3l`) and delivered as AVIF/WebP at the size each screen needs. Videos (Adilo),
course materials and certificates are unchanged.

## How it works
| Part | What it does |
|---|---|
| `server/cloudinary.ts` | Signed Cloudinary REST client. Reads `CLOUDINARY_URL` from the API environment; the secret never leaves the server. |
| `server/images.ts` | Uploads, asset registry (`image_assets`: `secure_url` + `public_id`), migration + rollback, profile pictures (`POST /api/me/avatar`), clean-up of unused images. |
| `/api/upload` | Course, blog, category, bundle, offer and notification images → Cloudinary folder per type (`edufy/courses`, `edufy/blog`, …). Videos/materials → Supabase Storage as before. |
| Media library | Upload / replace / delete in Cloudinary. Replacing repoints every use, then deletes the old copy; images in use cannot be deleted. |
| Stored URL | `https://res.cloudinary.com/j2sjtw3l/image/upload/f_auto,q_auto/v…/edufy/…` — automatic format and quality everywhere, even in older app versions. |
| Website / app | `cdnImage(url, width)`, `cdnSrcSet`, `cdnAvatar` add the right width (website `src/lib/cdnImage.ts`, app `app/src/logic/cdnImage.ts`). Other URLs are left unchanged. |
| Clean-up | Hourly (via the 5-minute cron): Cloudinary images not used anywhere for **7 days** are deleted. |
| Fallback | Without `CLOUDINARY_URL` everything keeps using Supabase Storage. |

## Setup (once)
hPanel → Websites → **api.edufyacademy.com** → Node.js → Environment variables → **Add**:
```
CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@j2sjtw3l
```
Save, then redeploy/restart the API. Check: Admin → Settings → Images & media shows "Connected to Cloudinary".
Never put the key or secret in the website, the app, GitHub or chat.

## Migrating existing images
Admin → Settings → **Images & media** → Cloudinary image CDN:
1. **Dry run (no changes)** — lists every image, where it is used and what will be skipped.
2. **Migrate existing images** — copies images in batches of 5 (Cloudinary downloads the originals itself),
   checks each copy on the CDN, records it in `image_assets` (with the original URL), then updates the
   database addresses (exact matches only). Re-running continues where it stopped; failures are listed.
3. Check the website and app. The original files in Supabase Storage are **not deleted**.
4. **Restore original addresses** puts every migrated address back (Cloudinary copies are kept 7 days).

Migrated: Supabase Storage images and Unsplash images in courses, bundles, blog (cover, author photo,
inline images), categories, banners, offers, profile pictures, notifications, media library, settings.
Never migrated: Adilo images, videos, PDFs, private files, invalid values.

## Deleting the old Supabase files (later, after checking)
Only when the website and app have shown the Cloudinary images for a while: in Supabase → Storage, delete the
old files in `course-thumbnails` / `site-assets` / `avatars` that `image_assets.original_url` lists. Keep
`course-videos`, `course-materials` and `certificates`.

## Rotating the secret
Cloudinary → Settings → API Keys → generate a new key, update `CLOUDINARY_URL` in hPanel, restart the API,
then disable the old key.
