import { Session } from '@supabase/supabase-js';

/**
 * A fallback for authPersistence to provide instant hydration.
 */
export const authPersistence = {
    /**
     * Synchronously retrieves the session from localStorage.
     * Supabase usually stores it under 'sb-[project-id]-auth-token'.
     */
    getCachedSessionSync: (): { session: Session | null } => {
        try {
            if (typeof window === 'undefined') return { session: null };
            
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.endsWith('-auth-token')) {
                    const storedSession = localStorage.getItem(key);
                    if (storedSession) {
                        const parsed = JSON.parse(storedSession);
                        // The stored session in Supabase is usually the Session object itself
                        return { session: parsed as Session };
                    }
                }
            }
        } catch (e) {
            console.warn('[authPersistence] Failed to read auth session from storage', e);
        }
        return { session: null };
    },
    
    // Maintain async version for backward compatibility if needed, though we'll use Sync mostly.
    getCachedSession: async (): Promise<{ session: Session | null }> => {
        return authPersistence.getCachedSessionSync();
    }
};
