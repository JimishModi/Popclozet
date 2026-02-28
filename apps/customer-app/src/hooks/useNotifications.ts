// src/hooks/useNotifications.ts
// Hook for managing notifications with real-time updates (RLS-safe)

import { useState, useEffect, useCallback, useRef } from 'react';
import {
    Notification,
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    subscribeToNotifications,
    unsubscribeFromNotifications,
} from '@/services/notificationService';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface UseNotificationsOptions {
    limit?: number;
    autoSubscribe?: boolean;
}

export function useNotifications({
    limit = 20,
    autoSubscribe = true,
}: UseNotificationsOptions = {}) {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const channelRef = useRef<RealtimeChannel | null>(null);

    // Fetch notifications (RLS filters by authenticated user automatically)
    const fetchNotifications = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const [notifs, count] = await Promise.all([
                getNotifications(limit),
                getUnreadCount(),
            ]);
            setNotifications(notifs);
            setUnreadCount(count);
        } catch (err) {
            setError(err as Error);
        } finally {
            setIsLoading(false);
        }
    }, [limit]);

    // Initial fetch
    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    // Real-time subscription
    useEffect(() => {
        if (!autoSubscribe) return;

        let cancelled = false;

        (async () => {
            const channel = await subscribeToNotifications((newNotif) => {
                setNotifications((prev) => [newNotif, ...prev].slice(0, limit));
                setUnreadCount((prev) => prev + 1);
            });

            if (cancelled) {
                if (channel) unsubscribeFromNotifications(channel);
                return;
            }

            channelRef.current = channel;
        })();

        return () => {
            cancelled = true;
            if (channelRef.current) {
                unsubscribeFromNotifications(channelRef.current);
                channelRef.current = null;
            }
        };
    }, [autoSubscribe, limit]);

    // Mark single notification as read
    const handleMarkAsRead = useCallback(async (notificationId: string) => {
        const success = await markAsRead(notificationId);
        if (success) {
            setNotifications((prev) =>
                prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
            );
            setUnreadCount((prev) => Math.max(0, prev - 1));
        }
        return success;
    }, []);

    // Mark all as read (RLS-safe, no userId needed)
    const handleMarkAllAsRead = useCallback(async () => {
        await markAllAsRead();
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
        setUnreadCount(0);
        return true;
    }, []);

    // Clear local state
    const clearNotifications = useCallback(() => {
        setNotifications([]);
        setUnreadCount(0);
    }, []);

    return {
        notifications,
        unreadCount,
        isLoading,
        error,
        hasUnread: unreadCount > 0,
        markAsRead: handleMarkAsRead,
        markAllAsRead: handleMarkAllAsRead,
        refresh: fetchNotifications,
        clear: clearNotifications,
    };
}

export default useNotifications;
