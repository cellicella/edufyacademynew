import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCartWishlist } from '../../context/CartWishlistContext';
import { User, Mail, Bell, Shield, Check, Save } from 'lucide-react';

import { supabase, isSupabaseConfigured } from '../../lib/supabase';

export const StudentProfilePage: React.FC = () => {
  const { currentUser } = useAuth();
  const { showToast } = useCartWishlist();
  const [name, setName] = useState(currentUser?.name || '');
  const [headline, setHeadline] = useState(currentUser?.headline || '');
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(true);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSupabaseConfigured && currentUser?.id) {
      try {
        await supabase
          .from('profiles')
          .update({ full_name: name, headline, bio })
          .eq('id', currentUser.id);
      } catch (err) {
        console.warn('[Profile] Error updating profile:', err);
      }
    }
    showToast('Profile and learning preferences updated', 'success');
  };

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#111827]">Account Settings & Profile</h1>
        <p className="text-xs text-[#64748B] mt-0.5">
          Manage your personal details, credentials, and notification settings.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Profile Card */}
        <div className="bg-white p-6 sm:p-8 rounded-xl border border-[#E2E8F0] space-y-6">
          <h2 className="font-display text-base font-bold text-[#111827]">Public Profile</h2>

          <div className="flex items-center gap-5">
            <img
              src={currentUser?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80'}
              alt="Avatar"
              referrerPolicy="no-referrer"
              className="w-16 h-16 rounded-full object-cover border-2 border-[#E2E8F0]"
            />
            <div>
              <button
                type="button"
                onClick={() => showToast('Avatar upload simulated in prototype', 'info')}
                className="px-3 py-1.5 text-xs font-semibold text-[#004AAD] bg-[#EBF3FF] rounded-lg hover:bg-blue-100 transition-colors"
              >
                Change Avatar
              </button>
              <div className="text-[11px] text-[#64748B] mt-1">JPG, GIF or PNG. Max size 2MB.</div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#111827] uppercase tracking-wider mb-1.5">
                Full Legal Name (For Certificates)
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-[#F7F9FC] border border-[#E2E8F0] rounded-lg text-[#111827] focus:outline-none focus:border-[#004AAD]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#111827] uppercase tracking-wider mb-1.5">
                Professional Headline
              </label>
              <input
                type="text"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-[#F7F9FC] border border-[#E2E8F0] rounded-lg text-[#111827] focus:outline-none focus:border-[#004AAD]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#111827] uppercase tracking-wider mb-1.5">
                Bio
              </label>
              <textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-[#F7F9FC] border border-[#E2E8F0] rounded-lg text-[#111827] focus:outline-none focus:border-[#004AAD]"
              ></textarea>
            </div>
          </div>
        </div>

        {/* Notifications & Preferences */}
        <div className="bg-white p-6 sm:p-8 rounded-xl border border-[#E2E8F0] space-y-4">
          <h2 className="font-display text-base font-bold text-[#111827]">
            Notification Preferences
          </h2>
          <div className="space-y-3">
            <label className="flex items-center justify-between text-xs cursor-pointer">
              <div>
                <div className="font-semibold text-[#111827]">Lecture Q&A Responses</div>
                <div className="text-[#64748B]">Notify me when an instructor or peer answers my questions</div>
              </div>
              <input
                type="checkbox"
                checked={emailNotifications}
                onChange={(e) => setEmailNotifications(e.target.checked)}
                className="rounded border-[#E2E8F0] text-[#004AAD] focus:ring-[#004AAD]"
              />
            </label>

            <label className="flex items-center justify-between text-xs cursor-pointer pt-3 border-t border-[#E2E8F0]">
              <div>
                <div className="font-semibold text-[#111827]">Weekly Progress Digest</div>
                <div className="text-[#64748B]">Weekly summary of study hours, streak status, and certificate progress</div>
              </div>
              <input
                type="checkbox"
                checked={weeklyDigest}
                onChange={(e) => setWeeklyDigest(e.target.checked)}
                className="rounded border-[#E2E8F0] text-[#004AAD] focus:ring-[#004AAD]"
              />
            </label>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="px-6 py-2.5 text-xs font-bold text-white bg-[#004AAD] hover:bg-[#003B8B] rounded-lg shadow transition-colors flex items-center gap-1.5"
          >
            <Save className="w-4 h-4" />
            <span>Save Changes</span>
          </button>
        </div>
      </form>
    </div>
  );
};
