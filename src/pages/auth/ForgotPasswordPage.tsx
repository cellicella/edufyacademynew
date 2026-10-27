import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { EdufyLogo } from '../../components/common/EdufyLogo';
import { Mail, ArrowRight, CheckCircle2 } from 'lucide-react';

import { useAuth } from '../../context/AuthContext';

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const { resetPassword } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setErrorMsg(null);
    const result = await resetPassword(email);
    setLoading(false);
    if (result.success) {
      setSent(true);
    } else {
      setErrorMsg(result.error || 'Failed to dispatch reset email.');
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F9FC] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <EdufyLogo size="lg" className="justify-center mb-6" />
        <h2 className="font-display text-2xl font-extrabold text-[#111827]">
          Reset your password
        </h2>
        <p className="mt-2 text-xs text-[#64748B]">
          Enter the email associated with your Edufy student or instructor account.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-md rounded-2xl border border-[#E2E8F0] sm:px-10">
          {sent ? (
            <div className="text-center space-y-4">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
              <h3 className="font-bold text-sm text-[#111827]">Reset link dispatched</h3>
              <p className="text-xs text-[#64748B]">
                We have transmitted password reset guidelines to <strong className="text-[#111827]">{email}</strong>.
              </p>
              <Link
                to="/reset-password?token=demo-token"
                className="inline-block mt-2 px-4 py-2 text-xs font-semibold text-white bg-[#004AAD] rounded-lg"
              >
                Proceed to Reset Screen
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMsg && (
                <div className="p-3 text-xs bg-red-50 text-red-700 border border-red-200 rounded-lg">
                  {errorMsg}
                </div>
              )}
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

              <button
                type="submit"
                className="w-full py-2.5 px-4 text-xs font-bold text-white bg-[#004AAD] hover:bg-[#003B8B] rounded-lg shadow transition-colors flex items-center justify-center gap-2"
              >
                <span>Send Reset Link</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="text-center pt-2">
                <Link to="/login" className="text-xs font-medium text-[#004AAD] hover:underline">
                  Back to Sign In
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
