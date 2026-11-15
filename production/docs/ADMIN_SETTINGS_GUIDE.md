# Edufy Academy: Admin Settings & Configuration Guide

**Admin panel → Settings & Configuration** (`/admin/settings`) is the single place to manage the website and the
student app without code changes.

## One-time setup (before first use)
1. **Database:** Supabase → SQL Editor → run the whole `supabase/RUN_IN_SQL_EDITOR.sql` (safe to run again). It creates:
   - the settings tables
   - the encrypted credentials table
   - the media library and the public `site-assets` storage bucket
   - admin permissions and the audit log
   - website/app banner fields
2. **Server:** add `SETTINGS_ENCRYPTION_KEY` (32 random bytes, base64) to the backend environment and restart the server once.
   - Without it, everything works except saving payment, email or Emovur keys from the panel (the server then keeps using its environment keys).
   - **Never change this key after you start saving credentials.**
3. **Server code:** deploy the updated backend (`server.ts` + `server/`) and website (`dist`).

## How changes reach the website and app

```
Admin saves ──► Express server validates ──► site_settings (Supabase) ──► audit log
                                   │
                                   └─► caches cleared ──► GET /api/settings/public
                                                          ├─► Website: reloads at once (admin's browser), visitors within 5 min / on next visit
                                                          └─► App: on next open / return to foreground, at most 15 min while open
```

- **Website:** if the API isn't reachable, it reads the same public values from the `get_public_settings()` database function.
- **App:** keeps the last copy on the phone, so it works offline.
- **Secrets:** private values (email templates, credentials) are **never** in the public payload.

## Sections

| Section | What you can change | Where it shows |
|---|---|---|
| **General** | Website/app name, website URL, company name and address, tagline, description, footer copyright (`{year}`), country code | Header/footer logo text, page titles, emails, app headers |
| **Branding & Logo** | Main, light-background, dark-background, login, app, splash, favicon and email logos (preview, replace, remove, built-in fallback) | Website header/footer/login, browser tab, emails, app logo, app splash |
| **Website Banners** | Homepage slider: title, subtitle, description, button text, link (course / bundle / blog post / web link), desktop and mobile images, order, schedule, on/off, website/app/both | Top of the website homepage (nothing changes there until a banner is live) |
| **Mobile App Banners** | Same for the app home slider (also links to offers) | App Home |
| **Images & Media** | Upload many images, search, filter by type, copy URL, replace (updates every place it is used), delete unused | Used by every image field |
| **Contact Information** | Phones, support/sales emails, address, Google Maps link, business hours, contact page text | Footer, contact page, maintenance page, app support |
| **Social Media Links** | Add, edit, enable/disable, reorder or delete platforms (Facebook, Instagram, YouTube, LinkedIn, X, Reddit, Pinterest, Telegram, WhatsApp, Other with your own icon) | Website footer, app profile |
| **Payment Gateway** | Payments on/off, display name, checkout instructions, Razorpay keys (test or live), server-side test, activation, webhook status | Website checkout, app checkout, server |
| **WhatsApp** | Button on/off, number, button text, welcome and support messages, Emovur API credentials (stored securely) | Floating website button, contact page, app support |
| **Email** | Sender name and email, reply-to, templates (welcome, payment, enrollment, certificate) with preview, Resend/Brevo key, test email | Emails sent by the server |
| **SEO** | Title, meta description, keywords, sharing image, indexing on/off, Google Analytics ID, Search Console code | Page `<head>`, `robots.txt` |
| **App Configuration** | Support phone/email/WhatsApp, help/support URLs, which Home sections show, notice bar, latest and minimum version, store links, update message | App |
| **Notifications** | Global push on/off, promotional/offer switches, default title/content, new course/bundle announcements | Existing push system (same history and devices) |
| **Maintenance Mode** | Website maintenance page, app announcement, message, start/end time, show contacts, push announcement | Website / app |
| **Audit Log** | Who changed what, old → new (non-secret) values, success/failure | Admin |
| **Admin Permissions** | Restrict admins to chosen sections; grant instructors specific sections (super admins only) | Admin |

## Payment gateway: safe key change
1. **Payment Gateway → Razorpay credentials.** Choose **Test** or **Live**, paste the Key ID and Key Secret (and the webhook secret if you use one), then **Save securely**. Live keys ask for your admin password.
2. The keys are stored **encrypted as "pending"**. Real payments keep using the current keys.
3. **Test configuration.** The server checks:
   - that the keys are valid
   - that it can connect to Razorpay
   - that it can create a ₹1 test order, which is never charged
   - signature verification
   - the webhook
   - that enrollment is ready
4. **Activate.** This works only after the test passes; live keys ask for your password again. New payments use the new keys immediately; payments already in progress still verify for 24 hours.
5. **Use environment keys** goes back to the keys in the server environment (password required).

Supported payment methods (UPI, cards, net banking, wallets) are switched on or off in the Razorpay Dashboard.

## Images
- **Formats:** PNG, JPG, WebP and GIF. SVG is allowed for logos, icons and category images, and is checked for scripts. ICO is allowed for favicons.
- **Optimisation:** large photos are resized in your browser and converted to WebP when that makes them smaller. Logos keep transparency.
- **Size limits by type:** for example, website banners need at least 1200×300 px and at most 3 MB. The upload form shows the recommended size.
- **Replace** uploads a new file, points every page/setting/banner/course that used the old image at the new one, then removes the old file.
- **Delete** is refused while an image is in use (the list shows where).

## When does a change take effect?

| Change | Takes effect |
|---|---|
| Banners (website and app) | **Immediately** (database); app on next refresh |
| Contact, WhatsApp, social, general, SEO (browser), branding logos, payment on/off, app configuration, maintenance, notification switches | **Immediately** on the website; app within minutes (next open / foreground) |
| Razorpay / email / Emovur keys | **Immediately after Activate** (other server copies within 60 s). **No restart** |
| `SETTINGS_ENCRYPTION_KEY`, any value in the server environment | **Backend restart** |
| SEO tags in the HTML for crawlers + `robots.txt` | Immediately when the Node.js server serves the website. On static hosting (public_html), tags apply in the browser only |
| App icon, adaptive icon, notification icon, native splash image, app name under the icon, package name, permissions, version number, signing key | **Mobile app rebuild** (`eas build`) and store update |
| Website code or design changes | **Website rebuild** (`npm run build`) and upload |
| Supabase sign-up confirmation email, Supabase Site URL / redirect URLs, Razorpay webhook, Razorpay payment methods, Resend/Brevo sender domain, Firebase / FCM | **External provider configuration** |

## Who can do what

| Role | Access |
|---|---|
| Super admin | Everything, including payment credentials and permissions. Every existing admin is a super admin until restricted |
| Admin (restricted) | Only the sections ticked in Admin Permissions. Never payment credentials or permissions |
| Instructor | Nothing unless a super admin grants sections (never payment) |
| Student | No access |

A super admin cannot remove their own super-admin rights, so the panel can't be locked out.
