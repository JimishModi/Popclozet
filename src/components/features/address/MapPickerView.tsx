/**
 * Map Picker View
 * 
 * Phase 4: Swiggy-style "Pick on Map" with center-pin UX
 * - Map moves, pin stays fixed at center
 * - Reverse-geocode on map idle
 * - Confirm button when address resolved
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import { motion } from 'framer-motion';
import { isMapboxAvailable, getMapboxToken } from '@/services/mapbox/core';
import { Loader } from '@/components/ui/Loader';
import { Button } from '@/components/ui/Button';

interface MapPickerViewProps {
    initialCenter?: [number, number]; // [lng, lat]
    onConfirm: (coordinates: [number, number], address: string) => void;
    onBack: () => void;
}

// Default to Mumbai center
const DEFAULT_CENTER: [number, number] = [72.8777, 19.0760];

export const MapPickerView: React.FC<MapPickerViewProps> = ({
    initialCenter = DEFAULT_CENTER,
    onConfirm,
    onBack,
}) => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const mapRef = useRef<mapboxgl.Map | null>(null);
    const [mapLoaded, setMapLoaded] = useState(false);
    const [resolvedAddress, setResolvedAddress] = useState<string>('');
    const [centerCoords, setCenterCoords] = useState<[number, number]>(initialCenter);
    const [isGeocoding, setIsGeocoding] = useState(false);

    // Reverse geocode function
    const reverseGeocode = useCallback(async (lng: number, lat: number) => {
        const token = getMapboxToken();
        if (!token) {
            setResolvedAddress(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
            return;
        }

        setIsGeocoding(true);
        try {
            const response = await fetch(
                `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}&types=address,poi,locality`
            );
            const data = await response.json();

            if (data.features && data.features.length > 0) {
                setResolvedAddress(data.features[0].place_name);
            } else {
                setResolvedAddress(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
            }
        } catch (error) {
            console.error('Reverse geocode error:', error);
            setResolvedAddress(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
        } finally {
            setIsGeocoding(false);
        }
    }, []);

    // Initialize map
    useEffect(() => {
        if (!mapContainer.current || !isMapboxAvailable()) return;

        const token = getMapboxToken();
        if (!token) return;

        mapboxgl.accessToken = token;

        const map = new mapboxgl.Map({
            container: mapContainer.current,
            style: 'mapbox://styles/mapbox/dark-v11',
            center: initialCenter,
            zoom: 16,
            attributionControl: false,
        });

        map.addControl(new mapboxgl.NavigationControl(), 'top-right');

        map.on('load', () => {
            setMapLoaded(true);
            // Initial reverse geocode
            reverseGeocode(initialCenter[0], initialCenter[1]);
        });

        // On map move end, reverse geocode center
        map.on('moveend', () => {
            const center = map.getCenter();
            setCenterCoords([center.lng, center.lat]);
            reverseGeocode(center.lng, center.lat);
        });

        mapRef.current = map;

        return () => {
            map.remove();
        };
    }, [initialCenter, reverseGeocode]);

    // Handle map not available
    if (!isMapboxAvailable()) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-6 bg-black">
                <p className="text-zinc-400 text-center mb-4">
                    Map is not available. Please enter your address manually.
                </p>
                <Button onClick={onBack}>Go Back</Button>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black via-black/80 to-transparent p-4">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onBack}
                        className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <div>
                        <h1 className="text-lg font-bold text-white">Pick Location</h1>
                        <p className="text-xs text-zinc-400">Move the map to adjust pin</p>
                    </div>
                </div>
            </div>

            {/* Map Container */}
            <div ref={mapContainer} className="flex-1" />

            {/* Center Pin - Fixed at center of map */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="relative"
                >
                    {/* Pin shadow */}
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-1 bg-black/30 rounded-full blur-sm" />
                    {/* Pin */}
                    <svg width="48" height="48" viewBox="0 0 48 48" className="-mb-4">
                        <path
                            d="M24 4C16.268 4 10 10.268 10 18C10 28 24 44 24 44C24 44 38 28 38 18C38 10.268 31.732 4 24 4Z"
                            fill="#ff4d6d"
                            stroke="#fff"
                            strokeWidth="2"
                        />
                        <circle cx="24" cy="18" r="6" fill="white" />
                    </svg>
                </motion.div>
            </div>

            {/* Bottom Panel */}
            <motion.div
                initial={{ y: 100 }}
                animate={{ y: 0 }}
                className="absolute bottom-0 left-0 right-0 bg-[#0f0f0f] rounded-t-3xl border-t border-white/10 p-6"
            >
                <div className="mb-4">
                    <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Selected Location</p>
                    {isGeocoding ? (
                        <div className="flex items-center gap-2 text-zinc-400">
                            <Loader size="sm" />
                            <span className="text-sm">Finding address...</span>
                        </div>
                    ) : (
                        <p className="text-white font-medium line-clamp-2">
                            {resolvedAddress || 'Move the map to select a location'}
                        </p>
                    )}
                </div>

                <Button
                    onClick={() => onConfirm(centerCoords, resolvedAddress)}
                    className="w-full"
                    size="lg"
                    disabled={!resolvedAddress || isGeocoding}
                >
                    Confirm Location
                </Button>
            </motion.div>

            {/* Loading overlay */}
            {!mapLoaded && (
                <div className="absolute inset-0 bg-black flex items-center justify-center z-20">
                    <Loader size="lg" text="Loading map..." />
                </div>
            )}
        </div>
    );
};
