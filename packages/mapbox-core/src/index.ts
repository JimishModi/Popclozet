/**
 * Mapbox Core - Shared Map Utilities
 * 
 * @popclozet/mapbox-core v1.0.0
 * 
 * Core map initialization and cleanup logic.
 * Role-specific modules in apps import from here.
 */

import mapboxgl from 'mapbox-gl';

// @ts-ignore
const CONFIGURED_TOKEN = import.meta.env?.VITE_MAPBOX_ACCESS_TOKEN || '';

/**
 * Configure Mapbox GL with the provided access token globally.
 * This MUST be called at the root of the React app to ensure WebWorkers have access before any map is rendered.
 */
export const configureMapbox = (token: string) => {
    if (!token) return;
    (mapboxgl as any).accessToken = token;
};

if (CONFIGURED_TOKEN) {
    (mapboxgl as any).accessToken = CONFIGURED_TOKEN;
}

let mapInstance: mapboxgl.Map | null = null;

/**
 * Check if Mapbox is configured and available
 */
export const isMapboxAvailable = (): boolean => {
    return !!CONFIGURED_TOKEN;
};

/**
 * Get the Mapbox access token (for static map URLs)
 */
export const getMapboxToken = (): string | undefined => {
    return CONFIGURED_TOKEN;
};

/**
 * Initialize a Mapbox map instance
 */
export const initializeMap = (
    container: HTMLElement,
    center: [number, number],
    zoom: number = 14,
    token?: string
): mapboxgl.Map => {
    const activeToken = token || CONFIGURED_TOKEN;
    if (!activeToken) {
        throw new Error('Mapbox access token is not configured');
    }

    (mapboxgl as any).accessToken = activeToken;

    // Destroy existing instance if any
    if (mapInstance) {
        destroyMap();
    }

    mapInstance = new mapboxgl.Map({
        container,
        style: 'mapbox://styles/mapbox/streets-v12',
        center,
        zoom,
        attributionControl: false,
    });

    mapInstance.addControl(new mapboxgl.NavigationControl(), 'top-right');

    return mapInstance;
};

/**
 * Destroy the current map instance and clean up resources
 */
export const destroyMap = (): void => {
    if (mapInstance) {
        mapInstance.remove();
        mapInstance = null;
    }
};

/**
 * Get the current map instance
 */
export const getMapInstance = (): mapboxgl.Map | null => mapInstance;

/**
 * Draw a route between two points
 */
