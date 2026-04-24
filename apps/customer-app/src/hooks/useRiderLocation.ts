import { useEffect, useCallback, useRef } from "react";
import { supabase } from "@popclozet/api-client";

interface RiderLocation {
    riderId: string;
    lat: number;
    lng: number;
    heading?: number;
    speed?: number;
    updatedAt: string;
}

type LocationCallback = (location: RiderLocation) => void;

/**
 * Hook to track rider location in real-time
 * Used by customer-app to show rider position on map
 */
export function useRiderLocation(riderId: string | null, onUpdate?: LocationCallback) {
    const callbackRef = useRef(onUpdate);
    callbackRef.current = onUpdate;

    useEffect(() => {
        if (!riderId) return;

        // Initial fetch
        const fetchLocation = async () => {
            try {
                const { data, error } = await supabase
                    .from("rider_locations")
                    .select("*")
                    .eq("rider_id", riderId)
                    .single();

                if (error) {
                    console.error('[useRiderLocation] Failed to fetch rider location:', error);
                    return;
                }

                if (data && callbackRef.current) {
                    callbackRef.current({
                        riderId: data.rider_id,
                        lat: data.lat,
                        lng: data.lng,
                        heading: data.heading,
                        speed: data.speed,
                        updatedAt: data.updated_at,
                    });
                }
            } catch (err) {
                console.error('[useRiderLocation] Unexpected error fetching rider location:', err);
            }
        };

        fetchLocation();

        // Subscribe to real-time updates
        let channel: ReturnType<typeof supabase.channel> | null = null;
        try {
            channel = supabase
                .channel(`rider_location_${riderId}`)
                .on(
                    "postgres_changes",
                    {
                        event: "*",
                        schema: "public",
                        table: "rider_locations",
                        filter: `rider_id=eq.${riderId}`,
                    },
                    (payload) => {
                        const data = payload.new as any;
                        if (callbackRef.current) {
                            callbackRef.current({
                                riderId: data.rider_id,
                                lat: data.lat,
                                lng: data.lng,
                                heading: data.heading,
                                speed: data.speed,
                                updatedAt: data.updated_at,
                            });
                        }
                    }
                )
                .subscribe((status, err) => {
                    if (err) console.warn('[useRiderLocation] Realtime subscription error (non-fatal):', err);
                });
        } catch (err) {
            console.warn('[useRiderLocation] Failed to subscribe to rider location (non-fatal):', err);
        }

        return () => {
            if (channel) supabase.removeChannel(channel);
        };
    }, [riderId]);
}

/**
 * Hook to broadcast rider location updates
 * Used by rider-app to send location to customers tracking the order
 */
export function useRiderLocationBroadcast(riderId: string) {
    const updateLocation = useCallback(
        async (lat: number, lng: number, heading?: number, speed?: number) => {
            if (!riderId) return false;

            const { error } = await supabase.from("rider_locations").upsert(
                {
                    rider_id: riderId,
                    lat,
                    lng,
                    heading,
                    speed,
                    updated_at: new Date().toISOString(),
                },
                { onConflict: "rider_id" }
            );

            return !error;
        },
        [riderId]
    );

    const startTracking = useCallback(
        (intervalMs: number = 5000) => {
            if (!navigator.geolocation) {
                console.error("Geolocation not supported");
                return () => { };
            }

            const watchId = navigator.geolocation.watchPosition(
                (position) => {
                    updateLocation(
                        position.coords.latitude,
                        position.coords.longitude,
                        position.coords.heading ?? undefined,
                        position.coords.speed ?? undefined
                    );
                },
                (error) => {
                    console.error("Geolocation error:", error);
                },
                {
                    enableHighAccuracy: true,
                    maximumAge: intervalMs,
                    timeout: 10000,
                }
            );

            return () => {
                navigator.geolocation.clearWatch(watchId);
            };
        },
        [updateLocation]
    );

    return { updateLocation, startTracking };
}
