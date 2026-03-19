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
    const existingMap = (container as any)._mapboxMap;
    if (existingMap) {
        try { existingMap.remove(); } catch (_) {}
    }
    
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
export const destroyMap = (map?: mapboxgl.Map | null): void => {
    const target = map || mapInstance;
    if (target) {
        try {
            target.remove();
        } catch (e) {
            // Already destroyed or invalid instance
        }
        if (target === mapInstance) {
            mapInstance = null;
        }
    }
};

/**
 * Get the current map instance
 */
export const getMapInstance = (): mapboxgl.Map | null => mapInstance;

/**
 * Draw a route on the map from provided coordinates.
 * This function only handles RENDERING, not calculation.
 */
export const drawRoute = async (
    map: mapboxgl.Map,
    start: [number, number],
    end: [number, number],
): Promise<void> => {
    drawRouteFromCoords(map, [start, end]);
};

export const drawRouteFromCoords = (
    map: mapboxgl.Map,
    coordinates: number[][] // [lng, lat] expected by Mapbox
): void => {
    const geojson: GeoJSON.Feature<GeoJSON.LineString> = {
        type: 'Feature',
        properties: {},
        geometry: {
            type: 'LineString',
            coordinates: coordinates as any,
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
    const bounds = coordinates.reduce(
        (bounds: mapboxgl.LngLatBounds, coord: number[]) => {
            return bounds.extend(coord as [number, number]);
        },
        new mapboxgl.LngLatBounds(coordinates[0] as [number, number], coordinates[0] as [number, number])
    );

    map.fitBounds(bounds, { padding: 50 });
};

// Alias for compatibility
export const drawRoute = drawRouteFromCoords;


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


// Re-export mapboxgl types for convenience
export { mapboxgl };
