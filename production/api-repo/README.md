# Edufy Academy API

Express backend for https://edufyacademy.com, live at **https://api.edufyacademy.com** (health check:
`/api/health`).

> This repository is generated from the main Edufy Academy project (`server.ts`, `server/`, server tests).
> Make changes there and run `PUSH-TO-GITHUB.cmd` in the project folder: it updates the website repository
> and this one. Changes made directly here are replaced by the next push from the project.

## Deployment (automatic)
Hostinger (Business plan, Node.js app on `api.edufyacademy.com`) deploys every push to `main`:

| Setting | Value |
|---|---|
| Framework | Express |
| Node.js | 22 |
| Install | `npm install` |
| Build script | `build` (esbuild → `server-dist/server.mjs`) |
| Entry file | `server-dist/server.mjs` |

## Environment variables
Set in hPanel → Websites → api.edufyacademy.com → Node.js → Environment variables (never in this repository).
Names and meaning: see `.env.example`. Required: `NODE_ENV`, `CORS_ORIGINS`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `SETTINGS_ENCRYPTION_KEY`, `CRON_SECRET`.

## Background jobs
Hostinger cron every 5 minutes: `curl -s "https://api.edufyacademy.com/api/internal/cron?key=<CRON_SECRET>"`
(sends queued emails and push notifications).

## Local development
```
npm install
npm run dev      # reads .env (copy .env.example)
npm test
```
