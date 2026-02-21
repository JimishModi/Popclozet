/**
 * Delivery Mapbox Service
 * 
 * Phase 2: Delivery/Rider-facing map functionality
 * 
 * Design Principles:
 * - Navigation-focused: Optimized for turn-by-turn directions
 * - Foreground-only: No background map rendering
 * - Rider-owned: Only the assigned rider can access
 */

import mapboxgl from 'mapbox-gl';
import { initializeMap, drawRoute, isMapboxAvailable } from './core';

let riderMarker: mapboxgl.Marker | null = null;

/**
 * Initialize delivery navigation map
 * For riders viewing their current delivery route
 * 
 * @param container - DOM element to render map into
 * @param startLocation - [lng, lat] rider current location
 * @param endLocation - [lng, lat] delivery destination
 * @returns Mapbox Map instance or null if unavailable
 */
export const initDeliveryNavigationMap = async (
    container: HTMLElement,
    startLocation: [number, number],
    endLocation: [number, number]
): Promise<mapboxgl.Map | null> => {
    if (!isMapboxAvailable()) {
        console.warn('Mapbox not available for delivery navigation');
        return null;
    }

    try {
        const map = initializeMap(container, startLocation, 16);

        // Wait for map to load before drawing route
        await new Promise<void>((resolve) => {
            map.on('load', () => resolve());
        });

        await drawRoute(map, startLocation, endLocation);
        return map;
    } catch (error) {
        console.error('Failed to initialize delivery navigation map:', error);
        return null;
    }
};

/**
 * Add or update rider marker on map
 * 
 * @param map - Mapbox Map instance
 * @param coordinates - [lng, lat] rider location
 * @returns Marker instance
 */
export const addRiderMarker = (
    map: mapboxgl.Map,
    coordinates: [number, number]
): mapboxgl.Marker => {
    // Remove existing marker if any
    if (riderMarker) {
        riderMarker.remove();
    }

    // Create custom rider marker element
    const el = document.createElement('div');
    el.className = 'rider-marker';
    el.style.width = '40px';
    el.style.height = '40px';
    el.style.backgroundImage = 'url(data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIyMCIgY3k9IjIwIiByPSIyMCIgZmlsbD0iIzg4NTVGNyIvPjxwYXRoIGQ9Ik0yMCAxMEMxNS41ODE3IDEwIDEyIDEzLjU4MTcgMTIgMThDMTIgMjMuNSAyMCAzMCAyMCAzMEMyMCAzMCAyOCAyMy41IDI4IDE4QzI4IDEzLjU4MTcgMjQuNDE4MyAxMCAyMCAxMFoiIGZpbGw9IndoaXRlIi8+PGNpcmNsZSBjeD0iMjAiIGN5PSIxOCIgcj0iMyIgZmlsbD0iIzg4NTVGNyIvPjwvc3ZnPg==)';
    el.style.backgroundSize = 'cover';
    el.style.cursor = 'pointer';

    riderMarker = new mapboxgl.Marker(el)
        .setLngLat(coordinates)
        .addTo(map);

    return riderMarker;
};

/**
 * Update rider marker location (for real-time tracking)
 * 
 * @param coordinates - [lng, lat] new rider location
 */
export const updateRiderLocation = (coordinates: [number, number]): void => {
    if (riderMarker) {
        riderMarker.setLngLat(coordinates);
    }
};

/**
 * Clean up rider marker
 */
export const removeRiderMarker = (): void => {
    if (riderMarker) {
        riderMarker.remove();
        riderMarker = null;
    }
};
