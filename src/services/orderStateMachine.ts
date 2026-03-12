/**
 * Order State Machine Service
 * 
 * Phase 1: Server-side state transitions via Supabase RPC
 * 
 * NEVER bypass this service with direct supabase.from('orders').update()
 * The database has guards preventing direct status updates.
 * 
 * @see supabase/migrations/20260122_order_state_machine.sql
 */

import { supabase } from './supabase';
import type { OrderStatus } from '@/types';

export type ActorRole = 'customer' | 'rider' | 'warehouse';

export interface TransitionResult {
    success: boolean;
    from?: OrderStatus;
    to?: OrderStatus;
    code?: string;
    message?: string;
    actor_role?: ActorRole;
    actor_id?: string;
}

/**
 * Transition an order to a new status via server-side state machine
 * 
 * @param orderId - The UUID of the order
 * @param newStatus - The target status
 * @param actorRole - The role performing the transition (customer, rider, warehouse)
 * @param actorId - The UUID of the actor (user_id)
 * @returns TransitionResult with success/failure and transition details
 * 
 * @example
 * ```typescript
 * // Customer cancelling their order
 * const result = await transitionOrderState(orderId, 'cancelled', 'customer', user.id);
 * if (!result.success) {
 *   console.error(result.error, result.message);
 * }
 * ```
 */
export const transitionOrderState = async (
    orderId: string,
    newStatus: OrderStatus,
    actorRole: ActorRole,
    actorId: string
): Promise<TransitionResult> => {
    // Note: 'admin' role is intentionally not allowed here
    // Admin cannot transition state (read-only by design)
    if ((actorRole as string) === 'admin') {
        return {
            success: false,
            code: 'ADMIN_READ_ONLY',
            message: 'Admin role cannot mutate order state. Use warehouse or rider role.',
        };
    }

    const { data, error } = await supabase.rpc('transition_order_state', {
        p_order_id: orderId,
        p_new_status: newStatus,
        p_actor_role: actorRole,
        p_actor_id: actorId,
    });

    if (error) {
        return {
            success: false,
            code: 'RPC_ERROR',
            message: error.message,
        };
    }

    return data as TransitionResult;
};

/**
 * Get allowed transitions for a given status and role
 * Client-side helper for UI state (e.g., showing/hiding buttons)
 * 
 * Note: This is advisory only. Server enforces actual transitions.
 */
export const getAllowedTransitions = (
    currentStatus: OrderStatus,
    role: ActorRole
): OrderStatus[] => {
    const transitions: Record<ActorRole, Partial<Record<OrderStatus, OrderStatus[]>>> = {
        rider: {
            dispatched: ['out_for_delivery'],
            out_for_delivery: ['delivered'],
        },
        customer: {
            pending: ['cancelled'],
            delivered: ['return_requested'],
        },
        warehouse: {
            pending: ['confirmed'],
            confirmed: ['packed'],
            packed: ['dispatched'],
        },
    };

    return transitions[role]?.[currentStatus] ?? [];
};

/**
 * Check if a transition is allowed (client-side)
 * 
 * Note: This is advisory only. Server enforces actual transitions.
 */
export const canTransition = (
    currentStatus: OrderStatus,
    targetStatus: OrderStatus,
    role: ActorRole
): boolean => {
    const allowed = getAllowedTransitions(currentStatus, role);
    return allowed.includes(targetStatus);
};
