/**
 * Rider Order Service
 *
 * Connects riders to customer orders and provides location updates.
 * Used by rider-app; customer-app subscribes to these updates.
 */

import { supabase, transitionOrderState, config } from '@popclozet/api-client';
import type { OrderStatus } from '@popclozet/domain-contracts';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RiderOrder {
    id: string;
    orderId: string;
    customerId: string;
    customerName?: string;
    customerPhone?: string;
    orderType: 'delivery' | 'pickup' | 'return';
    status: OrderStatus;
    pickupAddress: { fullAddress: string; lat: number; lng: number };
    deliveryAddress: { fullAddress: string; lat: number; lng: number };
    items: Array<{ name: string; qty: number; imageUrl?: string }>;
    totalAmount: number;
    deliveryFee: number;
    etaMinutes?: number;
    distanceKm?: number;
    routePolyline?: string;
    assignedAt: string;
    createdAt: string;
}

export interface RiderLocation {
    riderId: string;
    lat: number;
    lng: number;
    heading?: number;
    speed?: number;
    updatedAt: string;
}

// Used by OrderRequestsPage
export interface RiderOrderRequest {
    id: string;
    order_id: string;
    rider_id: string;
    status: 'pending' | 'declined';
    created_at: string;
}

export interface ClaimResult {
    success: boolean;
    message?: string;
    already_claimed?: boolean;
}

const RETURN_FLOW_STATUSES = new Set<OrderStatus>([
    'return_scheduled',
    'return_dispatched',
    'return_picked_up',
    'return_at_warehouse',
    'returned',
    'return_completed',
]);

function isReturnFlowOrder(order: { status?: string; order_type?: string | null }) {
    return RETURN_FLOW_STATUSES.has((order.status ?? '') as OrderStatus) || order.order_type === 'return';
}

// ─── Order request actions ────────────────────────────────────────────────────

/**
 * Atomically claim an order using the claim_order RPC.
 * Uses SELECT FOR UPDATE — safe against concurrent claims.
 *
 * Returns already_claimed=true when another rider beat this one.
 * The caller must remove the card in BOTH success and already_claimed cases —
 * the difference is only in the toast message shown.
 */
export async function claimOrder(
    orderId: string,
    riderId: string,
): Promise<ClaimResult> {
    const { data, error } = await supabase.rpc('claim_order', {
        p_order_id: orderId,
        p_rider_id: riderId,
    });

    if (error) {
        console.error('[riderOrderService] claimOrder:', error);
        return { success: false, message: error.message };
    }

    const result = data as { success: boolean; message?: string };

    if (!result.success && result.message?.toLowerCase().includes('already claimed')) {
        return { success: false, already_claimed: true, message: result.message };
    }

    return result;
}

/**
 * Release an order back to the pool.
 * Records cancellation so this rider won't see the order again.
 * The release_order RPC resets status to ready_for_pickup which
 * re-fires the broadcast trigger.
 */
export async function releaseOrder(
    orderId: string,
    riderId: string,
    reason = 'Cancelled by rider',
): Promise<{ success: boolean; message?: string }> {
    const { data, error } = await supabase.rpc('release_order', {
        p_order_id: orderId,
        p_rider_id: riderId,
        p_reason: reason,
    });

    if (error) {
        console.error('[riderOrderService] releaseOrder:', error);
        return { success: false, message: error.message };
    }

    return data as { success: boolean; message?: string };
}

/**
 * Decline an order notification (rider says no without accepting).
 * Sets notification status to 'declined' so the DB keeps a record,
 * but the card is removed from the UI immediately before this call.
 */
export async function declineOrderNotification(notificationId: string): Promise<void> {
    const { error } = await supabase
        .from('rider_notifications')
        .update({ status: 'declined' })
        .eq('id', notificationId);

    if (error) console.error('[riderOrderService] declineNotification:', error);
}

/**
 * Subscribe to incoming order request notifications for this rider.
 * Returns a cleanup function.
 *
 * onNew    — fired when a new pending notification is inserted
 * onDeleted — fired when a notification is deleted (another rider claimed it)
 */
