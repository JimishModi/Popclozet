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
import { authPersistence } from "@/services/authPersistence";

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

// ── Types ──────────────────────────────────────────────────────────────────
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

// ── Provider ───────────────────────────────────────────────────────────────
export const SupabaseAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Sync hydration for instant page loads (no flicker)
  const [session, setSession] = useState<Session | null>(() => authPersistence.getCachedSessionSync().session);
  const [user, setUser] = useState<User | null>(() => authPersistence.getCachedSessionSync().session?.user || null);
  const [profile, setProfile] = useState<UserProfile | null>(() => getCachedProfile());
  
  const [loading, setLoading] = useState(() => !authPersistence.getCachedSessionSync().session);
  const [needsOnboarding, setNeedsOnboarding] = useState(() => {
    const p = getCachedProfile();
    return p ? !p.onboarding_completed && !(p.full_name && p.full_name.trim().length > 0) : false;
  });
  const [hasConfirmationResult] = useState(false);

  const initialized = useRef(!!authPersistence.getCachedSessionSync().session);

  // ── Safety timeout — never leave the app stuck on loading ─────────────────
  useEffect(() => {
    const timeout = setTimeout(() => {
      setLoading(prev => {
        if (prev) console.warn('[Auth] Safety timeout — forcing loading=false after 4s');
        return false;
      });
    }, 4000);
    return () => clearTimeout(timeout);
  }, []);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const resolveNeedsOnboarding = (p: any) =>
    !p.onboarding_completed && !(p.full_name && p.full_name.trim().length > 0);

  // ── fetchProfile ──────────────────────────────────────────────────────────
  const fetchProfile = async (u: User) => {
    console.info('[Auth] fetchProfile for:', u.email || u.phone || u.id);
    try {
      const profileData = await Promise.race([
        getCurrentProfile(u.id),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Profile fetch timeout')), 3000)),
      ]) as any;

      if (!profileData) {
        console.info('[Auth] No profile found — needs onboarding');
        setNeedsOnboarding(true);
        setProfile(null);
      } else {
        console.info('[Auth] Profile loaded:', profileData.full_name || '(no name)');
        setNeedsOnboarding(resolveNeedsOnboarding(profileData));
        setProfile(profileData as any);
        cacheProfile(profileData);
      }
    } catch (err) {
      console.warn('[Auth] fetchProfile error/timeout:', err);
      const cached = getCachedProfile();
      if (cached) {
        setProfile(cached as any);
        setNeedsOnboarding(resolveNeedsOnboarding(cached));
      } else {
        setNeedsOnboarding(true);
        setProfile(null);
      }
    } finally {
      setLoading(false);
    }
  };

  // ── handleEmailConfirmed ──────────────────────────────────────────────────
  const handleEmailConfirmed = async (confirmedUser: User) => {
    console.info('[Auth] Marking email verified for:', confirmedUser.id);
    try {
      const { error } = await supabase
        .from('customer_profiles')
        .update({ email_verified: true })
        .eq('user_id', confirmedUser.id);

      if (error) { console.warn('[Auth] Failed to set email_verified:', error); return; }

      setProfile(prev => {
        if (!prev) return prev;
        const updated = { ...prev, email_verified: true };
        cacheProfile(updated);
        return updated as any;
      });
    } catch (err) {
      console.warn('[Auth] handleEmailConfirmed error:', err);
    }
  };

  // ── Session init ──────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      console.info('[Auth] Session sync check...');
      try {
        const { data } = await Promise.race([
          supabase.auth.getSession(),
          new Promise<any>((_, reject) => setTimeout(() => reject(new Error('getSession timeout')), 3000)),
        ]);
        
        const current = data.session;
        if (current) {
          setSession(current);
          setUser(current.user);
          // If we weren't already initialized by the cache, fetch profile now
          if (!initialized.current) {
            initialized.current = true;
            await fetchProfile(current.user);
          } else {
            // Background refresh even if cached
            getCurrentProfile(current.user.id).then(p => {
              if (p) {
                setProfile(p as any);
                cacheProfile(p);
                setNeedsOnboarding(resolveNeedsOnboarding(p));
              }
            }).catch(() => {});
          }
        }
      } catch (err) {
        console.warn('[Auth] getSession error or timeout:', err);
      } finally {
        setLoading(false);
      }
    })();

    // ── Auth state listener ─────────────────────────────────────────────────
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.info('[Auth] event:', event);
      if (event === 'SIGNED_OUT') {
        setSession(null); setUser(null); setProfile(null);
        setNeedsOnboarding(false);
        initialized.current = false;
        setLoading(false);
        return;
      }

      if (!session?.user) return;
      setSession(session);
      setUser(session.user);

      if (event === 'SIGNED_IN') {
        // Always re-fetch on sign in — ensures OTP users hit fetchProfile
        // even if the page was already initialized before login
        initialized.current = true;
        setLoading(true);
        fetchProfile(session.user);
        // fetchProfile calls setLoading(false) in its finally block — don't call it here
      } else {
        setLoading(false);
      }

      // Check for email verification on multiple events for robustness
      if (event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
        const { email, email_confirmed_at } = session.user;
        if (email_confirmed_at && email && !isPlaceholderEmail(email)) {
          handleEmailConfirmed(session.user);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── updateProfile ─────────────────────────────────────────────────────────
  const updateProfile = async (updates: any) => {
    if (!user) throw new Error('No authenticated user');

    const currentEmail = user.email || '';
    const incomingEmail = updates.email;
    const isEmailChanging = incomingEmail && incomingEmail !== currentEmail;

    if (isEmailChanging) {
      if (isPlaceholderEmail(currentEmail)) {
        // Cannot call auth.updateUser — Supabase rejects invalid placeholder domains.
        // The link-email edge function handles updating auth.users server-side.
        console.info('[Auth] Placeholder email — skipping auth.updateUser');
      } else {
        console.info('[Auth] Updating auth email to:', incomingEmail);
        const { error } = await supabase.auth.updateUser({ email: incomingEmail });
        if (error) throw error;
      }
      updates = { ...updates, email_verified: false };
    }

    const current = await getCurrentProfile(user.id);
    let result: any;

    if (current) {
      result = await saveProfileUpdates(updates);
    } else {
      result = await createProfile({
        ...updates,
        full_name: updates.full_name || '',
        phone: updates.phone || user.phone || '',
        email: updates.email || currentEmail,
        gender: updates.gender,
        role: 'customer',
      });
    }

    setProfile(result as any);
    cacheProfile(result);
    setNeedsOnboarding(false);
  };

  // ── refreshProfile ────────────────────────────────────────────────────────
  const refreshProfile = async () => {
    if (user) await fetchProfile(user);
  };

  // ── signOut ───────────────────────────────────────────────────────────────
  const signOut = async () => {
    if (user?.id) { try { await clearUserDataDB(user.id); } catch { } }

    try {
      await Promise.race([
        supabase.auth.signOut(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Sign out timeout')), 2000)),
      ]);
    } catch (err) {
      console.warn('[Auth] Sign out failed or timed out:', err);
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

// ── Hook ───────────────────────────────────────────────────────────────────
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within SupabaseAuthProvider');
  return ctx;
};
