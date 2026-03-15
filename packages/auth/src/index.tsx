/**
 * Auth Package – Session & Profile Resolution
 * @popclozet/auth v1.1.1 (FIXED)
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '@popclozet/api-client';
import type { UserProfile, UserRole } from '@popclozet/domain-contracts';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    phone: string,
    metadata?: Record<string, any>
  ) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  /* ---------- SAFETY TIMEOUT ---------- */
  useEffect(() => {
    const timeout = setTimeout(() => {
      setLoading((prev) => {
        if (prev) {
          console.warn('⚠️ [Auth] Safety timeout reached (5s). Forcing loading state to false.');
          return false;
        }
        return prev;
      });
    }, 5000);
    return () => clearTimeout(timeout);
  }, []);

  /* ---------- PROFILE FETCH (SAFE) ---------- */
  const fetchProfile = async (userId: string) => {
    console.log(`[Auth] Fetching profile for user: ${userId}`);
    try {
      const profilePromise = supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Profile fetch timeout')), 3000)
      );

      const { data, error } = await Promise.race([
        profilePromise,
        timeoutPromise
      ]) as any;

      if (error) throw error;
      console.log('✅ [Auth] Profile fetched:', data?.role || 'no profile');
      setProfile(data ?? null);
    } catch (err) {
      console.error('❌ [Auth] Profile resolution failed or timed out:', err);
      setProfile(null);
    }
  };

  /* ---------- SAFETY TIMEOUT ---------- */
  useEffect(() => {
    const timeout = setTimeout(() => {
      setLoading((prev) => {
        if (prev) {
          console.warn('[@popclozet/auth] Safety timeout: forcing loading=false');
          return false;
        }
        return prev;
      });
    }, 3000);
    return () => clearTimeout(timeout);
  }, []);

  /* ---------- AUTH BOOTSTRAP ---------- */
  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      console.log('[Auth] Bootstrapping session...');
      try {
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Session fetch timeout')), 3000)
        );

        const { data: { session } } = await Promise.race([
          sessionPromise,
          timeoutPromise
        ]) as any;

        if (!mounted) return;

        setSession(session);
        setUser(session?.user ?? null);
        console.log(`[Auth] Session resolved: ${session ? 'User logged in' : 'No user'}`);

        if (session?.user?.id) {
          await fetchProfile(session.user.id);
        }
      } catch (err) {
        console.error('❌ [Auth] Bootstrap failed or timed out:', err);
      } finally {
        if (mounted) {
          console.log('[Auth] Bootstrap complete, dismissing loader');
          setLoading(false);
        }
      }
    };

    bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`[Auth] State changed: ${event}`);
      if (!mounted) return;

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user?.id) {
        await fetchProfile(session.user.id);
      } else {
        setProfile(null);
      }

      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  /* ---------- ACTIONS ---------- */
  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  };

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    phone: string,
    metadata?: Record<string, any>
  ) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, phone, ...(metadata || {}) } },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setUser(null);
    setProfile(null);
    setSession(null);
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user?.id) throw new Error('No user logged in');

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('user_id', user.id);

    if (error) throw error;
    await fetchProfile(user.id);
  };

  const value: AuthContextType = {
    user,
    profile,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/* ---------- ROLE HELPERS ---------- */
export const hasRole = (
  profile: UserProfile | null,
  expectedRole: UserRole
): boolean => profile?.role === expectedRole;

export const isWrongRole = (
  profile: UserProfile | null,
  expectedRole: UserRole
): boolean => !!profile && profile.role !== expectedRole;
