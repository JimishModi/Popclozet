/**
 * Role Service
 *
 * Determines user role by checking which role-specific table contains the user.
 * Tables: customer_profiles, rider_profiles, warehouse_profiles
 */

import { supabase } from '@popclozet/api-client';

// ==========================================
// TYPES
// ==========================================

export type UserRole = 'customer' | 'rider' | 'admin' | 'warehouse';

// ==========================================
// ROLE QUERIES
// ==========================================

/**
 * Determine role for a given user ID by checking each role-specific table.
 * Priority: warehouse_profiles > rider_profiles > customer_profiles
 */
export async function getUserRole(userId: string): Promise<UserRole> {
    try {
        // Check warehouse_profiles first (highest privilege)
        const { data: wh } = await supabase
            .from('warehouse_profiles')
            .select('user_id')
            .eq('user_id', userId)
            .maybeSingle();
        if (wh) return 'warehouse';

        // Check rider_profiles
        const { data: rider } = await supabase
            .from('rider_profiles')
            .select('user_id')
            .eq('user_id', userId)
            .maybeSingle();
        if (rider) return 'rider';

        // Customer is the default if found in customer_profiles
        const { data: customer } = await supabase
            .from('customer_profiles')
            .select('user_id')
            .eq('user_id', userId)
            .maybeSingle();
        if (customer) return 'customer';

    } catch (err) {
        console.warn('Could not fetch user role:', err);
    }

    return 'customer';
}

/**
 * Guard function — throws if the current user doesn't have the required role.
 */
export async function requireRole(requiredRole: UserRole): Promise<void> {
    if (!supabase) throw new Error('Service unavailable');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const role = await getUserRole(user.id);

    if (role !== requiredRole && role !== 'admin' && role !== 'warehouse') {
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
