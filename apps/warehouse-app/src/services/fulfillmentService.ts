/**
 * Fulfillment Service
 * Handles order lifecycle management for the warehouse app.
 * 
 * Note: Uses direct updates since the transition_order_state() RPC
 * was not deployed to the database. If the RPC is deployed later,
 * switch to using transitionOrderState from @popclozet/api-client.
 */

import { supabase } from '@popclozet/api-client';

export interface OrderWithItems {
    id: string;
    user_id: string;
    delivery_address_id: string | null;
    rental_start_date: string;
    rental_end_date: string;
    total_amount: number;
    deposit_amount: number;
    status: string;
    delivery_eta: string | null;
    rider_id: string | null;
    warehouse_otp?: string | null;
    warehouse_otp_expires_at?: string | null;
    warehouse_otp_used?: boolean;
    created_at: string;
    order_items?: Array<{
        id: string;
        product_id: string;
        size: string | null;
        rental_price: number;
    }>;
    addresses?: {
        full_address: string;
        latitude: number | null;
        longitude: number | null;
    } | null;
}

/**
 * Normalize order rows: unify status from either `status` or `lifecycle_state`
 */
function normalizeOrders(rows: any[]): OrderWithItems[] {
    return rows.map(row => ({
        ...row,
        status: row.status || row.lifecycle_state || 'unknown',
    }));
}

/**
 * Get the effective status of an order
 */
function getEffectiveStatus(order: any): string {
    return order.status || order.lifecycle_state || 'unknown';
}

/**
 * Get all orders for fulfillment view
 */
export async function getFulfillmentOrders(): Promise<OrderWithItems[]> {
    try {
        const { data, error } = await supabase
            .from('orders')
            .select(`
                *,
                order_items (*),
                addresses:delivery_address_id (full_address, latitude, longitude)
            `)
            .order('created_at', { ascending: true });

        if (error) {
            console.warn('getFulfillmentOrders:', error.message);
            return [];
        }

        // Filter to relevant statuses
        const relevant = (data || []).filter(o => {
            const status = getEffectiveStatus(o);
            return ['pending', 'confirmed', 'packed', 'ready_for_pickup', 'driver_arrived_warehouse', 'order_picked_up', 'dispatched', 'placed', 'pending_payment'].includes(status);
        });

        return normalizeOrders(relevant);
    } catch {
        return [];
    }
}

/**
 * Get packed orders (ready for dispatch)
 */
export async function getPackedOrders(): Promise<OrderWithItems[]> {
    try {
        const { data, error } = await supabase
            .from('orders')
            .select(`
                *,
                order_items (*),
                addresses:delivery_address_id (full_address, latitude, longitude)
            `)
            .order('created_at', { ascending: true });

        if (error) {
            console.warn('getPackedOrders:', error.message);
            return [];
        }

        const packed = (data || []).filter(o => getEffectiveStatus(o) === 'packed');
        return normalizeOrders(packed);
    } catch {
        return [];
    }
}

/**
 * Helper: update order status via transition_order_state RPC.
 * Falls back to direct update if RPC fails (e.g. not deployed).
 */
async function updateOrderStatus(orderId: string, newStatus: string, actorId: string) {
    try {
        // Try the robust RPC first
        const { data, error } = await supabase.rpc('transition_order_state', {
            p_order_id: orderId,
            p_new_status: newStatus,
            p_actor_role: 'warehouse',
            p_actor_id: actorId,
            p_rider_id: null // Explicitly provide null to resolve overload ambiguity
        });

        if (!error && (data as any)?.success) {
            return (data as any);
        }

        console.warn('RPC transition failed, falling back to direct update:', error?.message);
    } catch (e) {
        console.warn('RPC transition error, falling back to direct update');
    }

    // Direct update fallback (supports both status and lifecycle_state columns)
    const updatePayload: Record<string, any> = {
        status: newStatus,
        lifecycle_state: newStatus,
        // updated_at: new Date().toISOString(), // Column not in schema cache
    };

    const { data: directData, error: directError } = await supabase
        .from('orders')
        .update(updatePayload)
        .eq('id', orderId)
        .select()
        .single();

    if (directError) throw new Error(directError.message);
    return directData;
}

/**
 * Confirm an order (pending → confirmed)
 */
