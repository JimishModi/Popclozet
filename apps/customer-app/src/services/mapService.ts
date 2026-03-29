// src/services/mapService.ts
// Mappls integration for customer app via map-core

import { initializeMap, mapboxgl } from '@popclozet/map-core';

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

// Create a map instance utilizing the mappls SDK via map-core
export async function createMap(container: HTMLElement | string, config: MapConfig): Promise<any> {
    const el = typeof container === 'string' ? document.getElementById(container)! : container;
    
    // Mappls SDK initializeMap expects [lat, lng] and handles conversion internally
    const map = await initializeMap(el, config.center, config.zoom);

    // Wait for the map to be fully loaded before returning
    await new Promise<void>((resolve) => {
        if (map.loaded()) {
            resolve();
        } else {
            map.once('load', () => resolve());
        }
    });

    return map;
}

// Marker icon configs
const MARKER_CONFIGS = {
    user: { color: '#8b5cf6', symbol: '📍', size: 42 },
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
    map: any,
    position: [number, number], // [lat, lng]
    options?: {
        title?: string;
        draggable?: boolean;
        icon?: 'user' | 'hub' | 'vehicle';
        popup?: string;
    }
): any {
    const [lat, lng] = position;

    let markerOptions: any = {
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
    map: any,
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

    if (map.getLayer(layerId)) map.removeLayer(layerId);
    if (map.getSource(sourceId)) map.removeSource(sourceId);

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

    const bounds = new mapboxgl.LngLatBounds();
    geoCoords.forEach((coord) => bounds.extend(coord as [number, number]));
    
    if (map.fitBounds) {
        map.fitBounds(bounds, { padding: 50, duration: 1000 });
    }

    return layerId;
}

export function removeRoute(map: any) {
    const sourceId = 'route-source';
    const layerId = 'route-layer';
    if (map.getLayer(layerId)) map.removeLayer(layerId);
    if (map.getSource(sourceId)) map.removeSource(sourceId);
}

export function destroyMap(map: any) {
    if (map) {
        map.remove();
    }
}

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
