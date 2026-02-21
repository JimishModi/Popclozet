import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@popclozet/api-client";
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
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", u.id)
        .maybeSingle();

      if (!data) {
        setNeedsOnboarding(true);
        setProfile(null);
      } else {
        setNeedsOnboarding(false);
        setProfile(data);
      }
    } finally {
      setLoading(false);
    }
  };

  /* ---------- SESSION INIT ---------- */
  useEffect(() => {

    // initial load (refresh)
    supabase.auth.getSession().then(({ data }) => {
      const sess = data.session;

      if (!sess) {
        setLoading(false);
        return;
      }

      setSession(sess);
      setUser(sess.user);

      if (!initialized.current) {
        initialized.current = true;
        fetchProfile(sess.user);
      }
    });

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
      options: { redirectTo: window.location.origin }
    });
  };

  /* ---------- PROFILE SAVE ---------- */
  const updateProfile = async (updates: any) => {
    if (!user) throw new Error("No authenticated user");

    const { error } = await supabase
      .from("profiles")
      .upsert({
        id: user.id,
        ...updates,
      });

    if (error) throw error;

    // IMPORTANT: stabilize routing
    await fetchProfile(user);
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