# GitHub → Hostinger automatic deployment

Two repositories, each connected to its own Hostinger website. Every push to `main` builds and publishes the new
version automatically (about 1–3 minutes).

| | Website | API |
|---|---|---|
| GitHub | `cellicella/edufyacademy-website` (private; this project folder) | `cellicella/edufyacademy-api` (private, generated from `server.ts`, `server/`, server tests) |
| Hostinger site | `edufyacademy.com` | `api.edufyacademy.com` |
| Hostinger app type | Node.js app, framework **Vite** (static output) | Node.js app, framework **Express** |
| Node.js | 22 | 22 |
| Build | `npm install` → script `build:web` (`vite build`) | `npm install` → script `build` (esbuild) |
| Output / entry | output directory `dist` | entry file `server-dist/server.mjs` |
| Environment variables (hPanel → Node.js) | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_API_BASE_URL`, `VITE_SITE_URL` (all public) | `NODE_ENV`, `CORS_ORIGINS`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SETTINGS_ENCRYPTION_KEY`, `CRON_SECRET` (+ optional Razorpay, Adilo, SMTP) |

The website build stops (and the live site stays as it is) when the Supabase values are missing, so a broken
site is never published. `public/.htaccess` is part of the build: HTTPS + `www` → `https://edufyacademy.com`,
`/api` → 404, and page refreshes on any route work.

## Pushing changes
Double-click **`PUSH-TO-GITHUB.cmd`** in the project folder (or run it with `-Message "What changed"`).
It commits this folder to the website repository and regenerates the API repository, then pushes both.
Before each commit it refuses `.env` files, keys, zips and anything that looks like a secret.
Options: `-WebsiteOnly`, `-ApiOnly`.

Requirements on the PC: Git for Windows (https://git-scm.com/download/win). The first push opens a GitHub sign-in
window (Git Credential Manager); after that it remembers the login.

## Never in Git
`.env`, `.env.local`, `app/.env`, `*.env` (for example the downloaded `api-edufyacademy.env`), keys and
keystores, `google-services.json`, zips, `dist/`, `server-dist/`, `node_modules/`, `Claude outputs/`,
`Edufy-Academy-Production/`. Secrets live only in hPanel (API), EAS (app) and your password manager.

## One-time setup
1. Run `PUSH-TO-GITHUB.cmd` once: it creates both private repositories (if missing) and pushes. **Manual (your PC)**
2. hPanel → connect GitHub (Hostinger GitHub app) with access to both repositories. **Manual**
3. Connect each repository to its website with the settings above and auto-deploy from `main` (done by Claude
   through the Hostinger API once 1–2 are done).

The old public repository `cellicella/edufyacademynew` is no longer used; archive or delete it on GitHub when you
are ready.

## Rolling back
hPanel → Websites → the site → Node.js → Deployments: redeploy an earlier build. Or revert the commit on GitHub;
the revert is deployed like any push.

## Checking a deployment
- hPanel → Node.js → Deployments shows the build log.
- Website: https://edufyacademy.com, refresh https://edufyacademy.com/courses (must not 404).
- API: https://api.edufyacademy.com/api/health → `"status":"ok"` and `"supabase":{"configured":true…}`.
