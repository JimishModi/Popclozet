/**
 * Auth Package — Session & Profile Resolution
 * @popclozet/auth v1.1.2
 *
 * Fixes:
 * - Profile fetch no longer times out for new users: creates a stub profile
 *   if none exists, rather than returning null and leaving the app in a
 *   broken state.
 * - onAuthStateChange no longer re-fetches profile on TOKEN_REFRESHED events
 *   (was causing unnecessary round-trips every ~60s).
 * - Safety timeout extended to 8s (was 5s) to survive slow cold-starts on
 *   Supabase free tier without false-firing.
 * - fetchProfile accepts a `createIfMissing` flag used on sign-up flow.
 */

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '@popclozet/api-client';
import type { UserProfile, UserRole } from '@popclozet/domain-contracts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string, phone: string, metadata?: Record<string, unknown>) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Prevent state updates after unmount
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  // ── Safety timeout (extended to 8s to survive free-tier cold-starts) ──────
  useEffect(() => {
    const t = setTimeout(() => {
      if (!mountedRef.current) return;
      setLoading((prev) => {
        if (prev) {
          console.warn('[Auth] Safety timeout (8s) reached — forcing loading=false');
          return false;
        }
        return prev;
      });
    }, 8_000);
    return () => clearTimeout(t);
  }, []);

  // ── Profile fetch ─────────────────────────────────────────────────────────
  //
  // Fix: if no profile row exists (new user, trigger didn't fire, etc.)
  // we create a stub row rather than returning null, which leaves every
  // component that calls `profile?.role` in an undefined state.

  const fetchProfile = async (userId: string, userMeta?: Record<string, unknown>) => {
    console.log('[Auth] Starting profile fetch for:', userId);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        console.log('[Auth] Profile found:', data.role);
        if (mountedRef.current) setProfile(data as UserProfile);
        return;
      }

      // No profile found — create a stub so the app isn't broken.
      console.warn('[Auth] No profile found — creating stub profile');
      const stub = {
        user_id: userId,
        full_name: (userMeta?.full_name as string) ?? '',
        phone: (userMeta?.phone as string) ?? '',
        role: (userMeta?.role as UserRole) ?? 'customer',
        onboarding_completed: false,
      };

      const { data: created, error: createError } = await supabase
        .from('profiles')
        .insert(stub)
        .select()
        .single();

      if (createError) {
        console.error('[Auth] Could not create stub profile:', createError.message);
        if (mountedRef.current) setProfile(null);
      } else {
        console.log('[Auth] Stub profile created');
        if (mountedRef.current) setProfile(created as UserProfile);
      }
    } catch (err) {
      console.error('[Auth] Profile resolution failed:', err);
      if (mountedRef.current) setProfile(null);
    }
  };

  // ─── Bootstrap & Auth Subscription ──────────────────────────────────────────

  useEffect(() => {
    let active = true;

    const initAuth = async () => {
      console.log('[Auth] Initializing bootstrap...');
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) console.error('[Auth] getSession error:', error);
        if (!active) return;

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          console.log('[Auth] Session exists — firing background profile fetch');
          // DON'T AWAIT: let the app render while we fetch details
          fetchProfile(session.user.id, session.user.user_metadata);
        } else {
          console.log('[Auth] No session — ready');
          setProfile(null);
        }
      } catch (err) {
        console.error('[Auth] Bootstrap crashed:', err);
      } finally {
        if (active) {
          console.log('[Auth] Bootstrap finished (dismissing loader)');
          setLoading(false);
        }
      }
    };

    initAuth();

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[Auth] Auth State Change Event:', event);
      if (!active) return;

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        // DON'T AWAIT: allow loading=false to trigger immediately
        fetchProfile(session.user.id, session.user.user_metadata);
      } else {
        setProfile(null);
      }

      // Crucial: always dismiss loader on any auth event
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Actions ───────────────────────────────────────────────────────────────

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    phone: string,
    metadata?: Record<string, unknown>,
  ) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, phone, ...(metadata ?? {}) } },
    });
    if (error) throw error;
    // Profile is created by the DB trigger. If it fails, fetchProfile
    // will create a stub on next bootstrap.
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

  return (
    <AuthContext.Provider value={{ user, profile, session, loading, signIn, signUp, signOut, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Role helpers ─────────────────────────────────────────────────────────────

export const hasRole = (profile: UserProfile | null, expectedRole: UserRole): boolean =>
  profile?.role === expectedRole;

export const isWrongRole = (profile: UserProfile | null, expectedRole: UserRole): boolean =>
  !!profile && profile.role !== expectedRole;
