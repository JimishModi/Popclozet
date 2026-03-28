/**
 * Home Page (Dashboard)
 *
 * Main rider dashboard with earnings, online toggle, and real-time order popups.
 *
 * Fixes applied:
 * 1. Removed delivery_tracking insert (table doesn't exist — was swallowed silently)
 * 2. Replaced inline supabase.rpc('claim_order') with claimOrder() service wrapper
 *    so already_claimed is detected and handled correctly
 * 3. Fixed stale closure in polling: replaced interval ref with a stable callback ref
 * 4. Added user?.id to the subscription effect's dep array
 * 5. Extracted fetchPendingOrder into a stable useCallback so both the effect and
 *    the polling share the exact same code path
 * 6. pendingOrder null-guard added before all async calls
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@popclozet/auth';
import { Zap, Bell, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';

import { StatusToggle } from '../components/StatusToggle';
import { EarningsCard, BonusCard } from '../components/EarningsCard';
import { OrderCard } from '../components/OrderCard';
import { SwipeToAccept } from '../components/SwipeToAccept';
import { BottomNavigation } from '../components/BottomNavigation';
import { RiderShell } from '../components/layout/RiderShell';
import { useToast } from '../contexts/ToastContext';

import { getEarningsSummary, type EarningsSummary } from '../services/walletService';
import { updateRiderStatus } from '../services/riderProfileService';
import { getUnreadCount } from '../services/notificationsService';
import {
    claimOrder,
    declineOrderNotification,
} from '../services/riderOrderService';
import { supabase } from '@popclozet/api-client';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ─── Types ────────────────────────────────────────────────────────────────────

interface IncomingOrder {
    id: string;
    notificationId: string;   // needed for decline
    source: 'assigned' | 'notification' | 'direct';
    workflowStatus: string;
    orderType: 'delivery' | 'pickup' | 'return';
    pickup: { name: string; address: string };
    dropoff: { name: string; address: string };
    customerName: string;
    itemCount: number;
    earnings: number;
    distance: string;
    duration: string;
    totalAmount?: number;
}

// ─── Mapper ───────────────────────────────────────────────────────────────────

const ORDER_SELECT = '*, addresses:delivery_address_id(full_address, latitude, longitude), order_items(id)';
const ASSIGNED_ORDER_STATUSES = [
    'rider_assigned',
    'ready_for_pickup',
    'driver_arrived_warehouse',
    'order_picked_up',
    'dispatched',
    'out_for_delivery',
    'return_scheduled',
    'return_dispatched',
    'return_picked_up',
] as const;

function getIncomingOrderCardStatus(order: IncomingOrder): 'pending' | 'accepted' | 'picked_up' | 'delivering' {
    if (order.source !== 'assigned') return 'pending';

    if (['order_picked_up', 'dispatched'].includes(order.workflowStatus)) {
        return 'picked_up';
    }

    if (['out_for_delivery', 'return_scheduled', 'return_dispatched', 'return_picked_up'].includes(order.workflowStatus)) {
        return 'delivering';
    }

    return 'accepted';
}

function getAssignedOrderRoute(order: IncomingOrder): string {
    // return_picked_up = rider has collected from customer, next step is warehouse drop-off
    if (order.workflowStatus === 'return_picked_up') {
        return `/warehouse/${order.id}`;
    }
    if (order.orderType === 'return' || ['out_for_delivery', 'return_scheduled', 'return_dispatched'].includes(order.workflowStatus)) {
        return `/delivery/${order.id}`;
    }

    return `/warehouse/${order.id}`;
}

function getAssignedActionLabel(order: IncomingOrder): string {
    if (order.workflowStatus === 'return_picked_up') return 'Drop off at Warehouse';
    if (order.orderType === 'return') return 'Open Return Pickup';
    if (order.workflowStatus === 'out_for_delivery') return 'Open Delivery';
    return 'Open Warehouse Pickup';
}

function mapDbOrderToIncoming(
    dbOrder: any,
    notificationId: string,
    source: IncomingOrder['source'],
): IncomingOrder {
    const addr = dbOrder.addresses;
    const fullAddr = addr?.full_address ?? 'Customer Address';
    const itemCount = Array.isArray(dbOrder.order_items)
        ? dbOrder.order_items.reduce((s: number, i: any) => s + (i.quantity || 1), 0)
        : 1;
    const estimatedKm = dbOrder.route_distance_km ?? 3;
    const etaMinutes = dbOrder.delivery_eta
        ? Math.max(1, Math.round((new Date(dbOrder.delivery_eta).getTime() - Date.now()) / 60000))
        : Math.round(estimatedKm * 3);
    const isReturn = ['return_scheduled', 'return_dispatched', 'return_picked_up'].includes(dbOrder.status);

    return {
        id: dbOrder.id,
        notificationId,
        source,
        workflowStatus: dbOrder.status ?? 'ready_for_pickup',
        orderType: isReturn
            ? 'return'
            : (dbOrder.order_type === 'pickup' || dbOrder.order_type === 'return' ? 'pickup' : 'delivery'),
        pickup: isReturn
            ? { name: 'Customer Pickup', address: fullAddr }
            : { name: 'popclozet Warehouse', address: 'Near IIT Main Gate, Powai' },
        dropoff: isReturn
            ? { name: 'Warehouse Drop-off', address: 'Near IIT Main Gate, Powai' }
            : { name: 'Customer', address: fullAddr },
        customerName: 'Customer',
        itemCount,
        earnings: dbOrder.delivery_fee > 0
            ? dbOrder.delivery_fee
            : Math.round((dbOrder.total_amount ?? 0) * 0.15),
        distance: `${estimatedKm.toFixed(1)} km`,
        duration: `${etaMinutes} mins`,
        totalAmount: dbOrder.total_amount,
    };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function HomePage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { showToast } = useToast();

    const [isOnline, setIsOnline] = useState(() =>
        localStorage.getItem('rider_is_online') === 'true',
    );
    const [isSearching, setIsSearching] = useState(false);
    const [pendingOrder, setPendingOrder] = useState<IncomingOrder | null>(null);
    const [earnings, setEarnings] = useState<EarningsSummary | null>(null);
    const [unreadNotifications, setUnread] = useState(0);
    const [isLoading, setIsLoading] = useState(false);

    const channelRef = useRef<RealtimeChannel | null>(null);
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const dismissedDirectOrderIdsRef = useRef<Set<string>>(new Set());

    // ── Stable fetch: single source of truth for "what order am I showing?" ──
    //
    // Fix 3 + 6: extracted so both initial load and polling use the same path.
    // useCallback with [user?.id] so it's only recreated when the user changes.

    const fetchPendingOrder = useCallback(async () => {
        if (!user?.id) return;
        try {
            const { data: assignedOrders, error: assignedError } = await supabase
                .from('orders')
                .select(ORDER_SELECT)
                .eq('rider_id', user.id)
                .in('status', [...ASSIGNED_ORDER_STATUSES])
                .order('updated_at', { ascending: false })
                .limit(1);

            if (assignedError) {
                console.error('[HomePage] fetchAssignedOrders:', assignedError);
            }

            if (assignedOrders?.length) {
                setPendingOrder(
                    mapDbOrderToIncoming(assignedOrders[0], `assigned:${assignedOrders[0].id}`, 'assigned'),
                );
                return;
            }

            const { data: notifs } = await supabase
                .from('rider_notifications')
                .select('id, order_id')
                .eq('rider_id', user.id)
                .eq('status', 'pending')
                .order('created_at', { ascending: false })
                .limit(1);

            if (!notifs?.length) {
                // Get order IDs this rider has already declined (persisted)
                const { data: declinedNotifs } = await supabase
                    .from('rider_notifications')
                    .select('order_id')
                    .eq('rider_id', user.id)
                    .eq('status', 'declined');

                const declinedOrderIds = new Set(
                    (declinedNotifs ?? []).map((n: any) => n.order_id)
                );

                const { data: availableOrders, error: availableError } = await supabase
                    .from('orders')
                    .select(ORDER_SELECT)
                    .is('rider_id', null)
                    .in('status', ['ready_for_pickup', 'return_scheduled'])
                    .order('updated_at', { ascending: false })
                    .limit(10);

                if (availableError) {
                    console.error('[HomePage] fetchAvailableOrders:', availableError);
                    setPendingOrder(null);
                    return;
                }

                const nextDirectOrder = (availableOrders ?? []).find(
                    (order: any) =>
                        !dismissedDirectOrderIdsRef.current.has(order.id) &&
                        !declinedOrderIds.has(order.id),
                );

                if (nextDirectOrder) {
                    setPendingOrder(
                        mapDbOrderToIncoming(nextDirectOrder, `direct:${nextDirectOrder.id}`, 'direct'),
                    );
                } else {
                    setPendingOrder(null);
                }
                return;
            }

            const notif = notifs[0];
            const { data: orderData } = await supabase
                .from('orders')
                .select(ORDER_SELECT)
                .eq('id', notif.order_id)
                .single();

            if (orderData) {
                setPendingOrder(mapDbOrderToIncoming(orderData, notif.id, 'notification'));
            } else {
                setPendingOrder(null);
            }
        } catch (err) {
            console.error('[HomePage] fetchPendingOrder:', err);
        }
    }, [user?.id]);

    // ── Load earnings + unread count ──────────────────────────────────────────

    useEffect(() => {
        if (!user?.id) return;
        getEarningsSummary(user.id).then(setEarnings);
        getUnreadCount(user.id).then(setUnread);
    }, [user?.id]);

    // ── Realtime subscription + polling when online ────────────────────────────
    //
    // Fix 4: added user?.id to dep array so the subscription starts correctly
    // when a user loads after isOnline is already true.

    useEffect(() => {
        if (!isOnline || !user?.id) return;

        setIsSearching(true);

        // Initial load
        fetchPendingOrder().finally(() => setIsSearching(false));

        // Realtime subscription on rider_notifications
        const channel = supabase
            .channel(`rider-notifs-${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'rider_notifications',
                    filter: `rider_id=eq.${user.id}`,
                },
                async (payload) => {
                    if (payload.eventType === 'DELETE') {
                        // Another rider claimed the order — re-fetch to get next one
                        setPendingOrder((curr) => {
                            const old = payload.old as any;
                            if (curr?.notificationId === old?.id || curr?.id === old?.order_id) {
                                fetchPendingOrder();
                                return null;
                            }
                            return curr;
                        });
                        return;
                    }

                    const n = payload.new as any;

                    if (n.status !== 'pending') {
                        // Declined or otherwise dismissed
                        setPendingOrder((curr) => {
                            if (curr?.notificationId === n.id) {
                                fetchPendingOrder();
                                return null;
                            }
                            return curr;
                        });
                        return;
                    }

                    // New pending notification — fetch the order and show it
                    const { data: orderData } = await supabase
                        .from('orders')
                        .select(ORDER_SELECT)
                        .eq('id', n.order_id)
                        .single();

                    if (orderData) {
                        setPendingOrder(mapDbOrderToIncoming(orderData, n.id, 'notification'));
                        setIsSearching(false);
                    }
                },
            )
            .subscribe();

        const assignedOrdersChannel = supabase
            .channel(`rider-orders-${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'orders',
                    filter: `rider_id=eq.${user.id}`,
                },
                () => {
                    void fetchPendingOrder();
                },
            )
            .subscribe();

        channelRef.current = channel;

        // Fix 2: polling uses the stable fetchPendingOrder callback.
        // The interval closure no longer captures stale pendingOrder state —
        // fetchPendingOrder reads from the DB and calls setPendingOrder directly.
        pollingRef.current = setInterval(() => {
            fetchPendingOrder();
        }, 15_000);

        return () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
            supabase.removeChannel(assignedOrdersChannel);
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
            }
        };
    }, [isOnline, user?.id, fetchPendingOrder]);

    // ── Toggle online/offline ─────────────────────────────────────────────────

    const handleToggleOnline = async () => {
        if (!user?.id) return;
        setIsLoading(true);

        const newStatus = isOnline ? 'offline' : 'online';
        const result = await updateRiderStatus(user.id, newStatus);

        if (result.success) {
            const next = !isOnline;
            setIsOnline(next);
            localStorage.setItem('rider_is_online', String(next));
            if (!next) {
                setPendingOrder(null);
                setIsSearching(false);
            }
        }
        setIsLoading(false);
    };

    // ── Accept order ──────────────────────────────────────────────────────────
    //
    // Fix 1: removed delivery_tracking insert (table doesn't exist)
    // Fix 2: using claimOrder() service wrapper for already_claimed detection
    // Fix 5: user?.id null guard

    const handleAcceptOrder = useCallback(async () => {
        if (!pendingOrder || !user?.id) return;

        if (pendingOrder.source === 'assigned') {
            navigate(getAssignedOrderRoute(pendingOrder));
            return;
        }

        const result = await claimOrder(pendingOrder.id, user.id);

        // Remove the card regardless of outcome — never leave a stale card showing
        dismissedDirectOrderIdsRef.current.delete(pendingOrder.id);
        setPendingOrder(null);

        if (result.success) {
            if (pendingOrder.orderType === 'return') {
                showToast('Return accepted! Head to the customer for pickup.', 'success');
                navigate(`/delivery/${pendingOrder.id}`);
            } else {
                showToast('Order accepted! Head to the warehouse.', 'success');
                navigate(`/warehouse/${pendingOrder.id}`);
            }
            return;
        }

        if (result.already_claimed) {
            showToast('Order was taken by another rider', 'info');
            // Fetch next pending order if any
            setTimeout(() => fetchPendingOrder(), 500);
            return;
        }

        showToast(result.message ?? 'Could not accept order', 'error');
        // Re-fetch in case there's another order available
        setTimeout(() => fetchPendingOrder(), 500);
    }, [pendingOrder, user?.id, navigate, showToast, fetchPendingOrder]);

    // ── Decline order ─────────────────────────────────────────────────────────

    const handleDeclineOrder = useCallback(async () => {
        if (!pendingOrder || !user?.id) return;

        const notifId = pendingOrder.notificationId;
        setPendingOrder(null);        // Optimistic remove
        setIsSearching(true);

        try {
            if (notifId.startsWith('direct:')) {
                // Persist decline in DB so it survives re-login
                dismissedDirectOrderIdsRef.current.add(pendingOrder.id);
                const { error: upsertErr } = await supabase.from('rider_notifications').upsert({
                    order_id: pendingOrder.id,
                    rider_id: user.id,
                    status: 'declined',
                }, { onConflict: 'order_id,rider_id' });
                if (upsertErr) {
                    console.error('[HomePage] Failed to persist decline:', upsertErr);
                }
                showToast('Order declined.', 'info');
            } else {
                await declineOrderNotification(notifId);
            }
            // After declining, check if there's another order waiting
            await fetchPendingOrder();
        } catch (err) {
            console.error('[HomePage] handleDeclineOrder:', err);
        } finally {
            setIsSearching(false);
        }
    }, [pendingOrder, user?.id, fetchPendingOrder, showToast]);

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <RiderShell>
            {/* Header */}
            <header className="sticky top-0 z-40 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-zinc-800/50">
                <div className="flex items-center justify-between px-4 h-16">
                    <StatusToggle
                        isOnline={isOnline}
                        onToggle={handleToggleOnline}
                        isLoading={isLoading}
                    />
                    <button
                        onClick={() => navigate('/notifications')}
                        className="relative p-2 rounded-full hover:bg-zinc-800/50 transition-colors"
                    >
                        <Bell size={22} className="text-zinc-400" />
                        {unreadNotifications > 0 && (
                            <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center">
                                {unreadNotifications > 9 ? '9+' : unreadNotifications}
                            </span>
                        )}
                    </button>
                </div>
            </header>

            {/* Main content */}
            <main className="px-4 py-6 space-y-4 flex-1">
                {/* Searching indicator */}
                <AnimatePresence>
                    {isSearching && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="flex items-center justify-center gap-2 py-4 px-6 rounded-xl bg-blue-500/10 border border-blue-500/20"
                        >
                            <div className="flex gap-1">
                                <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                            <span className="text-blue-400 font-medium">Searching for orders...</span>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Incoming order card */}
                <AnimatePresence>
                    {pendingOrder && !isSearching && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="space-y-4"
                        >
                            <OrderCard
                                {...pendingOrder}
                                status={getIncomingOrderCardStatus(pendingOrder)}
                            />

                            {pendingOrder.source === 'assigned' ? (
                                <div className="space-y-3">
                                    <button
                                        onClick={handleAcceptOrder}
                                        className="w-full h-14 rounded-2xl bg-blue-500 text-white font-semibold hover:bg-blue-400 transition-colors"
                                    >
                                        {getAssignedActionLabel(pendingOrder)}
                                    </button>
                                </div>
                            ) : (
                                <div className="flex gap-3">
                                    <button
                                        onClick={handleDeclineOrder}
                                        className="w-14 h-14 flex items-center justify-center rounded-full bg-red-500/10 border border-red-500/30 text-red-500 hover:bg-red-500/20 transition-colors"
                                        aria-label="Decline order"
                                    >
                                        ✕
                                    </button>
                                    <div className="flex-1">
                                        <SwipeToAccept onAccept={handleAcceptOrder} />
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Dashboard (no pending order) */}
                {!pendingOrder && (
                    <>
                        <EarningsCard
                            todayEarnings={earnings?.today ?? 0}
                            predictedEarnings={isOnline ? 1245 : undefined}
                            ordersCount={earnings?.ordersToday ?? 0}
                            onlineHours={5}
                            isOnline={isOnline}
                            onClick={() => navigate('/earnings')}
                        />

                        {isOnline && (
                            <BonusCard
                                bonusPay={earnings?.bonusToday ?? 36}
                                currentOrders={earnings?.ordersToday ?? 3}
                                targetOrders={5}
                                milestones={[1, 2, 3, 4, 5]}
                            />
                        )}

                        <div className="flex justify-center py-12">
                            <motion.div
                                animate={isOnline ? { scale: [1, 1.1, 1] } : {}}
                                transition={{ duration: 2, repeat: Infinity }}
                                className={clsx(
                                    'w-24 h-24 rounded-full flex items-center justify-center transition-colors duration-300',
                                    isOnline
                                        ? 'bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/30'
                                        : 'bg-zinc-800',
                                )}
                            >
                                <Zap size={40} className={isOnline ? 'text-white' : 'text-zinc-500'} />
                            </motion.div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => navigate('/slots')}
                                className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors text-left"
                            >
                                <span className="text-2xl mb-2 block">📅</span>
                                <span className="text-white font-medium">Book Slots</span>
                                <span className="block text-xs text-zinc-500 mt-0.5">Schedule your shifts</span>
                            </button>
                            <button
                                onClick={() => navigate('/orders')}
                                className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors text-left"
                            >
                                <span className="text-2xl mb-2 block">📋</span>
                                <span className="text-white font-medium">Order History</span>
                                <span className="block text-xs text-zinc-500 mt-0.5">View past deliveries</span>
                            </button>
                        </div>
                    </>
                )}
            </main>

            <BottomNavigation />
        </RiderShell>
    );
}

export default HomePage;
