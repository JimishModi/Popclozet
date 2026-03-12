/**
 * Rider Order Service
 * 
 * Connects riders to customer orders and provides location updates.
 * Used by rider-app; customer-app subscribes to these updates.
 */

import { supabase, transitionOrderState, config } from '@popclozet/api-client';
import type { OrderStatus } from '@popclozet/domain-contracts';

// ==========================================
// TYPES
// ==========================================

export interface RiderOrder {
    id: string;
    orderId: string;
    customerId: string;
    customerName?: string;
    customerPhone?: string;
    orderType: 'delivery' | 'pickup' | 'return';
    status: OrderStatus;
    pickupAddress: {
        fullAddress: string;
        lat: number;
        lng: number;
    };
    deliveryAddress: {
        fullAddress: string;
        lat: number;
        lng: number;
    };
    items: Array<{ name: string; qty: number }>;
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

// ==========================================
// RIDER ORDER FETCHING
// ==========================================

/**
 * Get all assigned orders for a rider
 * Updated to use correct schema: orders table with rider_id and addresses join
 */
export async function getRiderOrders(riderId: string): Promise<RiderOrder[]> {
    if (config.USE_MOCK_DATA) {
        return [
            {
                id: 'order-123',
                orderId: 'order-123',
                customerId: 'cust-1',
                customerName: 'Alice Smith',
                orderType: 'delivery',
                status: 'confirmed',
                pickupAddress: { fullAddress: 'PopClozet Warehouse', lat: 19.1234, lng: 72.8567 },
                deliveryAddress: {
                    fullAddress: '123 Main St, Mumbai',
                    lat: 19.1100,
                    lng: 72.8600,
                },
                items: [{ name: 'Designer Dress', qty: 1 }],
                totalAmount: 1500,
                deliveryFee: 150,
                etaMinutes: 15,
                distanceKm: 2.5,
                routePolyline: '',
                assignedAt: new Date().toISOString(),
                createdAt: new Date().toISOString(),
            }
        ];
    }

    const { data, error } = await supabase
        .from('orders')
        .select(`
            id,
            user_id,
            status,
            total_amount,
            created_at,
            delivery_eta,
            addresses:delivery_address_id (
                full_address,
                latitude,
                longitude
            ),
            order_items (
                id,
                product_id,
                rental_price
            )
        `)
        .eq('rider_id', riderId)
        .in('status', ['confirmed', 'packed', 'ready_for_pickup', 'driver_arrived_warehouse', 'order_picked_up', 'dispatched', 'out_for_delivery']);

    if (error) {
        console.error('Failed to fetch rider orders:', error);
        return [];
    }

    return (data || []).map((order: any) => {
        const addr = order.addresses;
        return {
            id: order.id,
            orderId: order.id,
            customerId: order.user_id,
            orderType: 'delivery' as const,
            status: order.status,
            pickupAddress: { fullAddress: 'PopClozet Warehouse', lat: 19.1234, lng: 72.8567 },
            deliveryAddress: {
                fullAddress: addr?.full_address || 'Customer Address',
                lat: addr?.latitude || 0,
                lng: addr?.longitude || 0,
            },
            items: (order.order_items || []).map((item: any) => ({
                name: `Product ${item.product_id.slice(0, 8)}`,
                qty: 1,
            })),
            totalAmount: order.total_amount || 0,
            deliveryFee: Math.round((order.total_amount || 0) * 0.15),
            assignedAt: order.created_at,
            createdAt: order.created_at,
        };
    });
}

/**
 * Get a single order by ID for the rider
 */
export async function getRiderOrderById(orderId: string): Promise<RiderOrder | null> {
    if (config.USE_MOCK_DATA) {
        return {
            id: orderId,
            orderId: orderId,
            customerId: 'cust-1',
            customerName: 'Alice Smith',
            orderType: 'delivery',
            status: 'out_for_delivery',
            pickupAddress: { fullAddress: 'PopClozet Warehouse', lat: 19.1234, lng: 72.8567 },
            deliveryAddress: {
                fullAddress: '123 Main St, Mumbai',
                lat: 19.1100,
                lng: 72.8600,
            },
            items: [{ name: 'Designer Dress', qty: 1 }],
            totalAmount: 1500,
            deliveryFee: 150,
            etaMinutes: 10,
            distanceKm: 1.2,
            routePolyline: '',
            assignedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
        };
    }

    const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

    if (error || !data) {
        console.error('Failed to fetch order:', error);
        return null;
    }

    return {
        id: data.id,
        orderId: data.id,
        customerId: data.user_id,
        orderType: data.order_type,
        status: data.status,
        pickupAddress: { fullAddress: 'Hub Location', lat: 0, lng: 0 },
        deliveryAddress: {
            fullAddress: data.addresses?.full_address || 'Customer Address',
            lat: data.addresses?.latitude || 0,
            lng: data.addresses?.longitude || 0,
        },
        items: [],
        totalAmount: 0,
        deliveryFee: data.delivery_fee,
        distanceKm: data.route_distance_km,
        routePolyline: data.route_polyline,
        assignedAt: data.created_at,
        createdAt: data.created_at,
    };
}

// ==========================================
// ORDER STATUS UPDATES
// ==========================================

/**
 * Update order status as rider
 */
export async function updateOrderAsRider(
    orderId: string,
    newStatus: OrderStatus,
    riderId: string
) {
    return transitionOrderState(orderId, newStatus, 'rider', riderId);
}

/**
 * Mark order as picked up from hub
 */
export async function markAsPickedUp(orderId: string, riderId: string) {
    return updateOrderAsRider(orderId, 'out_for_delivery', riderId);
}

/**
 * Mark rider as arrived at warehouse
 */
export async function markArrivedAtWarehouse(orderId: string, riderId: string) {
    return updateOrderAsRider(orderId, 'driver_arrived_warehouse', riderId);
}

/**
 * Mark order as picked up from warehouse
 */
export async function markOrderPickedUp(orderId: string, riderId: string) {
    return updateOrderAsRider(orderId, 'order_picked_up', riderId);
}

/**
 * Mark order as dispatched (leaving warehouse / out for delivery)
 */
export async function markAsDispatched(orderId: string, riderId: string) {
    return updateOrderAsRider(orderId, 'dispatched', riderId);
}

/**
 * Mark order as delivered to customer
 */
export async function markAsDelivered(orderId: string, riderId: string) {
    return updateOrderAsRider(orderId, 'delivered', riderId);
}

/**
 * Start pickup from hub (RPC - server validates rider auth)
 */
export async function startPickup(orderId: string) {
    const { error } = await supabase.rpc('start_pickup', { p_order: orderId });
    if (error) throw error;
}

/**
 * Mark items as picked up (RPC)
 */
export async function markPicked(orderId: string) {
    const { error } = await supabase.rpc('mark_picked', { p_order: orderId });
    if (error) throw error;
}

/**
 * Start delivery / out for delivery (RPC)
 */
export async function startDelivery(orderId: string) {
    const { error } = await supabase.rpc('out_for_delivery', { p_order: orderId });
    if (error) throw error;
}

/**
 * Complete delivery via RPC (server-side auth, credits wallet automatically)
 */
export async function completeDelivery(orderId: string) {
    const { error } = await supabase.rpc('complete_delivery', { p_order: orderId });
    if (error) throw error;
}

// ==========================================
// RIDER-TO-CUSTOMER MESSAGING
// ==========================================

/**
 * Predefined messages the rider can send to the customer
 */
export const PREDEFINED_MESSAGES = [
    'Your package has been dispatched and is on the way.',
    'I am at the warehouse collecting your package.',
    'Your package has been picked up. Heading to your location now.',
    'I will arrive at your location shortly.',
    'I am near your delivery location. Please be available.',
];

/**
 * Send a message from rider to customer via the notifications table
 */
export async function sendMessageToCustomer(
    orderId: string,
    customerId: string,
    message: string,
    riderName?: string
): Promise<boolean> {
    const { error } = await supabase
        .from('notifications')
        .insert({
            user_id: customerId,
            type: 'rider_message',
            title: `💬 Message from ${riderName || 'your rider'}`,
            body: message,
            order_id: orderId,
            is_read: false,
        });

    if (error) {
        console.error('Failed to send message to customer:', error);
        return false;
    }

    return true;
}

// ==========================================
// RIDER LOCATION UPDATES
// ==========================================

/**
 * Update rider's current location
 * Called frequently from rider app (every 5-10 seconds during active delivery)
 */
export async function updateRiderLocation(
    riderId: string,
    lat: number,
    lng: number,
    heading?: number,
    speed?: number
): Promise<boolean> {
    const { error } = await supabase
        .from('rider_locations')
        .upsert({
            rider_id: riderId,
            lat,
            lng,
            heading,
            speed,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'rider_id' });

    if (error) {
        console.error('Failed to update rider location:', error);
        return false;
    }

    return true;
}

/**
 * Get current location of a rider
 */
export async function getRiderLocation(riderId: string): Promise<RiderLocation | null> {
    const { data, error } = await supabase
        .from('rider_locations')
        .select('*')
        .eq('rider_id', riderId)
        .single();

    if (error || !data) {
        return null;
    }

    return {
        riderId: data.rider_id,
        lat: data.lat,
        lng: data.lng,
        heading: data.heading,
        speed: data.speed,
        updatedAt: data.updated_at,
    };
}

// ==========================================
// REALTIME SUBSCRIPTIONS
// ==========================================

/**
 * Subscribe to new order assignments for a rider
 * Watches for orders where rider_id is set to this rider
 */
export function subscribeToRiderOrderAssignments(
    riderId: string,
    callback: (orderId: string) => void
) {
    const channel = supabase
        .channel(`rider_assignments_${riderId}`)
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'orders',
                filter: `rider_id=eq.${riderId}`,
            },
            (payload) => {
                // Only notify if this update assigned the order to this rider
                if (payload.new.rider_id === riderId && payload.old?.rider_id !== riderId) {
                    callback(payload.new.id);
                }
            }
        )
        .subscribe();

    return () => supabase.removeChannel(channel);
}

/**
 * Subscribe to order status updates (for rider UI)
 */
export function subscribeToOrderUpdates(
    orderId: string,
    callback: (status: OrderStatus) => void
) {
    const channel = supabase
        .channel(`order_status_${orderId}`)
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'orders',
                filter: `id=eq.${orderId}`,
            },
            (payload) => {
                callback(payload.new.status);
            }
        )
        .subscribe();

    return () => supabase.removeChannel(channel);
}
