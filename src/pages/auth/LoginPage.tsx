import { AuthShell } from '../../components/layout/AuthShell';
import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { EdufyLogo } from '../../components/common/EdufyLogo';
import { Mail, Lock, ArrowRight, AlertCircle, CheckCircle2, Sparkles } from 'lucide-react';
import { useSiteSettings } from '../../context/SettingsContext';
import { AuthDivider, GoogleSignInButton } from '../../components/auth/GoogleSignIn';
import { safeInternalPath } from '../../lib/purchaseIntent';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, sendMagicLink, authError, clearError, currentUser, isAuthenticated } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { settings } = useSiteSettings();
  const auth = settings.auth;
  const [useMagic, setUseMagic] = useState(false);
  const [magicSent, setMagicSent] = useState(false);

  const rawRedirect = searchParams.get('redirect');
  // Only same-site paths (no open redirects)
  const redirectUrl = safeInternalPath(rawRedirect, window.location.origin);
  const continuingPurchase = !!redirectUrl && /[?&](enroll=1|buy=1|checkout=cart)(&|$)/.test(redirectUrl);
  // ?method=email always shows the email form, so administrators can never be locked out by login settings
  const forceEmail = searchParams.get('method') === 'email';
  const showGoogle = auth.googleEnabled;
  const showPassword = auth.emailPasswordEnabled || forceEmail || (!auth.googleEnabled && !auth.magicLinkEnabled);
  const showMagic = auth.magicLinkEnabled;
  const showEmailSection = showPassword || showMagic;
  const googleFirst = showGoogle && (auth.preferredMethod !== 'email' || !showEmailSection) && !forceEmail;

  // If already logged in, redirect immediately
  useEffect(() => {
    if (isAuthenticated && currentUser) {
      if (redirectUrl) {
        navigate(redirectUrl, { replace: true });
      } else if (currentUser.role === 'admin') {
        navigate('/admin', { replace: true });
      } else if (currentUser.role === 'instructor') {
        navigate('/instructor', { replace: true });
      } else {
        navigate('/student', { replace: true });
      }
    }
  }, [isAuthenticated, currentUser, redirectUrl, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    clearError();

    const result = await login(email, password);
    setLoading(false);

    if (result.success) {
      if (redirectUrl) {
        navigate(redirectUrl, { replace: true });
      } else {
        const userRole = result.user?.role || 'student';
        if (userRole === 'admin') {
          navigate('/admin', { replace: true });
        } else if (userRole === 'instructor') {
          navigate('/instructor', { replace: true });
        } else {
          navigate('/student', { replace: true });
        }
      }
    } else {
      setErrorMessage(result.error || 'Authentication failed. Please check your credentials.');
    }
  };

  const handleMagic = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    const r = await sendMagicLink(email, redirectUrl);
    setLoading(false);
    if (r.success) setMagicSent(true);
    else setErrorMessage(r.error || 'Could not send the sign-in link.');
  };

  return (
    <AuthShell>
      <div className="sm:mx-auto sm:w-full sm:max-w-[480px] text-left">
        <EdufyLogo size="lg" className="edufy-auth-logo justify-center mb-6" />
        <h2 className="ed-display text-[2.25rem] sm:text-[2.5rem] leading-tight">
          Sign in to your account
        </h2>
        <p className="mt-2 text-xs text-[#64748B]">
          Or{' '}
          <Link
            to={redirectUrl ? `/register?redirect=${encodeURIComponent(redirectUrl)}` : '/register'}
            className="font-semibold text-[#004AAD] hover:underline"
          >
            create a new student account
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-[480px]">
        <div className="bg-white py-8 px-6 shadow-lg rounded-[28px] border border-[#E2E8F0] sm:px-10 space-y-6">
          {(errorMessage || authError) && (
            <div className="p-3 text-xs bg-red-50 text-red-700 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{errorMessage || authError}</div>
            </div>
          )}

          {redirectUrl && (
            <div className="p-2.5 text-xs bg-blue-50 text-blue-800 border border-blue-200 rounded-lg">
              {continuingPurchase ? 'Sign in or create an account to continue your enrollment. You’ll return to your course right after.' : 'Please sign in to continue to your requested page.'}
            </div>
          )}

          {googleFirst && <GoogleSignInButton next={redirectUrl} onError={setErrorMessage} />}
          {googleFirst && showEmailSection && <AuthDivider label="Or continue with email" />}

          {showEmailSection && magicSent && (
            <div className="p-4 text-sm bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl flex items-start gap-2" role="status">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <div>
                If an account exists for <strong>{email}</strong>, a sign-in link is on its way. Open it on this device. Check your spam folder if it doesn’t arrive in a few minutes.
                <button type="button" className="block mt-2 text-[13px] font-semibold text-[#004AAD] hover:underline" onClick={() => setMagicSent(false)}>Use a different email</button>
              </div>
            </div>
          )}

          {showEmailSection && !magicSent && (useMagic || !showPassword) && showMagic && (
            <form className="space-y-4" onSubmit={handleMagic} aria-label="Email me a sign-in link">
              <div>
                <label className="block text-[15px] font-semibold text-[#111827] mb-1.5" htmlFor="magic-email">Email Address</label>
                <div className="relative">
                  <input id="magic-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="alex.jordan@company.com"
                    className="w-full pl-9 pr-3 py-2.5 text-xs bg-[#F7F9FC] border border-[#E2E8F0] rounded-lg text-[#111827] focus:outline-none focus:border-[#004AAD]" />
                  <Mail className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>
              <button type="submit" disabled={loading} className="w-full py-2.5 px-4 text-sm font-bold text-white bg-[#004AAD] hover:bg-[#003B8B] rounded-full shadow transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                <Sparkles className="w-4 h-4" />
                <span>{loading ? 'Sending…' : 'Email me a sign-in link'}</span>
              </button>
              {showPassword && (
                <button type="button" onClick={() => setUseMagic(false)} className="w-full text-[13px] font-semibold text-[#004AAD] hover:underline">Sign in with a password instead</button>
              )}
            </form>
          )}

          {showPassword && !magicSent && !(useMagic && showMagic) && (
            <>
          <form className="space-y-4" onSubmit={handleLogin} aria-label="Sign in with email and password">
            <div>
              <label className="block text-[15px] font-semibold text-[#111827] mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alex.jordan@company.com"
                  className="w-full pl-9 pr-3 py-2.5 text-xs bg-[#F7F9FC] border border-[#E2E8F0] rounded-lg text-[#111827] focus:outline-none focus:border-[#004AAD]"
                />
                <Mail className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[15px] font-semibold text-[#111827]">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-[13px] font-semibold text-[#004AAD] hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
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

            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-2 text-[#64748B] cursor-pointer">
                <input
                  type="checkbox"
                  defaultChecked
                  className="rounded border-[#E2E8F0] text-[#004AAD] focus:ring-[#004AAD]"
                />
                <span>Remember me on this browser</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 text-sm font-bold text-white bg-[#004AAD] hover:bg-[#003B8B] rounded-full shadow transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span>{loading ? 'Signing in...' : 'Sign In'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
              {showMagic && (
                <button type="button" onClick={() => setUseMagic(true)} className="w-full text-[13px] font-semibold text-[#004AAD] hover:underline">Email me a sign-in link instead</button>
              )}
            </>
          )}

          {!googleFirst && showGoogle && showEmailSection && <AuthDivider label="Or" />}
          {!googleFirst && showGoogle && <GoogleSignInButton next={redirectUrl} onError={setErrorMessage} />}

          {!showPassword && (
            <p className="text-center text-[12px] text-[#64748B]">
              Staff or administrator?{' '}
              <Link to={`/login?method=email${redirectUrl ? `&redirect=${encodeURIComponent(redirectUrl)}` : ''}`} className="font-semibold text-[#004AAD] hover:underline">
                Sign in with email and password
              </Link>
            </p>
          )}

        </div>
      </div>
    </AuthShell>
  );
};
