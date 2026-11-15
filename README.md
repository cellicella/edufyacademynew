# Edufy Academy

Online learning platform by Educurist Learning Solutions — **https://edufyacademy.com**

| Part | Folder | Runs on |
|---|---|---|
| Website (React + Vite) | `src/`, `public/`, `index.html` | Hostinger, deployed from this repository on every push to `main` |
| API (Express) | `server.ts`, `server/` | Hostinger `api.edufyacademy.com`, deployed from `cellicella/edufyacademy-api` (generated from these files) |
| Mobile app (Expo) | `app/` | Google Play via EAS builds |
| Database & auth | `supabase/` | Supabase |

- Deployment and pushing changes: `production/docs/GITHUB_AUTODEPLOY_GUIDE.md` (double-click `PUSH-TO-GITHUB.cmd`).
- Environment variables: `production/docs/PRODUCTION_ENVIRONMENT_VARIABLES.md`. Secrets are never stored in Git.

## Local development
```
npm install
npm run dev        # website + API on http://localhost:3000 (needs .env.local, see .env.example)
npm test
npm run build:web  # production website build in dist/
```
