/**
 * Delivery Mapbox Service
 *
 * Rider-specific map functionality - navigation-focused
 */
/**
 * Add or update rider marker on map
 */
export declare const addRiderMarker: (map: mapboxgl.Map, coordinates: [number, number]) => mapboxgl.Marker;
/**
 * Update rider marker location (for real-time tracking)
 */
export declare const updateRiderLocation: (coordinates: [number, number]) => void;
/**
 * Clean up rider marker
 */
export declare const removeRiderMarker: () => void;
