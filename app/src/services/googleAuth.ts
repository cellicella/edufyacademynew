import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';
import { friendlyOAuthError, parseOAuthCallback } from '@/logic/oauth';

// Closes the auth browser if the app is reopened through the redirect (Android)
WebBrowser.maybeCompleteAuthSession();

/**
 * Google sign-in through Supabase OAuth in the system browser (Chrome Custom Tabs / ASWebAuthenticationSession).
 * Works in Expo Go and in builds without native Google libraries. PKCE: the code verifier stays in the
 * secure session storage on this phone and the code is exchanged for a session here.
 *
 * Redirect URL: edufyacademy://auth/callback in builds (exp://…/--/auth/callback in Expo Go). It must be listed
 * in Supabase → Authentication → URL Configuration → Redirect URLs (edufyacademy://** covers builds).
 */
export async function signInWithGoogleBrowser(): Promise<'signed_in' | 'cancelled'> {
  const redirectTo = Linking.createURL('auth/callback');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true, queryParams: { prompt: 'select_account' } },
  });
  if (error || !data?.url) throw new Error(friendlyOAuthError(error?.message || 'no url'));
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo, { showInRecents: false });
  if (result.type !== 'success') return 'cancelled';
  const { code, error: cbError } = parseOAuthCallback(result.url);
  if (cbError || !code) {
    if (cbError === 'Google sign-in was cancelled.') return 'cancelled';
    throw new Error(cbError || 'Google sign-in failed.');
  }
  const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
  if (exErr) throw new Error(friendlyOAuthError(exErr.message));
  return 'signed_in';
}
