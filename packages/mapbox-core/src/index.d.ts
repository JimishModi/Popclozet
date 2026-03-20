/**
 * Mapbox Core - Shared Map Utilities
 *
 * @popclozet/mapbox-core v1.0.0
 *
 * Core map initialization and cleanup logic.
 * Role-specific modules in apps import from here.
 */
import * as mapboxgl from 'mapbox-gl';
/**
 * Configure Mapbox GL with the provided access token globally.
 */
export declare const configureMapbox: (token: string) => void;
/**
 * Check if Mapbox is configured and available
 */
export declare const isMapboxAvailable: () => boolean;
/**
 * Get the Mapbox access token (for static map URLs)
 */
export declare const getMapboxToken: () => string | undefined;
/**
 * Initialize a Mapbox map instance
 */
export declare const initializeMap: (container: HTMLElement, center: [number, number], zoom?: number, token?: string) => mapboxgl.Map;
/**
 * Destroy the current map instance and clean up resources
 */
export declare const destroyMap: () => void;
/**
 * Get the current map instance
 */
export declare const getMapInstance: () => mapboxgl.Map | null;
/**
 * Draw a route on the map from provided coordinates.
 */
export declare const drawRoute: (map: mapboxgl.Map, coordinates: number[][]) => Promise<void>;
/**
 * Alias for drawRoute
 */
export declare const drawRouteFromCoords: (map: mapboxgl.Map, coordinates: number[][]) => Promise<void>;
/**
 * Service area configuration (IIT Bombay campus center)
 */
export declare const SERVICE_CONFIG: {
    center: {
        lat: number;
        lng: number;
    };
    radiusKm: number;
    warehouseLocation: {
        lat: number;
        lng: number;
    };
};
/**
 * Calculate distance between two points using Haversine formula
 * Returns distance in kilometers
 */
export declare const calculateDistance: (from: {
    lat: number;
    lng: number;
}, to: {
    lat: number;
    lng: number;
}) => number;
/**
 * Check if a location is within the service area (6km from IIT Bombay)
 */
export declare const isWithinServiceArea: (lat: number, lng: number) => boolean;
/**
 * Get warehouse location
 */
export declare const getWarehouseLocation: () => {
    lat: number;
    lng: number;
};
/**
 * Get distance from warehouse to a location
 */
export declare const getDistanceFromWarehouse: (lat: number, lng: number) => number;
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
export declare const reverseGeocode: (lat: number, lng: number) => Promise<ReverseGeocodeResult | null>;
/**
 * Get current GPS position as a Promise
 */
export declare const getCurrentPosition: () => Promise<GeolocationPosition>;
/**
 * Auto-detect user location and get city name
 */
export declare const autoDetectLocation: () => Promise<{
    lat: number;
    lng: number;
    city: string;
    locality: string;
    isInServiceArea: boolean;
} | null>;
export { mapboxgl };
//# sourceMappingURL=index.d.ts.map