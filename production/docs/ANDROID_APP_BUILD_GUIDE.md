# Android app: production build and Google Play

The app is not uploaded to Hostinger. It is installed from Google Play (AAB) or as a test APK, and talks to
`https://api.edufyacademy.com` and Supabase over the internet. Both must be live before you test the app.

## Current configuration (checked in `app/app.config.ts` and `app/eas.json`)
| Item | Value |
|---|---|
| App name | Edufy Academy |
| Android package | `com.edufyacademy.student` (cannot change after the first Play upload) |
| Version | 1.0.0, versionCode managed by EAS (`appVersionSource: remote`, auto-increment on production builds) |
| Icon / adaptive icon / splash | `app/assets/images/icon.png`, `adaptive-icon.png` (background #004AAD), `splash-icon.png` |
| Expo SDK | 58 |
| Deep link scheme | `edufyacademy://` (password reset, Google sign-in return) |
| Google sign-in | system browser + Supabase OAuth (no native module needed) |
| Push | Expo push + Firebase (`google-services.json`) |
| Build profiles | `preview` → APK (internal testing), `production` → AAB (Play Store) |
| Safety check | preview/production builds stop if the API, website or Supabase address is not public https |

## 1. One-time setup (on your PC, in the `app` folder)
```
cd app
npm ci
npx eas-cli login              (your expo.dev account)
npx eas-cli init               (links the project; prints the project id: set EAS_PROJECT_ID)
```

## 2. Production settings in EAS
expo.dev → your project → **Project settings → Environment variables** → add for environments **production** and
**preview** (or with the CLI as shown):
```
npx eas-cli env:create --environment production --environment preview --name EXPO_PUBLIC_API_URL --value https://api.edufyacademy.com --visibility plaintext
npx eas-cli env:create --environment production --environment preview --name EXPO_PUBLIC_WEB_URL --value https://edufyacademy.com --visibility plaintext
npx eas-cli env:create --environment production --environment preview --name EXPO_PUBLIC_SUPABASE_URL --value https://tyqdyfecdvclwsvcahod.supabase.co --visibility plaintext
npx eas-cli env:create --environment production --environment preview --name EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY --value <publishable key> --visibility plaintext
npx eas-cli env:create --environment production --environment preview --name EAS_PROJECT_ID --value <project id> --visibility plaintext
npx eas-cli env:create --environment production --environment preview --name GOOGLE_SERVICES_JSON --type file --value .\google-services.json --visibility secret
```
If your eas-cli version does not accept two `--environment` flags in one line, run each line once per environment.

`google-services.json`: Firebase console → your project → Android app `com.edufyacademy.student` → download.
Push credentials: expo.dev → Credentials → Android → FCM V1 service account key (upload once).

Supabase must allow the app’s return address: Redirect URLs include `edufyacademy://**`.

## 3. Signing credentials
On the first Android build EAS asks “Generate a new Android Keystore?” → **Yes**. EAS stores it securely; download a
backup at expo.dev → Credentials → Android → Keystore → Download, and keep it safe. Never commit it.
With Google Play App Signing (default), Google holds the final app signing key and this keystore is the “upload key”.

## 4. Test APK (preview)
```
npx eas-cli build -p android --profile preview
```
When it finishes, EAS shows a link/QR code: open it on an Android phone and install. Test with mobile data against the
live API (see PRODUCTION_TESTING_CHECKLIST.md → Mobile app).

## 5. Production AAB
```
npx eas-cli build -p android --profile production
```
Download the `.aab` from the build page (it is also in expo.dev → Builds). Optional upload from the CLI:
`npx eas-cli submit -p android --profile production` (needs a Google Play service-account key; eas.json submits to the
**internal** track as a draft).

## 6. Google Play Console (first release)
1. https://play.google.com/console → **Create app** → name Edufy Academy, language, App, Free → accept declarations.
2. **Test and release → Testing → Internal testing → Create new release** → upload the `.aab` → add release notes →
   Save → Review → Start rollout to internal testing. Add tester emails under **Testers**.
3. Complete **Grow users → Store presence → Main store listing**: short/long description, icon 512×512, feature graphic
   1024×500, at least 2 phone screenshots.
4. **Policy and programs → App content**: privacy policy `https://edufyacademy.com/privacy`, app access (give a test
   student login for reviewers), ads (no), content rating questionnaire, target audience, data safety (account info:
   name, email, phone; purchase history; app activity; data encrypted in transit; users can request deletion).
5. When internal testing is fine: **Production → Create new release** → promote the same build → review → roll out.
   New personal developer accounts may first need a closed test with testers before production access.

## 7. Native Google account picker (optional, later)
The app uses Google sign-in through the browser, which works in all builds. Google’s native Android account picker
(`@react-native-google-signin/google-signin`, Credential Manager) needs a new native package, a development build and
the SHA-1 fingerprints of the upload key (expo.dev → Credentials) and the Play app-signing key (Play Console → Setup →
App signing), registered as Android OAuth clients. Not required for release.

## 8. Official Google “G” on the app button
Download Google’s sign-in assets (developers.google.com/identity/branding-guidelines), save the “G” PNG as
`app/assets/images/google-g.png`, and in `app/src/components/GoogleButton.tsx` replace
`const GOOGLE_MARK: number | null = null;` with `const GOOGLE_MARK: number | null = require('../../assets/images/google-g.png');`.
Then rebuild.
