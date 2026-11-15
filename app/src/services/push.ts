import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { isRunningInExpoGo } from 'expo';
import { supabase } from '@/lib/supabase';
import { prefs } from '@/lib/secureStorage';

/**
 * Remote push notifications (Expo Push Service → FCM on Android / APNs on iOS).
 *
 * The app only registers its Expo push token with the student's account (register_push_device RPC,
 * row-level security on the server side). No push credentials live in the app: sending happens on
 * the Edufy server.
 */

export type PushStatus =
  | 'registered'
  | 'denied' // the student (or the OS) turned notifications off
  | 'undetermined' // not asked yet
  | 'expo_go' // Expo Go can't receive remote push notifications (needs a development build)
  | 'not_configured' // no EAS projectId in this build
  | 'unavailable' // emulator without Google Play services, web, etc.
  | 'error';

const TOKEN_KEY = 'push_token';

export const ANDROID_CHANNELS: { id: string; name: string; description: string; importance: Notifications.AndroidImportance }[] = [
  { id: 'announcements', name: 'Important announcements', description: 'Announcements and messages from Edufy Academy', importance: Notifications.AndroidImportance.HIGH },
  { id: 'courses', name: 'New courses & bundles', description: 'When new courses or bundles are published', importance: Notifications.AndroidImportance.HIGH },
  { id: 'offers', name: 'Offers & discounts', description: 'Special offers and promotions', importance: Notifications.AndroidImportance.DEFAULT },
  { id: 'learning', name: 'Your learning', description: 'Course updates, completions and certificates', importance: Notifications.AndroidImportance.HIGH },
  { id: 'reminders', name: 'Learning reminders', description: 'Daily study reminders you set in the app', importance: Notifications.AndroidImportance.DEFAULT },
];

/** Notification channels must exist before a push for that channel arrives (Android 8+). */
export async function ensureChannels() {
  if (Platform.OS !== 'android') return;
  await Promise.all(
    ANDROID_CHANNELS.map((c) =>
      Notifications.setNotificationChannelAsync(c.id, {
        name: c.name,
        description: c.description,
        importance: c.importance,
        lightColor: '#004AAD',
        vibrationPattern: [0, 200, 120, 200],
        showBadge: true,
      }).catch(() => undefined)
    )
  );
}

export const projectId: string | undefined =
  (Constants.expoConfig?.extra as any)?.eas?.projectId || (Constants as any).easConfig?.projectId || undefined;

/** Why push can't work in this build, if it can't. */
export function pushSupport(): PushStatus | null {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return 'unavailable';
  if (isRunningInExpoGo()) return 'expo_go';
  if (!projectId) return 'not_configured';
  return null;
}

export async function permissionStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
  try {
    const p = await Notifications.getPermissionsAsync();
    if (p.granted || p.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) return 'granted';
    return p.canAskAgain === false || p.status === 'denied' ? 'denied' : 'undetermined';
  } catch {
    return 'undetermined';
  }
}

/**
 * Get this device's Expo push token and attach it to the signed-in student.
 * `ask` = show the OS permission prompt if the student hasn't answered yet.
 */
export async function registerForPush(ask: boolean): Promise<PushStatus> {
  const unsupported = pushSupport();
  if (unsupported) return unsupported;
  await ensureChannels();

  let perm = await permissionStatus();
  if (perm === 'undetermined' && ask) {
    const r = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: true, allowSound: true } });
    perm = r.granted ? 'granted' : r.canAskAgain === false || r.status === 'denied' ? 'denied' : 'undetermined';
  }
  if (perm !== 'granted') return perm;

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await saveToken(token);
    return 'registered';
  } catch (e: any) {
    const msg = String(e?.message || e);
    console.warn('[push] could not get a push token:', msg);
    // Emulators without Google Play services / missing FCM config surface here
    return /FIS_AUTH_ERROR|SERVICE_NOT_AVAILABLE|google|firebase|FirebaseApp/i.test(msg) ? 'unavailable' : 'error';
  }
}

async function saveToken(token: string) {
  const { error } = await supabase.rpc('register_push_device', {
    p_token: token,
    p_platform: Platform.OS === 'ios' ? 'ios' : 'android',
    p_device_name: (Constants.deviceName || '').slice(0, 120) || null,
    p_app_version: Constants.expoConfig?.version || null,
  });
  if (error) throw new Error(error.message);
  await prefs.set(TOKEN_KEY, token);
}

/** Called on logout (while still signed in) so the next student on this phone doesn't get our pushes. */
export async function unregisterPush() {
  try {
    const token = await prefs.get(TOKEN_KEY);
    if (!token) return;
    await supabase.rpc('unregister_push_device', { p_token: token });
    await prefs.remove(TOKEN_KEY);
  } catch (e: any) {
    console.warn('[push] unregister failed:', e?.message || e);
  }
}

/** Re-register when FCM/APNs rotates the device token. Returns an unsubscribe function. */
export function watchTokenChanges(onChange: () => void): () => void {
  if (pushSupport()) return () => undefined;
  const sub = Notifications.addPushTokenListener(() => onChange());
  return () => sub.remove();
}

export const PUSH_STATUS_TEXT: Record<PushStatus, string> = {
  registered: 'Push notifications are on for this device.',
  denied: 'Notifications are turned off for Edufy in your phone settings.',
  undetermined: 'Allow notifications to hear about new courses, offers and your progress.',
  expo_go: 'Expo Go can’t receive push notifications. Use the Edufy development or production build.',
  not_configured: 'This build isn’t linked to an Expo (EAS) project yet, so it can’t receive push notifications.',
  unavailable: 'This device can’t receive push notifications (emulators need Google Play services).',
  error: 'Couldn’t turn on push notifications right now. Please try again.',
};
