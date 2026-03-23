// src/components/NotificationCenter.tsx
// Notification bell with dropdown and real-time updates (RLS-safe)

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, Check, Package, Truck, RotateCcw, MessageCircle, MapPin } from 'lucide-react';
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

interface NotificationCenterProps {
    className?: string;
}

const NOTIFICATION_ICONS: Record<string, React.ReactNode> = {
    order_confirmed: <Package className="w-4 h-4" />,
    order_picked_up: <Package className="w-4 h-4" />,
    order_dispatched: <Truck className="w-4 h-4" />,
    out_for_delivery: <Truck className="w-4 h-4" />,
    rider_message: <MessageCircle className="w-4 h-4" />,
    delivered: <Check className="w-4 h-4" />,
    pickup_scheduled: <Package className="w-4 h-4" />,
    pickup_completed: <Check className="w-4 h-4" />,
    return_scheduled: <RotateCcw className="w-4 h-4" />,
    return_completed: <Check className="w-4 h-4" />,
    general: <Bell className="w-4 h-4" />,
};

export function NotificationCenter({ className }: NotificationCenterProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const channelRef = useRef<RealtimeChannel | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Load notifications (RLS filters by authenticated user)
    useEffect(() => {
        async function loadNotifications() {
            try {
                const [notifs, count] = await Promise.all([
                    getNotifications(),
                    getUnreadCount(),
                ]);
                setNotifications(notifs);
                setUnreadCount(count);
            } finally {
                setIsLoading(false);
            }
        }

        loadNotifications();
    }, []);

    // Subscribe to real-time updates
    useEffect(() => {
        let cancelled = false;

        (async () => {
            const channel = await subscribeToNotifications((newNotif) => {
                setNotifications((prev) => [newNotif, ...prev]);
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
            }
        };
    }, []);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleMarkAsRead = async (notifId: string) => {
        const success = await markAsRead(notifId);
        if (success) {
            setNotifications((prev) =>
                prev.map((n) => (n.id === notifId ? { ...n, is_read: true } : n))
            );
            setUnreadCount((prev) => Math.max(0, prev - 1));
        }
    };

    const handleMarkAllAsRead = async () => {
        await markAllAsRead();
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
        setUnreadCount(0);
    };

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        return `${diffDays}d ago`;
    };

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            {/* Bell button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 rounded-full hover:bg-white/10 transition-colors"
            >
                <Bell className="w-5 h-5 text-zinc-300" />

                {/* Unread badge */}
                {unreadCount > 0 && (
                    <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-[#f2546d] text-white text-[10px] font-bold rounded-full flex items-center justify-center"
                    >
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </motion.span>
                )}
            </button>

            {/* Dropdown */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-full mt-2 w-80 max-h-[70vh] bg-zinc-900 border border-zinc-800 rounded-2xl shadow-xl overflow-hidden z-50"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                            <h3 className="font-semibold text-white">Notifications</h3>
                            <div className="flex items-center gap-2">
                                {unreadCount > 0 && (
                                    <button
                                        onClick={handleMarkAllAsRead}
                                        className="text-xs text-[#f2546d] hover:underline"
                                    >
                                        Mark all read
                                    </button>
                                )}
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-1 rounded-full hover:bg-zinc-800"
                                >
                                    <X className="w-4 h-4 text-zinc-400" />
                                </button>
                            </div>
                        </div>

                        {/* Notifications list */}
                        <div className="max-h-[50vh] overflow-y-auto">
                            {isLoading ? (
                                <div className="flex items-center justify-center py-8">
                                    <div className="w-6 h-6 border-2 border-[#f2546d] border-t-transparent rounded-full animate-spin" />
                                </div>
                            ) : notifications.length === 0 ? (
                                <div className="text-center py-8">
                                    <Bell className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                                    <p className="text-sm text-zinc-500">No notifications yet</p>
                                </div>
                            ) : (
                                notifications.map((notif) => (
                                    <button
                                        key={notif.id}
                                        onClick={() => !notif.is_read && handleMarkAsRead(notif.id)}
                                        className={`w-full text-left p-4 border-b border-zinc-800/50 hover:bg-zinc-800/50 transition-colors ${!notif.is_read ? 'bg-[#f2546d]/5' : ''
                                            }`}
                                    >
                                        <div className="flex gap-3">
                                            {/* Icon */}
                                            <div
                                                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${!notif.is_read
                                                    ? 'bg-[#f2546d] text-white'
                                                    : 'bg-zinc-800 text-zinc-400'
                                                    }`}
                                            >
                                                {NOTIFICATION_ICONS[notif.type] || <Bell className="w-4 h-4" />}
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm font-medium ${!notif.is_read ? 'text-white' : 'text-zinc-300'}`}>
                                                    {notif.title}
                                                </p>
                                                <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">
                                                    {notif.message}
                                                </p>
                                                <p className="text-[10px] text-zinc-600 mt-1">
                                                    {formatTime(notif.created_at)}
                                                </p>
                                            </div>

                                            {/* Unread indicator */}
                                            {!notif.is_read && (
                                                <div className="w-2 h-2 rounded-full bg-[#f2546d] flex-shrink-0 mt-2" />
                                            )}
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default NotificationCenter;
