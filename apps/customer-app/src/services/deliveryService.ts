// src/services/deliveryService.ts
// Delivery/pickup routing, ETA calculation, and pricing

import { supabase } from '@popclozet/api-client';
import { calculateRoute, RouteResult } from './mapService';
import { RentalHub } from './hubService';
import { createTrackingRecord, deactivateTracking } from './trackingService';
import { notifyOrderStatusChange } from './notificationService';

export interface DeliveryOrder {
    id: string;
    user_id: string;
    hub_id?: string | null;
    delivery_address_id: string;
    delivery_address_snapshot?: {
        full_address: string;
        lat: number;
        lng: number;
    } | null;
    order_type: 'delivery' | 'pickup' | 'return' | 'rental' | 'home_try_on';
    status: OrderStatus;
    route_distance_km: number;
    route_polyline: string;
    estimated_delivery_at: string;
    actual_delivery_at: string | null;
    scheduled_slot: TimeSlot | null;
    delivery_fee: number;
    is_free_delivery: boolean;
    support_tier?: 'standard' | 'premium' | null;
    total_amount?: number;
    rider_id?: string | null;
    otp_delivery?: string | null;
    otp_return?: string | null;
    return_pickup_date?: string | null;
    return_time_slot?: string | null;
    created_at: string;
    updated_at: string;
}

export type OrderStatus =
    | 'pending'
    | 'confirmed'
    | 'packed'
    | 'ready_for_pickup'
    | 'rider_assigned'
    | 'preparing'
    | 'driver_arrived_warehouse'
    | 'order_picked_up'
    | 'dispatched'
    | 'out_for_delivery'
    | 'delivered'
    | 'pickup_scheduled'
    | 'picked_up'
    | 'in_use'
    | 'return_requested'
    | 'return_scheduled'
    | 'return_dispatched'
    | 'return_picked_up'
    | 'returned'
    | 'return_completed'
    | 'completed'
    | 'cancelled';

export interface TimeSlot {
    date: string; // YYYY-MM-DD
    start: string; // HH:mm
    end: string; // HH:mm
}

export interface DeliveryPricing {
    baseFee: number;
    distanceFee: number;
    totalFee: number;
    isFree: boolean;
    freeReason?: string;
}

// Pricing configuration
const PRICING_CONFIG = {
    baseFee: 49, // Base delivery fee in INR
    perKmRate: 5, // Per km rate after free km
    freeKm: 5, // First 5 km free
    maxFee: 199, // Cap delivery fee
    freeThreshold: 1999, // Free delivery for orders above this
    pickupDiscount: 0.5, // 50% off for pickup/return
};

// Calculate delivery pricing based on distance
export function calculateDeliveryPricing(
    distanceKm: number,
    orderAmount: number = 0,
    orderType: 'delivery' | 'pickup' | 'return' = 'delivery',
    hasFreeDelivery: boolean = false
): DeliveryPricing {
    // Fixed delivery fee of 40 rupees for all
    const fixedFee = hasFreeDelivery ? 0 : 40;

    return {
        baseFee: fixedFee,
        distanceFee: 0,
        totalFee: fixedFee,
        isFree: hasFreeDelivery,
    };
}

// Calculate ETA based on distance and time of day
export function calculateETA(
    distanceKm: number,
    hubAvgMinutes: number = 45
): { minutes: number; displayText: string } {
    // Base time from hub
    let minutes = hubAvgMinutes;

    // Add time based on distance (roughly 2 mins per km in city traffic)
    minutes += Math.round(distanceKm * 2);

    // Add buffer based on time of day
    const hour = new Date().getHours();
    if ((hour >= 8 && hour <= 10) || (hour >= 17 && hour <= 20)) {
        // Rush hour - add 20%
        minutes = Math.round(minutes * 1.2);
    }

    // Generate display text
    let displayText: string;
    if (minutes <= 30) {
        displayText = '20-30 mins';
    } else if (minutes <= 45) {
        displayText = '30-45 mins';
    } else if (minutes <= 60) {
        displayText = '45-60 mins';
    } else if (minutes <= 90) {
        displayText = '60-90 mins';
    } else {
        displayText = `${Math.round(minutes / 30) * 30}-${Math.round(minutes / 30) * 30 + 30} mins`;
    }

    return { minutes, displayText };
}

// Generate available time slots for next 7 days
export function getAvailableTimeSlots(): { date: string; slots: TimeSlot[] }[] {
    const result: { date: string; slots: TimeSlot[] }[] = [];
    const now = new Date();

    for (let i = 0; i < 7; i++) {
        const date = new Date(now);
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];

        const slots: TimeSlot[] = [];
        const startHour = i === 0 ? Math.max(10, now.getHours() + 2) : 10;

        for (let hour = startHour; hour <= 20; hour += 2) {
            slots.push({
                date: dateStr,
                start: `${String(hour).padStart(2, '0')}:00`,
                end: `${String(hour + 2).padStart(2, '0')}:00`,
            });
        }

        if (slots.length > 0) {
            result.push({ date: dateStr, slots });
        }
    }

    return result;
}

