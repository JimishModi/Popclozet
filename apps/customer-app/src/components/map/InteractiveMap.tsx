// src/components/map/InteractiveMap.tsx
// Interactive Mapbox GL map with clean UI and Red marker

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { createMap, addMarker, drawRoute, removeRoute, destroyMap } from '@/services/mapService';
import { RentalHub } from '@/services/hubService';
import { cn } from '@/lib/utils';

interface MapLocation {
    lat: number;
    lng: number;
}

interface InteractiveMapProps {
    className?: string;
    center?: MapLocation;
    zoom?: number;
    darkMode?: boolean;
    userLocation?: MapLocation | null;
    hubs?: RentalHub[];
    selectedHubId?: string;
    // Tracking simulation props
    routePath?: [number, number][] | null;
    vehicleLocation?: MapLocation | null;
    trackerMode?: boolean;

    onMapClick?: (location: MapLocation) => void;
    onHubClick?: (hub: RentalHub) => void;
    onMarkerDrag?: (location: MapLocation) => void;
}

export function InteractiveMap({
    className,
    center = { lat: 19.076, lng: 72.8777 },
    zoom = 12,
    darkMode = false,
    userLocation,
    hubs = [],
    selectedHubId,
    routePath,
    vehicleLocation,
    trackerMode = false,
    onMapClick,
    onHubClick,
    onMarkerDrag,
}: InteractiveMapProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<mapboxgl.Map | null>(null);
    const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Initialize map
    useEffect(() => {
        if (!containerRef.current) return;

        let mounted = true;

        async function initMap() {
            try {
                setIsLoading(true);
                setError(null);

                // Default to Mumbai if center is invalid
                const initialCenter = (center && Math.abs(center.lat) > 0.1) 
                    ? center 
                    : { lat: 19.076, lng: 72.8777 };

                const map = await createMap(containerRef.current!, {
                    center: [initialCenter.lat, initialCenter.lng],
                    zoom,
                    darkMode,
                });

                if (!mounted) {
                    map.remove();
                    return;
                }

                mapRef.current = map;

                if (onMapClick) {
                    map.on('click', (e) => {
                        onMapClick({ lat: e.lngLat.lat, lng: e.lngLat.lng });
                    });
                }

                setIsLoading(false);
            } catch (err) {
                console.error('Failed to initialize map:', err);
                if (mounted) {
                    setError('Failed to load map. Please refresh.');
                    setIsLoading(false);
                }
            }
        }

        initMap();

        return () => {
            mounted = false;
            markersRef.current.forEach((m) => m.remove());
            markersRef.current.clear();
            if (mapRef.current) {
                destroyMap(mapRef.current);
                mapRef.current = null;
            }
        };
    }, [darkMode]);

    // Fly to center
    useEffect(() => {
        if (mapRef.current && center && !isLoading) {
            if (Math.abs(center.lat) > 0.1) {
                mapRef.current.flyTo({
                    center: [center.lng, center.lat],
                    zoom: Math.max(mapRef.current.getZoom(), zoom),
                    duration: 1000,
                });
            }
        }
    }, [center.lat, center.lng, zoom, isLoading]);

    // User marker (Clean Red Pin)
    useEffect(() => {
        if (!mapRef.current || isLoading) return;

        if (!userLocation || (Math.abs(userLocation.lat) < 0.1)) {
            const m = markersRef.current.get('user');
            if (m) {
                m.remove();
                markersRef.current.delete('user');
            }
            return;
        }

        const existing = markersRef.current.get('user');
        if (existing) {
            existing.setLngLat([userLocation.lng, userLocation.lat]);
            // Fix for React 18 Strict Mode detaching markers from the DOM
            if (!existing.getElement().parentNode && mapRef.current) {
                existing.addTo(mapRef.current);
            }
        } else {
            // Standard red marker
            const marker = addMarker(mapRef.current, [userLocation.lat, userLocation.lng], {
                draggable: !!onMarkerDrag,
                title: 'Selected Location'
            });
            markersRef.current.set('user', marker);

            if (onMarkerDrag) {
                marker.on('dragend', () => {
                    const pos = marker.getLngLat();
                    onMarkerDrag({ lat: pos.lat, lng: pos.lng });
                });
            }
        }
    }, [userLocation?.lat, userLocation?.lng, onMarkerDrag, isLoading]);

    // Hub markers (Blue)
    useEffect(() => {
        if (!mapRef.current || isLoading) return;

        markersRef.current.forEach((m, k) => {
            if (k.startsWith('hub-')) {
                m.remove();
                markersRef.current.delete(k);
            }
        });

        hubs.forEach((hub) => {
            const marker = addMarker(mapRef.current!, [hub.lat, hub.lng], {
                icon: 'hub',
                title: hub.name,
                popup: `<div class="p-2"><strong>${hub.name}</strong><p class="text-xs mt-1 text-gray-500">${hub.address}</p></div>`
            });
            markersRef.current.set(`hub-${hub.id}`, marker);
            if (onHubClick) marker.getElement().addEventListener('click', () => onHubClick(hub));
        });
    }, [hubs, isLoading, onHubClick]);

    // Route and vehicle...
    useEffect(() => {
        if (!mapRef.current || isLoading) return;
        removeRoute(mapRef.current);
        if (routePath && routePath.length > 1) {
            drawRoute(mapRef.current, routePath);
        }
    }, [routePath, isLoading]);

    useEffect(() => {
        if (!mapRef.current || !vehicleLocation || isLoading) return;
        const existing = markersRef.current.get('vehicle');
        if (existing) {
            existing.setLngLat([vehicleLocation.lng, vehicleLocation.lat]);
        } else {
            const marker = addMarker(mapRef.current, [vehicleLocation.lat, vehicleLocation.lng], { icon: 'vehicle' });
            markersRef.current.set('vehicle', marker);
        }
    }, [vehicleLocation?.lat, vehicleLocation?.lng, isLoading]);

    return (
        <div className={cn('relative w-full h-full min-h-[400px]', className)}>
            <div ref={containerRef} className="w-full h-full rounded-2xl overflow-hidden" />
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[1px] rounded-2xl">
                    <div className="w-8 h-8 border-2 border-[#ff4d6d] border-t-transparent rounded-full animate-spin" />
                </div>
            )}
        </div>
    );
}

export default InteractiveMap;
