import { Platform } from 'react-native';
import { configProblems, PRODUCTION_WEB_URL, signupRedirectUrl } from '@/logic/config';

/**
 * Public runtime configuration (EXPO_PUBLIC_* variables are inlined at build time).
 * Only public values belong here — never a service-role key or Razorpay secret.
 */
const trimSlash = (v: string) => v.trim().replace(/\/+$/, '');

export const config = {
  supabaseUrl: trimSlash(process.env.EXPO_PUBLIC_SUPABASE_URL || ''),
  supabaseKey: (process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '').trim(),
  apiUrl: trimSlash(process.env.EXPO_PUBLIC_API_URL || ''),
  /** The website (not the API: that runs on its own address, api.edufyacademy.com). */
  webUrl: trimSlash(process.env.EXPO_PUBLIC_WEB_URL || '') || PRODUCTION_WEB_URL,
  /** Deep link used in password-reset emails (add it to Supabase → Auth → URL Configuration). */
  resetRedirect: 'edufyacademy://reset-password',
  /** Where the sign-up confirmation link lands (always the public https website, see signupRedirectUrl). */
  get signupRedirect(): string {
    return signupRedirectUrl(this.webUrl);
  },
  /** Request timeouts (ms) */
  timeouts: { api: 20000, payment: 30000, supabase: 20000 },
};

export const missingConfig = configProblems(config, { isDevice: Platform.OS === 'android' || Platform.OS === 'ios' });
