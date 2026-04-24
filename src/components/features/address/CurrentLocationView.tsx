/**
 * Current Location View
 * 
 * Phase 4: GPS-based location capture with map confirmation
 * - Request geolocation permission
 * - Show location on map
 * - Allow fine-tuning with draggable pin
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { mapboxgl, isMapboxAvailable } from '@popclozet/map-core';
import { motion } from 'framer-motion';
import { Loader } from '@/components/ui/Loader';
import { Button } from '@/components/ui/Button';

interface CurrentLocationViewProps {
    onConfirm: (coordinates: [number, number], address: string) => void;
    onBack: () => void;
    onPermissionDenied: () => void;
}

type LocationState = 'requesting' | 'locating' | 'found' | 'error' | 'denied';

export const CurrentLocationView: React.FC<CurrentLocationViewProps> = ({
    onConfirm,
    onBack,
    onPermissionDenied,
}) => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const mapRef = useRef<any>(null);
    const markerRef = useRef<any>(null);

    const [locationState, setLocationState] = useState<LocationState>('requesting');
    const [errorMessage, setErrorMessage] = useState<string>('');
    const [coordinates, setCoordinates] = useState<[number, number] | null>(null);
    const [resolvedAddress, setResolvedAddress] = useState<string>('');
    const [isGeocoding, setIsGeocoding] = useState(false);

    const reverseGeocode = useCallback(async (lng: number, lat: number) => {
        setIsGeocoding(true);
        try {
            const { reverseGeocode: rc } = await import('@popclozet/map-core');
            const result = await rc(lat, lng);
            if (result?.fullAddress) {
                setResolvedAddress(result.fullAddress);
            } else {
                setResolvedAddress(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
            }
        } catch {
            setResolvedAddress(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
        } finally {
            setIsGeocoding(false);
        }
    }, []);

    // Request geolocation
    useEffect(() => {
        if (!navigator.geolocation) {
            setLocationState('error');
            setErrorMessage('Geolocation is not supported by your browser');
            return;
        }

        setLocationState('locating');

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                setCoordinates([longitude, latitude]);
                setLocationState('found');
            },
            (error) => {
                if (error.code === error.PERMISSION_DENIED) {
                    setLocationState('denied');
                } else {
                    setLocationState('error');
                    setErrorMessage(error.message || 'Could not get your location');
                }
            },
            {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 0,
            }
        );
    }, []);

    // Initialize map when coordinates are found
    useEffect(() => {
        if (!coordinates || !mapContainer.current || !isMapboxAvailable()) return;

        const { initializeMap } = await import('@popclozet/map-core');

        initializeMap(mapContainer.current, coordinates, 17).then((map: any) => {
            mapRef.current = map;

            const { Marker } = mapboxgl;
            const marker = new Marker({ color: '#ff4d6d', draggable: true })
                .setLngLat(coordinates)
                .addTo(map);

            marker.on('dragend', () => {
                const lngLat = marker.getLngLat();
                setCoordinates([lngLat.lng, lngLat.lat]);
                reverseGeocode(lngLat.lng, lngLat.lat);
            });

            markerRef.current = marker;

            reverseGeocode(coordinates[0], coordinates[1]);
        });

        return () => {
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, [coordinates, reverseGeocode]);

    // Render based on state
    if (locationState === 'requesting' || locationState === 'locating') {
        return (
            <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center">
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-center"
                >
                    <div className="relative mb-6">
                        <div className="w-24 h-24 rounded-full bg-[#ff4d6d]/20 flex items-center justify-center">
                            <motion.div
                                animate={{ scale: [1, 1.2, 1] }}
                                transition={{ repeat: Infinity, duration: 1.5 }}
                                className="text-5xl"
                            >
                                📍
                            </motion.div>
                        </div>
                        <motion.div
                            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                            transition={{ repeat: Infinity, duration: 1.5 }}
                            className="absolute inset-0 rounded-full border-2 border-[#ff4d6d]/30"
                        />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2">Finding Your Location</h2>
                    <p className="text-zinc-400 text-sm">Please allow location access when prompted</p>
                </motion.div>
            </div>
        );
    }

    if (locationState === 'denied') {
        return (
            <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center p-6">
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-center"
                >
                    <div className="w-20 h-20 rounded-full bg-yellow-500/20 flex items-center justify-center mb-6 mx-auto">
                        <span className="text-4xl">🔒</span>
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2">Location Access Denied</h2>
                    <p className="text-zinc-400 text-sm mb-6">
                        You can still add your address manually or by picking on the map.
                    </p>
                    <div className="space-y-3 w-full max-w-xs mx-auto">
                        <Button onClick={onPermissionDenied} className="w-full">
                            Enter Manually Instead
                        </Button>
                        <button
                            onClick={onBack}
                            className="w-full py-2 text-zinc-400 text-sm hover:text-white"
                        >
                            Go Back
                        </button>
                    </div>
                </motion.div>
            </div>
        );
    }

    if (locationState === 'error') {
        return (
            <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center p-6">
                <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mb-6">
                    <span className="text-4xl">❌</span>
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Location Error</h2>
                <p className="text-zinc-400 text-sm text-center mb-6">{errorMessage}</p>
                <div className="space-y-3 w-full max-w-xs">
                    <Button onClick={onPermissionDenied} className="w-full">
                        Enter Manually Instead
                    </Button>
                    <button
                        onClick={onBack}
                        className="w-full py-2 text-zinc-400 text-sm hover:text-white"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    // Location found - show map with adjustable pin
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
                        <h1 className="text-lg font-bold text-white">Your Location</h1>
                        <p className="text-xs text-zinc-400">Drag the pin to adjust if needed</p>
                    </div>
                </div>
            </div>

            {/* Map Container */}
            <div ref={mapContainer} className="flex-1" />

            {/* Bottom Panel */}
            <motion.div
                initial={{ y: 100 }}
                animate={{ y: 0 }}
                className="absolute bottom-0 left-0 right-0 bg-[#0f0f0f] rounded-t-3xl border-t border-white/10 p-6"
            >
                <div className="flex items-start gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-xl">✓</span>
                    </div>
                    <div className="flex-1">
                        <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Current Location</p>
                        {isGeocoding ? (
                            <div className="flex items-center gap-2 text-zinc-400">
                                <Loader size="sm" />
                                <span className="text-sm">Finding address...</span>
                            </div>
                        ) : (
                            <p className="text-white font-medium line-clamp-2">
                                {resolvedAddress || 'Loading...'}
                            </p>
                        )}
                    </div>
                </div>

                <Button
                    onClick={() => coordinates && onConfirm(coordinates, resolvedAddress)}
                    className="w-full"
                    size="lg"
                    disabled={!coordinates || !resolvedAddress || isGeocoding}
                >
                    Confirm This Location
                </Button>
            </motion.div>
        </div>
    );
};
