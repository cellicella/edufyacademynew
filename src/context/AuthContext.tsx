import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { authCallbackUrl, siteUrl } from '../lib/siteUrl';
import { disableGoogleAutoSelect } from '../lib/googleIdentity';
import { isNewGoogleAccount, recordRegistration } from '../lib/metaEvents';

interface AuthContextType {
  currentUser: User | null;
  role: UserRole;
  isAuthenticated: boolean;
  isLoading: boolean;
  authError: string | null;
  login: (
    email: string,
    password?: string,
    role?: UserRole
  ) => Promise<{ success: boolean; error?: string; user?: User }>;
  register: (
    name: string,
    email: string,
    password?: string,
    role?: UserRole,
    redirectAfterVerify?: string | null
  ) => Promise<{ success: boolean; error?: string; requiresEmailVerification?: boolean; user?: User }>;
  resendVerification: (email: string, redirectAfterVerify?: string | null) => Promise<{ success: boolean; error?: string }>;
  /** Google via Supabase OAuth (redirects to Google, back through Supabase to /auth/callback). */
  loginWithGoogle: (next?: string | null) => Promise<{ success: boolean; error?: string }>;
  /** Google Identity Services ID token (official Google button / One Tap) → Supabase session. */
  loginWithGoogleIdToken: (idToken: string, rawNonce: string) => Promise<{ success: boolean; error?: string; user?: User }>;
  /** Passwordless sign-in link by email (only for existing accounts). */
  sendMagicLink: (email: string, next?: string | null) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  updatePassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('edufy_user');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed?.id === 'user-std-1' || parsed?.email === 'alex.jordan@edufy.test') {
          localStorage.removeItem('edufy_user');
          return null;
        }
        return parsed;
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const clearError = () => setAuthError(null);

  // Sync profile from Supabase profiles table, with automatic creation fallback
  const fetchSupabaseProfile = async (
    userId: string,
    email: string,
    fallbackMetadata?: { full_name?: string; role?: UserRole; avatar_url?: string }
  ): Promise<User | null> => {
    try {
      let { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.warn('[Auth] Error fetching profile:', error.message);
      }

      // If profile record does not exist in public.profiles, create it
      if (!profile) {
        const role = fallbackMetadata?.role || 'student';
        const fullName = fallbackMetadata?.full_name || email.split('@')[0];
        const newProfile = {
          id: userId,
          email,
          full_name: fullName,
          role,
          avatar_url:
            fallbackMetadata?.avatar_url ||
            'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80',
          headline: `${role.charAt(0).toUpperCase() + role.slice(1)} at Edufy Academy`,
          bio: '',
        };

        const { data: created, error: createErr } = await supabase
          .from('profiles')
          .upsert(newProfile, { onConflict: 'id' })
          .select()
          .maybeSingle();

        if (!createErr && created) {
          profile = created;
        }
      }

      // Fetch user's enrollments and wishlist from Supabase
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('course_id, status')
        .eq('user_id', userId)
        .eq('status', 'active');

      const { data: wishlists } = await supabase
        .from('wishlists')
        .select('course_id')
        .eq('user_id', userId);

      const enrolledIds = enrollments ? enrollments.map((e) => e.course_id) : [];
      const wishlistIds = wishlists ? wishlists.map((w) => w.course_id) : [];

      const role: UserRole = (profile?.role as UserRole) || fallbackMetadata?.role || 'student';
      const user: User = {
        id: userId,
        email,
        name: profile?.full_name || fallbackMetadata?.full_name || email.split('@')[0],
        avatar:
          profile?.avatar_url ||
          fallbackMetadata?.avatar_url ||
          'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80',
        role,
        headline: profile?.headline || `${role.charAt(0).toUpperCase() + role.slice(1)} at Edufy Academy`,
        bio: profile?.bio || '',
        enrolledCourseIds: enrolledIds,
        wishlistCourseIds: wishlistIds,
        completedCourseIds: [],
      };

      setCurrentUser(user);
      localStorage.setItem('edufy_user', JSON.stringify(user));
      return user;
    } catch (err) {
      console.error('[Auth] Failed to load Supabase profile:', err);
      return null;
    }
  };

  // Listen to Supabase Auth State changes and sync session
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    supabase.auth
      .getSession()
      .then(async ({ data: { session } }) => {
        if (!isMounted) return;
        if (session?.user) {
          await fetchSupabaseProfile(
            session.user.id,
            session.user.email || '',
            session.user.user_metadata as any
          );
        } else {
          // No active Supabase session found -> clear cached user state
          setCurrentUser(null);
          localStorage.removeItem('edufy_user');
        }
      })
      .catch((err) => {
        console.warn('[Auth] Session check failed:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;
      // Meta Pixel CompleteRegistration for a brand-new Google account (OAuth redirect or Google button);
      // counted once per account on this browser, sent from the next page where the pixel runs
      if (event === 'SIGNED_IN' && session?.user && isNewGoogleAccount(session.user, Date.now())) {
        recordRegistration(session.user.id, 'google');
      }
      if (session?.user) {
        await fetchSupabaseProfile(
          session.user.id,
          session.user.email || '',
          session.user.user_metadata as any
        );
      } else if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        localStorage.removeItem('edufy_user');
      }
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const role: UserRole = currentUser?.role || 'student';

  // Login handler
  const login = async (
    email: string,
    password?: string,
    _targetRole: UserRole = 'student'
  ): Promise<{ success: boolean; error?: string; user?: User }> => {
    setIsLoading(true);
    setAuthError(null);

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setIsLoading(false);
      const msg = 'Email address is required.';
      setAuthError(msg);
      return { success: false, error: msg };
    }

    if (!password) {
      setIsLoading(false);
      const msg = 'Password is required to sign in.';
      setAuthError(msg);
      return { success: false, error: msg };
    }

    if (isSupabaseConfigured) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        setIsLoading(false);
        let errorMsg = error.message;
        if (error.message.includes('Invalid login credentials')) {
          errorMsg = 'Invalid email or password. Please verify your credentials or register a new account.';
        } else if (error.message.includes('Email not confirmed')) {
          errorMsg = 'Your email address has not been confirmed yet. Please verify your email via the confirmation link or check your inbox.';
        }
        setAuthError(errorMsg);
        return { success: false, error: errorMsg };
      }

      if (data.user) {
        const user = await fetchSupabaseProfile(
          data.user.id,
          data.user.email || cleanEmail,
          data.user.user_metadata as any
        );
        setIsLoading(false);
        return { success: true, user: user || undefined };
      }

      setIsLoading(false);
      return { success: true };
    }

    setIsLoading(false);
    const err = 'Database authentication service is not configured.';
    setAuthError(err);
    return { success: false, error: err };
  };

  // Register handler
  const register = async (
    name: string,
    email: string,
    password?: string,
    userRole: UserRole = 'student',
    redirectAfterVerify?: string | null
  ): Promise<{ success: boolean; error?: string; requiresEmailVerification?: boolean; user?: User }> => {
    setIsLoading(true);
    setAuthError(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();

    if (!cleanName) {
      setIsLoading(false);
      const msg = 'Full name is required.';
      setAuthError(msg);
      return { success: false, error: msg };
    }

    if (!cleanEmail) {
      setIsLoading(false);
      const msg = 'Valid email address is required.';
      setAuthError(msg);
      return { success: false, error: msg };
    }

    if (!password || password.length < 6) {
      setIsLoading(false);
      const msg = 'Password must be at least 6 characters.';
      setAuthError(msg);
      return { success: false, error: msg };
    }

    // Security guardrail: Public registration can NEVER grant the admin role
    const safeRole: UserRole = userRole === 'instructor' ? 'instructor' : 'student';

    if (isSupabaseConfigured) {
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          // The confirmation link returns to THIS deployed site (not Supabase's default Site URL)
          emailRedirectTo: authCallbackUrl(redirectAfterVerify),
          data: {
            full_name: cleanName,
            role: safeRole,
          },
        },
      });

      if (error) {
        setIsLoading(false);
        let message = error.message;
        if (error.message.includes('Database error saving new user')) {
          message = 'Database trigger requires updating. Please run "supabase/fix_auth_trigger.sql" in your Supabase SQL Editor to resolve user creation.';
        } else if (error.message.includes('User already registered')) {
          message = 'An account with this email address already exists. Please sign in instead.';
        }
        setAuthError(message);
        return { success: false, error: message };
      }

      // Meta Pixel CompleteRegistration: Supabase created a new account. (For an email that is already registered,
      // Supabase answers without an identity and no account is created, so nothing is counted.)
      if (data.user?.id && (data.user.identities?.length ?? 0) > 0) {
        recordRegistration(data.user.id, 'email');
      }

      // Check if session was granted immediately (auto-confirm enabled)
      if (data.session?.user) {
        const user = await fetchSupabaseProfile(data.session.user.id, cleanEmail, {
          full_name: cleanName,
          role: userRole,
        });
        setIsLoading(false);
        return { success: true, requiresEmailVerification: false, user: user || undefined };
      } else {
        setIsLoading(false);
        return { success: true, requiresEmailVerification: true };
      }
    }

    setIsLoading(false);
    const err = 'Database service is currently unavailable for registration.';
    setAuthError(err);
    return { success: false, error: err };
  };

  // Logout handler
  const logout = async () => {
    setIsLoading(true);
    if (isSupabaseConfigured) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('[Auth] Sign out notice:', err);
      }
    }
    disableGoogleAutoSelect();
    setCurrentUser(null);
    localStorage.removeItem('edufy_user');
    setIsLoading(false);
  };

  // Resend the sign-up confirmation email (same redirect as registration)
  const resendVerification = async (email: string, redirectAfterVerify?: string | null): Promise<{ success: boolean; error?: string }> => {
    if (!isSupabaseConfigured) return { success: false, error: 'Database service is currently unavailable.' };
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: authCallbackUrl(redirectAfterVerify) },
    });
    if (error) {
      const message = /rate|seconds|too many/i.test(error.message)
        ? 'Please wait a minute before requesting another email.'
        : error.message;
      return { success: false, error: message };
    }
    return { success: true };
  };

  const friendlyOAuthError = (msg: string) =>
    /provider is not enabled|Unsupported provider/i.test(msg)
      ? 'Google sign-in is not switched on for this website yet. Please use email and password, or contact support.'
      : /nonce/i.test(msg)
      ? 'Google sign-in could not be verified. Please try again.'
      : msg;

  // Google (Supabase OAuth redirect flow). Supabase links a Google login to an existing account with the same
  // verified email, so enrollments and progress stay on that account.
  const loginWithGoogle = async (next?: string | null): Promise<{ success: boolean; error?: string }> => {
    setAuthError(null);
    if (!isSupabaseConfigured) return { success: false, error: 'Database service is currently unavailable.' };
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // Return to the site the visitor is on (Supabase only accepts addresses on its Redirect URLs list)
        redirectTo: `${window.location.origin}/auth/callback${next && next.startsWith('/') && !next.startsWith('//') ? `?next=${encodeURIComponent(next)}` : ''}`,
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) {
      const message = friendlyOAuthError(error.message);
      setAuthError(message);
      return { success: false, error: message };
    }
    return { success: true }; // the browser is now navigating to Google
  };

  const loginWithGoogleIdToken = async (idToken: string, rawNonce: string): Promise<{ success: boolean; error?: string; user?: User }> => {
    setAuthError(null);
    if (!isSupabaseConfigured) return { success: false, error: 'Database service is currently unavailable.' };
    const { data, error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken, nonce: rawNonce });
    if (error || !data.session?.user) {
      const message = friendlyOAuthError(error?.message || 'Google sign-in failed.');
      setAuthError(message);
      return { success: false, error: message };
    }
    const u = data.session.user;
    const user = await fetchSupabaseProfile(u.id, u.email || '', u.user_metadata as any);
    return { success: true, user: user || undefined };
  };

  const sendMagicLink = async (email: string, next?: string | null): Promise<{ success: boolean; error?: string }> => {
    setAuthError(null);
    const cleanEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) return { success: false, error: 'Enter a valid email address.' };
    if (!isSupabaseConfigured) return { success: false, error: 'Database service is currently unavailable.' };
    const { error } = await supabase.auth.signInWithOtp({ email: cleanEmail, options: { shouldCreateUser: false, emailRedirectTo: authCallbackUrl(next) } });
    // Same answer whether or not the account exists (no account enumeration)
    if (error && !/not found|signups not allowed|Signups not allowed/i.test(error.message)) {
      if (/rate limit|too many/i.test(error.message)) return { success: false, error: 'Too many requests. Please wait a minute and try again.' };
      return { success: false, error: error.message };
    }
    return { success: true };
  };

  // Password Reset Request
  const resetPassword = async (email: string): Promise<{ success: boolean; error?: string }> => {
    setAuthError(null);
    const cleanEmail = email.trim().toLowerCase();
    if (isSupabaseConfigured) {
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: `${siteUrl()}/reset-password`,
      });
      if (error) {
        setAuthError(error.message);
        return { success: false, error: error.message };
      }
      return { success: true };
    }
    return { success: false, error: 'Database service is currently unavailable.' };
  };

  // Update Password
  const updatePassword = async (newPassword: string): Promise<{ success: boolean; error?: string }> => {
    setAuthError(null);
    if (isSupabaseConfigured) {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) {
        setAuthError(error.message);
        return { success: false, error: error.message };
      }
      return { success: true };
    }
    return { success: false, error: 'Database service is currently unavailable.' };
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        role,
        isAuthenticated: !!currentUser,
        isLoading,
        authError,
        login,
        register,
        resendVerification,
        loginWithGoogle,
        loginWithGoogleIdToken,
        sendMagicLink,
        logout,
        resetPassword,
        updatePassword,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