// Calculate full delivery route info
export async function getDeliveryRoute(
    hub: RentalHub,
    userLat: number,
    userLng: number,
    orderType: 'delivery' | 'pickup' | 'return' = 'delivery'
): Promise<{
    route: RouteResult;
    pricing: DeliveryPricing;
    eta: { minutes: number; displayText: string };
} | null> {
    // For delivery: hub -> user
    // For pickup/return: user -> hub
    const origin = orderType === 'delivery'
        ? { lat: hub.lat, lng: hub.lng }
        : { lat: userLat, lng: userLng };
    const destination = orderType === 'delivery'
        ? { lat: userLat, lng: userLng }
        : { lat: hub.lat, lng: hub.lng };

    const route = await calculateRoute(origin, destination);

    if (!route) return null;

    const pricing = calculateDeliveryPricing(route.distance, 0, orderType);
    const eta = calculateETA(route.distance, hub.avg_delivery_minutes);

    return { route, pricing, eta };
}

// Create a delivery order
export async function createDeliveryOrder(
    userId: string,
    hubId: string,
    addressId: string,
    addressSnapshot: { full_address: string; lat: number; lng: number },
    orderType: 'delivery' | 'pickup' | 'return',
    routeInfo?: { distance_km: number; polyline: string; eta_minutes: number },
    scheduledSlot?: TimeSlot
): Promise<DeliveryOrder | null> {
    if (!supabase) {
        console.warn('Supabase not configured');
        return null;
    }

    const estimatedDeliveryAt = scheduledSlot
        ? new Date(`${scheduledSlot.date}T${scheduledSlot.start}:00`).toISOString()
        : new Date(Date.now() + (routeInfo?.eta_minutes || 60) * 60000).toISOString();

    const { data, error } = await supabase
        .from('orders')
        .insert({
            user_id: userId,
            hub_id: hubId,
            delivery_address_id: addressId,
            delivery_address_snapshot: addressSnapshot,
            order_type: orderType,
            status: 'pending',
            route_distance_km: routeInfo?.distance_km,
            route_polyline: routeInfo?.polyline,
            estimated_delivery_at: estimatedDeliveryAt,
            scheduled_slot: scheduledSlot,
            delivery_fee: calculateDeliveryPricing(routeInfo?.distance_km || 0, 0, orderType).totalFee,
            is_free_delivery: orderType === 'return',
        })
        .select()
        .single();

    if (error) {
        console.error('Failed to create delivery order:', error);
        return null;
    }

    return data;
}

// Update order status
export async function updateOrderStatus(
    orderId: string,
    status: OrderStatus,
    options?: {
        driverName?: string;
        vehicleNumber?: string;
        sendNotification?: boolean;
    }
): Promise<boolean> {
    if (!supabase) return false;

    // Get current order to get user_id for notifications
    const currentOrder = await getOrderById(orderId);
    if (!currentOrder) {
        console.error('Order not found:', orderId);
        return false;
    }

    const updates: Record<string, any> = { status, updated_at: new Date().toISOString() };

    if (status === 'delivered' || status === 'picked_up' || status === 'return_completed' || status === 'completed') {
        updates.actual_delivery_at = new Date().toISOString();
        // Deactivate tracking when order is completed
        await deactivateTracking(orderId);
    }

    const { error } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', orderId);

    if (error) {
        console.error('Failed to update order status:', error);
        return false;
    }

    // Create tracking record when order goes out for delivery or pickup is scheduled
    if (status === 'out_for_delivery' || status === 'pickup_scheduled') {
        await createTrackingRecord(
            orderId,
            options?.driverName,
            options?.vehicleNumber
        );
    }

    // Send notification if enabled (default: true)
    if (options?.sendNotification !== false) {
        try {
            await notifyOrderStatusChange(currentOrder.user_id, orderId, status);
        } catch (error) {
            console.warn('Failed to send notification:', error);
            // Don't fail the status update if notification fails
        }
    }

    return true;
}

// Get user's delivery orders
export async function getUserOrders(userId: string): Promise<DeliveryOrder[]> {
    if (!supabase) return [];

    const { data, error } = await supabase
        .from('orders')
        .select(`
            *,
            order_items (id),
            delivery_address:delivery_address_id!left (full_address, latitude, longitude)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) {
        // Only log real errors, not "no rows" (PGRST116)
        if (error.code !== 'PGRST116') {
            console.error('Failed to fetch orders:', error);
        }
        return [];
    }

    return data || [];
}

// Get order by ID
export async function getOrderById(orderId: string): Promise<DeliveryOrder | null> {
    if (!supabase) return null;

    const { data, error } = await supabase
        .from('orders')
        .select(`
            *,
            order_items (id, product_id, size, rental_price),
            delivery_address:delivery_address_id!left (full_address, latitude, longitude)
        `)
        .eq('id', orderId)
        .single();

    if (error) {
        console.error('Failed to fetch order:', error);
        return null;
    }

    return data;
}
