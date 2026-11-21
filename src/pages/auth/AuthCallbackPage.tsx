import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, AlertCircle, Loader2, Mail } from 'lucide-react';
import type { EmailOtpType } from '@supabase/supabase-js';
import { AuthShell } from '../../components/layout/AuthShell';
import { EdufyLogo } from '../../components/common/EdufyLogo';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { isMissingPkceVerifier } from '../../lib/authLinks';
import { safeInternalPath } from '../../lib/purchaseIntent';

type State =
  | { kind: 'working' }
  | { kind: 'verified'; signedIn: boolean; confirmedOnly?: boolean }
  | { kind: 'error'; title: string; message: string; canResend: boolean };

const OTP_TYPES: EmailOtpType[] = ['signup', 'email', 'invite', 'magiclink', 'recovery', 'email_change'];

/** Only same-site paths may be used as the post-verification destination. */
const safeNext = (v: string | null) => safeInternalPath(v, window.location.origin);

/**
 * Landing page for links in Supabase emails (sign-up confirmation, magic links).
 * Supports every link style Supabase can send:
 *  • implicit flow  — #access_token=…&type=signup   (handled by the Supabase client automatically)
 *  • PKCE flow      — ?code=…  (links started in the mobile app; when opened outside the app the email is
 *                     already confirmed by Supabase, so a missing code verifier means "verified, sign in")
 *  • token hash     — ?token_hash=…&type=signup      (custom email templates)
 *  • errors         — #error=access_denied&error_code=otp_expired&error_description=…
 */
