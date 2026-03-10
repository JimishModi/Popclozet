// src/components/map/InteractiveMap.tsx
// Interactive Mapbox GL map with dark mode support

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
    trackerMode?: boolean; // Enable auto-follow of vehicle

    onMapClick?: (location: MapLocation) => void;
    onHubClick?: (hub: RentalHub) => void;
    onMarkerDrag?: (location: MapLocation) => void;
}

export function InteractiveMap({
    className,
    center = { lat: 19.076, lng: 72.8777 }, // Mumbai default
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

                const map = await createMap(containerRef.current!, {
                    center: [center.lat, center.lng],
                    zoom,
                    darkMode,
                });

                if (!mounted) {
                    map.remove();
                    return;
                }

                mapRef.current = map;

                // Handle map clicks
                if (onMapClick) {
                    map.on('click', (e) => {
                        onMapClick({ lat: e.lngLat.lat, lng: e.lngLat.lng });
                    });
                }

                // If we already have a style loaded or it's loading, we can try to mark
                // Mapbox allows adding markers to map instance before style is fully loaded
                setIsLoading(false);
            } catch (err) {
                console.error('Failed to initialize map:', err);
                if (mounted) {
                    setError('Failed to load map. Please refresh the page.');
                    setIsLoading(false);
                }
            }
        }

        initMap();

        return () => {
            mounted = false;
            // Cleanup markers
            markersRef.current.forEach((marker) => marker.remove());
            markersRef.current.clear();
            if (mapRef.current) {
                destroyMap(mapRef.current);
                mapRef.current = null;
            }
        };
    }, [darkMode]); // Re-init on dark mode change

    // Update center when it changes - use flyTo for smooth animation
    useEffect(() => {
        if (mapRef.current && center && !isLoading) {
            mapRef.current.flyTo({
                center: [center.lng, center.lat],
                zoom,
                duration: 1000,
                essential: true, // This animation is considered essential and will not be interrupted
            });
        }
    }, [center.lat, center.lng, zoom, isLoading]);

    // Add/update user location marker (pink pin)
    useEffect(() => {
        if (!mapRef.current || isLoading) return;

        if (!userLocation) {
            const existingMarker = markersRef.current.get('user');
            if (existingMarker) {
                existingMarker.remove();
                markersRef.current.delete('user');
            }
            return;
        }

        const existingMarker = markersRef.current.get('user');
        if (existingMarker) {
            existingMarker.setLngLat([userLocation.lng, userLocation.lat]);
            // Update popup
            const popup = existingMarker.getPopup();
            if (popup) {
                popup.setHTML(`<div style="padding: 8px; text-align: center;"><strong>Selected Location</strong><br/>${userLocation.lat.toFixed(6)}, ${userLocation.lng.toFixed(6)}</div>`);
            }
        } else {
            const marker = addMarker(mapRef.current, [userLocation.lat, userLocation.lng], {
                icon: 'user',
                draggable: !!onMarkerDrag,
                title: 'Selected Location',
                popup: `<div style="padding: 8px; text-align: center;"><strong>Selected Location</strong><br/>${userLocation.lat.toFixed(6)}, ${userLocation.lng.toFixed(6)}</div>`,
            });

            markersRef.current.set('user', marker);

            // Show popup briefly
            const popup = marker.getPopup();
            if (popup) {
                marker.togglePopup();
                setTimeout(() => {
                    if (marker.getPopup()?.isOpen()) marker.togglePopup();
                }, 2500);
            }

            if (onMarkerDrag) {
                marker.on('dragend', () => {
                    const lngLat = marker.getLngLat();
                    onMarkerDrag({ lat: lngLat.lat, lng: lngLat.lng });
                });
            }
        }
    }, [userLocation?.lat, userLocation?.lng, onMarkerDrag, isLoading]);

    // Add hub markers
    useEffect(() => {
        if (!mapRef.current) return;

        // Remove old hub markers
        markersRef.current.forEach((marker, key) => {
            if (key.startsWith('hub-')) {
                marker.remove();
                markersRef.current.delete(key);
            }
        });

        // Add new hub markers
        hubs.forEach((hub) => {
            const marker = addMarker(mapRef.current!, [hub.lat, hub.lng], {
                icon: 'hub',
                title: hub.name,
                popup: `
                    <div style="padding: 8px;">
                        <strong>${hub.name}</strong>
                        <p style="font-size: 12px; color: #666; margin-top: 4px;">${hub.address}</p>
                    </div>
                `,
            });

            markersRef.current.set(`hub-${hub.id}`, marker);

            if (onHubClick) {
                marker.getElement().addEventListener('click', () => onHubClick(hub));
            }
        });
    }, [hubs, onHubClick]);

    // Highlight selected hub
    useEffect(() => {
        if (!selectedHubId || !mapRef.current) return;

        const selectedHub = hubs.find((h) => h.id === selectedHubId);
        if (selectedHub) {
            mapRef.current.flyTo({
                center: [selectedHub.lng, selectedHub.lat],
                zoom: 14,
                duration: 1000,
            });
        }
    }, [selectedHubId, hubs]);

    // Draw route line
    useEffect(() => {
        if (!mapRef.current) return;

        // Remove existing route
        removeRoute(mapRef.current);

        if (!routePath || routePath.length < 2) return;

        // Draw new route
        drawRoute(mapRef.current, routePath, {
            color: '#3b82f6',
            weight: 5,
            opacity: 0.8,
        });
    }, [routePath]);

    // Vehicle marker
    useEffect(() => {
        if (!mapRef.current || !vehicleLocation) return;

        const existingMarker = markersRef.current.get('vehicle');
        if (existingMarker) {
            existingMarker.setLngLat([vehicleLocation.lng, vehicleLocation.lat]);
        } else {
            const marker = addMarker(mapRef.current, [vehicleLocation.lat, vehicleLocation.lng], {
                icon: 'vehicle',
                title: 'Driver',
            });
            markersRef.current.set('vehicle', marker);
        }
    }, [vehicleLocation?.lat, vehicleLocation?.lng]);

    // Tracker Mode: Auto-follow vehicle
    useEffect(() => {
        if (!mapRef.current || !trackerMode || !vehicleLocation) return;

        mapRef.current.flyTo({
            center: [vehicleLocation.lng, vehicleLocation.lat],
            zoom: Math.max(mapRef.current.getZoom(), 15),
            duration: 500,
        });
    }, [trackerMode, vehicleLocation?.lat, vehicleLocation?.lng]);

    return (
        <div className={cn('relative w-full h-full min-h-[300px]', className)}>
            {/* Map container */}
            <div
                ref={containerRef}
                className="w-full h-full min-h-[400px] rounded-2xl overflow-hidden"
                style={{ backgroundColor: darkMode ? '#1f1f1f' : '#f0f0f0' }}
            />

            {/* Loading overlay */}
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-2xl">
                    <div className="flex flex-col items-center gap-2">
                        <div className="w-8 h-8 border-2 border-[#ff4d6d] border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm text-white">Loading map...</span>
                    </div>
                </div>
            )}

            {/* Error overlay */}
            {error && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80 rounded-2xl p-4">
                    <div className="text-center">
                        <p className="text-red-400 mb-2">{error}</p>
                        <button
                            onClick={() => window.location.reload()}
                            className="px-4 py-2 bg-[#ff4d6d] text-white rounded-full text-sm"
                        >
                            Retry
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default InteractiveMap;
