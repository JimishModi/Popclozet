// src/hooks/useDeliveryTracking.ts
// Real-time delivery tracking via Supabase Realtime

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@popclozet/api-client';
import { getOrderById, DeliveryOrder } from '@/services/deliveryService';
import { getTrackingRecord, TrackingRecord } from '@/services/trackingService';
import { calculateRoute } from '@/services/mapService';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface TrackingPosition {
    lat: number;
    lng: number;
    heading?: number;
    speed?: number;
    timestamp: string;
}

export interface TrackingData {
    orderId: string;
    position: TrackingPosition | null;
    driverName?: string;
    vehicleNumber?: string;
    estimatedMinutes?: number;
    isActive: boolean;
}

export interface UseDeliveryTrackingOptions {
    orderId: string;
    enabled?: boolean;
    onPositionUpdate?: (position: TrackingPosition) => void;
    onETAUpdate?: (minutes: number) => void;
}

export function useDeliveryTracking({
    orderId,
    enabled = true,
    onPositionUpdate,
    onETAUpdate,
}: UseDeliveryTrackingOptions) {
    const [order, setOrder] = useState<DeliveryOrder | null>(null);
    const [tracking, setTracking] = useState<TrackingData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const channelRef = useRef<RealtimeChannel | null>(null);
    const channelNameRef = useRef(`tracking:${orderId}_${Math.random().toString(36).slice(2, 9)}`);


    // Fetch order details
    useEffect(() => {
        if (!enabled || !orderId) return;

        let mounted = true;

        async function loadOrder() {
            setIsLoading(true);
            setError(null);

            try {
                const orderData = await getOrderById(orderId);
                if (mounted) {
                    setOrder(orderData);
                }
            } catch (err) {
                if (mounted) {
                    setError(err as Error);
                }
            } finally {
                if (mounted) {
                    setIsLoading(false);
                }
            }
        }

        loadOrder();

        return () => {
            mounted = false;
        };
    }, [orderId, enabled]);

    // Subscribe to real-time tracking
    useEffect(() => {
        if (!supabase || !enabled || !orderId) return;

        // Fetch initial tracking data using the service
        getTrackingRecord(orderId).then((data) => {
            if (data) {
                const trackingData: TrackingData = {
                    orderId,
                    position: {
                        lat: data.current_lat,
                        lng: data.current_lng,
                        heading: data.heading || undefined,
                        speed: data.speed || undefined,
                        timestamp: data.updated_at,
                    },
                    driverName: data.driver_name || undefined,
                    vehicleNumber: data.vehicle_number || undefined,
                    estimatedMinutes: data.eta_minutes || undefined,
                    isActive: data.is_active,
                };
                setTracking(trackingData);
            }
        }).catch((err) => {
            console.error('[useDeliveryTracking] Failed to get initial tracking record:', err);
        });

        // Set up realtime subscription
        let channel: ReturnType<typeof supabase.channel> | null = null;
        try {
            channel = supabase
                .channel(channelNameRef.current)
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'delivery_tracking',
                        filter: `order_id=eq.${orderId}`,
                    },
                    async (payload) => {
                        const data = payload.new as any;

                        const newPosition: TrackingPosition = {
                            lat: data.current_lat,
                            lng: data.current_lng,
                            heading: data.heading,
                            speed: data.speed,
                            timestamp: data.updated_at,
                        };

                        setTracking({
                            orderId,
                            position: newPosition,
                            driverName: data.driver_name,
                            vehicleNumber: data.vehicle_number,
                            estimatedMinutes: data.eta_minutes,
                            isActive: data.is_active,
                        });

                        // Callback for position update
                        onPositionUpdate?.(newPosition);

                        // Recalculate ETA if order has destination
                        if (order?.delivery_address_snapshot && data.is_active) {
                            try {
                                const route = await calculateRoute(
                                    { lat: newPosition.lat, lng: newPosition.lng },
                                    { lat: order.delivery_address_snapshot.lat, lng: order.delivery_address_snapshot.lng }
                                );
                                if (route) {
                                    const etaMinutes = Math.ceil(route.duration / 60);
                                    onETAUpdate?.(etaMinutes);
                                }
                            } catch {
                                // Silent fail for ETA recalculation
                            }
                        }
                    }
                )
                .subscribe((status, err) => {
                    if (err) console.warn('[useDeliveryTracking] Realtime subscription error (non-fatal):', err);
                });
        } catch (err) {
            console.warn('[useDeliveryTracking] Failed to subscribe to tracking realtime (non-fatal):', err);
        }

        channelRef.current = channel;

        return () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
        };
        // NOTE: onPositionUpdate and onETAUpdate are excluded from deps intentionally.
        // They are inline functions that change every render; including them would
        // cause the WebSocket to reconnect on every render (iOS Safari amplifies this).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [orderId, enabled]);

    // Manually refresh tracking data
    const refresh = useCallback(async () => {
        if (!orderId) return;

        const data = await getTrackingRecord(orderId);
        if (data) {
            setTracking({
                orderId,
                position: {
                    lat: data.current_lat,
                    lng: data.current_lng,
                    heading: data.heading || undefined,
                    speed: data.speed || undefined,
                    timestamp: data.updated_at,
                },
                driverName: data.driver_name || undefined,
                vehicleNumber: data.vehicle_number || undefined,
                estimatedMinutes: data.eta_minutes || undefined,
                isActive: data.is_active,
            });
        }
    }, [orderId]);

    return {
        order,
        tracking,
        isLoading,
        error,
        isActive: tracking?.isActive ?? false,
        position: tracking?.position ?? null,
        eta: tracking?.estimatedMinutes ?? null,
        driverInfo: tracking ? {
            name: tracking.driverName,
            vehicle: tracking.vehicleNumber,
        } : null,
        refresh,
    };
}

export default useDeliveryTracking;
