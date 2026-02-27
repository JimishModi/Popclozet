// src/components/NotificationBell.tsx
// Notification bell with unread count badge and dropdown panel (RLS-safe)

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, Check } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';
import type { Notification } from '@/services/notificationService';

interface NotificationBellProps {
    className?: string;
}

export function NotificationBell({ className = '' }: NotificationBellProps) {
    const [isOpen, setIsOpen] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);
    const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications({
        limit: 10,
        autoSubscribe: true,
    });

    // Close panel when clicking outside
    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const handleNotificationClick = (notificationId: string) => {
        markAsRead(notificationId);
    };

    const handleMarkAllRead = () => {
        markAllAsRead();
    };

    return (
        <div ref={panelRef} className={`relative ${className}`}>
            {/* Bell Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 rounded-full hover:bg-white/10 transition-colors"
            >
                <Bell className="w-5 h-5 text-white" />

                {/* Unread Badge */}
                {unreadCount > 0 && (
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-1 -right-1 w-5 h-5 bg-[#ff4d6d] rounded-full flex items-center justify-center"
                    >
                        <span className="text-[10px] font-bold text-white">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    </motion.div>
                )}
            </button>

            {/* Notification Panel */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-full mt-2 w-80 max-h-96 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden z-50"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
                            <h3 className="text-sm font-semibold text-white">Notifications</h3>
                            <div className="flex items-center gap-2">
                                {unreadCount > 0 && (
                                    <button
                                        onClick={handleMarkAllRead}
                                        className="text-xs text-[#ff4d6d] hover:text-[#ff3d5d] font-medium"
                                    >
                                        Mark all read
                                    </button>
                                )}
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-1 hover:bg-white/10 rounded"
                                >
                                    <X className="w-4 h-4 text-zinc-400" />
                                </button>
                            </div>
                        </div>

                        {/* Notifications List */}
                        <div className="overflow-y-auto max-h-80">
                            {notifications.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                                    <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mb-3">
                                        <Bell className="w-6 h-6 text-zinc-600" />
                                    </div>
                                    <p className="text-sm text-zinc-400">No notifications yet</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-zinc-800">
                                    {notifications.map((notification) => (
                                        <button
                                            key={notification.id}
                                            onClick={() => handleNotificationClick(notification.id)}
                                            className={`w-full px-4 py-3 text-left hover:bg-white/5 transition-colors ${!notification.is_read ? 'bg-[#ff4d6d]/5' : ''
                                                }`}
                                        >
                                            <div className="flex items-start gap-3">
                                                {/* Icon */}
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${!notification.is_read ? 'bg-[#ff4d6d]/20' : 'bg-zinc-800'
                                                    }`}>
                                                    {getNotificationIcon(notification.type)}
                                                </div>

                                                {/* Content */}
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-sm font-medium mb-0.5 ${!notification.is_read ? 'text-white' : 'text-zinc-300'
                                                        }`}>
                                                        {notification.title}
                                                    </p>
                                                    <p className="text-xs text-zinc-400 line-clamp-2">
                                                        {notification.message}
                                                    </p>
                                                    <p className="text-xs text-zinc-500 mt-1">
                                                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                                                    </p>
                                                </div>

                                                {/* Unread Indicator */}
                                                {!notification.is_read && (
                                                    <div className="w-2 h-2 rounded-full bg-[#ff4d6d] flex-shrink-0 mt-1.5" />
                                                )}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// Helper to get icon for notification type
function getNotificationIcon(type: string) {
    const iconClass = "w-4 h-4";

    switch (type) {
        case 'order_confirmed':
            return <Check className={`${iconClass} text-green-400`} />;
        case 'out_for_delivery':
            return <span className="text-sm">🚗</span>;
        case 'delivered':
            return <Check className={`${iconClass} text-green-400`} />;
        case 'pickup_scheduled':
        case 'return_scheduled':
            return <span className="text-sm">📦</span>;
        default:
            return <Bell className={`${iconClass} text-zinc-400`} />;
    }
}

export default NotificationBell;
