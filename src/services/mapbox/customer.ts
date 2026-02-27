/**
 * Customer Mapbox Service
 * 
 * Phase 2: Customer-facing map functionality
 * 
 * Design Principles:
 * - Lazy-loaded: Maps only render when explicitly requested
 * - Proximity-triggered: Live map activates only when rider ≤1km
 * - Fallback-first: Static map URL available when interactive fails
 * - Cost-aware: Minimal tile loads, bounded zoom
 */

import mapboxgl from 'mapbox-gl';
import { initializeMap, getMapboxToken, isMapboxAvailable } from './core';

/**
 * Get a static map image URL for order confirmation
 * Uses Static Images API - single request, no ongoing tile loads
 * 
 * @param center - [lng, lat] center coordinates
 * @param zoom - Zoom level (default 14)
 * @param width - Image width in pixels
 * @param height - Image height in pixels
 * @returns Static map URL or undefined if Mapbox unavailable
 */
export const getStaticMapUrl = (
    center: [number, number],
    zoom: number = 14,
    width: number = 400,
    height: number = 300
): string | undefined => {
    const token = getMapboxToken();
    if (!token) return undefined;

    // Use 2x for retina displays
    return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${center[0]},${center[1]},${zoom},0/${width}x${height}@2x?access_token=${token}`;
};

/**
 * Initialize customer tracking map
 * Only call this when rider is within proximity threshold (≤1km)
 * 
 * @param container - DOM element to render map into
 * @param customerLocation - [lng, lat] customer delivery address
 * @returns Mapbox Map instance or null if unavailable
 */
export const initCustomerTrackingMap = (
    container: HTMLElement,
    customerLocation: [number, number]
): mapboxgl.Map | null => {
    if (!isMapboxAvailable()) {
        console.warn('Mapbox not available, using static fallback');
        return null;
    }

    try {
        return initializeMap(container, customerLocation, 15);
    } catch (error) {
        console.error('Failed to initialize customer tracking map:', error);
        return null;
    }
};

/**
 * Add customer destination marker
 */
export const addCustomerMarker = (
    map: mapboxgl.Map,
    coordinates: [number, number]
): mapboxgl.Marker => {
    const el = document.createElement('div');
    el.className = 'customer-marker';
    el.style.width = '30px';
    el.style.height = '30px';
    el.style.backgroundImage = 'url(data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAiIGhlaWdodD0iMzAiIHZpZXdCb3g9IjAgMCAzMCAzMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIxNSIgY3k9IjE1IiByPSIxNSIgZmlsbD0iI0VDNDg5OSIvPjxwYXRoIGQ9Ik0xNSA4QzExLjY4NjMgOCA5IDEwLjY4NjMgOSAxNEM5IDE4LjUgMTUgMjIgMTUgMjJDMTUgMjIgMjEgMTguNSAyMSAxNEMyMSAxMC42ODYzIDE4LjMxMzcgOCAxNSA4WiIgZmlsbD0id2hpdGUiLz48Y2lyY2xlIGN4PSIxNSIgY3k9IjE0IiByPSIyIiBmaWxsPSIjRUM0ODk5Ii8+PC9zdmc+)';
    el.style.backgroundSize = 'cover';

    return new mapboxgl.Marker(el)
        .setLngLat(coordinates)
        .addTo(map);
};

/**
 * Check if static map fallback should be used
 * Returns true if:
 * - Mapbox is not configured
 * - User is on slow connection
 * - Cost threshold approaching
 */
export const shouldUseStaticFallback = (): boolean => {
    // Always available as fallback
    if (!isMapboxAvailable()) return true;

    // Check for slow connection (navigator.connection API)
    const connection = (navigator as any).connection;
    if (connection) {
        const slowConnections = ['slow-2g', '2g'];
        if (slowConnections.includes(connection.effectiveType)) {
            return true;
        }
    }

    return false;
};
