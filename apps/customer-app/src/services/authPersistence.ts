/**
 * Authentication Persistence Service
 * Persists authentication state for offline access
 */

import { supabase } from '@popclozet/api-client';
import { initDB } from '@/lib/db';
import type { Session, User } from '@supabase/supabase-js';

interface CachedAuth {
    session: Session | null;
    user: User | null;
    cachedAt: number;
    expiresAt: number;
}

const AUTH_CACHE_KEY = 'auth_cache';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

class AuthPersistenceService {
    private initialized = false;

    /**
     * Cache current session in IndexedDB
     */
    async cacheSession(): Promise<void> {
        try {
            const { data: { session }, error } = await supabase.auth.getSession();

            if (error) {
                console.error('Failed to get session:', error);
                return;
            }

            if (!session) {
                await this.clearCache();
                return;
            }

            const { data: { user } } = await supabase.auth.getUser();

            const cachedAuth: CachedAuth = {
                session,
                user,
                cachedAt: Date.now(),
                expiresAt: Date.now() + CACHE_DURATION,
            };

            const db = await initDB();
            await db.put('preferences', cachedAuth, AUTH_CACHE_KEY);

            console.log('✅ Auth session cached');
        } catch (error) {
            console.error('Failed to cache session:', error);
        }
    }

    /**
     * Get cached session from IndexedDB
     */
    async getCachedSession(): Promise<CachedAuth | null> {
        try {
            const db = await initDB();
            const cached = await db.get('preferences', AUTH_CACHE_KEY);

            if (!cached) {
                return null;
            }

            // Check if cache is expired
            if (cached.expiresAt < Date.now()) {
                console.log('⚠️ Cached auth expired');
                await this.clearCache();
                return null;
            }

            return cached as CachedAuth;
        } catch (error) {
            console.error('Failed to get cached session:', error);
            return null;
        }
    }

    /**
     * Validate cached session against server when online
     */
    async validateCachedSession(): Promise<boolean> {
        if (!navigator.onLine) {
            console.log('📵 Offline - skipping session validation');
            return true; // Trust cache when offline
        }

        try {
            const { data: { session }, error } = await supabase.auth.getSession();

            if (error) {
                console.error('Session validation failed:', error);
                return false;
            }

            if (!session) {
                await this.clearCache();
                return false;
            }

            // Update cache with fresh session
            await this.cacheSession();
            return true;
        } catch (error) {
            console.error('Failed to validate session:', error);
            return false;
        }
    }

    /**
     * Clear cached session
     */
    async clearCache(): Promise<void> {
        try {
            const db = await initDB();
            await db.delete('preferences', AUTH_CACHE_KEY);
            console.log('🗑️ Auth cache cleared');
        } catch (error) {
            console.error('Failed to clear auth cache:', error);
        }
    }

    /**
     * Handle token refresh offline gracefully
     */
    async refreshToken(): Promise<boolean> {
        if (!navigator.onLine) {
            console.log('📵 Offline - cannot refresh token');
            return false;
        }

        try {
            const { data, error } = await supabase.auth.refreshSession();

            if (error) {
                console.error('Token refresh failed:', error);
                return false;
            }

            if (data.session) {
                await this.cacheSession();
                return true;
            }

            return false;
        } catch (error) {
            console.error('Failed to refresh token:', error);
            return false;
        }
    }

    /**
     * Initialize auth persistence (safe, idempotent — call once on app startup)
     */
    initialize(): void {
        if (this.initialized) {
            console.warn('⚠️ Auth persistence already initialized');
            return;
        }

        this.initialized = true;

        // Set up auth state change listener
        supabase.auth.onAuthStateChange(async (event) => {
            console.log('🔐 Auth state changed:', event);

            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                await this.cacheSession();
            } else if (event === 'SIGNED_OUT') {
                await this.clearCache();
            }
        });

        console.log('✅ Auth persistence initialized');
    }

    /**
     * Get user from cache or server
     */
    async getUser(): Promise<User | null> {
        if (navigator.onLine) {
            const { data: { user } } = await supabase.auth.getUser();
            return user;
        }

        // Offline - use cached user
        const cached = await this.getCachedSession();
        return cached?.user || null;
    }

    /**
     * Check if user is authenticated (works offline)
     */
    async isAuthenticated(): Promise<boolean> {
        if (navigator.onLine) {
            const { data: { session } } = await supabase.auth.getSession();
            return !!session;
        }

        // Offline - check cache
        const cached = await this.getCachedSession();
        return !!cached?.session;
    }
}

// Export singleton instance
export const authPersistence = new AuthPersistenceService();
