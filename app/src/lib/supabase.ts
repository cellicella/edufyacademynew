import 'react-native-url-polyfill/auto';
import { AppState } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import { config } from './config';
import { secureSessionStorage } from './secureStorage';
import { fetchWithTimeout } from './fetchWithTimeout';

/**
 * Same Supabase project, users and RLS policies as the website.
 * Uses the PUBLIC publishable key only. Every request has a timeout.
 */
export const supabase = createClient(config.supabaseUrl || 'https://invalid.supabase.co', config.supabaseKey || 'missing-key', {
  auth: {
    storage: secureSessionStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
  global: {
    fetch: (input: any, init?: any) => fetchWithTimeout(input, init, config.timeouts.supabase),
  },
});

// Refresh tokens only while the app is in the foreground (Supabase React Native guidance)
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
