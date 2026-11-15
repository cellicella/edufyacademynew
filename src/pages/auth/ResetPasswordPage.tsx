import { AuthShell } from '../../components/layout/AuthShell';
import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { EdufyLogo } from '../../components/common/EdufyLogo';
import { Lock, ArrowRight, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { isMissingPkceVerifier } from '../../lib/authLinks';

/** 'checking' while the reset link is read; 'ready' shows the form; 'invalid' explains what to do. */
type LinkState = { kind: 'checking' } | { kind: 'ready' } | { kind: 'invalid'; title: string; message: string };

const EXPIRED = {
  title: 'This reset link has expired',
  message: 'Password reset links work once and expire after a while. Request a new one and use the latest email.',
};

export const ResetPasswordPage: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const { updatePassword } = useAuth();
  const navigate = useNavigate();
  const [link, setLink] = useState<LinkState>({ kind: isSupabaseConfigured ? 'checking' : 'ready' });
  const ran = useRef(false);

  // The reset email signs the visitor in for this one purpose; check that before showing the form.
  useEffect(() => {
    if (ran.current || !isSupabaseConfigured) return;
    ran.current = true;
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    if (hash.get('error_code') || hash.get('error') || query.get('error_code') || query.get('error')) {
      setLink({ kind: 'invalid', ...EXPIRED });
      return;
    }
    (async () => {
      try {
        const code = query.get('code');
        if (code && !(await supabase.auth.getSession()).data.session) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error && isMissingPkceVerifier(error)) {
            setLink({
              kind: 'invalid',
              title: 'Open this link where you requested it',
              message: 'This reset link was requested in the Edufy app, so it only works there. Open the email on that phone, or request a new link here on the website.',
            });
            return;
          }
          if (error) throw error;
        }
        // Tokens in the address bar are picked up by the Supabase client on load
        let session = (await supabase.auth.getSession()).data.session;
        for (let i = 0; !session && i < 10; i++) {
          await new Promise((r) => setTimeout(r, 300));
          session = (await supabase.auth.getSession()).data.session;
        }
        if (!session) {
          setLink({ kind: 'invalid', ...EXPIRED });
          return;
        }
        window.history.replaceState(null, '', window.location.pathname); // remove tokens from the address bar
        setLink({ kind: 'ready' });
      } catch {
        setLink({ kind: 'invalid', ...EXPIRED });
      }
    })();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters long.');
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    const result = await updatePassword(password);
    setLoading(false);
    if (result.success) {
      setDone(true);
    } else {
      setErrorMsg(result.error || 'Failed to update password.');
    }
  };

  return (
    <AuthShell>
      <div className="sm:mx-auto sm:w-full sm:max-w-[480px] text-left">
        <EdufyLogo size="lg" className="edufy-auth-logo justify-center mb-6" />
        <h2 className="font-display text-2xl font-extrabold text-[#111827]">
          Set a new password
        </h2>
        <p className="mt-2 text-xs text-[#64748B]">
          Choose a secure password of at least 8 characters.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-[480px]">
        <div className="bg-white py-8 px-6 shadow-lg rounded-[28px] border border-[#E2E8F0] sm:px-10">
          {link.kind === 'checking' ? (
            <div className="text-center space-y-3 py-4" aria-live="polite">
              <Loader2 className="w-8 h-8 text-[#004AAD] mx-auto animate-spin" />
              <p className="text-xs text-[#64748B]">Checking your reset link…</p>
            </div>
          ) : link.kind === 'invalid' ? (
            <div className="text-center space-y-4" aria-live="polite">
              <AlertCircle className="w-10 h-10 text-amber-600 mx-auto" />
              <h3 className="font-bold text-sm text-[#111827]">{link.title}</h3>
              <p className="text-xs text-[#64748B]">{link.message}</p>
              <Link to="/forgot-password" className="inline-block mt-2 w-full py-2.5 px-4 text-sm font-bold text-white bg-[#004AAD] rounded-full">
                Request a new link
              </Link>
              <Link to="/login" className="block text-xs font-semibold text-[#004AAD]">Back to sign in</Link>
            </div>
          ) : done ? (
            <div className="text-center space-y-4">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
              <h3 className="font-bold text-sm text-[#111827]">Password updated successfully</h3>
              <p className="text-xs text-[#64748B]">
                Your account password has been updated. You can now authenticate with your new credentials.
              </p>
              <button
                onClick={() => navigate('/login')}
                className="mt-2 w-full py-2.5 px-4 text-sm font-bold text-white bg-[#004AAD] rounded-full"
              >
                Sign In Now
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMsg && (
                <div className="p-3 text-xs bg-red-50 text-red-700 border border-red-200 rounded-lg">
                  {errorMsg}
                </div>
              )}
              <div>
                <label className="block text-[15px] font-semibold text-[#111827] mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-9 pr-3 py-2.5 text-xs bg-[#F7F9FC] border border-[#E2E8F0] rounded-lg text-[#111827] focus:outline-none focus:border-[#004AAD]"
                  />
                  <Lock className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <div>
                <label className="block text-[15px] font-semibold text-[#111827] mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-9 pr-3 py-2.5 text-xs bg-[#F7F9FC] border border-[#E2E8F0] rounded-lg text-[#111827] focus:outline-none focus:border-[#004AAD]"
                  />
                  <Lock className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 text-sm font-bold text-white bg-[#004AAD] hover:bg-[#003B8B] rounded-full shadow transition-colors flex items-center justify-center gap-2"
              >
                <span>Save New Password</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>
      </div>
    </AuthShell>
  );
};
