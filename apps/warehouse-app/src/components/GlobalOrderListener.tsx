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
                    console.log('[GlobalOrderListener] New order received:', payload.new);
                    const newOrder = payload.new as OrderWithItems;
                    
                    // Show full-screen notification
                    setActiveNotification(newOrder);
                    
                    // Play sound
                    playNotificationSound();
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
