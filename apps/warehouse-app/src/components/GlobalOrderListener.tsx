import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@popclozet/api-client';
import { NewOrderOverlay } from './NewOrderOverlay';
import { NewReturnOverlay } from './NewReturnOverlay';
import type { OrderWithItems } from '../services/fulfillmentService';
import { AnimatePresence, motion } from 'framer-motion';
import {
    Truck, MapPin, Package, Navigation, CheckCircle,
    RotateCcw, XCircle, X, ShieldAlert,
} from 'lucide-react';

// Reliable notification chime sound
const NOTIFICATION_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';

// ─── Activity Toast config ─────────────────────────────────────────────────────

interface ActivityToastData {
    id: string;
    title: string;
    subtitle: string;
    icon: React.ElementType;
    color: string;       // tailwind bg class e.g. 'bg-blue-500'
    borderColor: string;  // tailwind border class
}

const TOAST_DISMISS_MS = 5_000;

/**
 * Map of new status → toast config.
 * Only statuses listed here will trigger an activity toast.
 * New order (confirmed) and new return request are handled by the existing overlay cards.
 */
const STATUS_TOAST_CONFIG: Record<string, {
    title: string;
    icon: React.ElementType;
    color: string;
    borderColor: string;
}> = {
    rider_assigned: {
        title: '🏍️ Rider Assigned',
        icon: Truck,
        color: 'bg-blue-500/15 text-blue-400',
        borderColor: 'border-blue-500/30',
    },
    driver_arrived_warehouse: {
        title: '🏬 Rider at Warehouse',
        icon: MapPin,
        color: 'bg-amber-500/15 text-amber-400',
        borderColor: 'border-amber-500/30',
    },
    order_picked_up: {
        title: '📦 Order Picked Up',
        icon: Package,
        color: 'bg-blue-500/15 text-blue-400',
        borderColor: 'border-blue-500/30',
    },
    dispatched: {
        title: '🚗 Order Dispatched',
        icon: Navigation,
        color: 'bg-indigo-500/15 text-indigo-400',
        borderColor: 'border-indigo-500/30',
    },
    out_for_delivery: {
        title: '🚗 Out for Delivery',
        icon: Navigation,
        color: 'bg-indigo-500/15 text-indigo-400',
        borderColor: 'border-indigo-500/30',
    },
    delivered: {
        title: '✅ Order Delivered',
        icon: CheckCircle,
        color: 'bg-emerald-500/15 text-emerald-400',
        borderColor: 'border-emerald-500/30',
    },
    return_scheduled: {
        title: '🔄 Return Scheduled',
        icon: RotateCcw,
        color: 'bg-amber-500/15 text-amber-400',
        borderColor: 'border-amber-500/30',
    },
    return_dispatched: {
        title: '🏍️ Return Rider Dispatched',
        icon: Truck,
        color: 'bg-amber-500/15 text-amber-400',
        borderColor: 'border-amber-500/30',
    },
    return_picked_up: {
        title: '📦 Return Collected',
        icon: Package,
        color: 'bg-amber-500/15 text-amber-400',
        borderColor: 'border-amber-500/30',
    },
    return_at_warehouse: {
        title: '🏬 Return at Warehouse',
        icon: MapPin,
        color: 'bg-emerald-500/15 text-emerald-400',
        borderColor: 'border-emerald-500/30',
    },
    returned: {
        title: '✅ Return Completed',
        icon: CheckCircle,
        color: 'bg-emerald-500/15 text-emerald-400',
        borderColor: 'border-emerald-500/30',
    },
    return_completed: {
        title: '✅ Return Completed',
        icon: CheckCircle,
        color: 'bg-emerald-500/15 text-emerald-400',
        borderColor: 'border-emerald-500/30',
    },
    cancelled: {
        title: '❌ Order Cancelled',
        icon: XCircle,
        color: 'bg-red-500/15 text-red-400',
        borderColor: 'border-red-500/30',
    },
};

// ─── ActivityToast Component ────────────────────────────────────────────────────

