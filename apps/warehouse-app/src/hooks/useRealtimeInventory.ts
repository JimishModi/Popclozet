/**
 * useRealtimeInventory Hook
 * Subscribes to postgres_changes on the inventory table.
 * Calls onChange callback whenever inventory is updated.
 * Optionally subscribes to products table changes too.
 */

import { useEffect, useRef } from 'react';
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

    useEffect(() => {
        if (!enabled || !supabase) return;

        const channel = supabase
            .channel('warehouse-inventory-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'inventory',
                },
                (payload) => {
                    console.log('[Realtime] Inventory change:', payload.eventType, payload.new);
                    onChange();
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
                    onChange();
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
                    onChange();
                }
            );
        }

        channel.subscribe((status) => {
            console.log('[Realtime] Inventory channel:', status);
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
