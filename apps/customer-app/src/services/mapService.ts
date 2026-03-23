// src/services/mapService.ts
// Mapbox GL JS integration for customer app

import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// Set Mapbox access token
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '';
if (!MAPBOX_TOKEN) {
    console.warn('Mapbox access token is missing! Check your .env file.');
}
mapboxgl.accessToken = MAPBOX_TOKEN;

// Try to avoid some CSP issues with workers by using the bundled worker if possible
// or explicitly allowing the blob. We already updated index.html for this.

// Types for map service
export interface MapConfig {
    center: [number, number]; // [lat, lng]
    zoom: number;
    darkMode?: boolean;
}

export interface RouteResult {
    distance: number; // in kilometers
    duration: number; // in minutes
    polyline: string; // encoded polyline
    coordinates: [number, number][]; // lat, lng pairs
}

// Mapbox styles
const STYLES = {
    light: 'mapbox://styles/mapbox/streets-v12',
    dark: 'mapbox://styles/mapbox/dark-v11',
};

// Create a map instance - returns immediately with instance, but load can be awaited
export async function createMap(
    container: HTMLElement | string,
    config: MapConfig
): Promise<mapboxgl.Map> {
    const style = config.darkMode ? STYLES.dark : STYLES.light;
    const [lat, lng] = config.center;

    const map = new mapboxgl.Map({
        container,
        style,
        center: [lng, lat], // Mapbox uses [lng, lat]
        zoom: config.zoom,
        attributionControl: true,
        // Optimization: Performance hints
        preserveDrawingBuffer: false,
        trackResize: true,
    });

    // Navigation controls removed per user request (the "white box")

    // Return immediately so UI can show the container/loading state
    return map;
}

// Marker icon configs
const MARKER_CONFIGS = {
    user: { color: '#8b5cf6', symbol: '📍', size: 42 }, // Purple for premium feel
    hub: { color: '#10b981', symbol: '🏪', size: 36 },
    vehicle: { color: '#3b82f6', symbol: '🚗', size: 36 },
};

// Create a custom marker DOM element
function createMarkerElement(icon: 'user' | 'hub' | 'vehicle'): HTMLElement {
    const cfg = MARKER_CONFIGS[icon];
    const isUser = icon === 'user';
    const borderWidth = isUser ? 3 : 2;

    const el = document.createElement('div');
    el.className = 'custom-mapbox-marker';
    el.innerHTML = `
        <div style="
            background: ${cfg.color};
            width: ${cfg.size}px;
            height: ${cfg.size}px;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 3px 10px rgba(0,0,0,0.4);
            border: ${borderWidth}px solid white;
            cursor: pointer;
        ">
            <span style="transform: rotate(45deg); font-size: ${isUser ? 18 : 16}px;">${cfg.symbol}</span>
        </div>
    `;
    el.style.width = `${cfg.size}px`;
    el.style.height = `${cfg.size}px`;
    return el;
}

// Add a marker to the map
export function addMarker(
    map: mapboxgl.Map,
    position: [number, number], // [lat, lng]
    options?: {
        title?: string;
        draggable?: boolean;
        icon?: 'user' | 'hub' | 'vehicle';
        popup?: string;
    }
): mapboxgl.Marker {
    const [lat, lng] = position;

    let markerOptions: mapboxgl.MarkerOptions = {
        draggable: options?.draggable ?? false,
    };

    if (options?.icon) {
        const el = createMarkerElement(options.icon);
        markerOptions.element = el;
    } else {
        markerOptions.color = '#f2546d';
    }

    const marker = new mapboxgl.Marker(markerOptions)
        .setLngLat([lng, lat])
        .addTo(map);

    if (options?.popup) {
        const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(options.popup);
        marker.setPopup(popup);
    }

    return marker;
}

// Draw route on map using a GeoJSON source + layer
export function drawRoute(
    map: mapboxgl.Map,
    coordinates: [number, number][], // [lat, lng] pairs
    options?: {
        color?: string;
        weight?: number;
        opacity?: number;
        dashArray?: string;
    }
): string {
    const sourceId = 'route-source';
    const layerId = 'route-layer';

    // Remove existing route if present
    if (map.getLayer(layerId)) map.removeLayer(layerId);
    if (map.getSource(sourceId)) map.removeSource(sourceId);

    // Convert [lat, lng] to [lng, lat] for GeoJSON
    const geoCoords = coordinates.map(([lat, lng]) => [lng, lat]);

    map.addSource(sourceId, {
        type: 'geojson',
        data: {
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'LineString',
                coordinates: geoCoords,
            },
        },
    });

    map.addLayer({
        id: layerId,
        type: 'line',
        source: sourceId,
        layout: {
            'line-join': 'round',
            'line-cap': 'round',
        },
        paint: {
            'line-color': options?.color || '#f2546d',
            'line-width': options?.weight || 4,
            'line-opacity': options?.opacity || 0.8,
        },
    });

    // Fit map bounds to show entire route
    const bounds = new mapboxgl.LngLatBounds();
    geoCoords.forEach((coord) => bounds.extend(coord as [number, number]));
    map.fitBounds(bounds, { padding: 50, duration: 1000 });

    return layerId;
}

// Remove route from map
export function removeRoute(map: mapboxgl.Map) {
    const sourceId = 'route-source';
    const layerId = 'route-layer';
    if (map.getLayer(layerId)) map.removeLayer(layerId);
    if (map.getSource(sourceId)) map.removeSource(sourceId);
}

// Clean up map instance
export function destroyMap(map: mapboxgl.Map) {
    if (map) {
        map.remove();
    }
}

/**
 * Calculate route between two points using MapmyIndia via Backend Proxy
 */
export async function calculateRoute(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number }
): Promise<RouteResult | null> {
    try {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        const url = `${API_URL}/api/location/directions?origin=${origin.lng},${origin.lat}&destination=${destination.lng},${destination.lat}`;

        const response = await fetch(url);
        if (!response.ok) {
            console.error('Routing request failed:', response.status);
            return null;
        }

        const data = await response.json();

        if (!data.routes || data.routes.length === 0) {
            console.error('No routes found');
            return null;
        }

        const route = data.routes[0];
        // MapmyIndia GeoJSON coordinates are [lng, lat], convert to [lat, lng] for internal use
        const coordinates: [number, number][] = route.geometry.coordinates.map(
            (coord: [number, number]) => [coord[1], coord[0]]
        );

        return {
            distance: route.distance / 1000,
            duration: route.duration / 60,
            polyline: '',
            coordinates,
        };
    } catch (error) {
        console.error('Route calculation failed:', error);
        return null;
    }
}