function ActivityToast({ toast, onDismiss }: { toast: ActivityToastData; onDismiss: (id: string) => void }) {
    const Icon = toast.icon;

    useEffect(() => {
        const timer = setTimeout(() => onDismiss(toast.id), TOAST_DISMISS_MS);
        return () => clearTimeout(timer);
    }, [toast.id, onDismiss]);

    return (
        <motion.div
            layout
            initial={{ x: 320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 320, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border bg-zinc-900 shadow-xl ${toast.borderColor}`}
        >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${toast.color}`}>
                <Icon size={18} />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-semibold leading-tight">{toast.title}</p>
                <p className="text-zinc-500 text-xs mt-0.5 truncate">{toast.subtitle}</p>
            </div>
            <button onClick={() => onDismiss(toast.id)} className="text-zinc-600 hover:text-white shrink-0 p-0.5">
                <X size={14} />
            </button>
        </motion.div>
    );
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export function GlobalOrderListener() {
    const navigate = useNavigate();
    const [activeNotification, setActiveNotification] = useState<OrderWithItems | null>(null);
    const [activeReturnNotification, setActiveReturnNotification] = useState<any>(null);
    const [activityToasts, setActivityToasts] = useState<ActivityToastData[]>([]);
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
            });
        }
    }, []);

    const dismissToast = useCallback((id: string) => {
        setActivityToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const pushActivityToast = useCallback((data: Omit<ActivityToastData, 'id'>) => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        setActivityToasts(prev => {
            // Keep max 5 toasts to avoid screen flooding
            const next = [...prev, { ...data, id }];
            return next.length > 5 ? next.slice(-5) : next;
        });
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

        const showReturnNotification = async (requestId: string) => {
            try {
                const { data, error } = await supabase
                    .from('return_requests')
                    .select(`
                        *,
                        addresses:pickup_address_id (full_address, latitude, longitude)
                    `)
                    .eq('id', requestId)
                    .single();

                if (!error && data) {
                    setActiveReturnNotification(data);
                }
            } catch {
                // Silently fail
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
            // Order status updates — comprehensive handler
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
                    const oldStatus = oldOrder.status;
                    const newStatus = newOrder.status;

                    // Skip if status didn't change
                    if (oldStatus === newStatus) return;

                    // 1. Primary event: new order confirmed (online payment)
                    //    → Show full overlay card (existing behavior)
                    if (
                        (oldStatus === 'pending_payment' || oldStatus === 'pending') &&
                        newStatus === 'confirmed'
                    ) {
                        console.log('[GlobalOrderListener] Online payment confirmed:', newOrder.id);
                        await showOrderNotification(newOrder.id);
                        return;
                    }

                    // 2. Activity toast for all other tracked status transitions
                    const toastConfig = STATUS_TOAST_CONFIG[newStatus as string];
                    if (toastConfig) {
                        const orderId = newOrder.id as string;
                        const shortId = orderId.slice(0, 8).toUpperCase();
                        console.log(`[GlobalOrderListener] Activity: ${oldStatus} → ${newStatus} for #${shortId}`);

                        pushActivityToast({
                            title: toastConfig.title,
                            subtitle: `Order #${shortId}`,
                            icon: toastConfig.icon,
                            color: toastConfig.color,
                            borderColor: toastConfig.borderColor,
                        });
                        playNotificationSound();
                    }
                }
            )
            // Return requests: arrive as INSERT
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'return_requests',
                },
                async (payload) => {
                    console.log('[GlobalOrderListener] New return request:', payload.new.id);
                    await showReturnNotification(payload.new.id);
                }
            )
            // Manual KYC reviews: arrive as INSERT
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'manual_kyc_reviews',
                },
                async (payload) => {
                    const reviewId = payload.new.id;
                    const shortId = reviewId.slice(0, 8).toUpperCase();
                    console.log('[GlobalOrderListener] New manual KYC review:', reviewId);
                    
                    pushActivityToast({
                        title: '🛡️ Identity Verification',
                        subtitle: `Manual review needed #${shortId}`,
                        icon: ShieldAlert,
                        color: 'bg-orange-500/15 text-orange-400',
                        borderColor: 'border-orange-500/30',
                    });
                    playNotificationSound();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [playNotificationSound, pushActivityToast]);

    const handleViewOrder = () => {
        if (activeNotification) {
            navigate('/orders');
            setActiveNotification(null);
        }
    };

    const handleViewReturn = () => {
        if (activeReturnNotification) {
            navigate('/returns');
            setActiveReturnNotification(null);
        }
    };

    return (
        <>
            {/* Existing full-card overlays for primary events */}
            <AnimatePresence>
                {activeNotification && (
                    <NewOrderOverlay
                        order={activeNotification}
                        onClose={() => setActiveNotification(null)}
                        onView={handleViewOrder}
                    />
                )}
                {activeReturnNotification && (
                    <NewReturnOverlay
                        returnData={activeReturnNotification}
                        onClose={() => setActiveReturnNotification(null)}
                        onView={handleViewReturn}
                    />
                )}
            </AnimatePresence>

            {/* Activity toast stack — top-right, non-blocking */}
            <div className="fixed top-4 right-4 z-[998] flex flex-col gap-2 w-80 pointer-events-auto">
                <AnimatePresence mode="popLayout">
                    {activityToasts.map(toast => (
                        <ActivityToast key={toast.id} toast={toast} onDismiss={dismissToast} />
                    ))}
                </AnimatePresence>
            </div>
        </>
    );
}
