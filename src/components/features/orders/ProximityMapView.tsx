import React, { useEffect, useRef, useState } from 'react';
import { initializeMap, addRiderMarker, addCustomerMarker, updateRiderLocation, drawRoute, destroyMap } from '@/services/mapbox';
import { realtimeService } from '@/services/realtime';
import type { ProximityState } from '@/types';
import { motion } from 'framer-motion';

interface ProximityMapViewProps {
    orderId: string;
    riderId: string;
    customerLocation: {
        latitude: number;
        longitude: number;
    };
    proximityStatus: ProximityState['status'];
    /** Phase 2: Callback when map fails to load, triggers static fallback */
    onError?: () => void;
}

export const ProximityMapView: React.FC<ProximityMapViewProps> = ({
    orderId: _orderId, // Reserved for future use (audit logging)
    riderId,
    customerLocation,
    proximityStatus,
    onError,
}) => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const [mapInitialized, setMapInitialized] = useState(false);

    useEffect(() => {
        if (!mapContainer.current) return;

        let map: mapboxgl.Map | undefined;
        let unsubscribe: (() => void) | undefined;

        try {
            // Initialize map
            map = initializeMap(
                mapContainer.current,
                [customerLocation.longitude, customerLocation.latitude],
                14
            );

            // Add customer marker
            addCustomerMarker(map, [customerLocation.longitude, customerLocation.latitude]);

            setMapInitialized(true);

            // Subscribe to rider location updates
            unsubscribe = realtimeService.subscribeToRiderLocation(riderId, (payload) => {
                const { latitude, longitude } = payload.new;
                updateRiderLocation([longitude, latitude]);
            });
        } catch (error) {
            console.error('Failed to initialize proximity map:', error);
            // Phase 2: Trigger fallback to static map
            onError?.();
        }

        // Cleanup on unmount
        return () => {
            unsubscribe?.();
            destroyMap();
        };
    }, [riderId, customerLocation, onError]);

    return (
        <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="card overflow-hidden"
        >
            <div className="mb-4">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Live Tracking</h2>
                <p className="text-sm text-gray-600">
                    {proximityStatus === 'arrived'
                        ? 'Your rider has arrived at your location'
                        : 'Follow your rider in real-time'}
                </p>
            </div>

            {/* Map Container */}
            <div
                ref={mapContainer}
                className="w-full h-96 rounded-lg overflow-hidden bg-gray-100"
            />

            {/* Map Legend */}
            <div className="mt-4 flex items-center justify-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-primary-600" />
                    <span className="text-gray-700">Rider</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-secondary-600" />
                    <span className="text-gray-700">Your Location</span>
                </div>
            </div>
        </motion.div>
    );
};
