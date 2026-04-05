/**
 * useActiveOrder – Monitors the customer's most recent active order.
 * Uses real Supabase data + realtime subscription for live status updates.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase, config } from '@popclozet/api-client';
import { useAuth } from '@popclozet/auth';

export interface ActiveOrder {
    id: string;
    status: string;
    total_amount: number;
    rider_id?: string;
    rider_name?: string;
    estimated_delivery?: string;
    delivery_address?: string;
    created_at: string;
    updated_at: string;
}

const ACTIVE_STATUSES = [
    'pending',
    'confirmed',
    'packed',
    'ready_for_pickup',
    'rider_assigned',
    'driver_arrived_warehouse',
    'order_picked_up',
    'dispatched',
    'out_for_delivery',
    'return_requested',
    'return_scheduled',
    'return_dispatched',
    'return_picked_up',
    'return_at_warehouse',
    'returned',
];

export function useActiveOrder() {
    const { user } = useAuth();
    const [activeOrder, setActiveOrder] = useState<ActiveOrder | null>(null);
    const [loading, setLoading] = useState(true);
    const channelNameRef = useRef(`active_order_${user?.id}_${Math.random().toString(36).slice(2, 9)}`);

    const fetchActiveOrder = useCallback(async () => {
        if (!user?.id) {
            setLoading(false);
            return;
        }

        // Use mock data if configured
        if (config.USE_MOCK_DATA) {
            setActiveOrder({
                id: 'mock-order-1',
                status: 'out_for_delivery',
                total_amount: 999,
                rider_name: 'Raj K.',
                estimated_delivery: new Date(Date.now() + 25 * 60000).toISOString(),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            });
            setLoading(false);
            return;
        }

        try {
            const { data, error } = await supabase
                .from('orders')
                .select('id, status, total_amount, rider_id, created_at, updated_at')
                .eq('user_id', user.id)
                .in('status', ACTIVE_STATUSES)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (error || !data) {
                setActiveOrder(null);
                setLoading(false);
                return;
            }

            // Fetch rider name if assigned
            let riderName: string | undefined;
            if (data.rider_id) {
                const { data: riderProfile } = await supabase
                    .from('rider_profiles')
                    .select('full_name')
                    .eq('user_id', data.rider_id)
                    .single();
                riderName = riderProfile?.full_name;
            }

            setActiveOrder({
                id: data.id,
                status: data.status,
                total_amount: data.total_amount,
                rider_id: data.rider_id,
                rider_name: riderName,
                created_at: data.created_at,
                updated_at: data.updated_at,
            });
        } catch (err) {
            console.error('Failed to fetch active order:', err);
            setActiveOrder(null);
        } finally {
            setLoading(false);
        }
    }, [user?.id]);

    useEffect(() => {
        fetchActiveOrder();
    }, [fetchActiveOrder]);

    // Realtime subscription for order status changes
    useEffect(() => {
        if (!user?.id || config.USE_MOCK_DATA) return;

        let channel: ReturnType<typeof supabase.channel> | null = null;
        try {
            channel = supabase
                .channel(channelNameRef.current)
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'orders',
                        filter: `user_id=eq.${user.id}`,
                    },
                    () => {
                        fetchActiveOrder();
                    }
                )
                .subscribe((status, err) => {
                    if (err) console.warn('[useActiveOrder] Realtime subscription error (non-fatal):', err);
                });
        } catch (err) {
            console.warn('[useActiveOrder] Failed to subscribe to active order realtime (non-fatal):', err);
        }

        return () => {
            if (channel) supabase.removeChannel(channel);
        };
    }, [user?.id, fetchActiveOrder]);

    return { activeOrder, loading, refetch: fetchActiveOrder };
}
