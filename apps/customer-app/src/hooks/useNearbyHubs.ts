// src/hooks/useNearbyHubs.ts
// Hook for fetching and managing nearby hubs

import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { findNearbyHubs, getBestHub, cacheHubs, getCachedHubs, HubWithDistance } from '@/services/hubService';

interface UseNearbyHubsOptions {
    lat?: number;
    lng?: number;
    maxRadius?: number;
    enabled?: boolean;
}

export function useNearbyHubs({
    lat,
    lng,
    maxRadius = 50,
    enabled = true,
}: UseNearbyHubsOptions = {}) {
    const [selectedHubId, setSelectedHubId] = useState<string | null>(null);

    const queryEnabled = enabled && lat !== undefined && lng !== undefined;

    const {
        data: hubs = [],
        isLoading,
        error,
        refetch,
    } = useQuery({
        queryKey: ['nearbyHubs', lat, lng, maxRadius],
        queryFn: async () => {
            if (!lat || !lng) return [];

            const nearbyHubs = await findNearbyHubs(lat, lng, maxRadius);

            // Cache for offline use
            if (nearbyHubs.length > 0) {
                cacheHubs(nearbyHubs);
            }

            return nearbyHubs;
        },
        enabled: queryEnabled,
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 30 * 60 * 1000, // 30 minutes
        placeholderData: () => {
            // Use cached data while fetching
            const cached = getCachedHubs();
            if (!cached || !lat || !lng) return undefined;

            // Filter cached hubs by distance
            return cached
                .map((hub) => ({
                    ...hub,
                    distance_km: calculateDistance(lat, lng, hub.lat, hub.lng),
                    estimated_minutes: 45,
                    is_open: true,
                }))
                .filter((hub) => hub.distance_km <= maxRadius)
                .sort((a, b) => a.distance_km - b.distance_km) as HubWithDistance[];
        },
    });

    // Auto-select best hub if none selected
    useEffect(() => {
        if (!selectedHubId && hubs.length > 0) {
            const available = hubs.find(
                (h) => h.is_open && h.availability_status === 'available'
            );
            if (available) {
                setSelectedHubId(available.id);
            }
        }
    }, [hubs, selectedHubId]);

    const selectedHub = hubs.find((h) => h.id === selectedHubId) || null;

    const selectHub = useCallback((hubId: string | null) => {
        setSelectedHubId(hubId);
    }, []);

    const selectBestHub = useCallback(async () => {
        if (!lat || !lng) return null;

        const best = await getBestHub(lat, lng);
        if (best) {
            setSelectedHubId(best.id);
        }
        return best;
    }, [lat, lng]);

    return {
        hubs,
        selectedHub,
        selectedHubId,
        selectHub,
        selectBestHub,
        isLoading,
        error: error as Error | null,
        refetch,
        hasHubsNearby: hubs.length > 0,
    };
}

// Helper function
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

function toRad(deg: number): number {
    return (deg * Math.PI) / 180;
}

export default useNearbyHubs;
