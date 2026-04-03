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
import { Zap, Bell, X, ScanLine } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';

import { StatusToggle } from '../components/StatusToggle';
import { EarningsCard, BonusCard } from '../components/EarningsCard';
import { OrderCard } from '../components/OrderCard';
import { SwipeToAccept } from '../components/SwipeToAccept';
import { BottomNavigation } from '../components/BottomNavigation';
import { QRScannerOverlay } from '../components/QRScannerOverlay';
import { RiderShell } from '../components/layout/RiderShell';
import { useToast } from '../contexts/ToastContext';
import { useLocation } from '../contexts/LocationContext';

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
    items?: Array<{ name: string; qty: number; imageUrl?: string }>;
    earnings: number;
    distance: string;
    duration: string;
    totalAmount?: number;
}

// ─── Mapper ───────────────────────────────────────────────────────────────────

const ORDER_SELECT = `
    *, 
    customer_profiles!orders_user_id_fkey1(full_name),
    addresses:delivery_address_id(full_address, latitude, longitude), 
    order_items(
        id, 
        product_id, 
        products(name, images)
    )
`;
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

    const items = (dbOrder.order_items ?? []).map((i: any) => ({
        name: i.products?.name || `Product ${i.product_id.slice(0, 8)}`,
        qty: 1,
        imageUrl: Array.isArray(i.products?.images) ? i.products.images[0] : null,
    }));

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
            : { name: 'Popclozet Warehouse', address: 'Near IIT Main Gate, Powai' },
        dropoff: isReturn
            ? { name: 'Warehouse Drop-off', address: 'Near IIT Main Gate, Powai' }
            : { name: 'Customer', address: fullAddr },
        customerName: dbOrder.customer_profiles?.full_name || 'Customer', items,
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
    const { requestPermission, stopWatching } = useLocation();

    const [isOnline, setIsOnline] = useState(() =>
        localStorage.getItem('rider_is_online') === 'true',
    );
    const [isSearching, setIsSearching] = useState(false);
    const [pendingOrder, setPendingOrder] = useState<IncomingOrder | null>(null);
    const [earnings, setEarnings] = useState<EarningsSummary | null>(null);
    const [unreadNotifications, setUnread] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [showQRScanner, setShowQRScanner] = useState(false);

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

        const globalOrdersChannel = supabase
            .channel(`global-orders-[${user.id}]`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'orders',
                },
                (payload) => {
                    const n = payload.new as any;
                    // If an order gets a rider_id and it's someone else, 
                    // instantly hide it from this rider's screen!
                    if (n.rider_id && n.rider_id !== user.id) {
                        setPendingOrder((curr) => {
                            if (curr?.id === n.id) {
                                void fetchPendingOrder();
                                return null;
                            }
                            return curr;
                        });
                    }
                }
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
            supabase.removeChannel(globalOrdersChannel);
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

        const turningOnline = !isOnline;

        // If turning online, ensure we have location permission first
        if (turningOnline) {
            const granted = await requestPermission();
            if (!granted) {
                showToast('Location access is required to go online.', 'error');
                setIsLoading(false);
                return;
            }
        }

        const newStatus = turningOnline ? 'online' : 'offline';
        const result = await updateRiderStatus(user.id, newStatus);

        if (result.success) {
            setIsOnline(turningOnline);
            localStorage.setItem('rider_is_online', String(turningOnline));
            if (!turningOnline) {
                setPendingOrder(null);
                setIsSearching(false);
                stopWatching();
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
                            className="flex items-center justify-center gap-4 py-8 px-6 rounded-3xl bg-blue-500/5 border border-blue-500/10 relative overflow-hidden group"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-500/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                            <div className="flex gap-2">
                                <span className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.8)]" style={{ animationDelay: '0ms' }} />
                                <span className="w-2.5 h-2.5 bg-blue-400 rounded-full animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.6)]" style={{ animationDelay: '200ms' }} />
                                <span className="w-2.5 h-2.5 bg-blue-300 rounded-full animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.4)]" style={{ animationDelay: '400ms' }} />
                            </div>
                            <span className="text-blue-400 font-bold uppercase tracking-widest text-xs">Searching for High-Value Orders...</span>
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
                                <div className="space-y-3 mt-4">
                                    <button
                                        onClick={handleAcceptOrder}
                                        className="w-full h-14 rounded-2xl bg-blue-600 text-white font-bold uppercase tracking-widest shadow-lg shadow-blue-500/20 active:scale-95 transition-all text-sm"
                                    >
                                        {getAssignedActionLabel(pendingOrder)}
                                    </button>
                                </div>
                            ) : (
                                <div className="flex gap-4 mt-4">
                                    <button
                                        onClick={handleDeclineOrder}
                                        className="w-16 h-14 flex items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500/20 active:scale-95 transition-all"
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
                {!pendingOrder && !isSearching && (
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

                        <div className="flex justify-center py-12 relative">
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="w-44 h-44 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
                            </div>
                            <motion.div
                                animate={isOnline ? {
                                    scale: [1, 1.05, 1],
                                    rotate: [0, 5, -5, 0]
                                } : {}}
                                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                                className={clsx(
                                    'w-28 h-28 rounded-full flex items-center justify-center transition-all duration-700 relative z-10',
                                    isOnline
                                        ? 'bg-gradient-to-br from-blue-500 via-blue-600 to-blue-800 shadow-[0_0_50px_rgba(59,130,246,0.3)] border border-white/20'
                                        : 'bg-zinc-900 border border-white/5',
                                )}
                            >
                                <Zap size={44} className={isOnline ? 'text-white' : 'text-zinc-800'} />
                            </motion.div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => navigate('/slots')}
                                className="p-5 rounded-3xl bg-white/5 border border-white/5 hover:bg-white/10 active:scale-95 transition-all text-left group"
                            >
                                <span className="text-3xl mb-3 block group-hover:scale-110 transition-transform">📅</span>
                                <span className="text-white font-bold text-sm tracking-tight">Book Slots</span>
                                <span className="block text-[10px] text-zinc-500 mt-1 uppercase tracking-widest font-medium">Schedule shifts</span>
                            </button>
                            <button
                                onClick={() => navigate('/orders')}
                                className="p-5 rounded-3xl bg-white/5 border border-white/5 hover:bg-white/10 active:scale-95 transition-all text-left group"
                            >
                                <span className="text-3xl mb-3 block group-hover:scale-110 transition-transform">📋</span>
                                <span className="text-white font-bold text-sm tracking-tight">History</span>
                                <span className="block text-[10px] text-zinc-500 mt-1 uppercase tracking-widest font-medium">Past deliveries</span>
                            </button>
                            <button
                                onClick={() => setShowQRScanner(true)}
                                className="p-5 rounded-3xl bg-blue-500/5 border border-blue-500/10 hover:bg-blue-500/10 active:scale-95 transition-all text-left group col-span-2"
                            >
                                <div className="flex items-center gap-4">
                                    <span className="text-3xl group-hover:scale-110 transition-transform"><ScanLine size={28} className="text-blue-400" /></span>
                                    <div>
                                        <span className="text-white font-bold text-sm tracking-tight block">Scan Product</span>
                                        <span className="block text-[10px] text-zinc-500 mt-0.5 uppercase tracking-widest font-medium">Verify items via QR code</span>
                                    </div>
                                </div>
                            </button>
                        </div>
                    </>
                )}
            </main>

            {/* Floating QR Scan button when online */}
            {isOnline && !pendingOrder && !showQRScanner && (
                <button
                    onClick={() => setShowQRScanner(true)}
                    className="fixed bottom-24 right-4 z-30 w-14 h-14 rounded-full bg-blue-600 shadow-lg shadow-blue-500/30 flex items-center justify-center active:scale-90 transition-all hover:bg-blue-500"
                    aria-label="Scan Product QR"
                >
                    <ScanLine size={24} className="text-white" />
                </button>
            )}

            {/* QR Scanner Overlay */}
            {showQRScanner && (
                <QRScannerOverlay onClose={() => setShowQRScanner(false)} />
            )}

            <BottomNavigation />
        </RiderShell>
    );
}

export default HomePage;
