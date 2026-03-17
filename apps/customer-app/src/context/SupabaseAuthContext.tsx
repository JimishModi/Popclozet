import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@popclozet/api-client";
import { clearUserDataDB } from "@/lib/db";

// ── Profile service methods using customer_profiles table ──────────────────
const getCurrentProfile = async (userId: string) => {
  const { data, error } = await supabase
    .from('customer_profiles')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
};

const serviceUpdateProfile = async (updates: any) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not logged in");
  const { data, error } = await supabase
    .from('customer_profiles')
    .update(updates)
    .eq('user_id', user.id)
    .select()
    .single();
  if (error) throw error;
  return data;
};

const createProfile = async (profileInput: any) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not logged in");
  const { data, error } = await supabase
    .from('customer_profiles')
    .insert([{ ...profileInput, id: user.id, user_id: user.id }])
    .select()
    .single();
  if (error) throw error;
  return data;
};

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

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  needsOnboarding: boolean;
  hasConfirmationResult: boolean;

  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: any) => Promise<void>;
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

  // ── Profile fetch from customer_profiles ─────────────────────────────────
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
        setNeedsOnboarding(!profileData.onboarding_completed);
        setProfile(profileData as any);
        cacheProfile(profileData);
      }
    } catch (error) {
      console.warn("[Auth] Error/timeout fetching profile:", error);
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

  // ── Session init ──────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      console.info('[Auth] Session init started');
      try {
        // Step 1: Try IndexedDB cache
        const { authPersistence } = await import('@/services/authPersistence');
        const cached = await authPersistence.getCachedSession();

        if (cached?.session?.user) {
          console.info('[Auth] Hydrated from cache:', cached.session.user.email || cached.session.user.id);
          setSession(cached.session);
          setUser(cached.session.user);

          const cachedProfile = getCachedProfile();
          if (cachedProfile) {
            setProfile(cachedProfile as any);
            setNeedsOnboarding(!cachedProfile.onboarding_completed);
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

        // Step 2: OAuth redirect
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

        // Step 3: getSession with timeout
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

        if (!current) {
          setLoading(false);
          return;
        }

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
      if (event === "SIGNED_OUT") {
        setSession(null); setUser(null); setProfile(null);
        return;
      }
      if (!session?.user) return;

      setSession(session);
      setUser(session.user);

      if (event === "SIGNED_IN" && !initialized.current) {
        initialized.current = true;
        setLoading(true);
        fetchProfile(session.user);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── Google sign in ────────────────────────────────────────────────────────
  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` }
    });
  };

  // ── Update profile in customer_profiles ───────────────────────────────────
  const updateProfile = async (updates: any) => {
    if (!user) throw new Error("No authenticated user");
    try {
      const current = await getCurrentProfile(user.id);

      if (current) {
        const updated = await serviceUpdateProfile(updates);
        setProfile(updated as any);
        cacheProfile(updated);
      } else {
        const created = await createProfile({
          ...updates,
          full_name: updates.full_name || "",
          phone: updates.phone || (user.phone || ""),
          email: updates.email || (user.email || ""),
        });
        setProfile(created as any);
        cacheProfile(created);
      }

      setNeedsOnboarding(false);
    } catch (error) {
      console.error("Error upserting customer profile:", error);
      throw error;
    }
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
      signInWithGoogle, signOut, updateProfile,
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