// hooks/useOrderTracking.ts
// Subscribes to live tracking data for a single dispatched order.
// Used by OrderTrackingPage in the warehouse app.

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@popclozet/api-client';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface OrderTrackingData {
    // Rider live position
    riderLat: number;
    riderLng: number;
    heading: number | null;
    speed: number | null;
    // ETA + rider info
    etaMinutes: number | null;
    driverName: string | null;
    vehicleNumber: string | null;
    // Destination
    destLat: number | null;
    destLng: number | null;
    destAddress: string | null;
    // Order meta
    orderType: string;
    lastUpdated: string | null;
}

interface UseOrderTrackingResult {
    tracking: OrderTrackingData | null;
    isLoading: boolean;
    isLive: boolean;
}

export function useOrderTracking(orderId: string | undefined): UseOrderTrackingResult {
    const [tracking, setTracking] = useState<OrderTrackingData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isLive, setIsLive] = useState(false);
    const channelRef = useRef<RealtimeChannel | null>(null);

    useEffect(() => {
        if (!orderId) return;

        let cancelled = false;

        const load = async () => {
            setIsLoading(true);

            // Fetch active delivery_tracking row + order destination in one go
            const [trackingRes, orderRes] = await Promise.all([
                supabase
                    .from('delivery_tracking')
                    .select('*')
                    .eq('order_id', orderId)
                    .eq('is_active', true)
                    .maybeSingle(),
                supabase
                    .from('orders')
                    .select('order_type, delivery_address_snapshot, delivery_address_id, addresses:delivery_address_id(full_address, latitude, longitude)')
                    .eq('id', orderId)
                    .maybeSingle(),
            ]);

            if (cancelled) return;

            const dt = trackingRes.data;
            const order = orderRes.data;

            // Resolve destination from delivery_address_snapshot first, then addresses join
            const snap = order?.delivery_address_snapshot as any;
            const addr = (order as any)?.addresses;

            let destLat = snap?.lat ?? addr?.latitude ?? null;
            let destLng = snap?.lng ?? addr?.longitude ?? null;
            const destAddress = snap?.full_address ?? addr?.full_address ?? null;

            console.log('destination coords (from DB):', destLng, destLat);

            // Fallback for wrong Mumbai coordinates or 0,0
            const isZero = destLat === 0 && destLng === 0;
            const isMumbai = destLat && destLat > 18.8 && destLat < 19.3 && 
                             destLng && destLng > 72.7 && destLng < 73.1;
            
            // Re-geocode if coords are 0, or if they are in Mumbai but address isn't in MH
            const needsFallback = isZero || (isMumbai && destAddress && !destAddress.toLowerCase().includes('mumbai') && !destAddress.toLowerCase().includes('maharashtra'));

            if ((!destLat || needsFallback) && destAddress) {
                console.warn('Coordinates seem incorrect or missing. Applying runtime geocoding fallback for address:', destAddress);
                try {
                    const { mapboxgl } = await import('@popclozet/map-core');
                    const token = (mapboxgl as any).accessToken;
                    if (token) {
                        const encoded = encodeURIComponent(destAddress);
                        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?access_token=${token}&country=IN&limit=1`;
                        const res = await fetch(url);
                        const data = await res.json();
                        if (data.features && data.features.length > 0) {
                            const [lng, lat] = data.features[0].center;
                            destLat = lat;
                            destLng = lng;
                            console.log('Geocoding fallback successful:', destLng, destLat);
                        } else {
                            console.error('Geocoding failed for address:', destAddress);
                        }
                    }
                } catch (err) {
                    console.error('Geocoding fallback error:', err);
                }
            }

            if (dt) {
                setTracking({
                    riderLat: dt.current_lat,
                    riderLng: dt.current_lng,
                    heading: dt.heading ?? null,
                    speed: dt.speed ?? null,
                    etaMinutes: dt.eta_minutes ?? null,
                    driverName: dt.driver_name ?? null,
                    vehicleNumber: dt.vehicle_number ?? null,
                    destLat,
                    destLng,
                    destAddress,
                    orderType: order?.order_type ?? 'delivery',
                    lastUpdated: dt.updated_at ?? null,
                });
                setIsLive(true);
            } else {
                // No active tracking row yet — still show destination at minimum
                setTracking(t => t ? { ...t, destLat, destLng, destAddress, orderType: order?.order_type ?? 'delivery' } : null);
                setIsLive(false);
            }

            setIsLoading(false);
        };

        load();

        // Subscribe to delivery_tracking changes for this order
        const channel = supabase
            .channel(`warehouse_tracking_${orderId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'delivery_tracking',
                    filter: `order_id=eq.${orderId}`,
                },
                (payload) => {
                    const dt = payload.new as any;
                    if (!dt || !dt.is_active) {
                        setIsLive(false);
                        return;
                    }
                    setTracking(prev => prev ? {
                        ...prev,
                        riderLat: dt.current_lat,
                        riderLng: dt.current_lng,
                        heading: dt.heading ?? null,
                        speed: dt.speed ?? null,
                        etaMinutes: dt.eta_minutes ?? null,
                        driverName: dt.driver_name ?? prev.driverName,
                        vehicleNumber: dt.vehicle_number ?? prev.vehicleNumber,
                        lastUpdated: dt.updated_at ?? null,
                    } : null);
                    setIsLive(true);
                }
            )
            .subscribe();

        channelRef.current = channel;

        return () => {
            cancelled = true;
            supabase.removeChannel(channel);
        };
    }, [orderId]);

    return { tracking, isLoading, isLive };
}
