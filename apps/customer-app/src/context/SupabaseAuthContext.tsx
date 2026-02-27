import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@popclozet/api-client";
// Inline profile service methods since the separate file is missing
const getCurrentProfile = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.from('profiles').select('*').eq('user_id', user.id).single();
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
  const { data, error } = await supabase.from('profiles').insert([{ ...profileInput, user_id: user.id }]).select().single();
  if (error) throw error;
  return data;
};
import type { UserProfile } from "@popclozet/domain-contracts";

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

  /* ---------- PROFILE FETCH ---------- */
  const fetchProfile = async (u: User) => {
    try {
      const profileData = await getCurrentProfile();

      if (!profileData) {
        setNeedsOnboarding(true);
        setProfile(null);
      } else {
        setNeedsOnboarding(!profileData.onboarding_completed);
        setProfile(profileData as any);
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
      setNeedsOnboarding(true);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  /* ---------- SESSION INIT ---------- */
  useEffect(() => {

    // Handle OAuth redirect callback if present in URL (supabase returns session in URL)
    (async () => {
      try {
        const maybeSession = await (supabase.auth as any).getSessionFromUrl?.();
        // supabase may return { data: { session } } or { data }
        const sess = maybeSession?.data?.session || maybeSession?.session || null;

        if (sess) {
          setSession(sess);
          setUser(sess.user);
          if (!initialized.current) {
            initialized.current = true;
            await fetchProfile(sess.user);
          }
          // remove auth fragments/queries from URL to avoid confusing router
          try {
            const clean = window.location.origin + window.location.pathname + window.location.search;
            window.history.replaceState({}, document.title, clean);
          } catch (e) {
            // ignore
          }
          return;
        }

        // initial load (refresh) when no OAuth callback present
        const { data } = await supabase.auth.getSession();
        const current = data.session;

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
        console.error('Error during auth session init:', err);
        setLoading(false);
      }
    })();

    // listen ONLY for real login
    const { data: { subscription } } =
      supabase.auth.onAuthStateChange((event, session) => {

        if (event !== "SIGNED_IN") return;
        if (!session?.user) return;
        if (initialized.current) return;

        initialized.current = true;

        setSession(session);
        setUser(session.user);
        fetchProfile(session.user);
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
      const current = await getCurrentProfile();

      if (current) {
        // use server helper that updates by user_id
        const updated = await serviceUpdateProfile(updates);
        setProfile(updated as any);
      } else {
        // ensure phone is present for DB NOT NULL constraints
        const created = await createProfile({
          full_name: updates.full_name || "",
          phone: updates.phone || (user.phone || ""),
          role: (updates.role as string) || "customer",
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
    await supabase.auth.signOut();

    initialized.current = false;
    setUser(null);
    setProfile(null);
    setSession(null);
    setNeedsOnboarding(false);
    setLoading(false);
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