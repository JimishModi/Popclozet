// src/hooks/useMapLocation.ts
// Hook for GPS detection with fallback

import { useState, useEffect, useCallback } from 'react';
import { reverseGeocode, ValidatedAddress } from '@/services/addressService';

export interface MapLocationState {
    location: { lat: number; lng: number } | null;
    address: ValidatedAddress | null;
    isLoading: boolean;
    error: string | null;
    permissionState: 'prompt' | 'granted' | 'denied' | 'unavailable';
}

export function useMapLocation() {
    const [state, setState] = useState<MapLocationState>({
        location: null,
        address: null,
        isLoading: false,
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

    // Request current location with Fast-First strategy
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

        // Phase 1: FAST (Low Accuracy) - Instant via Wifi/Cell
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                const location = { lat: latitude, lng: longitude };

                // Set initial fast location immediately
                setState((prev) => ({
                    ...prev,
                    location,
                    permissionState: 'granted'
                }));

                // Try to get address for first fix
                try {
                    const address = await reverseGeocode(latitude, longitude);
                    setState((prev) => ({ ...prev, address }));
                } catch (e) { }

                // Phase 2: ACCURATE (High Accuracy) - Background GPS fix
                navigator.geolocation.getCurrentPosition(
                    async (highPos) => {
                        const hLat = highPos.coords.latitude;
                        const hLng = highPos.coords.longitude;
                        const hLocation = { lat: hLat, lng: hLng };

                        // Store in localStorage (the accurate one)
                        localStorage.setItem(
                            'user_location',
                            JSON.stringify({ ...hLocation, allowed: true })
                        );

                        try {
                            const hAddress = await reverseGeocode(hLat, hLng);
                            setState({
                                location: hLocation,
                                address: hAddress,
                                isLoading: false,
                                error: null,
                                permissionState: 'granted',
                            });
                        } catch {
                            setState((prev) => ({
                                ...prev,
                                location: hLocation,
                                isLoading: false,
                                permissionState: 'granted',
                            }));
                        }
                    },
                    (err) => {
                        // High accuracy failed, but we have the fast one, so just stop loading
                        setState((prev) => ({ ...prev, isLoading: false }));
                    },
                    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
                );
            },
            (error) => {
                // Initial fast request failed
                let errorMessage: string;
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = 'Location permission denied';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = 'Location unavailable';
                        break;
                    case error.TIMEOUT:
                        errorMessage = 'Location request timed out';
                        break;
                    default:
                        errorMessage = 'Failed to get location';
                }

                setState((prev) => ({
                    ...prev,
                    isLoading: false,
                    error: errorMessage,
                    permissionState: error.code === error.PERMISSION_DENIED ? 'denied' : prev.permissionState,
                }));
            },
            {
                enableHighAccuracy: false, // FAST
                timeout: 5000,
                maximumAge: 300000, // Reuse last 5 min cache if available
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

    // Clear location
    const clearLocation = useCallback(() => {
        localStorage.removeItem('user_location');
        setState({
            location: null,
            address: null,
            isLoading: false,
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
        clearLocation,
        isAvailable: state.permissionState !== 'unavailable',
        canRequest: state.permissionState === 'prompt' || state.permissionState === 'granted',
    };
}

export default useMapLocation;
