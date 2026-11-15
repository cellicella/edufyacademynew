# Android builds

The Android files are produced by **EAS Build** in Expo's cloud and need your Expo account, so they are not in this folder yet.

| File | Command | Where to get it |
|---|---|---|
| `edufy-academy-production.aab` (Google Play) | `npx eas-cli build -p android --profile production` | expo.dev → project → Builds → the build → **Download** |
| `edufy-academy-preview.apk` (direct install for testing) | `npx eas-cli build -p android --profile preview` | same page, or scan the QR code on a phone |

Put the downloaded files here for safekeeping. Never put the keystore here. EAS stores it for you:
download a backup with `npx eas-cli credentials` → Android → production → Keystore → Download, and keep it somewhere private.
