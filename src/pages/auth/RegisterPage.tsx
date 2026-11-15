import { AuthShell } from '../../components/layout/AuthShell';
import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { EdufyLogo } from '../../components/common/EdufyLogo';
import { UserRole } from '../../types';
import { Mail, Lock, User, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { useSiteSettings } from '../../context/SettingsContext';
import { AuthDivider, GoogleSignInButton } from '../../components/auth/GoogleSignIn';

export const RegisterPage: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('student');
  const [agree, setAgree] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [verificationSent, setVerificationSent] = useState(false);
  const { register, resendVerification, authError, clearError, currentUser, isAuthenticated } = useAuth();
  const [resendState, setResendState] = useState<{ busy: boolean; message: string | null; ok: boolean }>({ busy: false, message: null, ok: false });
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const rawRedirect = searchParams.get('redirect');
  const redirectUrl = rawRedirect && rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : null;
  const { settings } = useSiteSettings();
  const showGoogle = settings.auth.googleEnabled;
  const showForm = settings.auth.emailPasswordEnabled || !showGoogle;
  const googleFirst = showGoogle && settings.auth.preferredMethod !== 'email';

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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agree) return;
    setLoading(true);
    setErrorMessage(null);
    clearError();

    const result = await register(name, email, password, role, redirectUrl);
    setLoading(false);

    if (result.success) {
      if (result.requiresEmailVerification) {
        setVerificationSent(true);
      } else if (redirectUrl) {
        navigate(redirectUrl, { replace: true });
      } else if (role === 'instructor') {
        // Instructor sign-ups start as students with a pending application
        navigate('/become-instructor', { replace: true });
      } else {
        navigate('/student', { replace: true });
      }
    } else {
      setErrorMessage(result.error || 'Failed to create account.');
    }
  };

  return (
    <AuthShell>
      <div className="sm:mx-auto sm:w-full sm:max-w-[480px] text-left">
        <EdufyLogo size="lg" className="edufy-auth-logo justify-center mb-6" />
        <h2 className="ed-display text-[2.25rem] sm:text-[2.5rem] leading-tight">
          Create your Edufy account
        </h2>
        <p className="mt-2 text-xs text-[#64748B]">
          Already enrolled?{' '}
          <Link
            to={redirectUrl ? `/login?redirect=${encodeURIComponent(redirectUrl)}` : '/login'}
            className="font-semibold text-[#004AAD] hover:underline"
          >
            Sign in here
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-[480px]">
        <div className="bg-white py-8 px-6 shadow-lg rounded-[28px] border border-[#E2E8F0] sm:px-10 space-y-6">
          {verificationSent ? (
            <div className="text-center space-y-4 py-4">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="font-display text-lg font-bold text-[#111827]">
                Check Your Email
              </h3>
              <p className="text-xs text-[#64748B] leading-relaxed">
                We've dispatched a confirmation link to <strong className="text-[#111827]">{email}</strong>. Please verify your email to activate your Edufy account.
              </p>
              <Link
                to={redirectUrl ? `/login?redirect=${encodeURIComponent(redirectUrl)}` : '/login'}
                className="inline-block px-4 py-2 text-sm font-bold text-white bg-[#004AAD] rounded-full"
              >
                Proceed to Sign In
              </Link>
              <div className="text-xs text-[#64748B]">
                Didn't get it? Check your spam folder or{' '}
                <button
                  type="button"
                  disabled={resendState.busy}
                  onClick={async () => {
                    setResendState({ busy: true, message: null, ok: false });
                    const r = await resendVerification(email, redirectUrl);
                    setResendState({ busy: false, ok: r.success, message: r.success ? 'A new confirmation email is on its way.' : r.error || 'Could not resend the email.' });
                  }}
                  className="font-semibold text-[#004AAD] hover:underline disabled:opacity-50"
                >
                  {resendState.busy ? 'sending…' : 'resend the email'}
                </button>
                .
              </div>
              {resendState.message && (
                <p className={`text-xs ${resendState.ok ? 'text-emerald-700' : 'text-red-700'}`} role="status">{resendState.message}</p>
              )}
            </div>
          ) : (
            <>
              {(errorMessage || authError) && (
                <div className="p-3 text-xs bg-red-50 text-red-700 border border-red-200 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">{errorMessage || authError}</div>
                </div>
              )}
              {googleFirst && <GoogleSignInButton next={redirectUrl} text="signup_with" onError={setErrorMessage} />}
              {googleFirst && showForm && <AuthDivider label="Or sign up with email" />}
              {showForm && <form className="space-y-4" onSubmit={handleRegister}>
                {/* Role Selector Tabs */}
                <div>
                  <label className="block text-[15px] font-semibold text-[#111827] mb-2">
                    I want to join as:
                  </label>
                  <div className="grid grid-cols-2 gap-2 p-1 bg-[#F1F5F9] rounded-lg">
                    <button
                      type="button"
                      onClick={() => setRole('student')}
                      className={`py-1.5 text-xs font-bold rounded-md transition-all ${
                        role === 'student'
                          ? 'bg-white text-[#004AAD] shadow-xs'
                          : 'text-[#64748B] hover:text-[#111827]'
                      }`}
                    >
                      Student Learner
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole('instructor')}
                      className={`py-1.5 text-xs font-bold rounded-md transition-all ${
                        role === 'instructor'
                          ? 'bg-white text-[#5E17EB] shadow-xs'
                          : 'text-[#64748B] hover:text-[#111827]'
                      }`}
                    >
                      Lead Instructor
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[15px] font-semibold text-[#111827] mb-1.5">
                    Full Name
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Jordan Smith"
                      className="w-full pl-9 pr-3 py-2.5 text-xs bg-[#F7F9FC] border border-[#E2E8F0] rounded-lg text-[#111827] focus:outline-none focus:border-[#004AAD]"
                    />
                    <User className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

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
                      placeholder="jordan.smith@example.com"
                      className="w-full pl-9 pr-3 py-2.5 text-xs bg-[#F7F9FC] border border-[#E2E8F0] rounded-lg text-[#111827] focus:outline-none focus:border-[#004AAD]"
                    />
                    <Mail className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                <div>
                  <label className="block text-[15px] font-semibold text-[#111827] mb-1.5">
                    Create Password
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      className="w-full pl-9 pr-3 py-2.5 text-xs bg-[#F7F9FC] border border-[#E2E8F0] rounded-lg text-[#111827] focus:outline-none focus:border-[#004AAD]"
                    />
                    <Lock className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                <div className="flex items-start gap-2 text-xs">
                  <input
                    type="checkbox"
                    required
                    id="agree-checkbox"
                    checked={agree}
                    onChange={(e) => setAgree(e.target.checked)}
                    className="mt-0.5 rounded border-[#E2E8F0] text-[#004AAD] focus:ring-[#004AAD]"
                  />
                  <label htmlFor="agree-checkbox" className="text-[#64748B] text-[13px] leading-snug">
                    I agree to the Edufy Academy{' '}
                    <Link to="/terms" className="text-[#004AAD] underline">
                      Terms of Service
                    </Link>{' '}
                    and{' '}
                    <Link to="/privacy" className="text-[#004AAD] underline">
                      Privacy Policy
                    </Link>
                    .
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={loading || !agree}
                  className="w-full py-2.5 px-4 text-sm font-bold text-white bg-[#004AAD] hover:bg-[#003B8B] rounded-full shadow transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <span>{loading ? 'Creating account...' : 'Create Account'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>}
              {!googleFirst && showGoogle && showForm && <AuthDivider label="Or" />}
              {!googleFirst && showGoogle && <GoogleSignInButton next={redirectUrl} text="signup_with" onError={setErrorMessage} />}
              {showGoogle && (
                <p className="text-[11px] text-center text-[#94A3B8]">Google sign-up creates a student account. Already registered with this email? Google signs you into the same account.</p>
              )}
            </>
          )}
        </div>
      </div>
    </AuthShell>
  );
};
