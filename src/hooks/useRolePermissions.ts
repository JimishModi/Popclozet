/**
 * Role Permissions Hook
 * 
 * Phase 4 Finalization: Centralized role-based permission checks
 * 
 * Usage:
 * const { isAdmin, isRider, isCustomer, can } = useRolePermissions();
 * if (can('view_admin_dashboard')) { ... }
 */

import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export type UserRole = 'customer' | 'rider' | 'warehouse' | 'admin';

export type Permission =
    // Order permissions
    | 'view_own_orders'
    | 'cancel_own_orders'
    | 'view_all_orders'
    | 'transition_to_confirmed'
    | 'transition_to_packed'
    | 'transition_to_dispatched'
    | 'transition_to_out_for_delivery'
    | 'transition_to_delivered'
    // Admin permissions
    | 'view_admin_dashboard'
    | 'view_audit_log'
    | 'view_incidents'
    // Rider permissions
    | 'view_assigned_orders'
    | 'accept_delivery'
    | 'submit_location'
    | 'view_delivery_navigation';

// Permission matrix: role -> allowed permissions
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
    customer: [
        'view_own_orders',
        'cancel_own_orders',
    ],
    rider: [
        'view_assigned_orders',
        'accept_delivery',
        'submit_location',
        'view_delivery_navigation',
        'transition_to_out_for_delivery',
        'transition_to_delivered',
    ],
    warehouse: [
        'view_all_orders',
        'transition_to_confirmed',
        'transition_to_packed',
        'transition_to_dispatched',
    ],
    admin: [
        'view_all_orders',
        'view_admin_dashboard',
        'view_audit_log',
        'view_incidents',
        // Admin cannot transition orders (read-only)
    ],
};

export const useRolePermissions = () => {
    const { profile } = useAuth();

    const role = useMemo<UserRole>(() => {
        return (profile?.role as UserRole) || 'customer';
    }, [profile?.role]);

    const permissions = useMemo(() => {
        return ROLE_PERMISSIONS[role] || [];
    }, [role]);

    const can = (permission: Permission): boolean => {
        return permissions.includes(permission);
    };

    const isAdmin = role === 'admin';
    const isRider = role === 'rider';
    const isWarehouse = role === 'warehouse';
    const isCustomer = role === 'customer';

    return {
        role,
        permissions,
        can,
        isAdmin,
        isRider,
        isWarehouse,
        isCustomer,
    };
};
