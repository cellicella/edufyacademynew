import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSiteSettings } from '../../context/SettingsContext';
import { GOOGLE_CLIENT_ID_RE, cancelOneTap, googleProviderEnabled, prepareGoogle } from '../../lib/googleIdentity';
import type { User } from '../../types';

const LABELS = { continue_with: 'Continue with Google', signin_with: 'Sign in with Google', signup_with: 'Sign up with Google' } as const;

export const dashboardFor = (u?: Pick<User, 'role'> | null) => (u?.role === 'admin' ? '/admin' : u?.role === 'instructor' ? '/instructor' : '/student');

/**
 * "Continue with Google".
 * - With a Web Client ID (Settings → Authentication & Login Methods) Google renders its own official button
 *   (Google branding guidelines) and returns an ID token → Supabase session, without leaving the page.
 * - Without it, the button starts Supabase's Google OAuth redirect (needs the Google provider enabled in Supabase).
 */
export const GoogleSignInButton: React.FC<{ next?: string | null; text?: keyof typeof LABELS; onError?: (msg: string) => void }> = ({ next, text, onError }) => {
  const { settings } = useSiteSettings();
  const { loginWithGoogle, loginWithGoogleIdToken } = useAuth();
  const navigate = useNavigate();
  const holder = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<'loading' | 'official' | 'redirect' | 'unavailable'>('loading');
  const [busy, setBusy] = useState(false);
  const clientId = settings.auth.googleClientId;
  const label = text || settings.auth.googleButtonText || 'continue_with';

  useEffect(() => {
    let cancelled = false;
    setMode('loading');
    // Never offer a Google button that cannot work: Supabase reports whether the provider is switched on
    googleProviderEnabled().then((enabled) => {
    if (cancelled) return;
    if (enabled === false) {
      setMode('unavailable');
      return;
    }
    if (!GOOGLE_CLIENT_ID_RE.test(clientId)) {
      setMode('redirect');
      return;
    }
    prepareGoogle(clientId, async (credential, nonce) => {
      setBusy(true);
      const r = await loginWithGoogleIdToken(credential, nonce);
      setBusy(false);
      if (r.success) navigate(next || dashboardFor(r.user), { replace: true });
      else onError?.(r.error || 'Google sign-in failed.');
    })
      .then((google) => {
        if (cancelled || !holder.current) return;
        holder.current.innerHTML = '';
        const width = Math.min(400, Math.max(220, Math.round(holder.current.getBoundingClientRect().width || 320)));
        google.accounts.id.renderButton(holder.current, { type: 'standard', theme: 'outline', size: 'large', shape: 'pill', text: label, logo_alignment: 'center', width });
        setMode('official');
      })
      .catch(() => !cancelled && setMode('redirect')); // script blocked → fall back to the redirect flow
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, label]);

  const startRedirect = async () => {
    setBusy(true);
    const r = await loginWithGoogle(next);
    if (!r.success) {
      setBusy(false);
      onError?.(r.error || 'Google sign-in failed.');
    }
  };

  return (
    <div className="w-full">
      <div ref={holder} className={mode === 'official' ? 'flex justify-center min-h-[44px]' : 'hidden'} aria-busy={busy} />
      {mode === 'loading' && <div className="h-[44px] rounded-full border border-[#DADCE0] bg-white animate-pulse" aria-label="Loading Google sign-in" />}
      {mode === 'unavailable' && (
        <div className="w-full">
          <button type="button" disabled className="w-full h-[44px] px-4 rounded-full border border-[#DADCE0] bg-[#F8FAFC] text-[#94A3B8] text-sm font-medium cursor-not-allowed" style={{ fontFamily: 'Roboto, Arial, sans-serif' }}>
            {LABELS[label]}
          </button>
          <p className="mt-1.5 text-[12px] text-center text-amber-700">Google sign-in is not set up yet. Please use your email for now.</p>
        </div>
      )}
      {mode === 'redirect' && (
        <button
          type="button"
          onClick={startRedirect}
          disabled={busy}
          className="w-full h-[44px] px-4 rounded-full border border-[#747775] bg-white text-[#1F1F1F] text-sm font-medium hover:bg-[#F8FAFF] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#004AAD] disabled:opacity-60 flex items-center justify-center gap-2"
          style={{ fontFamily: 'Roboto, Arial, sans-serif' }}
        >
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          <span>{busy ? 'Opening Google…' : LABELS[label]}</span>
        </button>
      )}
      {busy && mode === 'official' && (
        <p className="mt-2 text-xs text-center text-[#64748B] flex items-center justify-center gap-1.5">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Signing you in…
        </p>
      )}
    </div>
  );
};

/** "OR continue with email" divider. */
export const AuthDivider: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex items-center gap-3" role="separator">
    <span className="h-px flex-1 bg-[#E2E8F0]" />
    <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">{label}</span>
    <span className="h-px flex-1 bg-[#E2E8F0]" />
  </div>
);

const ONE_TAP_HIDDEN = /^\/(login|register|forgot-password|reset-password|auth\/|admin|instructor|learn\/)/;

/**
 * Google One Tap prompt on public pages for signed-out visitors (Settings → Authentication → One Tap).
 * Never blocks the page or the regular sign-in button; dismissed prompts are throttled by Google.
 */
export const GoogleOneTap: React.FC = () => {
  const { settings } = useSiteSettings();
  const { isAuthenticated, isLoading, loginWithGoogleIdToken } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { googleEnabled, oneTapEnabled, googleClientId } = settings.auth;
  const hidden = ONE_TAP_HIDDEN.test(location.pathname);

  useEffect(() => {
    if (isLoading || isAuthenticated || hidden || !googleEnabled || !oneTapEnabled || !GOOGLE_CLIENT_ID_RE.test(googleClientId)) return;
    let cancelled = false;
    const t = window.setTimeout(() => {
      prepareGoogle(googleClientId, async (credential, nonce) => {
        const r = await loginWithGoogleIdToken(credential, nonce);
        if (r.success && r.user?.role && r.user.role !== 'student') navigate(dashboardFor(r.user));
      })
        .then((google) => !cancelled && google.accounts.id.prompt())
        .catch(() => undefined);
    }, 1500);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
      cancelOneTap();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isAuthenticated, hidden, googleEnabled, oneTapEnabled, googleClientId]);

  return null;
};
