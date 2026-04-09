import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@popclozet/auth';
import { motion } from 'framer-motion';
import { ArrowLeft, RefreshCw } from 'lucide-react';

import { BottomNavigation } from '../components/BottomNavigation';
import { OrderCard, OrderCardSkeleton } from '../components/OrderCard';
import { RiderShell } from '../components/layout/RiderShell';
import { useToast } from '../contexts/ToastContext';
import { getRiderSettings } from '../services/riderProfileService';
import { claimOrder, upsertRiderNotificationStatus } from '../services/riderOrderService';
import {
    getAssignedIncomingOrder,
    getAssignedOrderRoute,
    getAvailableIncomingOrders,
    type IncomingOrder,
} from '../services/rideFeedService';
import { supabase } from '@popclozet/api-client';

export function AvailableRidesPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { user } = useAuth();
    const { showToast } = useToast();

    const preferredOrderId = searchParams.get('order');
    const [rides, setRides] = useState<IncomingOrder[]>([]);
    const [activeOrder, setActiveOrder] = useState<IncomingOrder | null>(null);
    const [maxDistanceKm, setMaxDistanceKm] = useState<number | undefined>();
    const [isLoading, setIsLoading] = useState(true);
    const [actingOrderId, setActingOrderId] = useState<string | null>(null);
    const [settingsLoaded, setSettingsLoaded] = useState(false);

    useEffect(() => {
        if (!user?.id) return;

        let cancelled = false;
        getRiderSettings(user.id)
            .then((settings) => {
                if (!cancelled) {
                    setMaxDistanceKm(settings.maxDistance);
                }
            })
            .catch((error) => {
                console.error('[AvailableRidesPage] getRiderSettings:', error);
            })
            .finally(() => {
                if (!cancelled) {
                    setSettingsLoaded(true);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [user?.id]);

    const refreshRides = useCallback(async () => {
        if (!user?.id) return;

        setIsLoading(true);
        try {
            const [assigned, available] = await Promise.all([
                getAssignedIncomingOrder(user.id),
                getAvailableIncomingOrders(user.id, {
                    maxDistanceKm,
                }),
            ]);

            setActiveOrder(assigned);
            setRides(available);
        } finally {
            setIsLoading(false);
        }
    }, [user?.id, maxDistanceKm]);

    useEffect(() => {
        if (!user?.id || !settingsLoaded) return;
        void refreshRides();
    }, [user?.id, settingsLoaded, refreshRides]);

    useEffect(() => {
        if (!user?.id || !settingsLoaded) return;

        const riderNotificationsChannel = supabase
            .channel(`available-rides-rider-notifs-${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'rider_notifications',
                    filter: `rider_id=eq.${user.id}`,
                },
                () => {
                    void refreshRides();
                },
            )
            .subscribe();

        const ordersChannel = supabase
            .channel(`available-rides-orders-${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'orders',
                },
                () => {
                    void refreshRides();
                },
            )
            .subscribe();

        const intervalId = setInterval(() => {
            void refreshRides();
        }, 15_000);

        return () => {
            supabase.removeChannel(riderNotificationsChannel);
            supabase.removeChannel(ordersChannel);
            clearInterval(intervalId);
        };
    }, [user?.id, settingsLoaded, refreshRides]);

    const handleAcceptRide = useCallback(async (ride: IncomingOrder) => {
        if (!user?.id) return;
        if (activeOrder) {
            showToast('Finish current ride to accept another.', 'info');
            return;
        }

        setActingOrderId(ride.id);
        const result = await claimOrder(ride.id, user.id);
        setActingOrderId(null);

        if (result.success) {
            showToast(
                ride.orderType === 'return'
                    ? 'Return accepted! Head to the customer for pickup.'
                    : 'Ride accepted! Head to the warehouse.',
                'success',
            );
            navigate(ride.orderType === 'return' ? `/delivery/${ride.id}` : `/warehouse/${ride.id}`);
            return;
        }

        if (result.already_claimed) {
            showToast('Ride was taken by another rider.', 'info');
            void refreshRides();
            return;
        }

        showToast(result.message ?? 'Could not accept ride.', 'error');
        void refreshRides();
    }, [activeOrder, navigate, refreshRides, showToast, user?.id]);

    const handleHideRide = useCallback(async (ride: IncomingOrder) => {
        if (!user?.id) return;

        setActingOrderId(ride.id);
        const saved = await upsertRiderNotificationStatus(ride.id, user.id, 'declined');
        setActingOrderId(null);

        if (!saved) {
            showToast('Could not hide ride right now.', 'error');
            return;
        }

        showToast('Ride hidden for you.', 'info');
        void refreshRides();
    }, [refreshRides, showToast, user?.id]);

    const highlightedRideId = useMemo(() => preferredOrderId, [preferredOrderId]);

    return (
        <RiderShell>
            <header className="sticky top-0 z-40 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-zinc-800/50">
                <div className="flex items-center gap-4 px-4 h-16">
                    <button
                        onClick={() => navigate('/')}
                        className="p-2 -ml-2 text-zinc-400 hover:text-white transition-colors"
                        aria-label="Back to home"
                    >
                        <ArrowLeft size={22} />
                    </button>
                    <div className="flex-1">
                        <h1 className="text-lg font-semibold text-white">Available Rides</h1>
                        <p className="text-[11px] uppercase tracking-widest text-zinc-500">
                            Claimable delivery and return jobs
                        </p>
                    </div>
                    <button
                        onClick={() => void refreshRides()}
                        className="p-2 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition-colors"
                        aria-label="Refresh available rides"
                    >
                        <RefreshCw size={18} />
                    </button>
                </div>
            </header>

            <main className="px-4 py-6 space-y-4 flex-1">
                {activeOrder && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-3xl border border-amber-500/20 bg-amber-500/8 px-4 py-4"
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-400">
                                    Active Ride In Progress
                                </p>
                                <p className="mt-2 text-sm text-white">
                                    Finish your current ride before claiming another one. Available rides stay visible so you can monitor the pool.
                                </p>
                            </div>
                            <button
                                onClick={() => navigate(getAssignedOrderRoute(activeOrder))}
                                className="shrink-0 rounded-2xl bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-widest text-white hover:bg-white/15 transition-colors"
                            >
                                Open Ride
                            </button>
                        </div>
                    </motion.div>
                )}

                {isLoading && (
                    <>
                        <OrderCardSkeleton />
                        <OrderCardSkeleton />
                    </>
                )}

                {!isLoading && rides.length === 0 && (
                    <div className="rounded-3xl border border-white/10 bg-white/5 px-6 py-10 text-center">
                        <p className="text-sm font-semibold text-white">No rides available right now.</p>
                        <p className="mt-2 text-xs uppercase tracking-[0.2em] text-zinc-500">
                            New requests will appear here automatically
                        </p>
                    </div>
                )}

                {!isLoading && rides.map((ride) => {
                    const isBusy = actingOrderId === ride.id;
                    const isHighlighted = highlightedRideId === ride.id;

                    return (
                        <motion.div
                            key={ride.id}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={isHighlighted ? 'rounded-[28px] ring-2 ring-blue-500/40 ring-offset-0' : undefined}
                        >
                            <OrderCard
                                {...ride}
                                variant="detailed"
                                className={isHighlighted ? 'border-blue-500/30 bg-blue-500/5' : undefined}
                            />

                            <div className="mt-3 grid grid-cols-[96px,1fr] gap-3">
                                <button
                                    onClick={() => void handleHideRide(ride)}
                                    disabled={isBusy}
                                    className="h-12 rounded-2xl border border-red-500/20 bg-red-500/10 text-xs font-bold uppercase tracking-widest text-red-400 transition-colors hover:bg-red-500/15 disabled:opacity-50"
                                >
                                    Hide
                                </button>
                                <button
                                    onClick={() => void handleAcceptRide(ride)}
                                    disabled={Boolean(activeOrder) || isBusy}
                                    className="h-12 rounded-2xl bg-blue-600 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-500"
                                >
                                    {activeOrder ? 'Finish current ride to accept another' : isBusy ? 'Accepting...' : 'Accept Ride'}
                                </button>
                            </div>
                        </motion.div>
                    );
                })}
            </main>

            <BottomNavigation />
        </RiderShell>
    );
}

export default AvailableRidesPage;
