import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Retrieve frontend public Vite environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl !== 'https://your-project.supabase.co' &&
  !supabaseUrl.includes('placeholder')
);

// Create Supabase client singleton
export const supabase: SupabaseClient = createClient(
  supabaseUrl || 'https://edufy-placeholder.supabase.co',
  supabaseAnonKey || 'dummy-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

/**
 * Retrieve authorization token header for secure API calls
 */
export async function getAuthToken(): Promise<string | null> {
  if (isSupabaseConfigured) {
    try {
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token || null;
    } catch {
      return null;
    }
  }
  return null;
}
