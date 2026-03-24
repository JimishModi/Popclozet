// src/services/mapboxGeocode.ts
// Mapbox Forward Geocoding — reliable browser-side fallback for address resolution
// Uses the Mapbox Geocoding API v5, which has proper CORS support.

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '';

export interface MapboxGeocodeResult {
    lat: number;
    lng: number;
    placeName: string;
}

/**
 * Forward geocode an address string via Mapbox Geocoding API.
 * Biased towards India (bbox covers the country).
 */
export async function geocodeWithMapbox(address: string): Promise<MapboxGeocodeResult | null> {
    if (!MAPBOX_TOKEN) {
        console.warn('[MapboxGeocode] No VITE_MAPBOX_ACCESS_TOKEN — skipping Mapbox geocode');
        return null;
    }

    try {
        const bbox = '68.1,6.7,97.4,35.5'; // India bounding box
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${MAPBOX_TOKEN}&country=in&bbox=${bbox}&limit=1`;

        const response = await fetch(url);
        if (!response.ok) {
            console.warn('[MapboxGeocode] HTTP', response.status);
            return null;
        }

        const data = await response.json();
        if (!data.features || data.features.length === 0) {
            console.warn('[MapboxGeocode] No features returned');
            return null;
        }

        const feature = data.features[0];
        const [lng, lat] = feature.center; // Mapbox returns [lng, lat]

        if (typeof lat !== 'number' || typeof lng !== 'number' || (lat === 0 && lng === 0)) {
            return null;
        }

        return { lat, lng, placeName: feature.place_name || '' };
    } catch (err) {
        console.warn('[MapboxGeocode] Error:', err);
        return null;
    }
}
