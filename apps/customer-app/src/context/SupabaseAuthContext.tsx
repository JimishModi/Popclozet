import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@popclozet/api-client";
import { clearUserDataDB } from "@/lib/db";
// Inline profile service methods since the separate file is missing
const getCurrentProfile = async (userId: string) => {
  const { data, error } = await supabase.from('profiles').select('*').eq('user_id', userId).single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
};

const serviceUpdateProfile = async (updates: any) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not logged in");
  const { data, error } = await supabase.from('profiles').update(updates).eq('user_id', user.id).select().single();
  if (error) throw error;
  return data;
};

const createProfile = async (profileInput: any) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not logged in");
  const { data, error } = await supabase.from('profiles').insert([{ ...profileInput, id: user.id, user_id: user.id }]).select().single();
  if (error) throw error;
  return data;
};
import type { UserProfile } from "@popclozet/domain-contracts";

// ── Local profile cache (avoids Supabase cold-start delay) ──
const PROFILE_CACHE_KEY = 'popclozet_profile_cache';

function cacheProfile(profile: any) {
  try { localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile)); } catch { /* ignore */ }
}

function getCachedProfile(): any | null {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function clearCachedProfile() {
  try { localStorage.removeItem(PROFILE_CACHE_KEY); } catch { /* ignore */ }
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  needsOnboarding: boolean;
  hasConfirmationResult: boolean;

  signInWithPhoneNumber: (phone: string) => Promise<void>;
  confirmOTP: (otp: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: any) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

let pendingPhoneNumber: string | null = null;

export const SupabaseAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [hasConfirmationResult, setHasConfirmationResult] = useState(false);

  // prevents redirect loops
  const initialized = useRef(false);

  // Safety timeout — fires ONCE on mount only to prevent infinite loading state.
  // Reduced to 4s for snappy UX — if auth hasn't resolved by then, unblock the app.
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- PROFILE FETCH ---------- */
  const fetchProfile = async (u: User) => {
    console.info('[Auth] fetchProfile started for:', u.email || u.id);
    try {
      const profilePromise = getCurrentProfile(u.id);
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Profile fetch timeout')), 3000));

      const profileData = await Promise.race([profilePromise, timeoutPromise]) as any;

      if (!profileData) {
        console.info('[Auth] No profile found — needs onboarding');
        setNeedsOnboarding(true);
        setProfile(null);
      } else {
        console.info('[Auth] Profile loaded:', profileData.full_name || '(no name)');
        setNeedsOnboarding(!profileData.onboarding_completed);
        setProfile(profileData as any);
        cacheProfile(profileData); // Cache for instant hydration next time
      }
    } catch (error) {
      console.warn("[Auth] Error/timeout fetching profile:", error);
      // Try to use cached profile as fallback
      const cachedProfile = getCachedProfile();
      if (cachedProfile) {
        console.info('[Auth] Using cached profile as fallback');
        setProfile(cachedProfile as any);
        setNeedsOnboarding(!cachedProfile.onboarding_completed);
      } else {
        setNeedsOnboarding(false);
        setProfile(null);
      }
    } finally {
      console.info('[Auth] fetchProfile done — setting loading=false');
      setLoading(false);
    }
  };

  /* ---------- SESSION INIT ---------- */
  useEffect(() => {

    (async () => {
      console.info('[Auth] Session init started');
      try {
        // ─── STEP 1: Try instant hydration from IndexedDB cache ───
        // This avoids blocking on Supabase cold-start (free tier can take 5-15s)
        const { authPersistence } = await import('@/services/authPersistence');
        const cached = await authPersistence.getCachedSession();

        if (cached?.session?.user) {
          console.info('[Auth] Hydrated from cache:', cached.session.user.email || cached.session.user.id);
          setSession(cached.session);
          setUser(cached.session.user);

          // Also restore cached profile instantly
          const cachedProfile = getCachedProfile();
          if (cachedProfile) {
            console.info('[Auth] Profile restored from cache:', cachedProfile.full_name || '(no name)');
            setProfile(cachedProfile as any);
            setNeedsOnboarding(!cachedProfile.onboarding_completed);
            initialized.current = true;
            setLoading(false);
            // Still try to refresh profile in the background (non-blocking)
            getCurrentProfile(cached.session.user.id).then(freshProfile => {
              if (freshProfile) {
                setProfile(freshProfile as any);
                cacheProfile(freshProfile);
              }
            }).catch(() => { /* ignore background refresh failure */ });
          } else if (!initialized.current) {
            initialized.current = true;
            fetchProfile(cached.session.user);
          }
          return;
        }

        // ─── STEP 2: Handle OAuth redirect callback ───
        const maybeSession = await (supabase.auth as any).getSessionFromUrl?.();
        const sess = maybeSession?.data?.session || maybeSession?.session || null;

        if (sess) {
          console.info('[Auth] OAuth session found');
          setSession(sess);
          setUser(sess.user);
          if (!initialized.current) {
            initialized.current = true;
            await fetchProfile(sess.user);
          }
          try {
            const clean = window.location.origin + window.location.pathname + window.location.search;
            window.history.replaceState({}, document.title, clean);
          } catch (e) { /* ignore */ }
          return;
        }

        // ─── STEP 3: No cache, no OAuth — try getSession with timeout ───
        console.info('[Auth] No cache — trying getSession()...');
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
          // Don't block — onAuthStateChange will pick it up later
          setLoading(false);
          return;
        }

        if (!current) {
          console.info('[Auth] No active session found');
          setLoading(false);
          return;
        }

        console.info('[Auth] Session recovered for user:', current.user?.email || current.user?.id);
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

    // listen ONLY for real login or session updates without triggering loading states
    const { data: { subscription } } =
      supabase.auth.onAuthStateChange((event, session) => {

        if (event === "SIGNED_OUT") {
          setSession(null);
          setUser(null);
          setProfile(null);
          return;
        }

        if (!session?.user) return;

        setSession(session);
        setUser(session.user);

        // Only fetch profile and show loading if it's a new sign-in
        if (event === "SIGNED_IN" && !initialized.current) {
          initialized.current = true;
          setLoading(true);
          fetchProfile(session.user);
        } else {
          // Token refreshes shouldn't block the UI
          setLoading(false);
        }
      });

    return () => subscription.unsubscribe();
  }, []);

  /* ---------- PHONE OTP ---------- */
  const signInWithPhoneNumber = async (phone: string) => {
    const { error } = await supabase.auth.signInWithOtp({ phone });
    if (error) throw error;

    pendingPhoneNumber = phone;
    setHasConfirmationResult(true);
  };

  const confirmOTP = async (otp: string) => {
    if (!pendingPhoneNumber) throw new Error("No pending login");

    const { error } = await supabase.auth.verifyOtp({
      phone: pendingPhoneNumber,
      token: otp,
      type: "sms",
    });

    if (error) throw error;

    pendingPhoneNumber = null;
    setHasConfirmationResult(false);
  };

  /* ---------- GOOGLE ---------- */
  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` }
    });
  };

  /* ---------- PROFILE SAVE ---------- */
  const updateProfile = async (updates: any) => {
    if (!user) throw new Error("No authenticated user");
    try {
      // If a profile exists, update it; otherwise create a new one with required fields.
      const current = await getCurrentProfile(user.id);

      if (current) {
        // use server helper that updates by user_id
        const updated = await serviceUpdateProfile(updates);
        setProfile(updated as any);
      } else {
        // ensure phone is present for DB NOT NULL constraints
        const created = await createProfile({
          full_name: updates.full_name || "",
          phone: updates.phone || (user.phone || ""),
        });

        setProfile(created as any);
      }

      // stabilize routing / loading
      setNeedsOnboarding(false);
    } catch (error) {
      console.error("Error upserting profile:", error);
      throw error;
    }
  };

  /* ---------- SIGN OUT ---------- */
  const signOut = async () => {
    // Clear this user's cart & wishlist from IndexedDB before signing out
    if (user?.id) {
      try {
        await clearUserDataDB(user.id);
      } catch (e) {
        console.warn("[Auth] Failed to clear user data from IndexedDB:", e);
      }
    }

    try {
      await Promise.race([
        supabase.auth.signOut(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Sign out timeout')), 2000))
      ]);
    } catch (error) {
      console.warn("[Auth] Supabase sign out failed or timed out, clearing local state anyway:", error);
    } finally {
    }

    initialized.current = false;
    setUser(null);
    setProfile(null);
    setSession(null);
    setNeedsOnboarding(false);
    setLoading(false);
    clearCachedProfile();
  };

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      session,
      loading,
      needsOnboarding,
      hasConfirmationResult,
      signInWithPhoneNumber,
      confirmOTP,
      signInWithGoogle,
      signOut,
      updateProfile,
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