import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@popclozet/api-client';
import { NewOrderOverlay } from './NewOrderOverlay';
import type { OrderWithItems } from '../services/fulfillmentService';
import { AnimatePresence } from 'framer-motion';

// Reliable notification chime sound
const NOTIFICATION_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';

export function GlobalOrderListener() {
    const navigate = useNavigate();
    const [activeNotification, setActiveNotification] = useState<OrderWithItems | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const channelNameRef = useRef(`global-warehouse-notifier-${Math.random().toString(36).slice(2)}`);

    useEffect(() => {
        // Preload audio
        audioRef.current = new Audio(NOTIFICATION_SOUND_URL);
        audioRef.current.load();
    }, []);

    const playNotificationSound = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(err => {
                console.warn('[GlobalOrderListener] Audio playback blocked by browser:', err);
                // Browsers often block autoplay until the first user interaction.
                // This is expected in a web app if the user hasn't clicked anything yet.
            });
        }
    }, []);

    useEffect(() => {
        if (!supabase) return;

        // Helper: fetch full order details and show notification overlay
        const showOrderNotification = async (orderId: string) => {
            try {
                const { data, error } = await supabase
                    .from('orders')
                    .select(`
                        *,
                        order_items (
                            id, product_id, size, rental_price, individual_id,
                            products (id, name, images)
                        ),
                        addresses:delivery_address_id (full_address, latitude, longitude)
                    `)
                    .eq('id', orderId)
                    .single();

                if (!error && data) {
                    setActiveNotification(data as OrderWithItems);
                }
            } catch {
                // Silently fail — warehouse can refresh manually
            }
            playNotificationSound();
        };

        const channel = supabase
            .channel(channelNameRef.current)
            // COD orders: arrive as INSERT with status='confirmed'
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'orders',
                },
                async (payload) => {
                    const rawOrder = payload.new as OrderWithItems;
                    // Only show notification for confirmed orders (COD).
                    // Online payment orders start as 'pending_payment' and
                    // should NOT trigger warehouse notification until paid.
                    if (rawOrder.status === 'confirmed') {
                        console.log('[GlobalOrderListener] New confirmed (COD) order:', rawOrder.id);
                        await showOrderNotification(rawOrder.id);
                    } else {
                        console.log(`[GlobalOrderListener] Skipping INSERT with status=${rawOrder.status}:`, rawOrder.id);
                    }
                }
            )
            // Online payment orders: arrive as UPDATE from pending_payment → confirmed
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'orders',
                },
                async (payload) => {
                    const oldOrder = payload.old as Partial<OrderWithItems>;
                    const newOrder = payload.new as OrderWithItems;
                    // Notify warehouse when online payment is verified
                    if (
                        (oldOrder.status === 'pending_payment' || oldOrder.status === 'pending') &&
                        newOrder.status === 'confirmed'
                    ) {
                        console.log('[GlobalOrderListener] Online payment confirmed:', newOrder.id);
                        await showOrderNotification(newOrder.id);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [playNotificationSound]);

    const handleViewOrder = () => {
        if (activeNotification) {
            // Navigate to Order Fulfillment page (filtered to pending/new by default)
            navigate('/orders');
            setActiveNotification(null);
        }
    };

    return (
        <AnimatePresence>
            {activeNotification && (
                <NewOrderOverlay
                    order={activeNotification}
                    onClose={() => setActiveNotification(null)}
                    onView={handleViewOrder}
                />
            )}
        </AnimatePresence>
    );
}
