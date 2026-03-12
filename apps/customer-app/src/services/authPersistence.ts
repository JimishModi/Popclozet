import { Session } from '@supabase/supabase-js';

/**
 * A fallback stub for authPersistence.
 * This file is required by SupabaseAuthContext.tsx which was updated
 * in the recent git pull, to provide instant hydration from localStorage/IndexedDB.
 */
export const authPersistence = {
    getCachedSession: async (): Promise<{ session: Session | null }> => {
        try {
            // Try to find the Supabase auth token in localStorage as a generic fallback
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.endsWith('-auth-token')) {
                    const storedSession = localStorage.getItem(key);
                    if (storedSession) {
                        const parsed = JSON.parse(storedSession);
                        return { session: parsed as Session };
                    }
                }
            }
        } catch (e) {
            console.warn('[authPersistence] Failed to read auth session from storage', e);
        }
        return { session: null };
    }
};
