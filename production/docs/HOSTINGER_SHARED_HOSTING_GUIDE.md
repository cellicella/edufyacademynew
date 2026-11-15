# Hostinger guide: website on edufyacademy.com

Your plan: **Hostinger Business Web Hosting**. Facts used below come from Hostinger’s own support pages
(November 2026).

## 1. Compatibility check (result)

| Need | Business plan | Result |
|---|---|---|
| Static React website (HTML/JS/CSS) with `.htaccess` routing | yes (regular website, `public_html`) | READY |
| Node.js / Express API | yes, as a **Node.js web app**: up to 5 per Business plan, Node 18/20/22/24 | READY (on `api.` sub-domain) |
| Environment variables | yes (Node.js app dashboard → Environment variables) | READY |
| HTTPS | certificates installed automatically for connected domains | READY |
| Inbound webhooks (Razorpay, Supabase email hook) | yes, normal HTTPS requests; each request stops after 120 s | READY (handlers answer in under a second) |
| Always-running background workers / endless timers | **not guaranteed**: Hostinger says they stop when the app is deployed or restarted | HOSTING LIMITATION → solved with a Hostinger **cron job** every 5 minutes (see BACKEND_DEPLOYMENT_GUIDE.md §6) |
| WebSockets, custom ports, Docker, Redis | not supported | not used by Edufy |
| Resources (current “Unlimited/Business” limits) | 2 CPU cores, 3 GB RAM, process limit 120 shared by all sites on the plan | enough for launch; a VPS is the next step if traffic grows |
| Request time limit | 120 seconds | very large video uploads on slow connections may hit it; use Adilo’s own uploader for huge files |

A VPS is **not required** for launch. Move the API to a Hostinger VPS (or similar) later if you see 503 errors from the
process limit, need guaranteed background workers, or traffic grows a lot. Nothing in the code changes for that.

## 2. Connect the domain (only if it is not connected yet)

Domain bought at Hostinger: it is already pointed (“the nameservers are set up automatically”). Skip to §3.

Domain bought elsewhere (GoDaddy, BigRock, …), choose **one** method:

- **Nameservers (recommended)**: hPanel → **Websites** → **Manage** (edufyacademy.com) → **Hosting plan → Plan details**
  → card **Nameservers**. Copy both values exactly as shown (Hostinger: “Always use the exact values shown in your
  dashboard”). At your registrar, replace the nameservers with these two.
  If you use email from another provider (e.g. Google Workspace), re-add its MX records in hPanel → DNS after the switch.
- **A records**: hPanel shows the hosting IP in the domain connection step (“Connect via DNS record”). At your registrar:
  delete existing A/AAAA records for `@` and A/CNAME records for `www`, then create
  `A  @  → <IP from hPanel>` and `A  www  → <IP from hPanel>`.

Propagation: usually a few hours, up to 24. Check at hPanel → DNS (“Live DNS checkup”) or https://dnschecker.org
(type `edufyacademy.com`, record A: every location should show the Hostinger IP).

## 3. SSL and the canonical address

1. hPanel → **Websites → Manage (edufyacademy.com) → Security → SSL**. Make sure a certificate is **Active** for
   `edufyacademy.com` **and** `www.edufyacademy.com` (install it there if it is not).
2. The included `.htaccess` sends `http://…` and `https://www.…` to **https://edufyacademy.com** with one 301 redirect.
   Canonical address: **https://edufyacademy.com (without www)**. If hPanel offers a “Force HTTPS” switch you may turn it
   on as well; the two do not conflict.
3. Upload `.htaccess` only after SSL is Active (otherwise visitors are redirected to an https address without a certificate).

## 4. Upload the website

You need: `Edufy-Academy-Production\upload-ready\hostinger-website-public_html.zip` from the build.
It contains `index.html`, `assets/` (JS, CSS, fonts), `brand/` (logos), `favicon.ico`, `apple-touch-icon.png`,
`config.js` (API = `https://api.edufyacademy.com/api`, site = `https://edufyacademy.com`), `.htaccess` and `robots.txt`.

1. Log in at https://hpanel.hostinger.com → **Websites** → **Manage** next to edufyacademy.com.
2. Left menu **Files → File Manager** → open **public_html** (this is the domain’s document root).
3. **Back up the current site**: in `public_html` select everything (tick the top checkbox) → right-click → **Compress**
   → name `backup-before-edufy-YYYY-MM-DD.zip` → **Compress** → right-click the zip → **Download**. Keep it.
4. Delete the old site files from `public_html` (not the backup zip; move it out of public_html or delete it after downloading).
   Keep `.well-known` if it exists.
5. Click **Upload** (top right) → choose `hostinger-website-public_html.zip` → wait until it shows 100%.
6. Right-click the zip → **Extract** → extract to `public_html` itself (the box should say `public_html`, or be empty / “.”).
   After extracting, `public_html` must directly contain `index.html`, `.htaccess`, `config.js` and `assets`.
   If you see `public_html/hostinger-website-public_html/index.html` instead, open that folder, select all → **Move** → `public_html`.
7. Delete the uploaded zip.
8. `.htaccess` is a hidden file: if you do not see it, File Manager → Settings (gear) → **Show hidden files**.

## 5. Check the website

| Check | How | Expected |
|---|---|---|
| Homepage | open https://edufyacademy.com | Edufy homepage, padlock in the address bar |
| Redirects | open http://www.edufyacademy.com | ends on https://edufyacademy.com |
| Nested routes | open https://edufyacademy.com/courses then press **F5**; also `/login`, `/student/courses` | page loads (no 404) |
| API path is not the website | https://edufyacademy.com/api/health | 404 (the API is on api.edufyacademy.com) |
| API connection | browser F12 → Network → reload the courses page | requests to `api.edufyacademy.com/api/...` with status 200 |
| config | https://edufyacademy.com/config.js | shows the api.edufyacademy.com address |
| Mobile | open the site on your phone (mobile data, not Wi-Fi) | layout fits, menu opens, login works |

## 6. Updating later
Run the build again, then repeat §4 steps 5–7 (upload and extract over the existing files). `config.js` can be edited in
File Manager at any time (right-click → Edit) without rebuilding.
