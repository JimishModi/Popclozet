import { supabase } from './supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

type EventCallback<T = any> = (payload: T) => void;

class RealtimeService {
    private channels: Map<string, RealtimeChannel> = new Map();

    subscribeToOrderUpdates(orderId: string, callback: EventCallback) {
        const channelName = `order:${orderId}`;

        if (this.channels.has(channelName)) {
            return () => this.unsubscribe(channelName);
        }

        const channel = supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'orders',
                    filter: `id=eq.${orderId}`,
                },
                callback
            )
            .subscribe();

        this.channels.set(channelName, channel);

        return () => this.unsubscribe(channelName);
    }

    subscribeToRiderLocation(riderId: string, callback: EventCallback) {
        const channelName = `rider:${riderId}`;

        if (this.channels.has(channelName)) {
            return () => this.unsubscribe(channelName);
        }

        const channel = supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'rider_locations',
                    filter: `rider_id=eq.${riderId}`,
                },
                callback
            )
            .subscribe();

        this.channels.set(channelName, channel);

        return () => this.unsubscribe(channelName);
    }

    subscribeToProximityUpdates(orderId: string, callback: EventCallback) {
        const channelName = `proximity:${orderId}`;

        if (this.channels.has(channelName)) {
            return () => this.unsubscribe(channelName);
        }

        const channel = supabase
            .channel(channelName)
            .on(
                'broadcast',
                { event: 'rider_distance_update' },
                callback
            )
            .subscribe();

        this.channels.set(channelName, channel);

        return () => this.unsubscribe(channelName);
    }

    private unsubscribe(channelName: string) {
        const channel = this.channels.get(channelName);
        if (channel) {
            supabase.removeChannel(channel);
            this.channels.delete(channelName);
        }
    }

    unsubscribeAll() {
        this.channels.forEach((channel) => {
            supabase.removeChannel(channel);
        });
        this.channels.clear();
    }
}

export const realtimeService = new RealtimeService();
