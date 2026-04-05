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

            const expectedAuthStorageKey = (() => {
                try {
                    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
                    if (!supabaseUrl) return null;
                    const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
                    return projectRef ? `sb-${projectRef}-auth-token` : null;
                } catch {
                    return null;
                }
            })();

            const extractSession = (storedValue: string | null): Session | null => {
                if (!storedValue) return null;
                const parsed = JSON.parse(storedValue);

                // Newer Supabase storage format:
                // { currentSession: Session | null, expiresAt: number | null }
                if (parsed?.currentSession?.access_token) {
                    return parsed.currentSession as Session;
                }

                // Older format: Session object directly
                if (parsed?.access_token && parsed?.user) {
                    return parsed as Session;
                }

                return null;
            };

            if (expectedAuthStorageKey) {
                const expectedSession = extractSession(localStorage.getItem(expectedAuthStorageKey));
                if (expectedSession) {
                    return { session: expectedSession };
                }
            }

            // Fallback: pick the first parseable auth-token key (legacy keys / migrations)
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (!key || !key.endsWith('-auth-token')) continue;
                const parsedSession = extractSession(localStorage.getItem(key));
                if (parsedSession) {
                    return { session: parsedSession };
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
