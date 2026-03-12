/**
 * Notifications Page
 * 
 * In-app notification list
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@popclozet/auth';
import { ArrowLeft, Check, Trash2, Bell, Package, IndianRupee, Gift, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';

import {
    getNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    formatNotificationTime,
    type RiderNotification
} from '../services/notificationsService';

const notificationIcons = {
    order: Package,
    payment: IndianRupee,
    bonus: Gift,
    promotion: Gift,
    system: AlertCircle,
};

const notificationColors = {
    order: 'bg-blue-500/10 text-blue-500',
    payment: 'bg-green-500/10 text-green-500',
    bonus: 'bg-amber-500/10 text-amber-500',
    promotion: 'bg-purple-500/10 text-purple-500',
    system: 'bg-zinc-500/10 text-zinc-500',
};

export function NotificationsPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<RiderNotification[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (user?.id) {
            getNotifications(user.id).then((data) => {
                setNotifications(data);
                setIsLoading(false);
            });
        }
    }, [user?.id]);

    const handleMarkAsRead = async (id: string) => {
        await markAsRead(id);
        setNotifications(prev =>
            prev.map(n => n.id === id ? { ...n, isRead: true } : n)
        );
    };

    const handleMarkAllAsRead = async () => {
        if (!user?.id) return;
        await markAllAsRead(user.id);
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    };

    const handleDelete = async (id: string) => {
        await deleteNotification(id);
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    const unreadCount = notifications.filter(n => !n.isRead).length;

    return (
        <div className="min-h-screen bg-[#0a0a0a]">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-zinc-800/50">
                <div className="flex items-center justify-between px-4 h-16">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate(-1)}
                            className="p-2 -ml-2 text-zinc-400 hover:text-white transition-colors"
                        >
                            <ArrowLeft size={24} />
                        </button>
                        <h1 className="text-lg font-semibold text-white">Notifications</h1>
                    </div>

                    {unreadCount > 0 && (
                        <button
                            onClick={handleMarkAllAsRead}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-blue-500 hover:bg-blue-500/10 transition-colors"
                        >
                            <Check size={16} />
                            Mark all read
                        </button>
                    )}
                </div>
            </header>

            <main className="px-4 py-4">
                {isLoading ? (
                    // Loading skeleton
                    <div className="space-y-3">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="flex items-start gap-4 p-4 rounded-xl bg-zinc-900 animate-pulse">
                                <div className="w-10 h-10 rounded-full bg-zinc-800" />
                                <div className="flex-1">
                                    <div className="h-4 w-32 bg-zinc-800 rounded mb-2" />
                                    <div className="h-3 w-48 bg-zinc-800 rounded mb-2" />
                                    <div className="h-3 w-16 bg-zinc-800 rounded" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : notifications.length === 0 ? (
                    // Empty state
                    <div className="text-center py-16">
                        <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-4">
                            <Bell size={32} className="text-zinc-600" />
                        </div>
                        <h3 className="text-white font-medium mb-1">No notifications</h3>
                        <p className="text-zinc-500 text-sm">You're all caught up!</p>
                    </div>
                ) : (
                    <AnimatePresence>
                        <div className="space-y-3">
                            {notifications.map((notification, index) => {
                                const Icon = notificationIcons[notification.type];
                                const colorClass = notificationColors[notification.type];

                                return (
                                    <motion.div
                                        key={notification.id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 20 }}
                                        transition={{ delay: index * 0.05 }}
                                        onClick={() => !notification.isRead && handleMarkAsRead(notification.id)}
                                        className={clsx(
                                            "relative flex items-start gap-4 p-4 rounded-xl",
                                            "bg-zinc-900 border transition-colors cursor-pointer",
                                            notification.isRead
                                                ? "border-zinc-800"
                                                : "border-blue-500/30 bg-blue-500/5"
                                        )}
                                    >
                                        {/* Unread indicator */}
                                        {!notification.isRead && (
                                            <div className="absolute top-4 left-2 w-2 h-2 rounded-full bg-blue-500" />
                                        )}

                                        {/* Icon */}
                                        <div className={clsx(
                                            "w-10 h-10 rounded-full flex items-center justify-center",
                                            colorClass
                                        )}>
                                            <Icon size={20} />
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-white font-medium">{notification.title}</h4>
                                            <p className="text-sm text-zinc-400 mt-0.5 line-clamp-2">
                                                {notification.message}
                                            </p>
                                            <p className="text-xs text-zinc-600 mt-2">
                                                {formatNotificationTime(notification.createdAt)}
                                            </p>
                                        </div>

                                        {/* Delete button */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDelete(notification.id);
                                            }}
                                            className="p-2 text-zinc-600 hover:text-red-500 transition-colors"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </AnimatePresence>
                )}
            </main>
        </div>
    );
}

export default NotificationsPage;