export function subscribeToOrderRequests(
    riderId: string,
    onNew: (notification: RiderOrderRequest) => void,
    onDeleted: (notificationId: string) => void,
): () => void {
    const channel = supabase
        .channel(`rider_requests:${riderId}`)
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'rider_notifications',
                filter: `rider_id=eq.${riderId}`,
            },
            (payload) => onNew(payload.new as RiderOrderRequest),
        )
        .on(
            'postgres_changes',
            {
                event: 'DELETE',
                schema: 'public',
                table: 'rider_notifications',
                filter: `rider_id=eq.${riderId}`,
            },
            (payload) => onDeleted((payload.old as { id: string }).id),
        )
        .subscribe();

    return () => supabase.removeChannel(channel);
}

// ─── Rider order fetching ─────────────────────────────────────────────────────

export async function getRiderOrders(riderId: string): Promise<RiderOrder[]> {
    if (config.USE_MOCK_DATA) {
        return [{
            id: 'order-123', orderId: 'order-123', customerId: 'cust-1',
            customerName: 'Alice Smith', orderType: 'delivery', status: 'confirmed',
            pickupAddress: { fullAddress: 'Popclozet Warehouse', lat: 19.1234, lng: 72.8567 },
            deliveryAddress: { fullAddress: '123 Main St, Mumbai', lat: 19.1100, lng: 72.8600 },
            items: [{ name: 'Designer Dress', qty: 1 }],
            totalAmount: 1500, deliveryFee: 150, etaMinutes: 15, distanceKm: 2.5,
            routePolyline: '', assignedAt: new Date().toISOString(), createdAt: new Date().toISOString(),
        }];
    }

    const { data, error } = await supabase
        .from('orders')
        .select(`
            id, user_id, status, order_type, total_amount, delivery_fee, created_at, delivery_eta,
            customer_profiles!orders_user_id_fkey1(full_name),
            addresses:delivery_address_id (full_address, latitude, longitude),
            order_items (
                id, 
                product_id, 
                rental_price,
                products (name, images)
            )
        `)
        .eq('rider_id', riderId)
        .in('status', [
            'rider_assigned', 'confirmed', 'packed', 'ready_for_pickup', 'driver_arrived_warehouse',
            'order_picked_up', 'dispatched', 'out_for_delivery',
            'return_scheduled', 'return_dispatched', 'return_picked_up', 'return_at_warehouse',
            'delivered', 'cancelled', 'return_completed', 'returned',
        ])
        .order('created_at', { ascending: false });

    if (error) { console.error('[riderOrderService] getRiderOrders:', error); return []; }

    return (data ?? []).map((order: any) => {
        const addr = order.addresses;
        const isReturn = isReturnFlowOrder(order);
        const pickupAddress = isReturn
            ? {
                fullAddress: addr?.full_address ?? 'Customer Address',
                lat: addr?.latitude ?? 0,
                lng: addr?.longitude ?? 0,
            }
            : {
                fullAddress: 'Popclozet Warehouse, Powai',
                lat: 19.1234,
                lng: 72.8567,
            };
        const deliveryAddress = isReturn
            ? {
                fullAddress: 'Popclozet Warehouse, Powai',
                lat: 19.1234,
                lng: 72.8567,
            }
            : {
                fullAddress: addr?.full_address ?? 'Customer Address',
                lat: addr?.latitude ?? 0,
                lng: addr?.longitude ?? 0,
            };

        return {
            id: order.id, orderId: order.id, customerId: order.user_id,
            customerName: order.customer_profiles?.full_name || order.profiles?.full_name,
            orderType: isReturn ? 'return' as const : 'delivery' as const,
            status: order.status,
            pickupAddress,
            deliveryAddress,
            items: (order.order_items ?? []).map((i: any) => ({
                name: i.products?.name || `Product ${i.product_id.slice(0, 8)}`, 
                qty: 1,
                imageUrl: Array.isArray(i.products?.images) ? i.products.images[0] : null,
            })),
            totalAmount: order.total_amount ?? 0,
            deliveryFee: order.delivery_fee ?? Math.round((order.total_amount ?? 0) * 0.15),
            assignedAt: order.created_at,
            createdAt: order.created_at,
        };
    });
}

