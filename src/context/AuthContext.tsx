import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

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
    role?: UserRole
  ) => Promise<{ success: boolean; error?: string; requiresEmailVerification?: boolean; user?: User }>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  updatePassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
  switchRole: (role: UserRole) => Promise<void>;
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
    userRole: UserRole = 'student'
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
    setCurrentUser(null);
    localStorage.removeItem('edufy_user');
    setIsLoading(false);
  };

  // Password Reset Request
  const resetPassword = async (email: string): Promise<{ success: boolean; error?: string }> => {
    setAuthError(null);
    const cleanEmail = email.trim().toLowerCase();
    if (isSupabaseConfigured) {
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
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

  // Switch Role (allows admins to preview student/instructor view)
  const switchRole = async (newRole: UserRole) => {
    if (currentUser) {
      // Disallow non-admins from self-elevating to admin in the client
      if (newRole === 'admin' && currentUser.role !== 'admin') {
        console.warn('[Security] Unauthorized role elevation to admin rejected.');
        return;
      }

      const updated = { ...currentUser, role: newRole };
      setCurrentUser(updated);
      localStorage.setItem('edufy_user', JSON.stringify(updated));
    }
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
        logout,
        resetPassword,
        updatePassword,
        switchRole,
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
