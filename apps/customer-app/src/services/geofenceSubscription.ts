/**
 * Geofence Subscription Service
 * 
 * Subscribes to rider location updates via Supabase Realtime
 * and triggers status updates when rider enters delivery proximity.
 */

import { supabase } from '@popclozet/api-client';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ==========================================
// CONSTANTS
// ==========================================

export const PROXIMITY_THRESHOLDS = {
    arriving: 0.5,  // km — "Rider is on the way"
    nearby: 0.1,    // km — "Rider is almost here"
};

export type ProximityStatus = 'far' | 'arriving' | 'nearby';

// ==========================================
// HAVERSINE DISTANCE
// ==========================================

function toRad(v: number): number {
    return (v * Math.PI) / 180;
}

export function distanceKm(
    lat1: number, lng1: number,
    lat2: number, lng2: number
): number {
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// ==========================================
// PROXIMITY CHECK
// ==========================================

export function checkDeliveryProximity(
    riderLat: number,
    riderLng: number,
    destLat: number,
    destLng: number
): ProximityStatus {
    const dist = distanceKm(riderLat, riderLng, destLat, destLng);

    if (dist <= PROXIMITY_THRESHOLDS.nearby) return 'nearby';
    if (dist <= PROXIMITY_THRESHOLDS.arriving) return 'arriving';
    return 'far';
}

// ==========================================
// REALTIME SUBSCRIPTION
// ==========================================

export interface GeofenceCallbacks {
    onProximityChange: (status: ProximityStatus, distKm: number) => void;
    onLocationUpdate: (lat: number, lng: number) => void;
}

let activeChannel: RealtimeChannel | null = null;
let previousStatus: ProximityStatus = 'far';

/**
 * Subscribe to rider location updates for a specific order.
 * Fires callbacks when proximity status changes.
 */
export function subscribeToRiderProximity(
    riderId: string,
    destLat: number,
    destLng: number,
    callbacks: GeofenceCallbacks
): () => void {
    if (!supabase) {
        console.warn('Supabase not configured, geofence subscription skipped');
        return () => { };
    }

    // Clean up any existing subscription
    unsubscribeRiderProximity();

    previousStatus = 'far';

    try {
        activeChannel = supabase
            .channel(`rider-location-${riderId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'rider_locations',
                    filter: `rider_id=eq.${riderId}`,
                },
                (payload) => {
                    const { lat, lng } = payload.new as { lat: number; lng: number };
                    callbacks.onLocationUpdate(lat, lng);

                    const newStatus = checkDeliveryProximity(lat, lng, destLat, destLng);
                    const dist = distanceKm(lat, lng, destLat, destLng);

                    if (newStatus !== previousStatus) {
                        callbacks.onProximityChange(newStatus, dist);
                        previousStatus = newStatus;

                        // Auto-update order status if nearby
                        if (newStatus === 'arriving' || newStatus === 'nearby') {
                            showProximityNotification(newStatus, dist);
                        }
                    }
                }
            )
            .subscribe((status, err) => {
                if (err) console.warn('[geofenceSubscription] Realtime subscription error (non-fatal):', err);
            });
    } catch (err) {
        console.warn('[geofenceSubscription] Failed to subscribe to rider proximity (non-fatal):', err);
    }

    return () => unsubscribeRiderProximity();
}

/**
 * Clean up the realtime subscription
 */
export function unsubscribeRiderProximity(): void {
    if (activeChannel && supabase) {
        supabase.removeChannel(activeChannel);
        activeChannel = null;
    }
}

// ==========================================
// NOTIFICATIONS
// ==========================================

function showProximityNotification(status: ProximityStatus, distKm: number): void {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const messages: Record<ProximityStatus, string> = {
        far: '',
        arriving: `🏍️ Your rider is ${Math.round(distKm * 1000)}m away!`,
        nearby: '🎉 Your rider is almost at your door!',
    };

    if (messages[status]) {
        new Notification('Popclozet Delivery', {
            body: messages[status],
            icon: '/icons/icon-192x192.png',
        });
    }
}
