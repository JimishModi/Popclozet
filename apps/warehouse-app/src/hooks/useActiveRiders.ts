/**
 * useActiveRiders
 *
 * Returns real-time positions of all riders who have an order in
 * statuses: order_picked_up | dispatched | out_for_delivery
 *
 * Flow:
 *  1. Fetch active orders + rider_id + delivery address
 *  2. Fetch current positions from rider_locations
 *  3. Subscribe to rider_locations Realtime → update lat/lng in-place
 *  4. Subscribe to orders Realtime → add/remove riders as status changes
 */

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@popclozet/api-client';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface ActiveRider {
    riderId: string;
    riderName: string;
    lat: number;
    lng: number;
    heading?: number;
    speed?: number;
    orderId: string;
    orderStatus: string;
    deliveryAddress: {
        full_address: string;
        lat: number;
        lng: number;
    };
    lastUpdated: string;
}

const TRACKED_STATUSES = ['rider_assigned', 'driver_arrived_warehouse', 'order_picked_up', 'dispatched', 'out_for_delivery'];

export function useActiveRiders() {
    const [riders, setRiders] = useState<ActiveRider[]>([]);
    const [loading, setLoading] = useState(true);
    const locationChannelRef = useRef<RealtimeChannel | null>(null);
    const orderChannelRef    = useRef<RealtimeChannel | null>(null);

    const loadActiveRiders = async () => {
        setLoading(true);
        try {
            const { data: orders, error } = await supabase
                .from('orders')
                .select('id, status, rider_id, delivery_address_snapshot, addresses:delivery_address_id(full_address, latitude, longitude)')
                .in('status', TRACKED_STATUSES)
                .not('rider_id', 'is', null);

            if (error || !orders?.length) { setRiders([]); return; }

            const riderIds = [...new Set(orders.map((o: any) => o.rider_id as string))];

            const [locRes, profRes] = await Promise.all([
                supabase.from('rider_locations').select('rider_id, lat, lng, heading, speed, updated_at').in('rider_id', riderIds),
                supabase.from('profiles').select('user_id, full_name').in('user_id', riderIds),
            ]);

            const locationMap = new Map((locRes.data ?? []).map((l: any) => [l.rider_id, l]));
            const nameMap     = new Map((profRes.data ?? []).map((p: any) => [p.user_id, p.full_name ?? 'Rider']));

            const built: ActiveRider[] = [];
            for (const order of orders as any[]) {
                const loc  = locationMap.get(order.rider_id);
                if (!loc) continue;

                const addr = order.delivery_address_snapshot ?? order.addresses ?? {};
                built.push({
                    riderId:     order.rider_id,
                    riderName:   nameMap.get(order.rider_id) ?? 'Rider',
                    lat:         loc.lat,
                    lng:         loc.lng,
                    heading:     loc.heading ?? undefined,
                    speed:       loc.speed   ?? undefined,
                    orderId:     order.id,
                    orderStatus: order.status,
                    deliveryAddress: {
                        full_address: addr.full_address ?? addr.fullAddress ?? '',
                        lat: addr.lat ?? addr.latitude  ?? 0,
                        lng: addr.lng ?? addr.longitude ?? 0,
                    },
                    lastUpdated: loc.updated_at ?? new Date().toISOString(),
                });
            }
            setRiders(built);
        } catch (err) {
            console.error('[useActiveRiders] load error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadActiveRiders();

        // — rider_locations Realtime: move dots in-place —
        locationChannelRef.current = supabase
            .channel('warehouse-rider-locations')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'rider_locations' }, (payload) => {
                const u = payload.new as any;
                if (!u?.rider_id) return;
                setRiders((prev) => prev.map((r) =>
                    r.riderId === u.rider_id
                        ? { ...r, lat: u.lat, lng: u.lng, heading: u.heading ?? r.heading, speed: u.speed ?? r.speed, lastUpdated: u.updated_at ?? r.lastUpdated }
                        : r
                ));
            })
            .subscribe();

        // — orders Realtime: add/remove riders as status changes —
        orderChannelRef.current = supabase
            .channel('warehouse-active-order-status')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (payload) => {
                const o = payload.new as any;
                if (TRACKED_STATUSES.includes(o.status) && o.rider_id) {
                    loadActiveRiders(); // new rider entered tracked states
                } else {
                    setRiders((prev) => prev.filter((r) => r.orderId !== o.id));
                }
            })
            .subscribe();

        return () => {
            if (locationChannelRef.current) { supabase.removeChannel(locationChannelRef.current); locationChannelRef.current = null; }
            if (orderChannelRef.current)    { supabase.removeChannel(orderChannelRef.current);    orderChannelRef.current    = null; }
        };
    }, []);

    return { riders, loading, refresh: loadActiveRiders };
}
