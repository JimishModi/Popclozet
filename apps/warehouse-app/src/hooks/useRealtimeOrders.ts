/**
 * useRealtimeOrders Hook
 * Subscribes to postgres_changes on orders table.
 * Calls onChange to trigger data refresh on pages.
 */

import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@popclozet/api-client';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface UseRealtimeOrdersOptions {
    /** Called when any order changes */
    onChange: () => void;
    /** Enable/disable the subscription */
    enabled?: boolean;
}

export function useRealtimeOrders({ onChange, enabled = true }: UseRealtimeOrdersOptions) {
    const channelRef = useRef<RealtimeChannel | null>(null);
    // Unique name per hook instance so navigating between pages doesn't cause one
    // page's cleanup to remove another page's still-active channel.
    const channelNameRef = useRef(`warehouse-order-changes-${Math.random().toString(36).slice(2)}`);

    // Keep a stable ref to the latest onChange so realtime handlers always call
    // the current version of loadData without re-subscribing on every render.
    const onChangeRef = useRef(onChange);
    useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

    const stableOnChange = useCallback(() => onChangeRef.current(), []);

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
                    console.log('[Realtime] New order for data refresh:', payload.new.id);
                    stableOnChange();
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
                    console.log('[Realtime] Order updated for data refresh:', payload.new.id);
                    stableOnChange();
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
                    console.log('[Realtime] Return request changed for data refresh', payload.eventType);
                    stableOnChange();
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    stableOnChange();
                }
            });

        channelRef.current = channel;

        // Fallback polling: every 15 seconds, just in case websocket events are missed
        const pollInterval = setInterval(() => {
            stableOnChange();
        }, 15000);

        return () => {
            clearInterval(pollInterval);
            if (channelRef.current && supabase) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
        };
    }, [enabled, stableOnChange]);

    return channelRef;
}
