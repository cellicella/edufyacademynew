import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { AUTH_LINK_PAGES, misdirectedAuthLink } from '../../lib/authLinks';

// Captured while the bundle loads, before the Supabase client reads (and clears) tokens in the address bar.
const initialUrl =
  typeof window !== 'undefined'
    ? { pathname: window.location.pathname, search: window.location.search, hash: window.location.hash }
    : null;

/**
 * Safety net for auth email links that land on the home page because Supabase fell back to its
 * Site URL (requested address missing from Authentication → URL Configuration → Redirect URLs).
 * Sends them to the page that handles them, so the student still sees "Email verified" or the
 * "Set a new password" form. Renders nothing.
 */
export function AuthLinkRescue() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!initialUrl) return;
    const target = misdirectedAuthLink(initialUrl.pathname, initialUrl.search, initialUrl.hash);
    if (target) navigate(target, { replace: true });
    // Only for the address the site was opened with
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' && !(AUTH_LINK_PAGES as readonly string[]).includes(window.location.pathname)) {
        navigate('/reset-password', { replace: true });
      }
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  return null;
}
