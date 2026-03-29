// src/hooks/useMapLocation.ts
// Hook for GPS detection with fallback

import { useState, useEffect, useCallback } from 'react';
import { reverseGeocode, ValidatedAddress } from '@/services/addressService';

export interface MapLocationState {
    location: { lat: number; lng: number } | null;
    address: ValidatedAddress | null;
    isLoading: boolean;
    accuracy: number | null;
    error: string | null;
    permissionState: 'prompt' | 'granted' | 'denied' | 'unavailable';
}

export function useMapLocation() {
    const [state, setState] = useState<MapLocationState>({
        location: null,
        address: null,
        isLoading: false,
        accuracy: null,
        error: null,
        permissionState: 'prompt',
    });

    // Check permission state
    useEffect(() => {
        if (!navigator.geolocation) {
            setState((prev) => ({ ...prev, permissionState: 'unavailable' }));
            return;
        }

        if (navigator.permissions) {
            navigator.permissions.query({ name: 'geolocation' }).then((result) => {
                setState((prev) => ({
                    ...prev,
                    permissionState: result.state as 'prompt' | 'granted' | 'denied',
                }));

                result.addEventListener('change', () => {
                    setState((prev) => ({
                        ...prev,
                        permissionState: result.state as 'prompt' | 'granted' | 'denied',
                    }));
                });
            });
        }
    }, []);

    // Request current location with Settling Strategy (watches until accuracy improves)
    const requestLocation = useCallback(async () => {
        if (!navigator.geolocation) {
            setState((prev) => ({
                ...prev,
                error: 'Geolocation is not supported by your browser',
                permissionState: 'unavailable',
            }));
            return;
        }

        setState((prev) => ({ ...prev, isLoading: true, error: null }));

        let bestLocation: { lat: number, lng: number, accuracy: number } | null = null;
        let watchId: number | null = null;
        let settlingTimeout: any = null;

        const finalize = (finalLoc: { lat: number, lng: number }) => {
            if (watchId !== null) navigator.geolocation.clearWatch(watchId);
            if (settlingTimeout) clearTimeout(settlingTimeout);
            
            // final reverse geocode
            reverseGeocode(finalLoc.lat, finalLoc.lng)
                .then(finalAddress => {
                    setState(prev => ({
                        ...prev,
                        location: finalLoc,
                        address: finalAddress,
                        isLoading: false,
                        permissionState: 'granted'
                    }));
                })
                .catch(() => {
                    setState(prev => ({
                        ...prev,
                        location: finalLoc,
                        isLoading: false,
                        permissionState: 'granted'
                    }));
                });
            
            // Also persist
            localStorage.setItem(
                'user_location',
                JSON.stringify({ ...finalLoc, allowed: true })
            );
        };

        // Timeout fallback: after 20s, take whatever we have
        settlingTimeout = setTimeout(() => {
            console.log('[useMapLocation] Settling timeout reached — finalizing with best fix');
            if (bestLocation) {
                finalize({ lat: bestLocation.lat, lng: bestLocation.lng });
            } else {
                setState(prev => ({ ...prev, isLoading: false, accuracy: null, error: 'Location request timed out' }));
                if (watchId !== null) navigator.geolocation.clearWatch(watchId);
            }
        }, 20000);

        // Start watching for the best fix
        watchId = navigator.geolocation.watchPosition(
            (pos) => {
                const { latitude, longitude, accuracy } = pos.coords;
                console.log(`[useMapLocation] Fix received: Accuracy ${accuracy.toFixed(1)}m`);

                const newLoc = { lat: latitude, lng: longitude, accuracy };

                // Update state immediately so UI/marker moves even while settling
                setState(prev => ({ 
                    ...prev, 
                    location: { lat: latitude, lng: longitude }, 
                    accuracy,
                    permissionState: 'granted' 
                }));

                // Keep track of best fix
                if (!bestLocation || accuracy < bestLocation.accuracy) {
                    bestLocation = newLoc;
                    
                    // Optional: Update address occasionally if it's early or accuracy is great
                    if (accuracy < 15) {
                        console.log('[useMapLocation] High accuracy fix found (<15m) — finalizing early');
                        finalize({ lat: latitude, lng: longitude });
                    }
                }
            },
            (err) => {
                console.warn('[useMapLocation] Watch failed during settling:', err.message);
                if (bestLocation) {
                    finalize({ lat: bestLocation.lat, lng: bestLocation.lng });
                } else {
                    setState(prev => ({ ...prev, isLoading: false, accuracy: null, error: 'Could not get location' }));
                    if (settlingTimeout) clearTimeout(settlingTimeout);
                }
            },
            {
                enableHighAccuracy: true,
                timeout: 20000,
                maximumAge: 0
            }
        );
    }, []);

    // Watch position for live updates
    const watchPosition = useCallback(() => {
        if (!navigator.geolocation) return () => { };

        const watchId = navigator.geolocation.watchPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                const location = { lat: latitude, lng: longitude };

                setState((prev) => ({ ...prev, location }));
            },
            () => {
                // Silent fail for watch
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0,
            }
        );

        return () => navigator.geolocation.clearWatch(watchId);
    }, []);

    // Set location manually (from map click or search)
    const setLocation = useCallback(async (lat: number, lng: number) => {
        const location = { lat, lng };
        setState((prev) => ({ ...prev, location, isLoading: true }));

        try {
            const address = await reverseGeocode(lat, lng);
            setState((prev) => ({ ...prev, address, isLoading: false }));
        } catch {
            setState((prev) => ({ ...prev, isLoading: false }));
        }
    }, []);

    // Set location with pre-validated address (no reverse geocode needed)
    const setLocationWithAddress = useCallback((lat: number, lng: number, address: ValidatedAddress) => {
        const location = { lat, lng };
        setState((prev) => ({
            ...prev,
            location,
            address,
            isLoading: false
        }));

        // Also save to localStorage for persistence
        localStorage.setItem(
            'user_location',
            JSON.stringify({ lat, lng, allowed: true })
        );
    }, []);

    // Set location coordinates only — no reverse geocode, no address change.
    // Use this when updating coords for hub queries without polluting the GPS address.
    const setLocationCoords = useCallback((lat: number, lng: number) => {
        setState((prev) => ({ ...prev, location: { lat, lng } }));
    }, []);

    // Clear location
    const clearLocation = useCallback(() => {
        localStorage.removeItem('user_location');
        setState({
            location: null,
            address: null,
            isLoading: false,
            accuracy: null,
            error: null,
            permissionState: state.permissionState,
        });
    }, [state.permissionState]);

    // Load saved location on mount or auto-request if granted
    useEffect(() => {
        const saved = localStorage.getItem('user_location');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (parsed.lat && parsed.lng) {
                    // Set saved immediately
                    setLocation(parsed.lat, parsed.lng);
                }
            } catch { }
        }

        // If we already have permission, auto-request for fresh update
        if (navigator.permissions) {
            navigator.permissions.query({ name: 'geolocation' }).then((result) => {
                if (result.state === 'granted') {
                    requestLocation();
                }
            });
        }
    }, [setLocation, requestLocation]);

    return {
        ...state,
        requestLocation,
        watchPosition,
        setLocation,
        setLocationWithAddress,
        setLocationCoords,
        clearLocation,
        isAvailable: state.permissionState !== 'unavailable',
        canRequest: state.permissionState === 'prompt' || state.permissionState === 'granted',
    };
}

export default useMapLocation;
