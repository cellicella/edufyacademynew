# Edufy Academy: Production Testing Checklist

Test on the **deployed** website and the **installed** app (preview APK or Play internal track),
with a fresh student account and your admin account. Mark each line ✅ / ❌ and note the date.

## Before testing
- [ ] `build-production.ps1` summary is all PASS (`documentation/BUILD_RESULTS.md`)
- [ ] `RUN_IN_SQL_EDITOR.sql` has been run in Supabase
- [ ] `https://<api-address>/api/health` shows `"status":"ok"`, Supabase `hasServiceRole: true`, Razorpay configured
- [ ] `https://<api-address>/api/health?check=razorpay` shows `"mode":"live"` (production)
- [ ] SSL padlock on the website and the API address

## Website
| # | Test | How | ✅/❌ |
|---|---|---|---|
| 1 | Homepage loads | open `https://your-domain.com`; logo, banners, courses visible; no console errors (F12) | |
| 2 | Refresh on deep routes | open `/courses`, a course page, `/blog`, `/admin`; press F5 on each; no 404 | |
| 3 | Registration | register with a new email | |
| 4 | Email verification | email arrives (check spam); button opens `https://your-domain.com/auth/callback` (never localhost); "Email verified" → dashboard | |
| 5 | Resend verification | register again, tap **Resend email** | |
| 6 | Login / logout | log in, refresh (stays logged in), log out | |
| 7 | Password reset | "Forgot password" → email → new password works | |
| 8 | Google login | **N/A**: not part of the current product | N/A |
| 9 | Course catalog | search, filters, sort, course details, curriculum outline | |
| 10 | Categories | categories page + footer links show admin-managed categories; hidden category not shown | |
| 11 | Bundles | bundle list, bundle details, price | |
| 12 | Blog | `/blog` list, open a post, images, share/SEO title; draft posts not visible | |
| 13 | Video playback | free preview plays while logged out; paid lesson locked until purchase; plays after purchase | |
| 14 | Razorpay payment | buy a low-priced course with real UPI/card (live keys) | |
| 15 | Enrollment after verified payment | course appears in My Learning immediately; Admin → payments shows *captured* | |
| 16 | Failed/cancelled payment | close the Razorpay window → no enrollment, clear message | |
| 17 | Webhook | Razorpay → Webhooks → recent deliveries show 200 | |
| 18 | Certificates | complete a short course → claim certificate → PDF downloads | |
| 19 | Admin LMS | create/edit course, upload media, publish, categories, blog post, bundles, push notification; no yellow API banner | |
| 20 | Social links | footer icons open the 6 official profiles (Facebook, Instagram, LinkedIn, X, Pinterest, Reddit) | |
| 21 | Mobile responsiveness | phone browser + DevTools device mode: menu, course page, checkout, admin tables | |
| 22 | Favicon / share preview | tab icon is the Edufy logo; sharing the link shows the logo | |

## Mobile app (Android)
| # | Test | How | ✅/❌ |
|---|---|---|---|
| 1 | App installs | preview APK or Play internal-testing link; icon and name "Edufy Academy" | |
| 2 | Splash screen | animated splash with logo, then the correct screen (onboarding / login / home) | |
| 3 | Registration | new account; verification email opens the website callback page | |
| 4 | Login | email + password | |
| 5 | Session persists | close the app fully, reopen; still logged in. Reboot phone; still logged in | |
| 6 | Course catalog | Explore, search, categories, course details | |
| 7 | Bundles | bundle list and details | |
| 8 | Video playback | lesson plays, fullscreen + rotation, progress saved | |
| 9 | Next video autoplay | finish a lesson → next lesson starts | |
| 10 | Certificates | claim + share/download PDF | |
| 11 | Blog | list + article | |
| 12 | Push notifications | allow permission; Admin sends a test; it arrives; tapping opens the right screen; Notification centre shows it | |
| 13 | Payment | buy a course in the app (Razorpay) | |
| 14 | Enrollment sync | course bought on the website appears in the app (pull to refresh) and the other way round | |
| 15 | Offline handling | airplane mode → friendly "offline" message; back online → recovers | |
| 16 | Logout | logs out, push stops for that account | |

## Sign-off
| Area | Tested by | Date | Result |
|---|---|---|---|
| Website | | | |
| Backend / payments | | | |
| Android app | | | |
