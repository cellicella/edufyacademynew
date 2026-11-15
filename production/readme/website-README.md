# Edufy Academy: website (production build)

`dist/` is the finished, optimised website (minified JavaScript and CSS, fingerprinted assets, no source maps).
Upload the **contents** of `dist/`, not the folder itself and never the whole project.

| File | What it is |
|---|---|
| `dist/index.html` | Page shell. Every route (`/courses`, `/blog/...`, `/admin/...`) is served from it. |
| `dist/assets/` | JavaScript, CSS and images (cache-safe file names) |
| `dist/brand/`, `favicon.ico`, `apple-touch-icon.png` | Official logo and icons |
| `dist/config.js` | **Deployment settings you can edit after upload** (API address, site address) |
| `dist/.htaccess` | Hostinger/Apache rules: refresh on any route works (no 404), caching, security headers |

`.env.example` lists the build-time public settings (`VITE_*`). The Supabase URL and publishable key are built in from your PC's settings when you run the build script.

Pick a deployment option in `documentation/DEPLOYMENT_GUIDE.md`:
- **Option A:** website + API in one Hostinger Node.js app. Use `upload-ready/backend-with-website.zip`; you don't upload this folder separately.
- **Option B:** this `dist/` in `public_html` + the API on a sub-domain. Set `apiBaseUrl` in `config.js`.
