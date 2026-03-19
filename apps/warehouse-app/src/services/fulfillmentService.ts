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
        individual_id?: string | null;
        products?: {
            id: string;
            name: string;
            images?: string[] | null;
        } | null;
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

        const payload = data as { success?: boolean } | null;
        if (!error && payload?.success) {
            return payload as any;
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
    const { data: assignment, error: assignmentError } = await supabase.rpc('assign_order_units', {
        p_order_id: orderId,
        p_actor_id: actorId,
    });

    if (assignmentError) {
        throw new Error(assignmentError.message);
    }

    const assignmentPayload = assignment as { success?: boolean, message?: string } | null;
    if (assignmentPayload && !assignmentPayload.success) {
        throw new Error(assignmentPayload.message || 'Failed to assign physical units');
    }

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
                pickup_address:pickup_address_id (
                    id, label, full_address, latitude, longitude, is_default
                ),
                orders:order_id (
                    id, user_id, total_amount, status, lifecycle_state, rider_id,
                    return_pickup_date, return_time_slot,
                    addresses:delivery_address_id (full_address, latitude, longitude),
                    order_items (
                        id,
                        product_id,
                        size,
                        individual_id,
                        product:products (id, name, images),
                        unit:all_products!order_items_individual_id_fkey (
                            individual_id,
                            status,
                            inventory:inventory_id (
                                id,
                                size
                            )
                        )
                    )
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
export async function approveReturn(returnId: string, actorId: string) {
    const { data, error } = await supabase.rpc('approve_return_request', {
        p_return_request_id: returnId,
        p_actor_id: actorId,
    });

    if (error) throw error;
    
    const payload = data as { success?: boolean, message?: string } | null;
    if (payload && !payload.success) {
        throw new Error(payload.message || 'Failed to approve return');
    }

    return data;
}

/**
 * Receive a return at the warehouse.
 * Requires OTP verification — the rider must have dropped off first.
 */
export async function receiveReturnAtWarehouse(orderId: string, actorId: string, otp: string) {
    const { data, error } = await supabase.rpc('receive_return_at_warehouse', {
        p_order_id: orderId,
        p_actor_id: actorId,
        p_otp: otp,
    });

    if (error) throw error;
    
    const payload = data as { success?: boolean, message?: string } | null;
    if (payload && !payload.success) {
        throw new Error(payload.message || 'Failed to receive return');
    }

    return data;
}

/**
 * Get orders for warehouse fulfillment
 */
export async function getFulfillmentOrders(): Promise<OrderWithItems[]> {
    try {
        const { data, error } = await supabase
            .from('orders')
            .select(`
                *,
                order_items (
                    id,
                    product_id,
                    size,
                    rental_price,
                    individual_id,
                    products (id, name, images)
                ),
                addresses:delivery_address_id (full_address, latitude, longitude)
            `)
            .in('status', [
                'pending',
                'confirmed',
                'packed',
                'ready_for_pickup',
                'rider_assigned',
                'driver_arrived_warehouse',
                'dispatched',
                'out_for_delivery',
                'delivered'
            ])
            .order('created_at', { ascending: false });

        if (error) {
            console.error('getFulfillmentOrders error:', error.message);
            return [];
        }

        return normalizeOrders(data || []);
    } catch (err) {
        console.error('Failed to get fulfillment orders:', err);
        return [];
    }
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
            .in('status', ['ready_for_pickup', 'rider_assigned', 'driver_arrived_warehouse', 'order_picked_up', 'dispatched'])
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

/**
 * Get packed orders for dispatch
 */
export async function getPackedOrders(): Promise<OrderWithItems[]> {
    try {
        const { data, error } = await supabase
            .from('orders')
            .select(`
                *,
                order_items (
                    id,
                    product_id,
                    size,
                    rental_price,
                    individual_id,
                    products (id, name, images)
                ),
                addresses:delivery_address_id (full_address, latitude, longitude)
            `)
            .in('status', ['packed'])
            .order('created_at', { ascending: false });

        if (error) {
            console.error('getPackedOrders error:', error.message);
            return [];
        }

        return normalizeOrders(data || []);
    } catch (err) {
        console.error('Failed to get packed orders:', err);
        return [];
    }
}
