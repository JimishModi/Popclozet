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

    // Request current location
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

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                const location = { lat: latitude, lng: longitude };

                // Store in localStorage
                localStorage.setItem(
                    'user_location',
                    JSON.stringify({ ...location, allowed: true })
                );

                // Try to get address
                try {
                    const address = await reverseGeocode(latitude, longitude);
                    setState({
                        location,
                        address,
                        isLoading: false,
                        error: null,
                        permissionState: 'granted',
                    });
                } catch {
                    setState({
                        location,
                        address: null,
                        isLoading: false,
                        error: null,
                        permissionState: 'granted',
                    });
                }
            },
            (error) => {
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
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 300000, // Cache for 5 minutes
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

    // Load saved location on mount
    useEffect(() => {
        const saved = localStorage.getItem('user_location');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (parsed.lat && parsed.lng) {
                    setLocation(parsed.lat, parsed.lng);
                }
            } catch {
                // Invalid saved data
            }
        }
    }, [setLocation]);

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
