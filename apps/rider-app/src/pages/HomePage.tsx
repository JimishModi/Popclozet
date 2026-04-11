/**
 * Home Page (Dashboard)
 *
 * Main rider dashboard with earnings, online toggle, and real-time order popups.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@popclozet/auth';
import { Zap, Bell, FileText, CalendarDays, Search, ScanLine, QrCode } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';

import { StatusToggle } from '../components/StatusToggle';
import { EarningsCard, BonusCard } from '../components/EarningsCard';
import { OrderCard } from '../components/OrderCard';
import { SwipeToAccept } from '../components/SwipeToAccept';
import { BottomNavigation } from '../components/BottomNavigation';
import { QRScannerOverlay } from '../components/QRScannerOverlay';
import { PaymentQRModal } from '../components/PaymentQRModal';
import { RiderShell } from '../components/layout/RiderShell';
import { useToast } from '../contexts/ToastContext';
import { useLocation } from '../contexts/LocationContext';

import { getEarningsSummary, type EarningsSummary } from '../services/walletService';
import { updateRiderStatus } from '../services/riderProfileService';
import { getUnreadCount } from '../services/notificationsService';
import { ensurePushSubscription } from '../services/pushNotificationService';
import {
    claimOrder,
    dismissOrderNotification,
    upsertRiderNotificationStatus,
} from '../services/riderOrderService';
import {
    getAssignedActionLabel,
    getAssignedOrderRoute,
    getIncomingOrderCardStatus,
    getTopPendingIncomingOrder,
    type IncomingOrder,
} from '../services/rideFeedService';
import { supabase } from '@popclozet/api-client';
import type { RealtimeChannel } from '@supabase/supabase-js';

// Urgent alarm sound for new ride requests
const RIDE_ALARM_URL = 'https://assets.mixkit.co/active_storage/sfx/2645/2645-preview.mp3';

const getDismissedHomeRideStorageKey = (riderId: string) => `rider_home_dismissed:${riderId}`;

function readDismissedHomeRideIds(riderId: string): Set<string> {
    try {
        const raw = localStorage.getItem(getDismissedHomeRideStorageKey(riderId));
        if (!raw) return new Set<string>();
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return new Set<string>();
        return new Set(parsed.filter((value): value is string => typeof value === 'string'));
    } catch (error) {
        console.error('[HomePage] readDismissedHomeRideIds:', error);
        return new Set<string>();
    }
}

function persistDismissedHomeRideIds(riderId: string, dismissedOrderIds: Set<string>) {
    try {
        localStorage.setItem(
            getDismissedHomeRideStorageKey(riderId),
            JSON.stringify(Array.from(dismissedOrderIds)),
        );
    } catch (error) {
        console.error('[HomePage] persistDismissedHomeRideIds:', error);
    }
}

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
    const [showPaymentQR, setShowPaymentQR] = useState(false);

    const channelRef = useRef<RealtimeChannel | null>(null);
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const dismissedDirectOrderIdsRef = useRef<Set<string>>(new Set());
    const navigatingRef = useRef(false);
    const rideAlarmRef = useRef<HTMLAudioElement | null>(null);
    const prevPendingIdRef = useRef<string | null>(null);

    // Preload ride alarm
    useEffect(() => {
        rideAlarmRef.current = new Audio(RIDE_ALARM_URL);
        rideAlarmRef.current.load();
    }, []);

    // Play alarm + vibrate when a NEW pending order appears
    useEffect(() => {
        if (!pendingOrder) {
            prevPendingIdRef.current = null;
            return;
        }
        // Only fire alarm for new orders, not when re-rendering the same one
        if (pendingOrder.id === prevPendingIdRef.current) return;
        prevPendingIdRef.current = pendingOrder.id;

        // Vibrate aggressively
        if ('vibrate' in navigator) {
            navigator.vibrate([300, 100, 300, 100, 300, 100, 500, 200, 500]);
        }
        // Play alarm sound (repeat twice)
        if (rideAlarmRef.current) {
            const audio = rideAlarmRef.current;
            let playCount = 0;
            const handleEnded = () => {
                playCount++;
                if (playCount < 2) {
                    audio.currentTime = 0;
                    audio.play().catch(() => {});
                } else {
                    audio.removeEventListener('ended', handleEnded);
                }
            };
            audio.removeEventListener('ended', handleEnded);
            audio.addEventListener('ended', handleEnded);
            audio.currentTime = 0;
            audio.play().catch(() => {});
        }
    }, [pendingOrder]);

    const fetchPendingOrder = useCallback(async () => {
        if (!user?.id || navigatingRef.current) return;

        try {
            const nextOrder = await getTopPendingIncomingOrder(
                user.id,
                dismissedDirectOrderIdsRef.current,
            );
            setPendingOrder(nextOrder);
        } catch (err) {
            console.error('[HomePage] fetchPendingOrder:', err);
        }
    }, [user?.id]);

    useEffect(() => {
        if (!user?.id) return;

        dismissedDirectOrderIdsRef.current = readDismissedHomeRideIds(user.id);
        getEarningsSummary(user.id).then(setEarnings);
        getUnreadCount(user.id).then(setUnread);
    }, [user?.id]);

    useEffect(() => {
        if (!isOnline || !user?.id) return;

        navigatingRef.current = false;
        setIsSearching(true);
        void fetchPendingOrder().finally(() => setIsSearching(false));

        const riderNotificationsChannel = supabase
            .channel(`rider-notifs-${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'rider_notifications',
                    filter: `rider_id=eq.${user.id}`,
                },
                () => {
                    setIsSearching(false);
                    void fetchPendingOrder();
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
                    event: '*',
                    schema: 'public',
                    table: 'orders',
                },
                () => {
                    void fetchPendingOrder();
                },
            )
            .subscribe();

        channelRef.current = riderNotificationsChannel;
        pollingRef.current = setInterval(() => {
            void fetchPendingOrder();
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

    const handleToggleOnline = async () => {
        if (!user?.id) return;
        setIsLoading(true);

        const turningOnline = !isOnline;

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

            if (turningOnline) {
                void ensurePushSubscription({ promptIfDefault: true });
            } else {
                setPendingOrder(null);
                setIsSearching(false);
                stopWatching();
            }
        }

        setIsLoading(false);
    };

    const handleAcceptOrder = useCallback(async () => {
        if (!pendingOrder || !user?.id) return;

        if (pendingOrder.source === 'assigned') {
            navigatingRef.current = true;
            navigate(getAssignedOrderRoute(pendingOrder));
            return;
        }

        const orderId = pendingOrder.id;
        const orderType = pendingOrder.orderType;
        const result = await claimOrder(orderId, user.id);

        if (result.success) {
            navigatingRef.current = true;
            dismissedDirectOrderIdsRef.current.delete(orderId);
            persistDismissedHomeRideIds(user.id, dismissedDirectOrderIdsRef.current);
            setPendingOrder(null);

            if (orderType === 'return') {
                showToast('Return accepted! Head to the customer for pickup.', 'success');
                navigate(`/delivery/${orderId}`);
            } else {
                showToast('Order accepted! Head to the warehouse.', 'success');
                navigate(`/warehouse/${orderId}`);
            }
            return;
        }

        dismissedDirectOrderIdsRef.current.delete(orderId);
        persistDismissedHomeRideIds(user.id, dismissedDirectOrderIdsRef.current);
        setPendingOrder(null);

        if (result.already_claimed) {
            showToast('Order was taken by another rider', 'info');
            setTimeout(() => {
                void fetchPendingOrder();
            }, 500);
            return;
        }

        showToast(result.message ?? 'Could not accept order', 'error');
        setTimeout(() => {
            void fetchPendingOrder();
        }, 500);
    }, [pendingOrder, user?.id, navigate, showToast, fetchPendingOrder]);

    const handleDeclineOrder = useCallback(async () => {
        if (!pendingOrder || !user?.id) return;

        const notifId = pendingOrder.notificationId;
        setPendingOrder(null);
        setIsSearching(true);

        try {
            if (notifId.startsWith('direct:')) {
                dismissedDirectOrderIdsRef.current.add(pendingOrder.id);
                persistDismissedHomeRideIds(user.id, dismissedDirectOrderIdsRef.current);
                const saved = await upsertRiderNotificationStatus(pendingOrder.id, user.id, 'dismissed');
                if (!saved) {
                    console.warn('[HomePage] Falling back to local dismiss cache for direct ride', pendingOrder.id);
                }
                showToast('Ride hidden from Home.', 'info');
            } else {
                dismissedDirectOrderIdsRef.current.add(pendingOrder.id);
                persistDismissedHomeRideIds(user.id, dismissedDirectOrderIdsRef.current);
                const saved = await dismissOrderNotification(notifId);
                if (!saved) {
                    console.warn('[HomePage] Falling back to local dismiss cache for notification ride', pendingOrder.id);
                }
                showToast('Ride hidden from Home.', 'info');
            }
            await fetchPendingOrder();
        } catch (err) {
            console.error('[HomePage] handleDeclineOrder:', err);
        } finally {
            setIsSearching(false);
        }
    }, [pendingOrder, user?.id, fetchPendingOrder, showToast]);

    return (
        <RiderShell>
            <header className="sticky top-0 z-40 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-zinc-800/50">
                <div className="flex items-center justify-between px-4 h-16">
                    <StatusToggle
                        isOnline={isOnline}
                        onToggle={handleToggleOnline}
                        isLoading={isLoading}
                    />
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setShowPaymentQR(true)}
                            className="p-2 rounded-full hover:bg-zinc-800/50 transition-colors"
                            aria-label="Show Payment QR"
                        >
                            <QrCode size={22} className="text-emerald-400" />
                        </button>
                        <button
                            onClick={() => setShowQRScanner(true)}
                            className="p-2 rounded-full hover:bg-zinc-800/50 transition-colors"
                            aria-label="Scan QR Code"
                        >
                            <ScanLine size={22} className="text-zinc-400" />
                        </button>
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
                </div>
            </header>

            <main className="px-4 py-6 space-y-4 flex-1">
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
                                        X
                                    </button>
                                    <div className="flex-1">
                                        <SwipeToAccept onAccept={handleAcceptOrder} />
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

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
                                    rotate: [0, 5, -5, 0],
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
                                onClick={() => navigate('/available-rides')}
                                className="p-5 rounded-3xl bg-blue-500/5 border border-blue-500/10 hover:bg-blue-500/10 active:scale-95 transition-all text-left group"
                            >
                                <span className="text-3xl mb-3 block group-hover:scale-110 transition-transform">
                                    <Search size={28} className="text-blue-400" />
                                </span>
                                <span className="text-white font-bold text-sm tracking-tight">Available Rides</span>
                                <span className="block text-[10px] text-zinc-500 mt-1 uppercase tracking-widest font-medium">See all claimable jobs</span>
                            </button>
                            <button
                                onClick={() => navigate('/orders')}
                                className="p-5 rounded-3xl bg-white/5 border border-white/5 hover:bg-white/10 active:scale-95 transition-all text-left group"
                            >
                                <span className="text-3xl mb-3 block group-hover:scale-110 transition-transform">
                                    <FileText size={28} className="text-zinc-300" />
                                </span>
                                <span className="text-white font-bold text-sm tracking-tight">History</span>
                                <span className="block text-[10px] text-zinc-500 mt-1 uppercase tracking-widest font-medium">Past deliveries</span>
                            </button>
                            <button
                                onClick={() => navigate('/slots')}
                                className="p-5 rounded-3xl bg-white/5 border border-white/5 hover:bg-white/10 active:scale-95 transition-all text-left group"
                            >
                                <span className="text-3xl mb-3 block group-hover:scale-110 transition-transform">
                                    <CalendarDays size={28} className="text-zinc-300" />
                                </span>
                                <span className="text-white font-bold text-sm tracking-tight">Book Slots</span>
                                <span className="block text-[10px] text-zinc-500 mt-1 uppercase tracking-widest font-medium">Schedule shifts</span>
                            </button>
                            <button
                                onClick={() => setShowQRScanner(true)}
                                className="p-5 rounded-3xl bg-blue-500/5 border border-blue-500/10 hover:bg-blue-500/10 active:scale-95 transition-all text-left group"
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

            {showQRScanner && (
                <QRScannerOverlay onClose={() => setShowQRScanner(false)} />
            )}

            {showPaymentQR && (
                <PaymentQRModal
                    onClose={() => setShowPaymentQR(false)}
                />
            )}

            <BottomNavigation />
        </RiderShell>
    );
}

export default HomePage;
