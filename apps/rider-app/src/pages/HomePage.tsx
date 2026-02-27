/**
 * Home Page (Dashboard)
 * 
 * Main rider dashboard with earnings, online toggle, and real-time order popups
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@popclozet/auth';
import { Zap, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';

import { StatusToggle } from '../components/StatusToggle';
import { EarningsCard, BonusCard } from '../components/EarningsCard';
import { OrderCard } from '../components/OrderCard';
import { SwipeToAccept } from '../components/SwipeToAccept';
import { BottomNavigation } from '../components/BottomNavigation';
import { RiderShell } from '../components/layout/RiderShell';

import { getEarningsSummary, type EarningsSummary } from '../services/walletService';
import { updateRiderStatus } from '../services/riderProfileService';
import { getUnreadCount } from '../services/notificationsService';
import { supabase } from '@popclozet/api-client';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface IncomingOrder {
    id: string;
    orderType: 'delivery' | 'pickup';
    pickup: { name: string; address: string };
    dropoff: { name: string; address: string };
    customerName: string;
    itemCount: number;
    earnings: number;
    distance: string;
    duration: string;
    totalAmount?: number;
}

// Column reference for the select query – joins the address table
const ORDER_SELECT = '*, addresses:delivery_address_id(full_address, latitude, longitude)';

function mapDbOrderToIncoming(dbOrder: any): IncomingOrder {
    // address comes from the joined addresses row
    const addr = dbOrder.addresses;
    const fullAddr = addr?.full_address || 'Customer Address';

    // order_items aren't joined in the realtime payload, so we fall back to 1
    const itemCount = Array.isArray(dbOrder.order_items)
        ? dbOrder.order_items.reduce((s: number, i: any) => s + (i.quantity || 1), 0)
        : 1;

    const estimatedKm = 3; // placeholder distance

    return {
        id: dbOrder.id,
        orderType: 'delivery',
        pickup: {
            name: 'PopClozet Warehouse',
            address: 'Near IIT Main Gate, Powai',
        },
        dropoff: {
            name: 'Customer',
            address: fullAddr,
        },
        customerName: 'Customer',
        itemCount,
        earnings: Math.round((dbOrder.total_amount || 0) * 0.15), // 15% of order value
        distance: `${estimatedKm.toFixed(1)} km`,
        duration: `${estimatedKm * 3} mins`,
        totalAmount: dbOrder.total_amount,
    };
}

export function HomePage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [isOnline, setIsOnline] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [pendingOrder, setPendingOrder] = useState<IncomingOrder | null>(null);
    const [earnings, setEarnings] = useState<EarningsSummary | null>(null);
    const [unreadNotifications, setUnreadNotifications] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const channelRef = useRef<RealtimeChannel | null>(null);
    const pollingRef = useRef<NodeJS.Timeout | null>(null);

    // Fetch earnings on mount
    useEffect(() => {
        if (user?.id) {
            getEarningsSummary(user.id).then(setEarnings);
            getUnreadCount(user.id).then(setUnreadNotifications);
        }
    }, [user?.id]);

    // Subscribe to real-time orders when online
    useEffect(() => {
        if (!isOnline || !supabase) return;

        setIsSearching(true);

        // 1. Fetch existing pending orders first
        const fetchPendingOrders = async () => {
            try {
                const { data, error } = await supabase
                    .from('orders')
                    .select(ORDER_SELECT)
                    .eq('status', 'pending')
                    .order('created_at', { ascending: false })
                    .limit(1);

                if (!error && data && data.length > 0) {
                    setPendingOrder(mapDbOrderToIncoming(data[0]));
                }
            } catch (err) {
                console.error('Failed to fetch pending orders:', err);
            } finally {
                setIsSearching(false);
            }
        };

        fetchPendingOrders();

        // 2. Subscribe to real-time INSERT events on orders table
        const channel = supabase
            .channel('rider-new-orders')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'orders',
                    filter: 'status=eq.pending',
                },
                async (payload) => {
                    console.log('New order received:', payload);
                    // Realtime payload won't have the joined address, so re-fetch
                    const { data } = await supabase
                        .from('orders')
                        .select(ORDER_SELECT)
                        .eq('id', payload.new.id)
                        .single();
                    setPendingOrder(mapDbOrderToIncoming(data || payload.new));
                    setIsSearching(false);
                }
            )
            .subscribe();

        channelRef.current = channel;

        // 3. Poll every 10s as backup (in case realtime misses)
        pollingRef.current = setInterval(async () => {
            if (pendingOrder) return; // Already have one

            try {
                const { data } = await supabase
                    .from('orders')
                    .select(ORDER_SELECT)
                    .eq('status', 'pending')
                    .order('created_at', { ascending: false })
                    .limit(1);

                if (data && data.length > 0) {
                    setPendingOrder(mapDbOrderToIncoming(data[0]));
                    setIsSearching(false);
                }
            } catch (err) {
                // Polling failure is non-critical
            }
        }, 10000);

        return () => {
            if (channelRef.current && supabase) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
            }
        };
    }, [isOnline]);

    const handleToggleOnline = async () => {
        if (!user?.id) return;

        setIsLoading(true);
        const newStatus = isOnline ? 'offline' : 'online';

        const result = await updateRiderStatus(user.id, newStatus);
        if (result.success) {
            setIsOnline(!isOnline);
            if (!isOnline === false) {
                setPendingOrder(null);
                setIsSearching(false);
            }
        }
        setIsLoading(false);
    };

    const handleAcceptOrder = async () => {
        if (!pendingOrder || !supabase) return;

        // Update order status to confirmed and assign rider
        try {
            await supabase
                .from('orders')
                .update({
                    status: 'confirmed',
                    rider_id: user?.id || null,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', pendingOrder.id);
        } catch (err) {
            console.error('Failed to accept order:', err);
        }

        navigate(`/delivery/${pendingOrder.id}`, {
            state: { order: pendingOrder }
        });
    };

    const handleDeclineOrder = async () => {
        setPendingOrder(null);
        setIsSearching(true);

        // Fetch next pending order
        if (supabase) {
            setTimeout(async () => {
                try {
                    const { data } = await supabase
                        .from('orders')
                        .select(ORDER_SELECT)
                        .eq('status', 'pending')
                        .order('created_at', { ascending: false })
                        .limit(1);

                    if (data && data.length > 0) {
                        setPendingOrder(mapDbOrderToIncoming(data[0]));
                    }
                } catch (err) {
                    // Ignore
                }
                setIsSearching(false);
            }, 2000);
        } else {
            setTimeout(() => setIsSearching(false), 2000);
        }
    };

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

            {/* Main Content */}
            <main className="px-4 py-6 space-y-4 flex-1">
                {/* Searching overlay */}
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

                {/* Order Popup */}
                <AnimatePresence>
                    {pendingOrder && !isSearching && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="space-y-4"
                        >
                            {/* "Today's Earnings" button */}
                            <button
                                onClick={() => navigate('/earnings')}
                                className="w-full py-3 px-4 rounded-xl bg-zinc-800/50 border border-zinc-700/50 text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors"
                            >
                                Today's Earnings
                            </button>

                            {/* Order Card */}
                            <OrderCard
                                {...pendingOrder}
                                status="pending"
                            />

                            {/* Action buttons */}
                            <div className="flex gap-3">
                                <button
                                    onClick={handleDeclineOrder}
                                    className="w-14 h-14 flex items-center justify-center rounded-full bg-red-500/10 border border-red-500/30 text-red-500 hover:bg-red-500/20 transition-colors"
                                >
                                    ✕
                                </button>
                                <div className="flex-1">
                                    <SwipeToAccept onAccept={handleAcceptOrder} />
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Normal Dashboard (when no pending order) */}
                {!pendingOrder && (
                    <>
                        {/* Earnings Card */}
                        <EarningsCard
                            todayEarnings={earnings?.today || 0}
                            predictedEarnings={isOnline ? 1245 : undefined}
                            ordersCount={earnings?.ordersToday || 0}
                            onlineHours={5}
                            isOnline={isOnline}
                            onClick={() => navigate('/earnings')}
                        />

                        {/* Bonus Card (only when online) */}
                        {isOnline && (
                            <BonusCard
                                bonusPay={earnings?.bonusToday || 36}
                                currentOrders={earnings?.ordersToday || 3}
                                targetOrders={5}
                                milestones={[1, 2, 3, 4, 5]}
                            />
                        )}

                        {/* Center Lightning Icon */}
                        <div className="flex justify-center py-12">
                            <motion.div
                                animate={isOnline ? { scale: [1, 1.1, 1] } : {}}
                                transition={{ duration: 2, repeat: Infinity }}
                                className={clsx(
                                    "w-24 h-24 rounded-full flex items-center justify-center",
                                    "transition-colors duration-300",
                                    isOnline
                                        ? "bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/30"
                                        : "bg-zinc-800"
                                )}
                            >
                                <Zap
                                    size={40}
                                    className={isOnline ? "text-white" : "text-zinc-500"}
                                />
                            </motion.div>
                        </div>

                        {/* Quick Actions */}
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

            {/* Bottom Navigation */}
            <BottomNavigation />
        </RiderShell>
    );
}

export default HomePage;
