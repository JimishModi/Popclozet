/**
 * useRealtimeOrders Hook
 * Subscribes to postgres_changes on orders table.
 * Shows toast notification on new orders and calls onChange.
 */

import { useEffect, useRef } from 'react';
import { supabase } from '@popclozet/api-client';
import { useToast } from '../contexts/ToastContext';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface UseRealtimeOrdersOptions {
    /** Called when any order changes */
    onChange: () => void;
    /** Enable/disable the subscription */
    enabled?: boolean;
}

export function useRealtimeOrders({ onChange, enabled = true }: UseRealtimeOrdersOptions) {
    const { showToast } = useToast();
    const channelRef = useRef<RealtimeChannel | null>(null);
    // Unique name per hook instance so navigating between pages doesn't cause one
    // page's cleanup to remove another page's still-active channel.
    const channelNameRef = useRef(`warehouse-order-changes-${Math.random().toString(36).slice(2)}`);

    useEffect(() => {
        if (!enabled || !supabase) return;

        const channel = supabase
            .channel(channelNameRef.current)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'orders',
                },
                (payload) => {
                    console.log('[Realtime] New order:', payload.new);
                    showToast('🆕 New order received!', 'info');
                    onChange();
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'orders',
                },
                (payload) => {
                    console.log('[Realtime] Order updated:', payload.new);
                    onChange();
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'return_requests',
                },
                (payload) => {
                    console.log('[Realtime] Return request changed:', payload.eventType);
                    if (payload.eventType === 'INSERT') {
                        showToast('📦 New return request!', 'info');
                    }
                    onChange();
                }
            )
            .subscribe((status) => {
                console.log('[Realtime] Orders channel:', status);
            });

        channelRef.current = channel;

        return () => {
            if (channelRef.current && supabase) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
        };
    }, [enabled]);

    return channelRef;
}
