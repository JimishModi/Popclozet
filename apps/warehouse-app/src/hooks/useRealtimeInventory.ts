/**
 * useRealtimeInventory Hook
 * Subscribes to postgres_changes on the inventory table.
 * Calls onChange callback whenever inventory is updated.
 * Optionally subscribes to products table changes too.
 */

import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@popclozet/api-client';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface UseRealtimeInventoryOptions {
    /** Called when any inventory row changes */
    onChange: () => void;
    /** If true, also subscribe to products table changes */
    includeItems?: boolean;
    /** Enable/disable the subscription */
    enabled?: boolean;
}

export function useRealtimeInventory({ onChange, includeItems = false, enabled = true }: UseRealtimeInventoryOptions) {
    const channelRef = useRef<RealtimeChannel | null>(null);
    const channelNameRef = useRef(`warehouse-inventory-changes-${Math.random().toString(36).slice(2)}`);

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
                    event: '*',
                    schema: 'public',
                    table: 'inventory',
                },
                (payload) => {
                    console.log('[Realtime] Inventory change:', payload.eventType, payload.new);
                    stableOnChange();
                }
            );

        if (includeItems) {
            // Subscribe to products table changes (the actual catalog table)
            channel.on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'products',
                },
                (payload) => {
                    console.log('[Realtime] Products change:', payload.eventType);
                    stableOnChange();
                }
            );

            // Also subscribe to items table if it exists (for legacy compatibility)
            channel.on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'items',
                },
                (payload) => {
                    console.log('[Realtime] Items change:', payload.eventType);
                    stableOnChange();
                }
            );
        }

        channel.subscribe((status) => {
            console.log('[Realtime] Inventory channel:', status);
            if (status === 'SUBSCRIBED') {
                stableOnChange();
            }
        });

        channelRef.current = channel;

        // Fallback polling: every 15 seconds refresh
        const pollInterval = setInterval(() => {
            console.log('[Realtime] Polling fallback - inventory');
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