export async function getRiderOrderById(orderId: string): Promise<RiderOrder | null> {
    if (config.USE_MOCK_DATA) {
        return {
            id: orderId, orderId, customerId: 'cust-1', customerName: 'Alice Smith',
            orderType: 'delivery', status: 'out_for_delivery',
            pickupAddress: { fullAddress: 'Popclozet Warehouse', lat: 19.1234, lng: 72.8567 },
            deliveryAddress: { fullAddress: '123 Main St, Mumbai', lat: 19.1100, lng: 72.8600 },
            items: [{ name: 'Designer Dress', qty: 1 }],
            totalAmount: 1500, deliveryFee: 150, etaMinutes: 10, distanceKm: 1.2,
            routePolyline: '', assignedAt: new Date().toISOString(), createdAt: new Date().toISOString(),
        };
    }

    const { data, error } = await supabase
        .from('orders')
        .select(`
            id, user_id, status, order_type, total_amount, delivery_fee,
            route_distance_km, route_polyline, created_at, delivery_eta,
            customer_profiles!orders_user_id_fkey1(full_name),
            addresses:delivery_address_id (full_address, latitude, longitude),
            order_items (
                id, 
                product_id, 
                rental_price,
                products (name, images)
            )
        `)
        .eq('id', orderId)
        .single();

    if (error || !data) { console.error('[riderOrderService] getRiderOrderById:', error); return null; }

    const addr = data.addresses as any;
    const isReturn = isReturnFlowOrder(data);
    return {
        id: data.id, orderId: data.id, customerId: data.user_id,
        customerName: (data as any).customer_profiles?.full_name || (data as any).profiles?.full_name,
        orderType: isReturn ? 'return' : (data.order_type ?? 'delivery'),
        status: data.status,
        pickupAddress: isReturn
            ? {
                fullAddress: addr?.full_address ?? 'Customer Address',
                lat: addr?.latitude ?? 0,
                lng: addr?.longitude ?? 0,
            }
            : {
                fullAddress: 'Popclozet Warehouse', lat: 19.1234, lng: 72.8567,
            },
        deliveryAddress: isReturn
            ? {
                fullAddress: 'Popclozet Warehouse', lat: 19.1234, lng: 72.8567,
            }
            : {
                fullAddress: addr?.full_address ?? 'Customer Address',
                lat: addr?.latitude ?? 0,
                lng: addr?.longitude ?? 0,
            },
        items: (data.order_items ?? []).map((i: any) => ({
            name: i.products?.name || `Product ${i.product_id.slice(0, 8)}`, 
            qty: 1,
            imageUrl: Array.isArray(i.products?.images) ? i.products.images[0] : null,
        })),
        totalAmount: data.total_amount ?? 0,
        deliveryFee: data.delivery_fee ?? 0,
        distanceKm: data.route_distance_km,
        routePolyline: data.route_polyline,
        assignedAt: data.created_at,
        createdAt: data.created_at,
    };
}

// ─── Order status transitions ─────────────────────────────────────────────────

export async function updateOrderAsRider(orderId: string, newStatus: OrderStatus, riderId: string) {
    return transitionOrderState(orderId, newStatus, 'rider', riderId);
}

export async function markAsPickedUp(orderId: string, riderId: string) {
    return updateOrderAsRider(orderId, 'out_for_delivery', riderId);
}

export async function verifyWarehouseOtp(orderId: string, otp: string, riderId: string) {
    const { data, error } = await supabase.rpc('verify_warehouse_otp', {
        p_order_id: orderId, p_otp: otp, p_actor_id: riderId,
    });
    if (error) return { success: false, message: error.message };
    return data;
}

export async function markArrivedAtWarehouse(orderId: string, riderId: string) {
    return updateOrderAsRider(orderId, 'driver_arrived_warehouse', riderId);
}

export async function markOrderPickedUp(orderId: string, riderId: string) {
    return updateOrderAsRider(orderId, 'order_picked_up', riderId);
}

export async function markAsDispatched(orderId: string, riderId: string) {
    return updateOrderAsRider(orderId, 'dispatched', riderId);
}

export async function markAsOutForDelivery(orderId: string, riderId: string) {
    return updateOrderAsRider(orderId, 'out_for_delivery', riderId);
}

export async function markAsDelivered(orderId: string, riderId: string) {
    return updateOrderAsRider(orderId, 'delivered', riderId);
}

/**
 * Rider drops off a return at the warehouse.
 * Generates an OTP that the warehouse staff must enter to complete receipt.
 * Transitions: return_picked_up → return_at_warehouse
 */
