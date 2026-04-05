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

declare global {
    // Keep exactly one Supabase client per JS runtime to avoid split auth state.
    // eslint-disable-next-line no-var
    var __popclozet_supabase_client__: SupabaseClient | undefined;
}

// ==========================================
// SUPABASE CLIENT
// ==========================================

let supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[api-client] CRITICAL: Supabase environment variables are missing.');
    throw new Error('Missing Supabase environment variables');
}

if (import.meta.env.PROD && supabaseUrl.startsWith('http://')) {
    supabaseUrl = supabaseUrl.replace('http://', 'https://');
}

// Supabase URL must use HTTPS in production to avoid insecure WebSocket (ws://) errors.
// The Supabase JS client derives wss:// from https:// URLs automatically.
if (!supabaseUrl.startsWith('https://') && import.meta.env.PROD) {
    console.error(
        '[api-client] CRITICAL: VITE_SUPABASE_URL must use https:// in production. ' +
        `Current value starts with: "${supabaseUrl.substring(0, 10)}...". ` +
        'This will cause "WebSocket not available: The operation is insecure" errors.'
    );
}

if (import.meta.env.DEV) {
    console.log('[api-client] Initializing Supabase client...', {
        url: supabaseUrl.substring(0, 30) + '...',
        hasKey: !!supabaseAnonKey
    });
}

// ── WebSocket availability probe ───────────────────────────────────────────
// iOS Safari in-app browsers (Instagram, TikTok, private browsing, PWA)
// throw DOMException: "The operation is insecure" synchronously when the
// WebSocket constructor is called, even on wss://. Probe once at module load
// so we can skip all Supabase Realtime subscriptions in that environment.
let realtimeAvailable = false;
try {
    if (typeof WebSocket !== 'undefined') {
        // Use a dummy unreachable address; the constructor throws synchronously
        // on iOS Safari insecure contexts before any network request is made.
        const probe = new WebSocket('wss://0.0.0.0');
        probe.close();
        realtimeAvailable = true;
    }
} catch {
    realtimeAvailable = false;
    console.warn('[api-client] WebSocket unavailable — realtime features disabled (iOS Safari insecure context)');
}

/**
 * Returns true if WebSocket (Supabase Realtime) is available in this browser
 * context. Hooks should skip .subscribe() calls when this returns false.
 */
export const isRealtimeAvailable = (): boolean => realtimeAvailable;

const realtimeConfig = realtimeAvailable ? {
    params: {
        eventsPerSecond: 10,
    },
} : {
    params: {
        eventsPerSecond: 0,
    },
};

let client: SupabaseClient;
if (globalThis.__popclozet_supabase_client__) {
    client = globalThis.__popclozet_supabase_client__;
    if (import.meta.env.DEV) {
        console.log('[api-client] Reusing global Supabase singleton.');
    }
} else {
    try {
    client = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        },
        realtime: realtimeConfig,
    });
    globalThis.__popclozet_supabase_client__ = client;
    if (import.meta.env.DEV) {
        console.log('[api-client] Supabase client created successfully.');
    }
} catch (e) {
    console.error('❌ [@popclozet/api-client] CRITICAL: createClient failed:', e);
    throw e;
}
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

    try {
        // Check warehouse_profiles first (highest privilege)
        const { data: wh } = await supabase
            .from('warehouse_profiles')
            .select('user_id')
            .eq('user_id', user.id)
            .maybeSingle();
        if (wh) return 'warehouse';

        // Check rider_profiles
        const { data: rider } = await supabase
            .from('rider_profiles')
            .select('user_id')
            .eq('user_id', user.id)
            .maybeSingle();
        if (rider) return 'rider';

        // Customer is the default if found in customer_profiles
        const { data: customer } = await supabase
            .from('customer_profiles')
            .select('user_id')
            .eq('user_id', user.id)
            .maybeSingle();
        if (customer) return 'customer';

    } catch (err) {
        console.warn('Could not fetch user role:', err);
    }

    return null;
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
            return_scheduled: ['return_dispatched'],
            return_dispatched: ['return_picked_up'],
            return_picked_up: ['return_at_warehouse'],
        },
        customer: {
            pending: ['cancelled'],
            delivered: ['return_requested'],
            in_use: ['return_requested'],
        },
        warehouse: {
            pending: ['confirmed'],
            confirmed: ['packed'],
            packed: ['ready_for_pickup'],
            return_requested: ['return_scheduled'],
            return_at_warehouse: ['returned'],
            returned: ['return_completed'],
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

        try {
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
                .subscribe((status, err) => {
                    if (err) console.warn('[realtimeService] subscribeToOrderUpdates error (non-fatal):', err);
                });

            this.channels.set(channelName, channel);
        } catch (err) {
            console.warn('[realtimeService] subscribeToOrderUpdates failed (non-fatal):', err);
        }

        return () => this.unsubscribe(channelName);
    }

    subscribeToRiderLocation(riderId: string, callback: EventCallback) {
        const channelName = `rider:${riderId}`;

        if (this.channels.has(channelName)) {
            return () => this.unsubscribe(channelName);
        }

        try {
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
                .subscribe((status, err) => {
                    if (err) console.warn('[realtimeService] subscribeToRiderLocation error (non-fatal):', err);
                });

            this.channels.set(channelName, channel);
        } catch (err) {
            console.warn('[realtimeService] subscribeToRiderLocation failed (non-fatal):', err);
        }

        return () => this.unsubscribe(channelName);
    }

    subscribeToProximityUpdates(orderId: string, callback: EventCallback) {
        const channelName = `proximity:${orderId}`;

        if (this.channels.has(channelName)) {
            return () => this.unsubscribe(channelName);
        }

        try {
            const channel = supabase
                .channel(channelName)
                .on(
                    'broadcast',
                    { event: 'rider_distance_update' },
                    callback
                )
                .subscribe((status, err) => {
                    if (err) console.warn('[realtimeService] subscribeToProximityUpdates error (non-fatal):', err);
                });

            this.channels.set(channelName, channel);
        } catch (err) {
            console.warn('[realtimeService] subscribeToProximityUpdates failed (non-fatal):', err);
        }

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

// Re-export Mappls distance service
export * from './mapplsDistanceService';

