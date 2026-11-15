# Edufy Academy: backend (Express API)

This is the Node.js server that handles payments (Razorpay order + signature verification + enrollment),
secure video access, course publishing, lesson import (Adilo), certificates and push notifications.
**It cannot run on plain static hosting.** It needs a Node.js runtime: a Hostinger **Business** or **Cloud**
web hosting plan ("Node.js web app"), or a **VPS**.

| Path | Purpose |
|---|---|
| `server-dist/server.mjs` | Compiled production server (start this file) |
| `server.ts`, `server/` | Source code (for reference / rebuilding) |
| `package.json`, `package-lock.json` | Dependencies (lockfile = exact versions) |
| `scripts/verify-prebuilt.mjs` | "Build" step for Hostinger uploads (only checks the prebuilt file exists) |
| `supabase/` | Database migrations (`RUN_IN_SQL_EDITOR.sql`) and the email template |
| `.env.example` | Every server setting, with **placeholders only** |

## Commands
| | |
|---|---|
| Install (production only) | `npm ci --omit=dev` |
| Start | `npm run start:prod` (= `node server-dist/server.mjs`) |
| Health check | `GET https://<api-address>/api/health` → JSON with `"status":"ok"` |
| Rebuild after code changes (on your PC) | `npm run build` |

## Required environment variables (server only)
`NODE_ENV=production`, `CORS_ORIGINS`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `ADILO_PUBLIC_KEY`, `ADILO_SECRET_KEY`
(+ optional `ADILO_PROJECT_ID`, `EXPO_ACCESS_TOKEN`, `PUSH_WORKER_ENABLED`). See `documentation/ENVIRONMENT_VARIABLES.md`.

## How it behaves in production
- `NODE_ENV=production` disables test/simulated payments. Enrollment happens **only** after the Razorpay signature is verified on the server (or a verified webhook).
- If a `dist/` folder sits next to `server-dist/`, the server also serves the website (with SPA fallback). Otherwise it is API-only.
- Unknown `/api/...` routes and errors always return JSON (never the HTML page).
- CORS: only the origins in `CORS_ORIGINS` may call the API from a browser (the mobile app is unaffected).
- Run **one** copy with `PUSH_WORKER_ENABLED=true` (the default). It sends scheduled and automatic notifications.
