/**
 * Role Service
 * 
 * Provides role-based access control using Supabase Auth profiles.
 * Roles: consumer, rider, admin
 */

import { supabase } from '@popclozet/api-client';

// ==========================================
// TYPES
// ==========================================

export type UserRole = 'consumer' | 'rider' | 'admin';

// ==========================================
// ROLE QUERIES
// ==========================================

/**
 * Get the role for a given user ID from the profiles table.
 */
export async function getUserRole(userId: string): Promise<UserRole> {
    try {
        if (supabase) {
            const { data } = await supabase
                .from('profiles')
                .select('role')
                .eq('user_id', userId)
                .maybeSingle();

            if (data?.role) {
                return data.role as UserRole;
            }
        }
    } catch (err) {
        console.warn('Could not fetch user role:', err);
    }

    // Default to consumer
    return 'consumer';
}

/**
 * Guard function — throws if the current user doesn't have the required role.
 * Use in service functions that need role-based access control.
 */
export async function requireRole(requiredRole: UserRole): Promise<void> {
    if (!supabase) throw new Error('Service unavailable');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const role = await getUserRole(user.id);

    if (role !== requiredRole && role !== 'admin') {
        throw new Error(`Access denied. Required role: ${requiredRole}, your role: ${role}`);
    }
}

/**
 * Check if the current user has a specific role (non-throwing version).
 */
export async function hasRole(requiredRole: UserRole): Promise<boolean> {
    try {
        await requireRole(requiredRole);
        return true;
    } catch {
        return false;
    }
}