export async function confirmOrder(orderId: string, actorId: string) {
    return updateOrderStatus(orderId, 'confirmed', actorId);
}

/**
 * Mark order as ready for pickup (packed → ready_for_pickup)
 * This signals riders that the order is available for collection.
 */
export async function markAsReadyForPickup(orderId: string, actorId: string, riderId?: string) {
    if (riderId) {
        // Assign rider + transition to ready_for_pickup
        const { data, error } = await supabase
            .from('orders')
            .update({
                status: 'ready_for_pickup',
                lifecycle_state: 'ready_for_pickup',
                rider_id: riderId,
                // updated_at: new Date().toISOString(),
            })
            .eq('id', orderId)
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data;
    }

    return updateOrderStatus(orderId, 'ready_for_pickup', actorId);
}

/**
 * Generate a secure 6-digit OTP for rider arrival verification
 */
export async function generateWarehouseOtp(orderId: string): Promise<{ otp: string, expiresAt: string }> {
    const { data, error } = await supabase.rpc('generate_warehouse_otp', {
        p_order_id: orderId
    });

    if (error) throw new Error(error.message);
    if (!data?.success) throw new Error(data?.message || 'Failed to generate OTP');

    return {
        otp: data.otp,
        expiresAt: data.expires_at
    };
}

/**
 * Pack an order (confirmed → packed)
 */
export async function packOrder(orderId: string, actorId: string) {
    return updateOrderStatus(orderId, 'packed', actorId);
}

/**
 * Dispatch an order (packed → dispatched)
 */
export async function dispatchOrder(orderId: string, actorId: string, riderId?: string) {
    if (riderId) {
        // If rider is provided, include it in the direct update fallback payload
        // Note: The transition_order_state RPC doesn't handle rider assignment, 
        // so we use a hybrid approach or separate the concerns.
        const { data, error } = await supabase
            .from('orders')
            .update({
                status: 'dispatched',
                lifecycle_state: 'dispatched',
                rider_id: riderId,
                // updated_at: new Date().toISOString(),
            })
            .eq('id', orderId)
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data;
    }

    return updateOrderStatus(orderId, 'dispatched', actorId);
}

/**
 * Get return requests
 */
export async function getReturnRequests() {
    try {
        const { data, error } = await supabase
            .from('return_requests')
            .select(`
                *,
                orders:order_id (
                    id, user_id, total_amount, status, lifecycle_state,
                    order_items (product_id, size)
                )
            `)
            .order('created_at', { ascending: false });

        if (error) {
            console.warn('getReturnRequests:', error.message);
            return [];
        }
        return data || [];
    } catch {
        return [];
    }
}

/**
 * Approve a return request
 */
export async function approveReturn(returnId: string) {
    const { error } = await supabase
        .from('return_requests')
        .update({ status: 'approved' })
        .eq('id', returnId)
        .eq('status', 'requested');

    if (error) throw error;
}

/**
 * Complete a return (item received at warehouse)
 */
export async function completeReturn(returnId: string) {
    const { error } = await supabase
        .from('return_requests')
        .update({ status: 'completed' })
        .eq('id', returnId);

    if (error) throw error;
}

/**
 * Get active pickup orders (orders the rider is currently handling)
 * Shows the warehouse which packages have been picked up / are in transit.
 */
export async function getActivePickups(): Promise<OrderWithItems[]> {
    try {
        const { data, error } = await supabase
            .from('orders')
            .select(`
                *,
                order_items (*),
                addresses:delivery_address_id (full_address, latitude, longitude),
                rider:rider_id (full_name)
            `)
            .in('status', ['ready_for_pickup', 'driver_arrived_warehouse', 'order_picked_up', 'dispatched'])
            .order('updated_at', { ascending: false });

        if (error) {
            console.warn('getActivePickups:', error.message);
            return [];
        }

        return normalizeOrders(data || []);
    } catch {
        return [];
    }
}

/**
 * Get recent orders
 */
export async function getRecentOrders(limit: number = 10): Promise<OrderWithItems[]> {
    try {
        const { data, error } = await supabase
            .from('orders')
            .select(`*, order_items (*)`)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.warn('getRecentOrders:', error.message);
            return [];
        }
        return normalizeOrders(data || []);
    } catch {
        return [];
    }
}