export async function riderDropOffReturn(orderId: string, riderId: string) {
    const { data, error } = await supabase.rpc('rider_drop_off_return', {
        p_order_id: orderId,
        p_actor_id: riderId,
    });
    if (error) return { success: false, message: error.message };
    return data as { success: boolean; message?: string; otp?: string; status?: string };
}

/**
 * @deprecated Use riderDropOffReturn instead. This is now warehouse-only with OTP.
 */
export async function receiveReturnAtWarehouse(orderId: string, actorId: string) {
    const { data, error } = await supabase.rpc('receive_return_at_warehouse', {
        p_order_id: orderId,
        p_actor_id: actorId,
    });
    if (error) return { success: false, message: error.message };
    return data as { success: boolean; message?: string; status?: string };
}

/**
 * Complete delivery via RPC (server-side auth, credits wallet automatically)
 */
export async function completeDelivery(orderId: string): Promise<void> {
    const { error } = await supabase.rpc('complete_delivery', { p_order: orderId });
    if (error) throw error;
}

// ─── Messaging ────────────────────────────────────────────────────────────────

export const PREDEFINED_MESSAGES = [
    'Your package has been dispatched and is on the way.',
    'I am at the warehouse collecting your package.',
    'Your package has been picked up. Heading to your location now.',
    'I will arrive at your location shortly.',
    'I am near your delivery location. Please be available.',
    'I am on the way to collect your return.',
    'I have collected your return and I am heading back to the warehouse.',
];

export async function sendMessageToCustomer(
    orderId: string, customerId: string, message: string, riderName?: string,
): Promise<boolean> {
    const { error } = await supabase.from('notifications').insert({
        user_id: customerId,
        type: 'rider_message',
        title: `💬 Message from ${riderName ?? 'your rider'}`,
        body: message,
        order_id: orderId,
        is_read: false,
    });
    if (error) { console.error('[riderOrderService] sendMessageToCustomer:', error); return false; }
    return true;
}

// ─── Location ─────────────────────────────────────────────────────────────────

export async function updateRiderLocation(
    riderId: string, latitude: number, longitude: number,
    heading?: number, speed?: number,
): Promise<boolean> {
    const { error } = await supabase.from('rider_locations').upsert(
        {
            rider_id: riderId,
            lat: latitude,          // DB column is 'lat', not 'latitude'
            lng: longitude,         // DB column is 'lng', not 'longitude'
            heading: heading ?? null,
            speed: speed ?? null,
            updated_at: new Date().toISOString(), // DB column is 'updated_at', not 'timestamp'
        },
        { onConflict: 'rider_id' },
    );
    if (error) { console.error('[riderOrderService] updateRiderLocation:', error); return false; }
    return true;
}

export async function getRiderLocation(riderId: string): Promise<RiderLocation | null> {
    const { data, error } = await supabase
        .from('rider_locations').select('*').eq('rider_id', riderId).single();
    if (error || !data) return null;
    return {
        riderId: data.rider_id,
        lat: data.latitude,
        lng: data.longitude,
        heading: data.heading,
        speed: data.speed,
        updatedAt: data.timestamp,
    };
}

// ─── Realtime helpers ─────────────────────────────────────────────────────────

export function subscribeToRiderOrderAssignments(
    riderId: string, callback: (orderId: string) => void,
) {
    const channel = supabase
        .channel(`rider_assignments_${riderId}`)
        .on('postgres_changes', {
            event: 'UPDATE', schema: 'public', table: 'orders',
            filter: `rider_id=eq.${riderId}`,
        }, (payload) => {
            if (payload.new.rider_id === riderId && payload.old?.rider_id !== riderId) {
                callback(payload.new.id);
            }
        })
        .subscribe();
    return () => supabase.removeChannel(channel);
}

export function subscribeToOrderUpdates(
    orderId: string, callback: (status: OrderStatus) => void,
) {
    const channel = supabase
        .channel(`order_status_${orderId}`)
        .on('postgres_changes', {
            event: 'UPDATE', schema: 'public', table: 'orders',
            filter: `id=eq.${orderId}`,
        }, (payload) => callback(payload.new.status))
        .subscribe();
    return () => supabase.removeChannel(channel);
}
