/** Validates the public runtime configuration. Pure (no React Native imports). */

/** The public website. Used when EXPO_PUBLIC_WEB_URL is not set, and for links in auth emails. */
export const PRODUCTION_WEB_URL = 'https://edufyacademy.com';

/**
 * Where the sign-up confirmation link in the email lands: the website's /auth/callback page (it
 * confirms the email and tells the student to sign in, in the app or on the web). Always a public
 * https address: a development value (http://10.0.2.2:3000, a LAN IP) would send the student's
 * browser to an address that only works on the developer's PC.
 */
export function signupRedirectUrl(webUrl: string): string {
  const base = /^https:\/\//.test(webUrl.trim()) ? webUrl.trim().replace(/\/+$/, '') : PRODUCTION_WEB_URL;
  return `${base}/auth/callback`;
}
export interface PublicEnv { supabaseUrl: string; supabaseKey: string; apiUrl: string }

export function configProblems(env: PublicEnv, opts: { isDevice: boolean }): string[] {
  const problems: string[] = [];
  if (!env.supabaseUrl) problems.push('EXPO_PUBLIC_SUPABASE_URL is missing.');
  else if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i.test(env.supabaseUrl.replace(/\/+$/, ''))) problems.push('EXPO_PUBLIC_SUPABASE_URL must look like https://<project>.supabase.co');
  if (!env.supabaseKey) problems.push('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing.');
  else if (/^sb_secret_|service_role/i.test(env.supabaseKey)) problems.push('A SECRET Supabase key was configured. Use the publishable key only.');
  if (!env.apiUrl) problems.push('EXPO_PUBLIC_API_URL is missing.');
  else if (!/^https?:\/\/[^\s/]+/i.test(env.apiUrl)) problems.push('EXPO_PUBLIC_API_URL must start with http:// or https://');
  else if (opts.isDevice && /\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(env.apiUrl))
    problems.push('EXPO_PUBLIC_API_URL points to "localhost", which on a phone means the phone itself. Use your PC’s LAN IP (e.g. http://192.168.1.5:3000) or 10.0.2.2 on the Android emulator.');
  return problems;
}