export const AuthCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, resendVerification } = useAuth();
  const [state, setState] = useState<State>({ kind: 'working' });
  const [email, setEmail] = useState('');
  const [resend, setResend] = useState<{ busy: boolean; message: string | null; ok: boolean }>({ busy: false, message: null, ok: false });
  const ran = useRef(false);

  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const next = safeNext(query.get('next'));
  // Google (OAuth ?code= without a type) and magic links sign the user in; sign-up links verify an email
  const signInLink = (!!query.get('code') && !query.get('type')) || query.get('type') === 'magiclink' || hash.get('type') === 'magiclink' || !!hash.get('provider_token');

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const errorCode = hash.get('error_code') || query.get('error_code');
    const errorDesc = hash.get('error_description') || query.get('error_description');
    if (errorCode || hash.get('error') || query.get('error')) {
      const expired = /otp_expired|expired|invalid/i.test(`${errorCode} ${errorDesc}`);
      setState({
        kind: 'error',
        title: expired ? 'This link has expired' : signInLink || /access_denied/.test(`${errorCode} ${hash.get('error') || query.get('error')}`) ? 'Sign-in was cancelled or failed' : 'We couldn’t verify your email',
        message: expired
          ? 'Confirmation links can be used once and expire after a while. Enter your email below and we’ll send a new one — or simply sign in if you already confirmed.'
          : (errorDesc || 'The verification link is not valid.').replace(/\+/g, ' '),
        canResend: true,
      });
      return;
    }

    if (!isSupabaseConfigured) {
      setState({ kind: 'error', title: 'Verification unavailable', message: 'The website is not connected to the authentication service.', canResend: false });
      return;
    }

    (async () => {
      try {
        const tokenHash = query.get('token_hash');
        const type = query.get('type') as EmailOtpType | null;
        const code = query.get('code');
        if (tokenHash && type && OTP_TYPES.includes(type)) {
          const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
          if (error) throw error;
        } else if (code) {
          // The client may already have exchanged it (detectSessionInUrl); only exchange if there is no session yet
          const { data } = await supabase.auth.getSession();
          if (!data.session) {
            const { error } = await supabase.auth.exchangeCodeForSession(code);
            if (error && isMissingPkceVerifier(error)) {
              window.history.replaceState(null, '', window.location.pathname + (next ? `?next=${encodeURIComponent(next)}` : ''));
              setState({ kind: 'verified', signedIn: false, confirmedOnly: true });
              return;
            }
            if (error) throw error;
          }
        }

        // Implicit-flow tokens in the URL hash are picked up by the Supabase client on load
        let session = (await supabase.auth.getSession()).data.session;
        for (let i = 0; !session && i < 10; i++) {
          await new Promise((r) => setTimeout(r, 300));
          session = (await supabase.auth.getSession()).data.session;
        }
        // Remove tokens from the address bar
        window.history.replaceState(null, '', window.location.pathname + (next ? `?next=${encodeURIComponent(next)}` : ''));
        setState({ kind: 'verified', signedIn: !!session });
        // The welcome email is queued by the database once the account is confirmed (exactly once per account).
      } catch (e: any) {
        if (isMissingPkceVerifier(e)) {
          setState({ kind: 'verified', signedIn: false, confirmedOnly: true });
          return;
        }
        const msg = String(e?.message || e);
        setState({
          kind: 'error',
          title: /expired|invalid/i.test(msg) ? 'This link has expired' : 'We couldn’t verify your email',
          message: /expired|invalid/i.test(msg)
            ? 'Confirmation links can be used once and expire after a while. Request a new one below, or sign in if you already confirmed.'
            : msg,
          canResend: true,
        });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Signed in after verification → go to the right dashboard once the profile has loaded
  useEffect(() => {
    if (state.kind !== 'verified' || !state.signedIn || !currentUser) return;
    const dest = next || (currentUser.role === 'admin' ? '/admin' : currentUser.role === 'instructor' ? '/instructor' : '/student');
    const t = setTimeout(() => navigate(dest, { replace: true }), 1500);
    return () => clearTimeout(t);
  }, [state, currentUser, next, navigate]);

  const doResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) return setResend({ busy: false, ok: false, message: 'Enter the email you registered with.' });
    setResend({ busy: true, ok: false, message: null });
    const r = await resendVerification(email, next);
    setResend({ busy: false, ok: r.success, message: r.success ? 'A new confirmation email is on its way. Check your inbox (and spam folder).' : r.error || 'Could not send the email.' });
  };

  return (
    <AuthShell>
      <div className="sm:mx-auto sm:w-full sm:max-w-[480px]">
        <EdufyLogo size="lg" className="edufy-auth-logo justify-center mb-6" />
        <div className="bg-white py-10 px-6 shadow-lg rounded-[28px] border border-[#E2E8F0] sm:px-10 text-center space-y-4" aria-live="polite">
          {state.kind === 'working' && (
            <>
              <Loader2 className="w-10 h-10 text-[#004AAD] mx-auto animate-spin" />
              <h1 className="font-display text-xl font-extrabold text-[#111827]">{signInLink ? 'Signing you in…' : 'Verifying your email…'}</h1>
              <p className="text-sm text-[#64748B]">This only takes a moment.</p>
            </>
          )}

          {state.kind === 'verified' && (
            <>
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h1 className="font-display text-xl font-extrabold text-[#111827]">{signInLink && !state.confirmedOnly ? (state.signedIn ? 'You’re signed in' : 'Sign-in incomplete') : 'Email verified'}</h1>
              {state.signedIn ? (
                <p className="text-sm text-[#64748B]">Welcome to Edufy Academy! Taking you to your dashboard…</p>
              ) : (
                <>
                  <p className="text-sm text-[#64748B]">Your account is active. Sign in to start learning — on this website or in the Edufy app.</p>
                  <Link to={next ? `/login?redirect=${encodeURIComponent(next)}` : '/login'} className="inline-block px-6 py-2.5 text-sm font-bold text-white bg-[#004AAD] rounded-full">
                    Sign in
                  </Link>
                </>
              )}
            </>
          )}

          {state.kind === 'error' && (
            <>
              <div className="w-14 h-14 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="w-7 h-7" />
              </div>
              <h1 className="font-display text-xl font-extrabold text-[#111827]">{state.title}</h1>
              <p className="text-sm text-[#64748B]">{state.message}</p>
              {state.canResend && (
                <form onSubmit={doResend} className="space-y-3 text-left pt-2">
                  <label className="block text-[14px] font-semibold text-[#111827]" htmlFor="resend-email">Email address</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input id="resend-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="ed-field !pl-9" placeholder="you@example.com" />
                  </div>
                  <button type="submit" disabled={resend.busy} className="w-full px-4 py-2.5 text-sm font-bold text-white bg-[#004AAD] rounded-full disabled:opacity-60">
                    {resend.busy ? 'Sending…' : 'Send a new confirmation email'}
                  </button>
                  {resend.message && <p className={`text-xs ${resend.ok ? 'text-emerald-700' : 'text-red-700'}`}>{resend.message}</p>}
                </form>
              )}
              <Link to="/login" className="inline-block text-sm font-semibold text-[#004AAD] hover:underline">Go to sign in</Link>
            </>
          )}
        </div>
      </div>
    </AuthShell>
  );
};
