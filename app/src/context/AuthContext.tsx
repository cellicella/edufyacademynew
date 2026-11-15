import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { signInWithGoogleBrowser } from '@/services/googleAuth';
import type { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { config } from '@/lib/config';
import { Profile } from '@/lib/types';
import { loadOrCreateProfile } from '@/services/profile';
import { authMessage } from '@/logic/authErrors';
import { friendlyMessage } from '@/logic/apiErrors';
import { unregisterPush } from '@/services/push';

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  profileError: string | null;
  initializing: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  /** Google via Supabase OAuth in the system browser. Resolves 'cancelled' when the student closes it. */
  signInWithGoogle: () => Promise<'signed_in' | 'cancelled'>;
  signUp: (fullName: string, email: string, password: string, phone?: string | null) => Promise<{ needsVerification: boolean }>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  const userIdRef = useRef<string | null>(null);

  const loadProfile = useCallback(async (s: Session | null) => {
    if (!s?.user) {
      setProfile(null);
      setProfileError(null);
      return;
    }
    try {
      const p = await loadOrCreateProfile(s.user.id, s.user.email || '', s.user.user_metadata?.full_name, s.user.user_metadata?.phone);
      if (userIdRef.current === s.user.id) {
        setProfile(p);
        setProfileError(null);
      }
    } catch (e) {
      // Keep the session; the Profile tab shows a retry option.
      setProfileError(friendlyMessage(e, 'Could not load your profile.'));
    }
  }, []);

  useEffect(() => {
    let alive = true;
    // INITIAL_SESSION fires once on subscribe with the stored session (refreshed if needed).
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (!alive) return;
      const previousUser = userIdRef.current;
      userIdRef.current = s?.user?.id || null;
      setSession(s);
      // Supabase warns against awaiting other Supabase calls inside this callback (it can
      // deadlock the auth lock), so profile loading is deferred to the next tick.
      if (event === 'INITIAL_SESSION') {
        setTimeout(async () => {
          await loadProfile(s);
          if (alive) setInitializing(false);
        }, 0);
      } else if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        if (previousUser !== userIdRef.current || event === 'USER_UPDATED') setTimeout(() => loadProfile(s), 0);
      } else if (event === 'SIGNED_OUT') {
        setProfile(null);
        setProfileError(null);
        queryClient.clear(); // drop the previous student's cached data
      }
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile, queryClient]);

  const value = useMemo<AuthState>(
    () => ({
      session,
      profile,
      profileError,
      initializing,
      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
        if (error) throw new Error(authMessage(error));
      },
      signInWithGoogle: () => signInWithGoogleBrowser(),
      async signUp(fullName, email, password, phone) {
        // Public registration always creates a student account (same rule as the website).
        const { data, error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          // The confirmation link opens the Edufy website's verification page (never localhost)
          options: { data: { full_name: fullName.trim(), role: 'student', ...(phone ? { phone } : {}) }, emailRedirectTo: config.signupRedirect },
        });
        if (error) throw new Error(authMessage(error));
        // With email confirmation on, Supabase returns a user with no identities if the email exists
        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          throw new Error('An account with this email already exists. Please sign in.');
        }
        return { needsVerification: !data.session };
      },
      async signOut() {
        // Detach this phone's push token first (needs the session), so the next person to sign in
        // here doesn't receive this student's notifications. Never blocks logout.
        await Promise.race([unregisterPush(), new Promise((r) => setTimeout(r, 4000))]);
        // 'local' signs out this device only — the student stays signed in on the website.
        const { error } = await supabase.auth.signOut({ scope: 'local' });
        if (error) console.warn('[auth] sign-out:', error.message);
      },
      async requestPasswordReset(email) {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: config.resetRedirect });
        if (error) throw new Error(authMessage(error));
      },
      async updatePassword(password) {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw new Error(authMessage(error));
      },
      async refreshProfile() {
        const { data } = await supabase.auth.getSession();
        await loadProfile(data.session);
      },
    }),
    [session, profile, profileError, initializing, loadProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
