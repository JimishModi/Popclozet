/**
 * Delivery Mapbox Service
 * 
 * Rider-specific map functionality - navigation-focused
 */

import { mapboxgl } from '@popclozet/mapbox-core';

let riderMarker: mapboxgl.Marker | null = null;

/**
 * Add or update rider marker on map
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
