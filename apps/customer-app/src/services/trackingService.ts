// src/services/trackingService.ts
// Delivery tracking service for real-time vehicle position updates

import { supabase } from '@popclozet/api-client';
import { calculateRoute } from './mapService';
import { getOrderById, DeliveryOrder } from './deliveryService';
import { getHubById, RentalHub } from './hubService';

export interface TrackingRecord {
    id: string;
    order_id: string;
    driver_name: string | null;
    vehicle_number: string | null;
    current_lat: number;
    current_lng: number;
    heading: number | null;
    speed: number | null;
    eta_minutes: number | null;
    last_eta_update: string;
    is_active: boolean;
    updated_at: string;
}

export interface TrackingUpdate {
    lat: number;
    lng: number;
    heading?: number;
    speed?: number;
}

/**
 * Create a new tracking record for an order
 * This should be called when an order status changes to 'out_for_delivery' or 'pickup_scheduled'
 */
export async function createTrackingRecord(
    orderId: string,
    driverName?: string,
    vehicleNumber?: string
): Promise<TrackingRecord | null> {
    if (!supabase) {
        console.warn('Supabase not configured');
        return null;
    }

    // Get order details
    const order = await getOrderById(orderId);
    if (!order) {
        console.error('Order not found:', orderId);
        return null;
    }

    // Get hub details
    const hub = order.hub_id ? await getHubById(order.hub_id) : null;
    if (!hub) {
        console.error('Hub not found for order:', orderId);
        return null;
    }

    // Determine starting position based on order type
    // For delivery: start at hub
    // For pickup/return: start at user location
    const startPosition = order.order_type === 'delivery'
        ? { lat: hub.lat, lng: hub.lng }
        : order.delivery_address_snapshot
            ? { lat: order.delivery_address_snapshot.lat, lng: order.delivery_address_snapshot.lng }
            : null;

    if (!startPosition) {
        console.error('Cannot determine start position for order:', orderId);
        return null;
    }

    // Calculate initial ETA
    const destination = order.order_type === 'delivery'
        ? order.delivery_address_snapshot
        : { lat: hub.lat, lng: hub.lng };

    if (!destination) {
        console.error('Cannot determine destination for order:', orderId);
        return null;
    }

    let etaMinutes: number | null = null;
    try {
        const route = await calculateRoute(startPosition, { lat: destination.lat, lng: destination.lng });
        if (route) {
            etaMinutes = Math.ceil(route.duration);
        }
    } catch (error) {
        console.warn('Failed to calculate initial ETA:', error);
        // Use fallback ETA from order
        if (order.route_distance_km) {
            etaMinutes = Math.ceil(order.route_distance_km * 2 + 30); // Rough estimate
        }
    }

    // Deactivate any existing tracking records for this order
    await supabase
        .from('delivery_tracking')
        .update({ is_active: false })
        .eq('order_id', orderId)
        .eq('is_active', true);

    // Create new tracking record
    const { data, error } = await supabase
        .from('delivery_tracking')
        .insert({
            order_id: orderId,
            driver_name: driverName || null,
            vehicle_number: vehicleNumber || null,
            current_lat: startPosition.lat,
            current_lng: startPosition.lng,
            heading: null,
            speed: null,
            eta_minutes: etaMinutes,
            is_active: true,
        })
        .select()
        .single();

    if (error) {
        console.error('Failed to create tracking record:', error);
        return null;
    }

    return data;
}

/**
 * Update vehicle position in tracking record
 */
