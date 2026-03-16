/**
 * API Client - Supabase Client & Services
 * 
 * @popclozet/api-client v1.0.0
 * 
 * Provides Supabase client, order state machine, and realtime service.
 * Apps consume this package; they do not define their own clients.
 */

import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import type { OrderStatus, ActorRole, TransitionResult, UserRole } from '@popclozet/domain-contracts';

// ==========================================
// SUPABASE CLIENT
// ==========================================

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
}

console.log('📦 [@popclozet/api-client] Initializing Supabase client...', { url: supabaseUrl });

let client: SupabaseClient;
try {
    client = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        },
        realtime: {
            params: {
                eventsPerSecond: 10,
            },
        },
    });
    console.log('✅ [@popclozet/api-client] Supabase client created successfully.');
} catch (e) {
    console.error('❌ [@popclozet/api-client] CRITICAL: createClient failed:', e);
    throw e;
}

export const supabase = client;

// ==========================================
// USER HELPERS
// ==========================================

export const getCurrentUser = async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
};

export const getUserRole = async (): Promise<UserRole | null> => {
    const user = await getCurrentUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .single();

    if (error) throw error;
    return data?.role ?? null;
};

// ==========================================
// ORDER STATE MACHINE
// ==========================================

/**
 * Transition an order to a new status via server-side state machine
 * 
 * NEVER bypass this with direct supabase.from('orders').update()
 * The database has guards preventing direct status updates.
 */
export const transitionOrderState = async (
    orderId: string,
    newStatus: OrderStatus,
    actorRole: ActorRole,
    actorId: string
): Promise<TransitionResult> => {
    // Admin role is intentionally not allowed here (read-only by design)
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
        p_rider_id: null, // Explicitly provide null to resolve overload ambiguity
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
            ready_for_pickup: ['driver_arrived_warehouse'],
            driver_arrived_warehouse: ['order_picked_up'],
            order_picked_up: ['dispatched'],
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
            packed: ['ready_for_pickup'],
        },
    };

    return transitions[role]?.[currentStatus] ?? [];
};

/**
 * Check if a transition is allowed (client-side advisory)
 */
export const canTransition = (
    currentStatus: OrderStatus,
    targetStatus: OrderStatus,
    role: ActorRole
): boolean => {
    const allowed = getAllowedTransitions(currentStatus, role);
    return allowed.includes(targetStatus);
};

// ==========================================
// REALTIME SERVICE
// ==========================================

type EventCallback<T = unknown> = (payload: T) => void;

class RealtimeService {
    private channels: Map<string, RealtimeChannel> = new Map();

    subscribeToOrderUpdates(orderId: string, callback: EventCallback) {
        const channelName = `order:${orderId}`;

        if (this.channels.has(channelName)) {
            return () => this.unsubscribe(channelName);
        }

        const channel = supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'orders',
                    filter: `id=eq.${orderId}`,
                },
                callback
            )
            .subscribe();

        this.channels.set(channelName, channel);

        return () => this.unsubscribe(channelName);
    }

    subscribeToRiderLocation(riderId: string, callback: EventCallback) {
        const channelName = `rider:${riderId}`;

        if (this.channels.has(channelName)) {
            return () => this.unsubscribe(channelName);
        }

        const channel = supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'rider_locations',
                    filter: `rider_id=eq.${riderId}`,
                },
                callback
            )
            .subscribe();

        this.channels.set(channelName, channel);

        return () => this.unsubscribe(channelName);
    }

    subscribeToProximityUpdates(orderId: string, callback: EventCallback) {
        const channelName = `proximity:${orderId}`;

        if (this.channels.has(channelName)) {
            return () => this.unsubscribe(channelName);
        }

        const channel = supabase
            .channel(channelName)
            .on(
                'broadcast',
                { event: 'rider_distance_update' },
                callback
            )
            .subscribe();

        this.channels.set(channelName, channel);

        return () => this.unsubscribe(channelName);
    }

    private unsubscribe(channelName: string) {
        const channel = this.channels.get(channelName);
        if (channel) {
            supabase.removeChannel(channel);
            this.channels.delete(channelName);
        }
    }

    unsubscribeAll() {
        this.channels.forEach((channel) => {
            supabase.removeChannel(channel);
        });
        this.channels.clear();
    }
}

export const realtimeService = new RealtimeService();

// Re-export rental order service
export * from './rentalOrderService';

// Re-export pickup scheduler
export * from './pickupScheduler';

// Re-export customer notification service
export * from './notifyCustomerService';

// Export config
export * from './config';

