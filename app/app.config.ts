import type { ExpoConfig } from 'expo/config';
import fs from 'fs';
import path from 'path';

// Release builds block plain-http traffic on Android. Allow it only when the configured
// API is http:// (local testing). Production should always use an https:// API URL.
const apiUrl = process.env.EXPO_PUBLIC_API_URL || '';
// Development builds (EAS profile "development") talk to the Express server on your PC over http.
const allowCleartext = apiUrl.startsWith('http://') || process.env.EAS_BUILD_PROFILE === 'development';

// Store / tester builds must talk to the live, https server — never to a PC or emulator address.
// This check runs on the EAS build server (EAS_BUILD=true) for the "preview" and "production" profiles,
// so a misconfigured release fails at build time instead of shipping an app that can't connect.
const releaseProfile = ['preview', 'production'].includes(process.env.EAS_BUILD_PROFILE || '');
if (process.env.EAS_BUILD === 'true' && releaseProfile) {
  const bad = (name: string, v: string) =>
    !/^https:\/\/[^\s/]+/i.test(v) || /\/\/(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(v) ? `${name}="${v}"` : null;
  const problems = [
    bad('EXPO_PUBLIC_API_URL', apiUrl),
    bad('EXPO_PUBLIC_WEB_URL', process.env.EXPO_PUBLIC_WEB_URL || ''),
    bad('EXPO_PUBLIC_SUPABASE_URL', process.env.EXPO_PUBLIC_SUPABASE_URL || ''),
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ? null : 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY is empty',
  ].filter(Boolean);
  if (problems.length) {
    throw new Error(
      `[Edufy] ${process.env.EAS_BUILD_PROFILE} build stopped: these must be public https addresses (set them with "eas env:create"): ${problems.join(', ')}`
    );
  }
}

// Push notifications on Android go through Firebase Cloud Messaging. Put the google-services.json
// downloaded from Firebase next to this file (it is git-ignored), or upload it as an EAS file
// environment variable named GOOGLE_SERVICES_JSON.
const googleServicesFile =
  process.env.GOOGLE_SERVICES_JSON || (fs.existsSync(path.resolve('google-services.json')) ? './google-services.json' : undefined);

// EAS project id (links builds, updates and Expo push tokens to the project on expo.dev). It is not a
// secret. Fixed here so every build uses the same project; EAS_PROJECT_ID / EXPO_PUBLIC_EAS_PROJECT_ID
// are no longer needed (a different value there is ignored, so it can't point builds at another project).
const EAS_PROJECT_ID = '37cb3efb-c3fa-4181-8486-0f5161c535e6';
const easProjectId = EAS_PROJECT_ID;

const config: ExpoConfig = {
  name: 'Edufy Academy',
  slug: 'edufy-academy',
  // Student app targets Android and iOS only (secure session storage is not available on web)
  platforms: ['android', 'ios'],
  version: '1.0.0',
  orientation: 'default', // portrait UI, landscape allowed for fullscreen video
  icon: './assets/images/icon.png',
  scheme: 'edufyacademy',
  userInterfaceStyle: 'light',
  // newArchEnabled was removed: React Native 0.88 / Expo SDK 58 always run on the New Architecture,
  // and the option no longer exists in ExpoConfig.
  backgroundColor: '#F7F9FC',
  ios: {
    bundleIdentifier: 'com.edufyacademy.student',
    supportsTablet: true,
    infoPlist: {
      NSPhotoLibraryUsageDescription: 'Choose a profile picture for your Edufy Academy account.',
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: 'com.edufyacademy.student',
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon.png',
      backgroundColor: '#004AAD',
    },
    permissions: ['android.permission.INTERNET', 'android.permission.POST_NOTIFICATIONS'],
    ...(googleServicesFile ? { googleServicesFile } : {}),
  },
  plugins: [
    'expo-router',
    ['expo-build-properties', { android: { usesCleartextTraffic: allowCleartext } }],
    // Excludes SecureStore data from Android Auto Backup (restored keystore data can't be decrypted).
    // No biometric unlock is used, so no Face ID permission is requested.
    ['expo-secure-store', { configureAndroidBackup: true, faceIDPermission: false }],
    'expo-font',
    'expo-web-browser',
    'expo-sharing',
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-icon.png',
        imageWidth: 200,
        resizeMode: 'contain',
        backgroundColor: '#004AAD',
      },
    ],
    [
      'expo-notifications',
      {
        // Small status-bar icon: white glyph on transparent (Android tints it)
        icon: './assets/images/notification-icon.png',
        color: '#004AAD',
        defaultChannel: 'announcements',
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'Choose a profile picture for your Edufy Academy account.',
        cameraPermission: false,
        // Photos only: without this the plugin adds RECORD_AUDIO, which Google Play asks you to justify.
        microphonePermission: false,
      },
    ],
  ],
  experiments: { typedRoutes: false },
  extra: {
    router: {},
    eas: {
      projectId: easProjectId,
    },
  },
};

export default config;