export const drawRoute = async (
    map: mapboxgl.Map,
    start: [number, number],
    end: [number, number]
): Promise<void> => {
    // Read the directly injected token from map instance since Vite static vars fail across workspaces
    const activeToken = (map as any)?._requestManager?._transformRequestFn?.()?.access_token || 
                        (mapboxgl as any).accessToken || 
                        CONFIGURED_TOKEN;
                        
    if (!activeToken) return;

    const query = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/driving/${start[0]},${start[1]};${end[0]},${end[1]}?geometries=geojson&access_token=${activeToken}`
    );
    const json = await query.json();

    if (!json.routes || json.routes.length === 0) {
        console.warn('No route found');
        return;
    }

    const data = json.routes[0];
    const route = data.geometry.coordinates;

    const geojson: GeoJSON.Feature<GeoJSON.LineString> = {
        type: 'Feature',
        properties: {},
        geometry: {
            type: 'LineString',
            coordinates: route,
        },
    };

    // Remove existing route layer if any
    if (map.getSource('route')) {
        map.removeLayer('route');
        map.removeSource('route');
    }

    map.addSource('route', {
        type: 'geojson',
        data: geojson,
    });

    map.addLayer({
        id: 'route',
        type: 'line',
        source: 'route',
        layout: {
            'line-join': 'round',
            'line-cap': 'round',
        },
        paint: {
            'line-color': '#8855F7',
            'line-width': 4,
            'line-opacity': 0.8,
        },
    });

    // Fit map to show entire route
    const coordinates = route;
    const bounds = coordinates.reduce(
        (bounds: mapboxgl.LngLatBounds, coord: number[]) => {
            return bounds.extend(coord as [number, number]);
        },
        new mapboxgl.LngLatBounds(coordinates[0], coordinates[0])
    );

    map.fitBounds(bounds, { padding: 50 });
};

// ==========================================
// IIT BOMBAY GEOFENCING
// ==========================================

/**
 * Service area configuration (IIT Bombay campus center)
 */
export const SERVICE_CONFIG = {
    center: { lat: 19.1334, lng: 72.9133 }, // IIT Bombay
    radiusKm: 6,
    warehouseLocation: { lat: 19.1334, lng: 72.9133 }, // Same as center for demo
};

/**
 * Calculate distance between two points using Haversine formula
 * Returns distance in kilometers
 */
export const calculateDistance = (
    from: { lat: number; lng: number },
    to: { lat: number; lng: number }
): number => {
    const R = 6371; // Earth's radius in km
    const dLat = toRad(to.lat - from.lat);
    const dLng = toRad(to.lng - from.lng);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

const toRad = (deg: number): number => deg * (Math.PI / 180);

/**
 * Check if a location is within the service area (6km from IIT Bombay)
 */
export const isWithinServiceArea = (lat: number, lng: number): boolean => {
    const distance = calculateDistance(SERVICE_CONFIG.center, { lat, lng });
    return distance <= SERVICE_CONFIG.radiusKm;
};

/**
 * Get warehouse location
 */
export const getWarehouseLocation = () => SERVICE_CONFIG.warehouseLocation;

/**
 * Get distance from warehouse to a location
 */
export const getDistanceFromWarehouse = (lat: number, lng: number): number => {
    return calculateDistance(SERVICE_CONFIG.warehouseLocation, { lat, lng });
};

// ==========================================
// REVERSE GEOCODING
// ==========================================

export interface ReverseGeocodeResult {
    city: string;
    locality: string;
    fullAddress: string;
    state: string;
    country: string;
}

/**
 * Reverse geocode coordinates to get city/locality name
 * Uses Mapbox Geocoding API
 */
export const reverseGeocode = async (
    lat: number,
    lng: number
): Promise<ReverseGeocodeResult | null> => {
    if (!CONFIGURED_TOKEN) {
        console.error('Mapbox token not configured');
        return null;
    }

    try {
        // Don't restrict types - get all results for better coverage
        const response = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${CONFIGURED_TOKEN}`
        );

        if (!response.ok) {
            console.error('Geocoding request failed:', response.status);
            throw new Error('Geocoding request failed');
        }

        const data = await response.json();
        console.log('Mapbox geocoding response:', data);

        if (!data.features || data.features.length === 0) {
            console.error('No features in geocoding response');
            return null;
        }

        // Parse the response to extract city and locality
        let city = '';
        let locality = '';
        let state = '';
        let country = '';
        let fullAddress = data.features[0]?.place_name || '';

        // First, check all features for place, locality, neighborhood
        for (const feature of data.features) {
            const placeType = feature.place_type?.[0] || '';

            if (placeType === 'place' && !city) {
                city = feature.text;
            }
            if ((placeType === 'locality' || placeType === 'neighborhood') && !locality) {
                locality = feature.text;
            }
            if (placeType === 'region' && !state) {
                state = feature.text;
            }
            if (placeType === 'country' && !country) {
                country = feature.text;
            }
        }

        // Also extract from context of the first (most specific) feature
        const mainFeature = data.features[0];
        if (mainFeature?.context) {
            for (const ctx of mainFeature.context) {
                const id = ctx.id || '';
                if (id.startsWith('place') && !city) {
                    city = ctx.text;
                }
                if (id.startsWith('locality') && !locality) {
                    locality = ctx.text;
                }
                if (id.startsWith('region') && !state) {
                    state = ctx.text;
                }
                if (id.startsWith('country') && !country) {
                    country = ctx.text;
                }
            }
        }

        // If main feature is a neighborhood/locality, use it
        const mainType = mainFeature?.place_type?.[0];
        if (!locality && (mainType === 'neighborhood' || mainType === 'locality' || mainType === 'poi')) {
            locality = mainFeature.text;
        }

        // If we still don't have city, try to get it from the first feature's name
        if (!city && mainFeature?.text) {
            // Try to extract city from place_name
            const parts = fullAddress.split(',').map((s: string) => s.trim());
            if (parts.length >= 2) {
                // Usually: locality, city, state, country
                if (!locality) locality = parts[0];
                city = parts[1] || parts[0];
            } else {
                city = mainFeature.text;
            }
        }

        // Final fallback: use state as city if nothing else
        if (!city && state) {
            city = state;
        }

        console.log('Parsed location:', { city, locality, state, country });

        return {
            city: city || 'Unknown Location',
            locality: locality || city || 'Unknown',
            fullAddress,
            state,
            country,
        };
    } catch (error) {
        console.error('Reverse geocoding error:', error);
        return null;
    }
};

/**
 * Get current GPS position as a Promise
 */
export const getCurrentPosition = (options?: PositionOptions): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation not supported'));
            return;
        }

        const defaultOptions: PositionOptions = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000,
            ...options
        };

        navigator.geolocation.getCurrentPosition(resolve, reject, defaultOptions);
    });
};

/**
 * Auto-detect user location and get city name
 */
export const autoDetectLocation = async (): Promise<{
    lat: number;
    lng: number;
    city: string;
    locality: string;
    isInServiceArea: boolean;
} | null> => {
    try {
        const position = await getCurrentPosition();
        const { latitude: lat, longitude: lng } = position.coords;

        const geoResult = await reverseGeocode(lat, lng);
        const inServiceArea = isWithinServiceArea(lat, lng);

        return {
            lat,
            lng,
            city: geoResult?.city || 'Unknown',
            locality: geoResult?.locality || geoResult?.city || 'Unknown',
            isInServiceArea: inServiceArea,
        };
    } catch (error) {
        console.error('Auto-detect location error:', error);
        return null;
    }
};

// Re-export mapboxgl types for convenience
export { mapboxgl };
