import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { createChunkedStorage, KVBackend, safeKey } from '@/logic/chunkedStorage';

/**
 * Secure storage for the Supabase session and small app preferences.
 *
 * Native (Android / iOS): Android Keystore-encrypted storage / iOS Keychain via expo-secure-store.
 * Tokens are never written to AsyncStorage or plain files.
 *
 * Web: expo-secure-store has NO web implementation (its web module is an empty object, so
 * getItemAsync throws "getValueWithKeyAsync is not a function"). The app is Android/iOS only;
 * on web values stay in memory (nothing persisted) and app/index.tsx shows a "use your phone" screen.
 */
export const isSecureStoreSupported = Platform.OS === 'android' || Platform.OS === 'ios';

const memory = new Map<string, string>();
const backend: KVBackend = isSecureStoreSupported
  ? { get: (k) => SecureStore.getItemAsync(k), set: (k, v) => SecureStore.setItemAsync(k, v), del: (k) => SecureStore.deleteItemAsync(k) }
  : { get: async (k) => memory.get(k) ?? null, set: async (k, v) => void memory.set(k, v), del: async (k) => void memory.delete(k) };

/** Storage adapter passed to the Supabase client. Only key names are ever logged, never values. */
export const secureSessionStorage = createChunkedStorage(backend, {
  onUnreadable: (key, err) => console.warn(`[secure-storage] Cleared unreadable entry "${key}": ${(err as any)?.message || err}`),
});

/** Small, non-secret preferences (onboarding seen, reminder time, notification read marker). */
export const prefs = {
  async get(key: string): Promise<string | null> {
    try {
      return await backend.get(`pref_${safeKey(key)}`);
    } catch (e: any) {
      console.warn(`[prefs] could not read "${key}": ${e?.message || e}`);
      return null;
    }
  },
  set: (key: string, value: string) => backend.set(`pref_${safeKey(key)}`, value),
  remove: (key: string) => backend.del(`pref_${safeKey(key)}`),
};

/**
 * Cache for public, non-secret data that can be larger than one secure-store entry (site settings).
 * Uses the same backend in chunks; nothing sensitive is stored here.
 */
export const settingsCache = createChunkedStorage(backend, {
  onUnreadable: (key) => console.warn(`[settings-cache] Cleared unreadable entry "${key}"`),
});
