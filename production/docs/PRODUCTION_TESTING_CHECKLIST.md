# Production testing checklist (edufyacademy.com)

Test on the live addresses after deployment. Use a real phone on mobile data for the app.
Mark each line: ✅ pass · ❌ fail (note what happened) · ⏭ not applicable.

## Hosting
| # | Check | How | Expected |
|---|---|---|---|
| H1 | HTTPS + canonical | open `http://www.edufyacademy.com` | ends on `https://edufyacademy.com`, padlock |
| H2 | Assets | F12 → Network → reload homepage | no red (404) requests; logo + favicon show |
| H3 | SPA routing | open `/courses`, `/blog`, `/student/courses`, press F5 on each | page loads, no 404 |
| H4 | API not on main domain | `https://edufyacademy.com/api/health` | 404 |
| H5 | Backend health | `https://api.edufyacademy.com/api/health` | `status: ok` |
| H6 | API connectivity + CORS | courses page loads data; F12 console has no CORS errors | data from `api.edufyacademy.com` |
| H7 | Cron | `https://api.edufyacademy.com/api/internal/cron?key=…` | `ok: true`; Hostinger cron job runs every 5 min |
| H8 | Razorpay webhook | after a test payment: Admin → Payment Gateway | “Last verified webhook” shows a time |
| H9 | Supabase auth URLs | Supabase → Authentication → URL Configuration | Site URL `https://edufyacademy.com`, no localhost |
| H10 | Email redirects | register a new account | confirmation link opens `https://edufyacademy.com/auth/callback` |

## Website
| # | Check | Expected |
|---|---|---|
| W1 | Homepage, banners, categories | load quickly, correct logo |
| W2 | Navbar on desktop, tablet, phone | no demo switcher; search, wishlist, cart and account menu aligned |
| W3 | Register (email) | confirmation email arrives; link verifies; welcome email arrives once |
| W4 | Login (email) / logout | dashboard opens; logout returns to public site |
| W5 | Google login / sign-up | Google account picker → back on Edufy signed in (existing email → same account and enrollments) |
| W6 | Forgot password | email arrives; link opens `/reset-password`; new password works |
| W7 | Course catalog, categories, bundles, blog | lists and detail pages open |
| W8 | Video playback | enrolled course plays (Adilo); locked lessons stay locked |
| W9 | Payment (small live amount or test mode) | Razorpay opens; after paying, course appears in My courses; purchase email once |
| W10 | Admin panel | `/admin` opens for admin only; a student account gets no admin access |
| W11 | Admin → SMTP test email | “accepted for delivery” and email received |
| W12 | Contact page, WhatsApp, social links | correct numbers/URLs open |
| W13 | Certificates | claim + `/verify-certificate?code=…` works |

## Mobile app (installed APK/AAB build, mobile data)
| # | Check | Expected |
|---|---|---|
| M1 | Splash | Edufy splash, then onboarding/home |
| M2 | Sign-in screen | logo, “Continue with Google” first, email + password, show/hide password, forgot password, create account link; fits small phone, no clipped buttons with keyboard open |
| M3 | Sign-up screen | name, email, mobile with country code, password strength, confirm, terms; invalid inputs show messages; existing email offers “Sign in instead” |
| M4 | Google login | browser opens Google, returns to app signed in. If Google is not set up: button disabled with a clear note (never a fake login) |
| M5 | Email login + session persistence | close and reopen the app: still signed in |
| M6 | Large font | Android Settings → Display → Font size max: screens still scroll, nothing cut off |
| M7 | Home, catalog, bundles, blog | load from the live API |
| M8 | Video player + next-video autoplay | plays; next lesson starts |
| M9 | Payment + enrollment sync | buy in app → course appears in app and on the website |
| M10 | Certificates | list + share |
| M11 | Push | Admin → Push Notifications → send test → arrives on the phone |
| M12 | Password reset link | email link opens the app reset screen |
| M13 | Logout | returns to sign-in; another account sees only its own data |

## Sign-off
Tested by: ______  Date: ______  Website build date: ______  App build/version: ______
