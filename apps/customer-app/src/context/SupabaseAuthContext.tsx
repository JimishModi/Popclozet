import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@popclozet/api-client";
import { clearUserDataDB } from "@/lib/db";
import {
  createProfile,
  getCurrentProfile,
  updateProfile as saveProfileUpdates,
} from "@/services/profileService";
import type { UserProfile } from "@popclozet/domain-contracts";

// ── Local profile cache ────────────────────────────────────────────────────
const PROFILE_CACHE_KEY = 'popclozet_profile_cache';

function cacheProfile(profile: any) {
  try { localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile)); } catch { }
}

function getCachedProfile(): any | null {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function clearCachedProfile() {
  try { localStorage.removeItem(PROFILE_CACHE_KEY); } catch { }
}

// ── Placeholder email helpers ──────────────────────────────────────────────
const PLACEHOLDER_DOMAINS = ['@phone.popclozet.com', '@phone.popclozet.internal'];

export function isPlaceholderEmail(email: string | undefined | null): boolean {
  if (!email) return true;
  return PLACEHOLDER_DOMAINS.some(domain => email.endsWith(domain));
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  needsOnboarding: boolean;
  hasConfirmationResult: boolean;
  signOut: () => Promise<void>;
  updateProfile: (updates: any) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const SupabaseAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [hasConfirmationResult] = useState(false);

  const initialized = useRef(false);

  // Safety timeout
  useEffect(() => {
    const timeout = setTimeout(() => {
      setLoading((prev) => {
        if (prev) {
          console.warn('[Auth] Safety timeout — forcing loading=false after 4s');
          return false;
        }
        return prev;
      });
    }, 4000);
    return () => clearTimeout(timeout);
  }, []);

  // ── Profile fetch ─────────────────────────────────────────────────────────
  const fetchProfile = async (u: User) => {
    console.info('[Auth] fetchProfile started for:', u.email || u.phone || u.id);
    try {
      const profilePromise = getCurrentProfile(u.id);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Profile fetch timeout')), 3000)
      );

      const profileData = await Promise.race([profilePromise, timeoutPromise]) as any;

      if (!profileData) {
        console.info('[Auth] No customer profile found — needs onboarding');
        setNeedsOnboarding(true);
        setProfile(null);
      } else {
        console.info('[Auth] Profile loaded:', profileData.full_name || '(no name)');
        const hasName = !!(profileData.full_name && profileData.full_name.trim().length > 0);
        setNeedsOnboarding(!profileData.onboarding_completed && !hasName);
        setProfile(profileData as any);
        cacheProfile(profileData);
      }
    } catch (error) {
      console.warn("[Auth] Error/timeout fetching profile:", error);
      const cachedProfile = getCachedProfile();
      if (cachedProfile) {
        console.info('[Auth] Using cached profile as fallback');
        setProfile(cachedProfile as any);
        const hasCachedName = !!(cachedProfile.full_name && cachedProfile.full_name.trim().length > 0);
        setNeedsOnboarding(!cachedProfile.onboarding_completed && !hasCachedName);
      } else {
        setNeedsOnboarding(true);
        setProfile(null);
      }
    } finally {
      console.info('[Auth] fetchProfile done — setting loading=false');
      setLoading(false);
    }
  };

  // ── Email verified handler ────────────────────────────────────────────────
  // Called when USER_UPDATED fires with a confirmed email.
  // This is the safety net for cases where the user lands on /home directly
  // instead of going through /auth/verify-email-callback.
  const handleEmailConfirmed = async (confirmedUser: User) => {
    console.info('[Auth] Email confirmed for user:', confirmedUser.id);
    try {
      const { error } = await supabase
        .from('customer_profiles')
        .update({ email_verified: true })
        .eq('user_id', confirmedUser.id);

      if (error) {
        console.warn('[Auth] Failed to set email_verified:', error);
        return;
      }

      // Update local state and cache immediately so UI banners disappear
      setProfile(prev => {
        if (!prev) return prev;
        const updated = { ...prev, email_verified: true };
        cacheProfile(updated);
        return updated as any;
      });

      console.info('[Auth] email_verified set to true in customer_profiles');
    } catch (err) {
      console.warn('[Auth] handleEmailConfirmed error:', err);
    }
  };

  // ── Session init ──────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      console.info('[Auth] Session init started');
      try {
        const { authPersistence } = await import('@/services/authPersistence');
        const cached = await authPersistence.getCachedSession();

        if (cached?.session?.user) {
          console.info('[Auth] Hydrated from cache:', cached.session.user.email || cached.session.user.id);
          setSession(cached.session);
          setUser(cached.session.user);

          const cachedProfile = getCachedProfile();
          if (cachedProfile) {
            setProfile(cachedProfile as any);
            const hasCachedName = !!(cachedProfile.full_name && cachedProfile.full_name.trim().length > 0);
            setNeedsOnboarding(!cachedProfile.onboarding_completed && !hasCachedName);
            initialized.current = true;
            setLoading(false);
            getCurrentProfile(cached.session.user.id).then(freshProfile => {
              if (freshProfile) { setProfile(freshProfile as any); cacheProfile(freshProfile); }
            }).catch(() => { });
          } else if (!initialized.current) {
            initialized.current = true;
            fetchProfile(cached.session.user);
          }
          return;
        }

        const maybeSession = await (supabase.auth as any).getSessionFromUrl?.();
        const sess = maybeSession?.data?.session || maybeSession?.session || null;

        if (sess) {
          setSession(sess);
          setUser(sess.user);
          if (!initialized.current) {
            initialized.current = true;
            await fetchProfile(sess.user);
          }
          try {
            const clean = window.location.origin + window.location.pathname + window.location.search;
            window.history.replaceState({}, document.title, clean);
          } catch { }
          return;
        }

        const sessionPromise = supabase.auth.getSession();
        const sessionTimeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('[Auth] getSession timeout after 3s')), 3000)
        );

        let current: any = null;
        try {
          const { data } = await Promise.race([sessionPromise, sessionTimeout]);
          current = data.session;
        } catch (timeoutErr) {
          console.warn(timeoutErr);
          setLoading(false);
          return;
        }

        if (!current) { setLoading(false); return; }

        setSession(current);
        setUser(current.user);
        if (!initialized.current) {
          initialized.current = true;
          fetchProfile(current.user);
        }
      } catch (err) {
        console.error('[Auth] Error during session init:', err);
        setLoading(false);
      }
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        if (!session?.user) return;
        setSession(session);
        setUser(session.user);

        const emailConfirmedAt = session.user.email_confirmed_at;
        const email = session.user.email;
        const isReal = email && !isPlaceholderEmail(email);

        if (emailConfirmedAt && isReal) {
          console.info(`[Auth] ${event} with confirmed email — marking verified`);
          handleEmailConfirmed(session.user);
        }

        if (event === "SIGNED_IN") {
          // Always re-fetch on sign in
          initialized.current = true;
          setLoading(true);
          fetchProfile(session.user);
        } else {
          setLoading(false);
        }
      } else if (event === "SIGNED_OUT") {
        setSession(null); setUser(null); setProfile(null);
        setNeedsOnboarding(false);
        initialized.current = false;
        setLoading(false);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── Update profile ────────────────────────────────────────────────────────
  const updateProfile = async (updates: any) => {
    if (!user) throw new Error("No authenticated user");
    try {
      const currentEmail = user.email || '';
      const currentEmailIsPlaceholder = isPlaceholderEmail(currentEmail);
      const incomingEmail = updates.email;
      const isEmailChanging = incomingEmail && incomingEmail !== currentEmail;

      if (isEmailChanging) {
        if (currentEmailIsPlaceholder) {
          // Placeholder email — skip auth.updateUser (it rejects invalid domains)
          // The link-email edge function handles updating auth.users
          console.info('[Auth] Placeholder email — saving real email to profile only');
          updates = { ...updates, email_verified: false };
        } else {
          console.info('[Auth] Updating email in Supabase Auth to:', incomingEmail);
          const { error: authError } = await supabase.auth.updateUser({ email: incomingEmail });
          if (authError) throw authError;
          updates = { ...updates, email_verified: false };
        }
      }

      const current = await getCurrentProfile(user.id);

      if (current) {
        const updated = await saveProfileUpdates(updates);
        setProfile(updated as any);
        cacheProfile(updated);
      } else {
        const created = await createProfile({
          ...updates,
          full_name: updates.full_name || "",
          phone: updates.phone || (user.phone || ""),
          email: updates.email || user.email || "",
          gender: updates.gender,
          role: "customer",
        });
        setProfile(created as any);
        cacheProfile(created);
      }

      setNeedsOnboarding(false);
    } catch (error: any) {
      console.error("Error updating profile:", error);
      throw error;
    }
  };

  // ── Refresh profile ───────────────────────────────────────────────────────
  const refreshProfile = async () => {
    if (!user) return;
    await fetchProfile(user);
  };

  // ── Sign out ──────────────────────────────────────────────────────────────
  const signOut = async () => {
    if (user?.id) {
      try { await clearUserDataDB(user.id); } catch { }
    }
    try {
      await Promise.race([
        supabase.auth.signOut(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Sign out timeout')), 2000))
      ]);
    } catch (error) {
      console.warn("[Auth] Supabase sign out failed or timed out:", error);
    }

    initialized.current = false;
    setUser(null); setProfile(null); setSession(null);
    setNeedsOnboarding(false); setLoading(false);
    clearCachedProfile();
  };

  return (
    <AuthContext.Provider value={{
      user, profile, session, loading, needsOnboarding, hasConfirmationResult,
      signOut, updateProfile, refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within SupabaseAuthProvider");
  return ctx;
};
    }

initialized.current = false;
setUser(null); setProfile(null); setSession(null);
setNeedsOnboarding(false); setLoading(false);
clearCachedProfile();
  };

return (
  <AuthContext.Provider value={{
    user, profile, session, loading, needsOnboarding, hasConfirmationResult,
    signOut, updateProfile, refreshProfile,
  }}>
    {children}
  </AuthContext.Provider>
);
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within SupabaseAuthProvider");
  return ctx;
};
