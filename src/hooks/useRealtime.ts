import { useEffect, useRef } from 'react';
import { realtimeService } from '@/services/realtime';

export const useRiderProximity = (orderId: string, onUpdate: (data: any) => void) => {
    const unsubscribeRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        if (!orderId) return;

        // Subscribe to proximity updates
        unsubscribeRef.current = realtimeService.subscribeToProximityUpdates(orderId, (payload) => {
            onUpdate(payload.payload);
        });

        return () => {
            if (unsubscribeRef.current) {
                unsubscribeRef.current();
            }
        };
    }, [orderId, onUpdate]);
};

export const useOrderUpdates = (orderId: string, onUpdate: (data: any) => void) => {
    const unsubscribeRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        if (!orderId) return;

        // Subscribe to order updates
        unsubscribeRef.current = realtimeService.subscribeToOrderUpdates(orderId, (payload) => {
            onUpdate(payload);
        });

        return () => {
            if (unsubscribeRef.current) {
                unsubscribeRef.current();
            }
        };
    }, [orderId, onUpdate]);
};
