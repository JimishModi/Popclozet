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
        try { existingMap.remove(); } catch (_) { }
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
 * This function handles RENDERING of a LineString on the map.
 */
export const drawRoute = async (
    map: mapboxgl.Map,
    coordinates: number[][] // [lng, lat] expected by Mapbox
): Promise<void> => {
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

// Aliases for compatibility
export const drawRouteFromCoords = drawRoute;

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
// GEOLOCATION HELPERS
// ==========================================

export interface ReverseGeocodeResult {
    city: string;
    locality: string;
    fullAddress: string;
    state: string;
    country: string;
}

/**
 * Reverse geocode coordinates to get city/locality information from Mapbox.
 */
export const reverseGeocode = async (lat: number, lng: number): Promise<ReverseGeocodeResult | null> => {
    if (!CONFIGURED_TOKEN) {
        return null;
    }

    try {
        const url = new URL(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json`);
        url.searchParams.set('access_token', CONFIGURED_TOKEN);
        url.searchParams.set('language', 'en');
        url.searchParams.set('limit', '5');

        const response = await fetch(url.toString());
        if (!response.ok) {
            return null;
        }

        const data = await response.json();
        const features = Array.isArray(data?.features) ? data.features : [];
        const context = Array.isArray(features[0]?.context) ? features[0].context : [];
        const allParts = [features[0], ...context].filter(Boolean);

        const findByPrefix = (prefix: string) =>
            allParts.find((item: any) => typeof item?.id === 'string' && item.id.startsWith(prefix));

        const neighborhood = findByPrefix('neighborhood');
        const locality = findByPrefix('locality');
        const place = findByPrefix('place');
        const region = findByPrefix('region');
        const country = findByPrefix('country');

        const city = place?.text || locality?.text || region?.text || 'Current location';
        const localityName = neighborhood?.text || locality?.text || city;

        return {
            city,
            locality: localityName,
            fullAddress: features[0]?.place_name || `${localityName}, ${city}`,
            state: region?.text || '',
            country: country?.text || '',
        };
    } catch {
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
 * Auto-detect user location, reverse geocode it, and evaluate service coverage.
 * Returns location details including city, locality, and service area status.
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
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const geocode = await reverseGeocode(lat, lng);

        return {
            lat,
            lng,
            city: geocode?.city || 'Current location',
            locality: geocode?.locality || geocode?.city || 'Current location',
            isInServiceArea: isWithinServiceArea(lat, lng),
        };
    } catch {
        return null;
    }
};

// ==========================================
// MULTI-INSTANCE MAP (warehouse / multi-rider views)
// ==========================================

/**
 * Create an independent Mapbox map instance that does NOT touch the singleton.
 * Use this when you need a second map on the page (e.g. warehouse live-rider map).
 */
export const createMapInstance = (
    container: HTMLElement,
    center: [number, number],
    zoom: number = 13
): mapboxgl.Map => {
    if (!CONFIGURED_TOKEN) throw new Error('Mapbox access token is not configured');

    const map = new mapboxgl.Map({
        container,
        style: 'mapbox://styles/mapbox/dark-v11',
        center,
        zoom,
        attributionControl: false,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
    return map;
};

/**
 * Create a round, color-filled HTML element for use as a Mapbox marker.
 * Pass the returned element to `new mapboxgl.Marker(el)`.
 */
export const createColorMarker = (
    color: string,
    size: number = 14,
    pulse: boolean = false
): HTMLElement => {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = `position:relative;width:${size + 8}px;height:${size + 8}px;display:flex;align-items:center;justify-content:center;`;

    if (pulse) {
        const ring = document.createElement('div');
        ring.style.cssText = `position:absolute;inset:0;border-radius:50%;background:${color};opacity:0.25;animation:mapPulse 1.8s ease-out infinite;`;
        wrapper.appendChild(ring);

        if (!document.getElementById('map-pulse-style')) {
            const style = document.createElement('style');
            style.id = 'map-pulse-style';
            style.textContent = `@keyframes mapPulse{0%{transform:scale(1);opacity:0.25}70%,100%{transform:scale(2.2);opacity:0}}`;
            document.head.appendChild(style);
        }
    }

    const dot = document.createElement('div');
    dot.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid rgba(255,255,255,0.85);box-shadow:0 2px 6px rgba(0,0,0,0.45);position:relative;z-index:1;`;
    wrapper.appendChild(dot);
    return wrapper;
};

/**
 * Update or create a GeoJSON LineString source+layer on a map in-place (no flicker).
 * If the source already exists, calls setData() to update coordinates.
 */
export const updateRouteSource = (
    map: mapboxgl.Map,
    sourceId: string,
    layerId: string,
    coordinates: [number, number][],
    color: string = '#8855F7'
): void => {
    const geojson: GeoJSON.Feature<GeoJSON.LineString> = {
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates },
    };

    if (map.getSource(sourceId)) {
        (map.getSource(sourceId) as mapboxgl.GeoJSONSource).setData(geojson);
    } else {
        map.addSource(sourceId, { type: 'geojson', data: geojson });
        map.addLayer({
            id: layerId,
            type: 'line',
            source: sourceId,
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': color, 'line-width': 3, 'line-opacity': 0.75 },
        });
    }
};

// Re-export mapboxgl types for convenience
export { mapboxgl };
