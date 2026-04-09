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
  refreshProfile: () => Promise<void>;
  recoverFromStuckAuth: () => void;
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
  // Track whether onAuthStateChange has already delivered a valid session
  const authListenerFiredRef = useRef(false);
  const bootstrapPendingRef = useRef(true);
  const bootstrapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const clearBootstrapTimeout = () => {
    if (bootstrapTimeoutRef.current) {
      clearTimeout(bootstrapTimeoutRef.current);
      bootstrapTimeoutRef.current = null;
    }
  };

  const withTimeout = async <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
    let timeoutRef: ReturnType<typeof setTimeout> | null = null;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutRef = setTimeout(() => {
        reject(new Error(label));
      }, ms);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeoutRef) {
        clearTimeout(timeoutRef);
      }
    }
  };

  const clearSupabaseAuthStorage = () => {
    if (typeof window === 'undefined') return;

    const clearStorage = (storage: Storage) => {
      const keysToRemove: string[] = [];

      for (let i = 0; i < storage.length; i += 1) {
        const key = storage.key(i);
        if (!key) continue;

        if (
          /^sb-.*-auth-token$/.test(key) ||
          key.includes('supabase.auth.token') ||
          key.includes('auth-token')
        ) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach((key) => storage.removeItem(key));
    };

    try {
      clearStorage(window.localStorage);
    } catch {
      // Ignore storage access failures in restricted webviews/PWAs.
    }

    try {
      clearStorage(window.sessionStorage);
    } catch {
      // Ignore storage access failures in restricted webviews/PWAs.
    }
  };

  const recoverFromStuckAuth = () => {
    console.warn('[Auth] Recovering from stuck loading state by clearing cached auth state');
    clearBootstrapTimeout();
    bootstrapPendingRef.current = false;
    authListenerFiredRef.current = false;
    clearSupabaseAuthStorage();

    if (!mountedRef.current) return;
    setSession(null);
    setUser(null);
    setProfile(null);
    setLoading(false);
  };

  // Safety timeout — increased to 15s to accommodate slow networks
  // where token refresh might take longer after app close/reopen
  useEffect(() => {
    const t = setTimeout(() => {
      if (!mountedRef.current) return;
      setLoading((prev) => {
        if (prev) {
          console.warn('[Auth] Safety timeout (15s) reached — forcing loading=false');
          return false;
        }
        return prev;
      });
    }, 15_000);
    return () => clearTimeout(t);
  }, []);

  // ── Profile fetch ─────────────────────────────────────────────────────────

  const getRiderProfileFallback = async (userId: string) => {
    const { data, error } = await withTimeout(
      Promise.resolve(
        supabase
          .from('riders')
          .select('id, user_id, name, phone, email, avatar_url, joined_at, updated_at')
          .or(`id.eq.${userId},user_id.eq.${userId}`)
          .maybeSingle()
      ),
      3000,
      'Rider profile fallback timed out'
    );

    if (error || !data) return null;

    return {
      id: data.id ?? data.user_id ?? userId,
      user_id: data.user_id ?? data.id ?? userId,
      full_name: data.name ?? '',
      phone: data.phone ?? '',
      avatar_url: data.avatar_url ?? undefined,
      role: 'rider' as UserRole,
      onboarding_completed: true,
      created_at: data.joined_at ?? new Date().toISOString(),
      updated_at: data.updated_at ?? data.joined_at ?? new Date().toISOString(),
    } as UserProfile;
  };

  const fetchProfile = async (userId: string, userMeta?: Record<string, unknown>) => {
    console.log('[Auth] Starting profile fetch for:', userId);
    try {
      // Use .limit(1) instead of .maybeSingle() because users may exist
      // in multiple profile tables (e.g., customer_profiles AND rider_profiles).
      // Order by role to prioritize rider/warehouse over customer.
      const { data: rows, error } = await withTimeout(
        Promise.resolve(
          supabase
            .from('profiles')
            .select('*')
            .eq('user_id', userId)
            .order('role', { ascending: false })
            .limit(1)
        ),
        4000,
        'Profile lookup timed out'
      );

      let derivedRole: UserRole = 'warehouse';

      const data = rows?.[0] ?? null;
      const riderFallback = await getRiderProfileFallback(userId);

      if (data || riderFallback) {
        const resolvedProfile = riderFallback && (!data || data.role !== 'rider')
          ? {
              ...(data ?? {}),
              ...riderFallback,
              full_name: riderFallback.full_name || data?.full_name || '',
              phone: riderFallback.phone || data?.phone || '',
            }
          : (data as UserProfile);

        console.log('[Auth] Profile found:', resolvedProfile.role);
        if (mountedRef.current) setProfile(resolvedProfile);
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
        const { data: { session }, error } = await withTimeout(
          supabase.auth.getSession(),
          4000,
          'Auth session lookup timed out'
        );
        
        console.log('[Auth] Bootstrap session status:', session ? 'Present' : 'Not found');
        if (error) console.error('[Auth] getSession error:', error);
        if (!active) return;

        if (session?.user) {
          clearBootstrapTimeout();
          bootstrapPendingRef.current = false;
          authListenerFiredRef.current = true;
          // Session is valid — use it immediately
          setSession(session);
          setUser(session.user);
          fetchProfile(session.user.id, session.user.user_metadata);
          setLoading(false);
        } else {
          // No session from getSession. Check if there's even a stored token
          // before waiting for onAuthStateChange to deliver a refreshed session.
          const hasStoredToken = (() => {
            try {
              for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && (/^sb-.*-auth-token$/.test(key) || key.includes('supabase.auth.token'))) {
                  return true;
                }
              }
            } catch { /* ignore */ }
            return false;
          })();

          if (!hasStoredToken) {
            // No stored token at all — user is genuinely not logged in.
            console.log('[Auth] No session and no stored token — user is logged out');
            clearBootstrapTimeout();
            bootstrapPendingRef.current = false;
            setSession(null);
            setUser(null);
            setProfile(null);
            setLoading(false);
          } else {
            // Token exists but may be expired — wait briefly for refresh.
            console.log('[Auth] No session from getSession — waiting for auth listener to attempt token refresh...');
            clearBootstrapTimeout();
            bootstrapPendingRef.current = true;
            bootstrapTimeoutRef.current = setTimeout(() => {
              if (!active || !mountedRef.current) return;
              if (!authListenerFiredRef.current) {
                bootstrapPendingRef.current = false;
                console.log('[Auth] Auth listener did not fire within 4s — user is likely logged out');
                setSession(null);
                setUser(null);
                setProfile(null);
                setLoading(false);
              }
            }, 4_000);
          }
        }
      } catch (err) {
        console.error('[Auth] Bootstrap crashed:', err);
        clearBootstrapTimeout();
        bootstrapPendingRef.current = false;
        if (active) {
          setSession(null);
          setUser(null);
          setProfile(null);
          setLoading(false);
        }
      }
    };

    initAuth();

    // Re-validate session when the PWA returns from background.
    // On mobile, the OS can suspend the app long enough for the access token
    // to expire. Without this, riders stay on a stale "logged-in" screen until
    // the next Supabase call fails, or get a blank loading screen on re-open.
    const handleVisibilityChange = async () => {
      if (document.visibilityState !== 'visible' || !active) return;
      try {
        const { data: { session: latest } } = await withTimeout(
          supabase.auth.getSession(),
          4000,
          'Visibility session check timed out'
        );
        if (!active || !mountedRef.current) return;
        if (latest?.user) {
          setSession(latest);
          setUser(latest.user);
          setLoading(false);
        }
        // If latest is null and user is already null, nothing to do.
        // If latest is null and user was set, onAuthStateChange will fire
        // SIGNED_OUT and handle it through the normal path.
      } catch (err) {
        console.warn('[Auth] Visibility change session check failed:', err);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[Auth] Auth State Change Event:', event);
      if (!active) return;

      if (session?.user) {
        clearBootstrapTimeout();
        bootstrapPendingRef.current = false;
        authListenerFiredRef.current = true;
        setSession(session);
        setUser(session.user);
        fetchProfile(session.user.id, session.user.user_metadata);
        setLoading(false);
        return;
      }

      if (event === 'SIGNED_OUT') {
        if (bootstrapPendingRef.current) {
          // SIGNED_OUT can fire while Supabase is mid-refresh on PWA wake-up
          // (e.g. token expired while app was backgrounded). During bootstrap,
          // defer to the timer — the token may still be successfully refreshed.
          console.log('[Auth] SIGNED_OUT during bootstrap — deferring to bootstrap timer');
          // fall through to the bootstrapPendingRef guard below
        } else {
          clearBootstrapTimeout();
          bootstrapPendingRef.current = false;
          authListenerFiredRef.current = false;
          setSession(null);
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }
      }

      if (bootstrapPendingRef.current) {
        console.log(`[Auth] ${event} delivered null session during bootstrap — still waiting for refresh`);
        return;
      }

      console.log(`[Auth] ${event} delivered null session after bootstrap — clearing auth state`);
      authListenerFiredRef.current = false;
      setSession(null);
      setUser(null);
      setProfile(null);
      setLoading(false);
    });

    return () => {
      active = false;
      clearBootstrapTimeout();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
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
    <AuthContext.Provider value={{ user, profile, session, loading, signIn, signUp, signOut, updateProfile, refreshProfile: () => user ? fetchProfile(user.id) : Promise.resolve(), recoverFromStuckAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Role helpers ─────────────────────────────────────────────────────────────

export const hasRole = (profile: UserProfile | null, expectedRole: UserRole): boolean =>
  profile?.role === expectedRole;

export const isWrongRole = (profile: UserProfile | null, expectedRole: UserRole): boolean =>
  !!profile && profile.role !== expectedRole;
