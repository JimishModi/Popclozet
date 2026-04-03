/**
 * MapMyIndia (Mappls) Service
 *
 * Uses the Supabase Edge Function `location` to avoid CORS issues.
 * The edge function calls route.mappls.com server-side.
 */

import { callLocationFn } from "@/utils/env";
import { haversineDistance } from "@/utils/haversine";

export interface DistanceResult {
    distanceKm: number;
    status: 'success' | 'error';
    error?: string;
}

export interface GeocodeResult {
    lat: number;
    lng: number;
    eLoc?: string | null;
    status: 'success' | 'error';
    error?: string;
}

/**
 * Calculate road distance between two points via the Supabase Edge Function.
 * Falls back to Haversine (straight-line) if the edge function is unavailable.
 */
export async function getRoadDistance(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number; eLoc?: string }
): Promise<DistanceResult> {
    const originStr = `${origin.lng},${origin.lat}`;
    const destStr = destination.eLoc
        ? destination.eLoc
        : `${destination.lng},${destination.lat}`;

    if (!origin.lat || !origin.lng) {
        return { distanceKm: 0, status: 'error', error: 'Invalid origin coordinates' };
    }
    if (!destination.eLoc && (!destination.lat || !destination.lng)) {
        return { distanceKm: 0, status: 'error', error: 'Invalid destination (no eLoc or coordinates)' };
    }

    try {
        console.log('🗺️ Calling location edge function (distance):', originStr, '→', destStr);
        const data = await callLocationFn({ action: 'distance', origin: originStr, destination: destStr });

        if (typeof data.distance === 'number') {
            console.log(`🛣️ Road distance: ${data.distance.toFixed(2)}km`);
            return { distanceKm: data.distance, status: 'success' };
        }
        throw new Error(data.error || 'Unexpected response format');
    } catch (err) {
        console.warn('Distance edge function failed, using Haversine fallback:', err);

        // Haversine fallback — only possible if we have numeric coords for destination
        if (destination.lat && destination.lng) {
            const km = haversineDistance(origin.lat, origin.lng, destination.lat, destination.lng);
            console.log(`📐 Haversine fallback distance: ${km.toFixed(2)}km`);
            return { distanceKm: km, status: 'success' };
        }

        return {
            distanceKm: 0,
            status: 'error',
            error: err instanceof Error ? err.message : 'Unknown error'
        };
    }
}

/**
 * Geocode text address to coordinates via the Supabase Edge Function.
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult> {
    try {
        console.log('[Geocode] Calling location edge function:', address);
        const data = await callLocationFn({ action: 'geocode', address });
        console.log('[Geocode] Response:', JSON.stringify(data));

        const lat = typeof data.lat === 'number' ? data.lat : parseFloat(data.lat ?? '0');
        const lng = typeof data.lng === 'number' ? data.lng : parseFloat(data.lng ?? '0');

        if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) {
            throw new Error('Geocoding returned invalid coordinates');
        }

        console.log(`[Geocode] ✓ Resolved: lat=${lat} lng=${lng} eLoc=${data.eLoc ?? 'none'}`);
        return {
            lat,
            lng,
            eLoc: data.eLoc ?? null,
            status: 'success'
        };
    } catch (err) {
        console.error('[Geocode] ✗ Failed for address:', address, err);
        return {
            lat: 0,
            lng: 0,
            status: 'error',
            error: err instanceof Error ? err.message : 'Unknown error'
        };
    }
}

/**
 * Sanity-check: are origin and destination suspiciously close?
 */
export function coordinatesAreSuspiciouslyClose(
    origin: { lat: number; lng: number },
    dest: { lat: number; lng: number }
): boolean {
    return (
        Math.abs(origin.lat - dest.lat) < 0.1 &&
        Math.abs(origin.lng - dest.lng) < 0.1
    );
}
