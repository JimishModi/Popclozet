// src/services/mapService.ts
// Mappls integration for customer app via map-core

import { callLocationFn } from '@/utils/env';

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

export interface MapLocation {
    lat: number;
    lng: number;
}

export async function createMap(container: HTMLElement | string, config: MapConfig): Promise<any> {
    console.warn('createMap is stubbed');
    return {};
}

export function addMarker(map: any, position: [number, number], options?: any): any {
    console.warn('addMarker is stubbed');
    return {
        remove: () => {},
        getElement: () => document.createElement('div'),
        setLngLat: () => {},
        on: () => {},
    };
}

export function drawRoute(map: any, coordinates: [number, number][], options?: any): string {
    console.warn('drawRoute is stubbed');
    return 'stub-layer';
}

export function removeRoute(map: any) {
    console.warn('removeRoute is stubbed');
}

export function destroyMap(map: any) {
    console.warn('destroyMap is stubbed');
}

export async function calculateRoute(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number }
): Promise<RouteResult | null> {
    try {
        const originStr = `${origin.lng},${origin.lat}`;
        const destStr = `${destination.lng},${destination.lat}`;

        const data = await callLocationFn({
            action: 'directions',
            origin: originStr,
            destination: destStr,
        });

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
