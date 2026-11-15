# Edufy Academy: student app (Expo / React Native), production notes

Source code of the Android/iOS student app (no `node_modules`, no native folders, no `.env`, no keystores).

| Setting | Value |
|---|---|
| App name | Edufy Academy |
| Android application id | `com.edufyacademy.student` |
| Deep-link scheme | `edufyacademy://` |
| Expo SDK / React Native | SDK 58 / RN 0.88 (new architecture) |
| Build profiles (`eas.json`) | `development` (dev client APK) · `preview` (installable APK) · `production` (Play Store AAB) |
| Version code | managed by EAS (`appVersionSource: remote`, auto-increment on production builds) |
| Permissions | `INTERNET`, `POST_NOTIFICATIONS` |

## Build
```
npm ci
npx eas-cli login
npx eas-cli init                                     # first time only: links the Expo project
npx eas-cli build -p android --profile preview      # APK for testing
npx eas-cli build -p android --profile production   # AAB for Google Play
```
Before building, add the production settings on **expo.dev → project → Environment variables**
(see `.env.example` and `documentation/ENVIRONMENT_VARIABLES.md`). Preview/production builds **stop on purpose**
if the API, website or Supabase address is missing, not https, or a localhost/LAN address.

Full step-by-step: `documentation/DEPLOYMENT_GUIDE.md` → part C.
