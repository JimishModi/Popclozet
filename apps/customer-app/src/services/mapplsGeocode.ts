// src/services/mapplsGeocode.ts
// Mappls Forward Geocoding — replacing Mapbox for address resolution
// Uses the Mappls Atlas API.

const MAPPLS_TOKEN = import.meta.env.VITE_MAPPLS_REST_KEY || '';

export interface MapplsGeocodeResult {
    lat: number;
    lng: number;
    placeName: string;
}

/**
 * Forward geocode an address string via Mappls Geocoding API.
 */
export async function geocodeWithMappls(address: string): Promise<MapplsGeocodeResult | null> {
    if (!MAPPLS_TOKEN) {
        console.warn('[MapplsGeocode] No VITE_MAPPLS_REST_KEY — skipping geocode');
        return null;
    }

    try {
        // Mappls Atlas Geocode / Search API
        // For simple point geocoding:
        const url = `https://atlas.mappls.com/api/places/geocode?address=${encodeURIComponent(address)}&access_token=${MAPPLS_TOKEN}`;

        const response = await fetch(url);
        if (!response.ok) {
            console.warn('[MapplsGeocode] HTTP', response.status);
            return null;
        }

        const data = await response.json();
        
        // Mappls Geocode response structure
        if (!data.copResults || data.copResults.length === 0) {
            // Fallback to Atlas search if geocode fails
            const searchUrl = `https://atlas.mappls.com/api/places/textsearch/json?query=${encodeURIComponent(address)}&access_token=${MAPPLS_TOKEN}`;
            const searchRes = await fetch(searchUrl);
            const searchData = await searchRes.json();
            
            if (!searchData.suggestedLocations || searchData.suggestedLocations.length === 0) {
                console.warn('[MapplsGeocode] No results found');
                return null;
            }
            
            const loc = searchData.suggestedLocations[0];
            return {
                lat: parseFloat(loc.latitude),
                lng: parseFloat(loc.longitude),
                placeName: loc.placeAddress || loc.eLoc || address
            };
        }

        const result = data.copResults[0];
        const lat = parseFloat(result.latitude);
        const lng = parseFloat(result.longitude);

        if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) {
            return null;
        }

        return { 
            lat, 
            lng, 
            placeName: result.formatted_address || result.address || address 
        };
    } catch (err) {
        console.warn('[MapplsGeocode] Error:', err);
        return null;
    }
}
