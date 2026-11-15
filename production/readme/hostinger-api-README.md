# Edufy Academy API: Hostinger Node.js app package

Upload this zip as a Node.js web app on `api.edufyacademy.com` (hPanel → Websites → Add website → Web App).

| Setting | Value |
|---|---|
| Framework | Express (or Other) |
| Node.js | 22.x (20.x also works) |
| Build command | none |
| Entry file | `server-dist/server.mjs` |

Environment variables: set them in the Hostinger dashboard (never upload a `.env` file). `.env.example` lists the names.
Required at minimum: `NODE_ENV=production`, `CORS_ORIGINS`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `SETTINGS_ENCRYPTION_KEY`, Razorpay keys, Adilo keys, `CRON_SECRET`.

Cron job (Advanced → Cron Jobs, every 5 minutes):
`curl -s "https://api.edufyacademy.com/api/internal/cron?key=YOUR_CRON_SECRET"`

Health check: https://api.edufyacademy.com/api/health

Full instructions: documentation/BACKEND_DEPLOYMENT_GUIDE.md
