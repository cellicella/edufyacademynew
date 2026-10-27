import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCartWishlist } from '../../context/CartWishlistContext';
import { courseService } from '../../services/api';
import {
  GraduationCap,
  Sparkles,
  TrendingUp,
  Users,
  Award,
  Video,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

export const BecomeInstructorPage: React.FC = () => {
  const { currentUser, role } = useAuth();
  const { showToast } = useCartWishlist();
  const navigate = useNavigate();

  const [headline, setHeadline] = useState(currentUser?.headline || 'Lead Software Instructor');
  const [bio, setBio] = useState(
    currentUser?.bio ||
      'Passionate engineer and educator with 8+ years building enterprise systems and teaching practical engineering.'
  );
  const [expertise, setExpertise] = useState('Full Stack Web Development');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const isAlreadyInstructor = role === 'instructor' || role === 'admin';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      showToast('Please sign in to apply as an instructor.', 'warning');
      navigate('/login?redirect=/become-instructor');
      return;
    }

    try {
      setLoading(true);
      const res = await courseService.applyToBecomeInstructor({
        headline,
        bio,
      });

      setSuccess(true);
      showToast(res.message || 'Instructor privileges activated!', 'success');

      // Reload or refresh auth
      setTimeout(() => {
        window.location.href = '/instructor/courses/new';
      }, 1500);
    } catch (err: any) {
      console.error('Instructor application error:', err);
      showToast(err.message || 'Failed to submit application.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-12">
        {/* Hero Section */}
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold text-[#004AAD] bg-[#EBF3FF] border border-[#004AAD]/15">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Edufy Instructor Guild</span>
          </span>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-[#111827] tracking-tight">
            Come Teach With Us & Inspire Thousands of Engineers
          </h1>
          <p className="text-sm sm:text-base text-[#64748B] leading-relaxed">
            Share your knowledge with ambitious students worldwide. Leverage our Udemy-style course creator, stream video lessons, and earn lifetime royalties in Indian Rupees (₹).
          </p>
        </div>

        {/* Value Proposition Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-[#E2E8F0] shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#004AAD] flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
            <h3 className="font-display text-sm font-bold text-[#111827]">Earn Direct Royalties</h3>
            <p className="text-xs text-[#64748B] leading-relaxed">
              Set your own course prices in INR with transparent Razorpay payouts directly to your bank account.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-[#E2E8F0] shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-[#5E17EB] flex items-center justify-center">
              <Video className="w-5 h-5" />
            </div>
            <h3 className="font-display text-sm font-bold text-[#111827]">Udemy-Style Creator Studio</h3>
            <p className="text-xs text-[#64748B] leading-relaxed">
              Upload videos, organize structured sections, attach resources, and preview live before publishing.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-[#E2E8F0] shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Award className="w-5 h-5" />
            </div>
            <h3 className="font-display text-sm font-bold text-[#111827]">Accredited Certificates</h3>
            <p className="text-xs text-[#64748B] leading-relaxed">
              Your students receive verifiable digital certificates backed by SHA-256 cryptographic proof.
            </p>
          </div>
        </div>

        {/* Application or Active Status Card */}
        <div className="bg-white rounded-3xl border border-[#E2E8F0] p-8 sm:p-10 shadow-sm max-w-2xl mx-auto">
          {isAlreadyInstructor ? (
            <div className="text-center space-y-4">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h2 className="font-display text-xl font-bold text-[#111827]">
                Your Instructor Status is Active!
              </h2>
              <p className="text-xs text-[#64748B] max-w-md mx-auto">
                You already possess instructor permissions on Edufy Academy. You can build new masterclasses, manage lessons, and inspect student metrics.
              </p>
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  to="/instructor/courses/new"
                  className="w-full sm:w-auto px-6 py-2.5 text-xs font-bold text-white bg-[#004AAD] hover:bg-[#003B8B] rounded-xl shadow transition-colors flex items-center justify-center gap-2"
                >
                  <Video className="w-4 h-4" />
                  <span>Launch Course Creator</span>
                </Link>
                <Link
                  to="/instructor/courses"
                  className="w-full sm:w-auto px-6 py-2.5 text-xs font-bold text-[#111827] bg-[#F1F5F9] hover:bg-[#E2E8F0] rounded-xl transition-colors"
                >
                  View Course Catalog
                </Link>
              </div>
            </div>
          ) : success ? (
            <div className="text-center space-y-4">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h2 className="font-display text-xl font-bold text-[#111827]">
                Welcome to the Edufy Faculty!
              </h2>
              <p className="text-xs text-[#64748B]">
                Your instructor account has been created. Redirecting you to the Course Creator studio...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <h2 className="font-display text-lg font-bold text-[#111827]">
                  Instructor Application & Profile Setup
                </h2>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Complete your instructor bio to start creating your curriculum right away.
                </p>
              </div>

              {!currentUser && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center justify-between">
                  <span>Sign in required before submitting.</span>
                  <Link to="/login?redirect=/become-instructor" className="font-bold underline">
                    Sign In &rarr;
                  </Link>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#111827] mb-1">
                    Professional Headline <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={headline}
                    onChange={(e) => setHeadline(e.target.value)}
                    placeholder="e.g. Senior Full-Stack Architect & Cloud Consultant"
                    className="w-full px-3.5 py-2 text-xs bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg focus:outline-none focus:border-[#004AAD] text-[#111827]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#111827] mb-1">
                    Primary Domain of Expertise
                  </label>
                  <input
                    type="text"
                    required
                    value={expertise}
                    onChange={(e) => setExpertise(e.target.value)}
                    placeholder="e.g. React, Next.js, Node.js & System Architecture"
                    className="w-full px-3.5 py-2 text-xs bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg focus:outline-none focus:border-[#004AAD] text-[#111827]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#111827] mb-1">
                    Instructor Bio & Teaching Experience <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Briefly describe your professional background, past mentoring experience, and courses you plan to publish..."
                    className="w-full px-3.5 py-2 text-xs bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg focus:outline-none focus:border-[#004AAD] text-[#111827]"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 text-xs font-bold text-white bg-[#004AAD] hover:bg-[#003B8B] rounded-xl shadow transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <span>{loading ? 'Activating Profile...' : 'Activate Instructor Studio'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
