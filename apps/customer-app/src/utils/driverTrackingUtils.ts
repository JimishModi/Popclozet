// src/utils/driverTrackingUtils.ts
// Utility functions for driver/admin to update vehicle positions
// This would typically be called from a driver mobile app or admin dashboard

import { updateTrackingPosition } from '@/services/trackingService';

/**
 * Update vehicle position from driver app
 * This should be called periodically (e.g., every 5-10 seconds) when vehicle is moving
 * 
 * @example
 * ```typescript
 * // In driver app, get GPS position
 * navigator.geolocation.watchPosition(
 *   (position) => {
 *     updateVehiclePosition(orderId, {
 *       lat: position.coords.latitude,
 *       lng: position.coords.longitude,
 *       speed: position.coords.speed ? position.coords.speed * 3.6 : undefined, // Convert m/s to km/h
 *       heading: position.coords.heading || undefined,
 *     });
 *   },
 *   (error) => console.error('GPS error:', error),
 *   { enableHighAccuracy: true, timeout: 5000 }
 * );
 * ```
 */
export async function updateVehiclePosition(
    orderId: string,
    position: { lat: number; lng: number; speed?: number; heading?: number }
): Promise<boolean> {
    try {
        return await updateTrackingPosition(orderId, position);
    } catch (error) {
        console.error('Failed to update vehicle position:', error);
        return false;
    }
}

/**
 * Helper function to format position for API
 */
export function formatPosition(coords: GeolocationCoordinates) {
    return {
        lat: coords.latitude,
        lng: coords.longitude,
        speed: coords.speed ? coords.speed * 3.6 : undefined, // Convert m/s to km/h
        heading: coords.heading || undefined,
    };
}

/**
 * Start GPS tracking for an order (for driver app)
 * Returns a cleanup function to stop tracking
 */
export function startGPSTracking(
    orderId: string,
    onUpdate?: (success: boolean) => void,
    intervalMs: number = 5000
): () => void {
    let watchId: number | null = null;
    let isActive = true;

    if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(
            async (position) => {
                if (!isActive) return;

                const success = await updateVehiclePosition(orderId, formatPosition(position.coords));
                onUpdate?.(success);
            },
            (error) => {
                console.error('GPS tracking error:', error);
                onUpdate?.(false);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 5000,
            }
        );
    } else {
        console.error('Geolocation not supported');
    }

    // Return cleanup function
    return () => {
        isActive = false;
        if (watchId !== null) {
            navigator.geolocation.clearWatch(watchId);
        }
    };
}

