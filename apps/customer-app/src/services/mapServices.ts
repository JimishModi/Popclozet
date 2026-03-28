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
    eLoc?: string | null;
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
 * Geocode text address to coordinates via the backend proxy.
 *
 * The old approach (calling apis.mapmyindia.com directly from the browser) is
 * blocked by CORS and returns 412 Precondition Failed.
 * We route through /api/location/geocode which uses the server-side REST key.
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult> {
    try {
        const proxyUrl = `${API_BASE_URL}/api/location/geocode?address=${encodeURIComponent(address)}`;
        console.log('[Geocode] Calling backend proxy:', proxyUrl);

        const res = await fetch(proxyUrl);

        // Log the raw response for debugging every time
        const data = await res.json();
        console.log('[Geocode] Raw backend geocode response:', JSON.stringify(data));

        if (!res.ok) {
            console.error('[Geocode] Backend returned error:', res.status, data);
            throw new Error(data?.error ?? `Backend returned HTTP ${res.status}`);
        }

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
 * If both are within 0.1° (~11km) of each other AND we have no eLoc,
 * coordinates may be stale/wrong.
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