export async function updateTrackingPosition(
    orderId: string,
    position: TrackingUpdate
): Promise<boolean> {
    if (!supabase) return false;

    // Get current tracking record
    const { data: tracking } = await supabase
        .from('delivery_tracking')
        .select('*')
        .eq('order_id', orderId)
        .eq('is_active', true)
        .single();

    if (!tracking) {
        console.warn('No active tracking record found for order:', orderId);
        return false;
    }

    // Get order to recalculate ETA
    const order = await getOrderById(orderId);
    if (!order) {
        console.error('Order not found:', orderId);
        return false;
    }

    // Determine destination
    const hub = order.hub_id ? await getHubById(order.hub_id) : null;
    if (!hub) {
        console.error('Hub not found for order:', orderId);
        return false;
    }

    const destination = order.order_type === 'delivery'
        ? order.delivery_address_snapshot
        : { lat: hub.lat, lng: hub.lng };

    if (!destination) {
        console.error('Cannot determine destination for order:', orderId);
        return false;
    }

    // Recalculate ETA
    let etaMinutes: number | null = tracking.eta_minutes;
    try {
        const route = await calculateRoute(
            { lat: position.lat, lng: position.lng },
            { lat: destination.lat, lng: destination.lng }
        );
        if (route) {
            etaMinutes = Math.ceil(route.duration);
        }
    } catch (error) {
        console.warn('Failed to recalculate ETA:', error);
    }

    // Calculate heading from previous position if available
    let heading = position.heading;
    if (!heading && tracking.current_lat && tracking.current_lng) {
        heading = calculateHeading(
            { lat: tracking.current_lat, lng: tracking.current_lng },
            { lat: position.lat, lng: position.lng }
        );
    }

    // Update tracking record
    const { error } = await supabase
        .from('delivery_tracking')
        .update({
            current_lat: position.lat,
            current_lng: position.lng,
            heading: heading || null,
            speed: position.speed || null,
            eta_minutes: etaMinutes,
            last_eta_update: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .eq('id', tracking.id);

    if (error) {
        console.error('Failed to update tracking position:', error);
        return false;
    }

    return true;
}

/**
 * Get active tracking record for an order
 */
export async function getTrackingRecord(orderId: string): Promise<TrackingRecord | null> {
    if (!supabase) return null;

    const { data, error } = await supabase
        .from('delivery_tracking')
        .select('*')
        .eq('order_id', orderId)
        .eq('is_active', true)
        .single();

    if (error) {
        if (error.code !== 'PGRST116') { // Not found error
            console.error('Failed to fetch tracking record:', error);
        }
        return null;
    }

    return data;
}

/**
 * Deactivate tracking record (when delivery is complete)
 */
export async function deactivateTracking(orderId: string): Promise<boolean> {
    if (!supabase) return false;

    const { error } = await supabase
        .from('delivery_tracking')
        .update({ is_active: false })
        .eq('order_id', orderId)
        .eq('is_active', true);

    if (error) {
        console.error('Failed to deactivate tracking:', error);
        return false;
    }

    return true;
}

/**
 * Calculate heading (bearing) between two points in degrees
 */
function calculateHeading(
    from: { lat: number; lng: number },
    to: { lat: number; lng: number }
): number {
    const lat1 = (from.lat * Math.PI) / 180;
    const lat2 = (to.lat * Math.PI) / 180;
    const deltaLng = ((to.lng - from.lng) * Math.PI) / 180;

    const y = Math.sin(deltaLng) * Math.cos(lat2);
    const x =
        Math.cos(lat1) * Math.sin(lat2) -
        Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);

    let heading = (Math.atan2(y, x) * 180) / Math.PI;
    return (heading + 360) % 360; // Normalize to 0-360
}

/**
 * Simulate vehicle movement along route (for testing/demo)
 * In production, this would be called by driver app with actual GPS data
 */
export async function simulateVehicleMovement(
    orderId: string,
    intervalMs: number = 5000
): Promise<() => void> {
    const order = await getOrderById(orderId);
    if (!order) {
        throw new Error('Order not found');
    }

    const hub = order.hub_id ? await getHubById(order.hub_id) : null;
    if (!hub) {
        throw new Error('Hub not found');
    }

    // Get or create tracking record
    let tracking = await getTrackingRecord(orderId);
    if (!tracking) {
        tracking = await createTrackingRecord(orderId) || undefined;
        if (!tracking) {
            throw new Error('Failed to create tracking record');
        }
    }

    // Calculate route
    const origin = order.order_type === 'delivery'
        ? { lat: hub.lat, lng: hub.lng }
        : order.delivery_address_snapshot
            ? { lat: order.delivery_address_snapshot.lat, lng: order.delivery_address_snapshot.lng }
            : null;

    const destination = order.order_type === 'delivery'
        ? order.delivery_address_snapshot
        : { lat: hub.lat, lng: hub.lng };

    if (!origin || !destination) {
        throw new Error('Cannot determine route endpoints');
    }

    const route = await calculateRoute(origin, destination);
    if (!route || route.coordinates.length === 0) {
        throw new Error('Failed to calculate route');
    }

    // Animate along route
    let currentIndex = 0;
    const speedMultiplier = 20; // Points per update
    let lastUpdate = Date.now();

    const intervalId = setInterval(async () => {
        currentIndex = Math.min(currentIndex + speedMultiplier, route.coordinates.length - 1);
        const [lat, lng] = route.coordinates[currentIndex];

        await updateTrackingPosition(orderId, { lat, lng });

        // Check if reached destination
        if (currentIndex >= route.coordinates.length - 1) {
            clearInterval(intervalId);
            await deactivateTracking(orderId);
        }

        lastUpdate = Date.now();
    }, intervalMs);

    return () => clearInterval(intervalId);
}
