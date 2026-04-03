// src/services/mapplsGeocode.ts
// Mappls Forward Geocoding — uses Supabase Edge Function to avoid CORS

import { callLocationFn } from '@/utils/env';

export interface MapplsGeocodeResult {
    lat: number;
    lng: number;
    placeName: string;
}

/**
 * Forward geocode an address string via the location Edge Function.
 */
export async function geocodeWithMappls(address: string): Promise<MapplsGeocodeResult | null> {
    try {
        const data = await callLocationFn({ action: 'geocode', address });

        const lat = typeof data.lat === 'number' ? data.lat : parseFloat(data.lat ?? '0');
        const lng = typeof data.lng === 'number' ? data.lng : parseFloat(data.lng ?? '0');

        if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) {
            return null;
        }

        return {
            lat,
            lng,
            placeName: data.displayAddress || address
        };
    } catch (err) {
        console.warn('[MapplsGeocode] Error:', err);
        return null;
    }
}
