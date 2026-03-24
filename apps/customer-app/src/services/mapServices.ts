/**
 * MapMyIndia (Mappls) Service
 *
 * Uses the backend Express proxy at /api/location/distance
 * (same endpoint that CheckoutPage uses) to avoid CORS issues.
 * The backend calls route.mappls.com server-side.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export interface DistanceResult {
    distanceKm: number;
    status: 'success' | 'error';
    error?: string;
}

export interface GeocodeResult {
    lat: number;
    lng: number;
    status: 'success' | 'error';
    error?: string;
}

/**
 * Calculate road distance between two points using the backend proxy
 * (same endpoint that CheckoutPage uses: GET /api/location/distance)
 *
 * @param origin  { lat, lng } of the origin point (warehouse)
 * @param destination  { lat, lng, eLoc? } of the destination point
 */
export async function getRoadDistance(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number; eLoc?: string }
): Promise<DistanceResult> {
    const originStr = `${origin.lng},${origin.lat}`;

    // Prefer eLoc (most accurate with MapMyIndia), fall back to lng,lat
    const destStr = destination.eLoc
        ? destination.eLoc
        : `${destination.lng},${destination.lat}`;

    // Validate — reject zero/NaN
    if (!origin.lat || !origin.lng) {
        return { distanceKm: 0, status: 'error', error: 'Invalid origin coordinates' };
    }
    if (!destination.eLoc && (!destination.lat || !destination.lng)) {
        return { distanceKm: 0, status: 'error', error: 'Invalid destination (no eLoc or coordinates)' };
    }

    try {
        const url = `${API_BASE_URL}/api/location/distance?origin=${originStr}&destination=${destStr}`;
        console.log('🗺️ Calling backend distance API:', url);

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Backend returned HTTP ${response.status}`);
        }

        const data = await response.json();

        if (typeof data.distance === 'number') {
            console.log(`🛣️ Road distance: ${data.distance.toFixed(2)}km`);
            return { distanceKm: data.distance, status: 'success' };
        }

        throw new Error(data.error || 'Unexpected response format');
    } catch (err) {
        console.error('Distance API error:', err);
        return {
            distanceKm: 0,
            status: 'error',
            error: err instanceof Error ? err.message : 'Unknown error'
        };
    }
}

/**
 * Geocode text address to coordinates using the backend proxy
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult> {
    try {
        const url = `${API_BASE_URL}/api/location/search?query=${encodeURIComponent(address)}`;

        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const results = await response.json();
        const first = Array.isArray(results) ? results[0] : null;

        if (first && (first.latitude || first.lat)) {
            return {
                lat: parseFloat(first.latitude || first.lat),
                lng: parseFloat(first.longitude || first.lng),
                status: 'success'
            };
        }

        throw new Error('No geocoding results');
    } catch (err) {
        console.error('Geocode error:', err);
        return {
            lat: 0,
            lng: 0,
            status: 'error',
            error: err instanceof Error ? err.message : 'Unknown error'
        };
    }
}
