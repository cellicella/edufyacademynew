import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { EdufyLogo } from '../../components/common/EdufyLogo';
import { UserRole } from '../../types';
import { Mail, Lock, ArrowRight, UserCheck, Shield, GraduationCap, AlertCircle } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register, authError, clearError, currentUser, isAuthenticated } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const redirectUrl = searchParams.get('redirect');

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

  const handleQuickDemoLogin = async (targetRole: UserRole) => {
    setLoading(true);
    setErrorMessage(null);
    clearError();

    const demoEmail =
      targetRole === 'admin'
        ? 'admin@edufy.academy'
        : targetRole === 'instructor'
        ? 'sarah.chen@edufy.test'
        : 'student@edufy.test';
    const demoPassword = 'EdufyDemoPassword123!';

    // Attempt sign-in with standard demo password
    let result = await login(demoEmail, demoPassword);

    // If user does not exist in auth yet, auto-provision and sign in
    if (!result.success) {
      const regResult = await register(
        targetRole === 'admin'
          ? 'Platform Administrator'
          : targetRole === 'instructor'
          ? 'Dr. Sarah Chen'
          : 'Jordan Smith',
        demoEmail,
        demoPassword,
        targetRole
      );

      if (regResult.success) {
        result = await login(demoEmail, demoPassword);
      }
    }

    setLoading(false);

    if (result.success) {
      if (redirectUrl) {
        navigate(redirectUrl, { replace: true });
      } else if (targetRole === 'admin') {
        navigate('/admin', { replace: true });
      } else if (targetRole === 'instructor') {
        navigate('/instructor', { replace: true });
      } else {
        navigate('/student', { replace: true });
      }
    } else {
      setErrorMessage(
        result.error ||
          'Quick login failed. If this is a fresh database, please ensure "supabase/fix_auth_trigger.sql" has been executed.'
      );
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F9FC] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <EdufyLogo size="lg" className="justify-center mb-6" />
        <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-[#111827]">
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

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-md rounded-2xl border border-[#E2E8F0] sm:px-10 space-y-6">
          {(errorMessage || authError) && (
            <div className="p-3 text-xs bg-red-50 text-red-700 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{errorMessage || authError}</div>
            </div>
          )}

          {redirectUrl && (
            <div className="p-2.5 text-xs bg-blue-50 text-blue-800 border border-blue-200 rounded-lg">
              Please sign in to continue to your requested page.
            </div>
          )}

          <form className="space-y-4" onSubmit={handleLogin}>
            <div>
              <label className="block text-xs font-bold text-[#111827] uppercase tracking-wider mb-1.5">
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
                <Mail className="w-4 h-4 text-[#64748B] absolute left-3 top-3" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-[#111827] uppercase tracking-wider">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-[11px] font-semibold text-[#004AAD] hover:underline"
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
                <Lock className="w-4 h-4 text-[#64748B] absolute left-3 top-3" />
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
              className="w-full py-2.5 px-4 text-xs font-bold text-white bg-[#004AAD] hover:bg-[#003B8B] rounded-lg shadow transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span>{loading ? 'Signing in...' : 'Sign In'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Demo Access Buttons */}
          <div className="pt-4 border-t border-[#E2E8F0] space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] block text-center">
              Quick 1-Click Evaluation Login
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickDemoLogin('student')}
                disabled={loading}
                className="p-2 border border-[#E2E8F0] rounded-lg bg-[#F8FAFC] hover:bg-[#EBF3FF] hover:border-blue-300 text-center transition-colors disabled:opacity-50"
              >
                <GraduationCap className="w-4 h-4 text-[#004AAD] mx-auto mb-1" />
                <span className="text-[10px] font-bold text-[#111827] block">Student</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemoLogin('instructor')}
                disabled={loading}
                className="p-2 border border-[#E2E8F0] rounded-lg bg-[#F8FAFC] hover:bg-[#F4EFFF] hover:border-purple-300 text-center transition-colors disabled:opacity-50"
              >
                <UserCheck className="w-4 h-4 text-[#5E17EB] mx-auto mb-1" />
                <span className="text-[10px] font-bold text-[#111827] block">Instructor</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
