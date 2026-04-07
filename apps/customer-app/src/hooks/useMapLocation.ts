// src/hooks/useMapLocation.ts
// Hook for GPS detection with fallback

import { useState, useEffect, useCallback } from 'react';
import { reverseGeocode, type ValidatedAddress } from '@/services/addressService';

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

    useEffect(() => {
        if (!navigator.geolocation) {
            setState((prev) => ({ ...prev, permissionState: 'unavailable' }));
            return;
        }

        if (!navigator.permissions) return;

        let isMounted = true;
        let permissionStatus: PermissionStatus | null = null;

        const syncPermission = () => {
            if (!isMounted || !permissionStatus) return;
            setState((prev) => ({
                ...prev,
                permissionState: permissionStatus!.state as 'prompt' | 'granted' | 'denied',
            }));
        };

        navigator.permissions.query({ name: 'geolocation' }).then((result) => {
            permissionStatus = result;
            syncPermission();
            permissionStatus.addEventListener('change', syncPermission);
        });

        return () => {
            isMounted = false;
            permissionStatus?.removeEventListener('change', syncPermission);
        };
    }, []);

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

        let bestLocation: { lat: number; lng: number; accuracy: number } | null = null;
        let watchId: number | null = null;
        let settlingTimeout: ReturnType<typeof setTimeout> | null = null;
        let goodEnoughTimeout: ReturnType<typeof setTimeout> | null = null;
        let finalized = false;

        const geoOptions: PositionOptions = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 5000,
        };

        const clearTimers = () => {
            if (settlingTimeout) clearTimeout(settlingTimeout);
            if (goodEnoughTimeout) clearTimeout(goodEnoughTimeout);
        };

        const failRequest = (
            message: string,
            permissionState?: MapLocationState['permissionState']
        ) => {
            if (watchId !== null) navigator.geolocation.clearWatch(watchId);
            clearTimers();

            setState((prev) => ({
                ...prev,
                isLoading: false,
                accuracy: null,
                error: message,
                permissionState: permissionState ?? prev.permissionState,
            }));
        };

        const updateBestLocation = (latitude: number, longitude: number, accuracy: number) => {
            console.log(`[useMapLocation] Fix received: Accuracy ${accuracy.toFixed(1)}m`);

            setState((prev) => ({
                ...prev,
                location: { lat: latitude, lng: longitude },
                accuracy,
                permissionState: 'granted',
            }));

            if (!bestLocation || accuracy < bestLocation.accuracy) {
                bestLocation = { lat: latitude, lng: longitude, accuracy };
                return true;
            }

            return false;
        };

        const finalize = (finalLoc: { lat: number; lng: number }) => {
            if (finalized) return;
            finalized = true;

            if (watchId !== null) navigator.geolocation.clearWatch(watchId);
            clearTimers();

            reverseGeocode(finalLoc.lat, finalLoc.lng)
                .then((finalAddress) => {
                    setState((prev) => ({
                        ...prev,
                        location: finalLoc,
                        address: finalAddress,
                        isLoading: false,
                        error: null,
                        permissionState: 'granted',
                    }));
                })
                .catch(() => {
                    setState((prev) => ({
                        ...prev,
                        location: finalLoc,
                        isLoading: false,
                        error: null,
                        permissionState: 'granted',
                    }));
                });
            // Also persist
            try {
                localStorage.setItem(
                    'user_location',
                    JSON.stringify({ ...finalLoc, allowed: true })
                );
            } catch (err) {
                console.warn('[useMapLocation] Failed to save location to localStorage', err);
            }
        };

        settlingTimeout = setTimeout(() => {
            console.log('[useMapLocation] Settling timeout reached (10s) - finalizing with best fix');
            if (bestLocation) {
                finalize({ lat: bestLocation.lat, lng: bestLocation.lng });
            } else {
                failRequest('Location request timed out. Move to an open area and try again.');
            }
        }, 10000);

        goodEnoughTimeout = setTimeout(() => {
            if (bestLocation && bestLocation.accuracy < 200) {
                console.log(
                    `[useMapLocation] Good-enough fix after 4s (${bestLocation.accuracy.toFixed(0)}m) - finalizing`
                );
                finalize({ lat: bestLocation.lat, lng: bestLocation.lng });
            }
        }, 4000);

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const improved = updateBestLocation(
                    pos.coords.latitude,
                    pos.coords.longitude,
                    pos.coords.accuracy
                );

                if (improved && pos.coords.accuracy < 80) {
                    console.log('[useMapLocation] Initial fix good enough - finalizing early');
                    finalize({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                }
            },
            (err) => {
                console.warn('[useMapLocation] Initial getCurrentPosition failed:', err.message);

                if (err.code === err.PERMISSION_DENIED) {
                    failRequest(
                        'Location permission was denied. Enable it in browser settings and try again.',
                        'denied'
                    );
                }
            },
            geoOptions
        );

        watchId = navigator.geolocation.watchPosition(
            (pos) => {
                const { latitude, longitude, accuracy } = pos.coords;
                const improved = updateBestLocation(latitude, longitude, accuracy);

                if (improved && accuracy < 50) {
                    console.log('[useMapLocation] Good accuracy fix (<50m) - finalizing early');
                    finalize({ lat: latitude, lng: longitude });
                }
            },
            (err) => {
                console.warn('[useMapLocation] Watch failed during settling:', err.message);

                if (err.code === err.PERMISSION_DENIED) {
                    failRequest(
                        'Location permission was denied. Enable it in browser settings and try again.',
                        'denied'
                    );
                    return;
                }

                if (bestLocation) {
                    finalize({ lat: bestLocation.lat, lng: bestLocation.lng });
                    return;
                }

                failRequest(
                    err.code === err.TIMEOUT
                        ? 'Location request timed out. Move to an open area and try again.'
                        : 'Could not get location'
                );
            },
            geoOptions
        );
    }, []);

    const watchPosition = useCallback(() => {
        if (!navigator.geolocation) return () => {};

        const watchId = navigator.geolocation.watchPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                const location = { lat: latitude, lng: longitude };

                setState((prev) => ({ ...prev, location }));
            },
            () => {
                // Silent fail for watch.
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0,
            }
        );

        return () => navigator.geolocation.clearWatch(watchId);
    }, []);

    const setLocation = useCallback(async (lat: number, lng: number) => {
        const location = { lat, lng };
        setState((prev) => ({ ...prev, location, address: null, isLoading: true }));

        try {
            let address = await reverseGeocode(lat, lng);
            if (!address) {
                address = {
                    lat,
                    lng,
                    formattedAddress: `Location ${lat.toFixed(6)}, ${lng.toFixed(6)}`,
                    city: '',
                    pincode: '',
                };
            }
            setState((prev) => ({ ...prev, address, isLoading: false }));
        } catch {
            const fallbackAddress = {
                lat,
                lng,
                formattedAddress: `Location ${lat.toFixed(6)}, ${lng.toFixed(6)}`,
                city: '',
                pincode: '',
            };
            setState((prev) => ({ ...prev, address: fallbackAddress, isLoading: false }));
        }
    }, []);

    const setLocationWithAddress = useCallback((lat: number, lng: number, address: ValidatedAddress) => {
        const location = { lat, lng };
        setState((prev) => ({
            ...prev,
            location,
            address,
            isLoading: false,
        }));

        // Also save to localStorage for persistence
        try {
            localStorage.setItem(
                'user_location',
                JSON.stringify({ lat, lng, allowed: true })
            );
        } catch (err) {
            console.warn('[useMapLocation] Failed to save location to localStorage', err);
        }
    }, []);

    const setLocationCoords = useCallback((lat: number, lng: number) => {
        setState((prev) => ({ ...prev, location: { lat, lng }, address: null }));
    }, []);

    const clearLocation = useCallback(() => {
        try { localStorage.removeItem('user_location'); } catch {}
        setState({
            location: null,
            address: null,
            isLoading: false,
            accuracy: null,
            error: null,
            permissionState: state.permissionState,
        });
    }, [state.permissionState]);

    useEffect(() => {
        let saved = null;
        try { saved = localStorage.getItem('user_location'); } catch {}
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (parsed.lat && parsed.lng) {
                    setLocation(parsed.lat, parsed.lng);
                }
            } catch {
                // Ignore malformed local storage.
            }
        }

        if (!navigator.permissions) return;

        navigator.permissions.query({ name: 'geolocation' }).then((result) => {
            if (result.state === 'granted') {
                requestLocation();
            }
        });
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
