/**
 * Mapbox Core Utilities
 * 
 * Phase 2: Shared utilities for role-based Mapbox services
 * This module contains the core map initialization and cleanup logic.
 * Role-specific modules import from here.
 * 
 * @see src/services/mapbox/customer.ts - Customer-facing maps
 * @see src/services/mapbox/delivery.ts - Delivery navigation
 */

import mapboxgl from 'mapbox-gl';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

if (MAPBOX_TOKEN) {
    mapboxgl.accessToken = MAPBOX_TOKEN;
}

let mapInstance: mapboxgl.Map | null = null;

/**
 * Check if Mapbox is configured and available
 */
export const isMapboxAvailable = (): boolean => {
    return !!MAPBOX_TOKEN;
};

/**
 * Get the Mapbox access token (for static map URLs)
 */
export const getMapboxToken = (): string | undefined => {
    return MAPBOX_TOKEN;
};

/**
 * Initialize a Mapbox map instance
 * 
 * @param container - DOM element to render map into
 * @param center - [lng, lat] center coordinates
 * @param zoom - Initial zoom level
 * @returns Mapbox Map instance
 * @throws Error if Mapbox token not configured
 */
export const initializeMap = (
    container: HTMLElement,
    center: [number, number],
    zoom: number = 14
): mapboxgl.Map => {
    if (!MAPBOX_TOKEN) {
        throw new Error('Mapbox access token is not configured');
    }

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
 * 
 * @param map - Mapbox Map instance
 * @param start - [lng, lat] start coordinates
 * @param end - [lng, lat] end coordinates
 */
export const drawRoute = async (
    map: mapboxgl.Map,
    start: [number, number],
    end: [number, number]
): Promise<void> => {
    if (!MAPBOX_TOKEN) return;

    const query = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/driving/${start[0]},${start[1]};${end[0]},${end[1]}?geometries=geojson&access_token=${MAPBOX_TOKEN}`
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
