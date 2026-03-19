/**
 * Auth Package — Session & Profile Resolution
 * @popclozet/auth v1.2.0
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

  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  // Safety timeout
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

  const fetchProfile = async (userId: string, userMeta?: Record<string, unknown>) => {
    console.log('[Auth] Starting profile fetch for:', userId);
    try {
      // 1. Try warehouse_profiles first (highest priority)
      let { data: profileRow } = await supabase
        .from('warehouse_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      let derivedRole: UserRole = 'warehouse';

      // 2. Try rider_profiles if not in warehouse
      if (!profileRow) {
        const { data: riderRow } = await supabase
          .from('rider_profiles')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();
        
        if (riderRow) {
          profileRow = riderRow;
          derivedRole = 'rider';
        }
      }

      // 3. Try customer_profiles as fallback
      if (!profileRow) {
        const { data: customerRow } = await supabase
          .from('customer_profiles')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (customerRow) {
          profileRow = customerRow;
          derivedRole = 'customer';
        }
      }

      if (profileRow) {
        console.log('[Auth] Profile found, role:', derivedRole);
        // Inject role into the profile object for compatibility
        const decoratedProfile = { ...profileRow, role: derivedRole } as UserProfile;
        if (mountedRef.current) setProfile(decoratedProfile);
        return;
      }

      // No profile found — create a stub in customer_profiles
      console.warn('[Auth] No profile found — creating stub profile');
      const stub = {
        id: userId,
        user_id: userId,
        full_name: (userMeta?.full_name as string) ?? '',
        phone: (userMeta?.phone as string) ?? '',
        // email: (userMeta?.email as string) ?? '',
        onboarding_completed: false,
      };

      const { data: created, error: createError } = await supabase
        .from('customer_profiles')
        .insert(stub)
        .select()
        .single();

      if (createError) {
        console.error('[Auth] Could not create stub profile:', createError.message);
        if (mountedRef.current) setProfile(null);
      } else {
        console.log('[Auth] Stub profile created');
        if (mountedRef.current) setProfile({ ...created, role: 'customer' } as UserProfile);
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
          fetchProfile(session.user.id, session.user.user_metadata);
        } else {
          setProfile(null);
        }
      } catch (err) {
        console.error('[Auth] Bootstrap crashed:', err);
      } finally {
        if (active) setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[Auth] Auth State Change Event:', event);
      if (!active) return;

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        fetchProfile(session.user.id, session.user.user_metadata);
      } else {
        setProfile(null);
      }

      setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

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
    // Using current profile role to determine which table to update
    const role = profile?.role || 'customer';
    
    let table = 'customer_profiles';
    if (role === 'rider') table = 'rider_profiles';
    if (role === 'warehouse' || role === 'admin') table = 'warehouse_profiles';

    // Omit role from updates as it's not a real column in these tables
    const { role: _role, ...dbUpdates } = updates as any;

    const { error } = await supabase
      .from(table)
      .update(dbUpdates)
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
