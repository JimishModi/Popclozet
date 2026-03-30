/**
 * Order History Page
 * 
 * List of past deliveries with filters
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@popclozet/auth';
import { ArrowLeft, Search, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';

import { RiderShell } from '../components/layout/RiderShell';
import { BottomNavigation } from '../components/BottomNavigation';
import { OrderCard, OrderCardSkeleton } from '../components/OrderCard';
import { getRiderOrders, type RiderOrder } from '../services/riderOrderService';

type FilterTab = 'all' | 'delivered' | 'cancelled';

export function OrderHistoryPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [orders, setOrders] = useState<RiderOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<FilterTab>('all');
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (user?.id) {
            getRiderOrders(user.id).then((data) => {
                setOrders(data);
                setIsLoading(false);
            });
        }
    }, [user?.id]);

    const filteredOrders = orders.filter((order) => {
        // Tab filter
        if (activeTab === 'delivered' && order.status !== 'delivered') return false;
        if (activeTab === 'cancelled' && order.status !== 'cancelled') return false;

        // Search filter
        if (searchQuery && !order.orderId.toLowerCase().includes(searchQuery.toLowerCase())) {
            return false;
        }

        return true;
    });

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    };

    // Group orders by date
    const groupedOrders = filteredOrders.reduce((groups, order) => {
        const date = formatDate(order.createdAt);
        if (!groups[date]) {
            groups[date] = [];
        }
        groups[date].push(order);
        return groups;
    }, {} as Record<string, RiderOrder[]>);

    return (
        <RiderShell>
            {/* Header */}
            <header className="sticky top-0 z-40 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-white/5">
                <div className="flex items-center gap-4 px-4 h-16">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 -ml-2 text-zinc-400 hover:text-white transition-colors"
                    >
                        <ArrowLeft size={22} />
                    </button>
                    <h1 className="text-lg font-bold text-white tracking-tight">Delivery History</h1>
                </div>

                {/* Search bar */}
                <div className="px-4 pb-4">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-blue-500 transition-colors" size={16} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search by order ID..."
                            className={clsx(
                                "w-full h-12 pl-11 pr-4 rounded-2xl",
                                "bg-white/5 border border-white/5",
                                "text-white placeholder:text-zinc-600 text-sm",
                                "focus:outline-none focus:border-blue-500/50 focus:bg-white/[0.08] transition-all"
                            )}
                        />
                    </div>
                </div>

                {/* Tabs */}
                <div className="px-4 pb-4 flex gap-2 overflow-x-auto no-scrollbar">
                    {(['all', 'delivered', 'cancelled'] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={clsx(
                                "px-5 py-2 rounded-xl text-xs font-bold transition-all capitalize whitespace-nowrap tracking-widest",
                                activeTab === tab
                                    ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                                    : "bg-white/5 text-zinc-500 hover:text-zinc-300"
                            )}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </header>

            <main className="px-4 py-6 space-y-8 flex-1">
                {isLoading ? (
                    <div className="space-y-6">
                        <OrderCardSkeleton />
                        <OrderCardSkeleton />
                        <OrderCardSkeleton />
                    </div>
                ) : Object.keys(groupedOrders).length === 0 ? (
                    <div className="text-center py-20">
                        <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Search size={32} className="text-zinc-700" />
                        </div>
                        <h3 className="text-white font-bold text-lg mb-2">No results found</h3>
                        <p className="text-zinc-500 text-sm max-w-[200px] mx-auto">Try adjusting your filters or search query.</p>
                    </div>
                ) : (
                    Object.entries(groupedOrders).map(([date, dateOrders], groupIndex) => (
                        <motion.div
                            key={date}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: groupIndex * 0.05 }}
                        >
                            <div className="flex items-center gap-3 mb-4">
                                <div className="h-px flex-1 bg-gradient-to-r from-transparent to-white/5" />
                                <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.2em] flex items-center gap-2">
                                    <Calendar size={10} className="text-zinc-700" />
                                    {date}
                                </span>
                                <div className="h-px flex-1 bg-gradient-to-l from-transparent to-white/5" />
                            </div>
                            <div className="space-y-4">
                                {dateOrders.map((order) => (
                                    <OrderCard
                                        key={order.id}
                                        {...order}
                                        id={order.orderId}
                                        pickup={{
                                            name: order.pickupAddress.fullAddress.split(',')[0],
                                            address: order.pickupAddress.fullAddress,
                                        }}
                                        dropoff={{
                                            name: order.deliveryAddress.fullAddress.split(',')[0],
                                            address: order.deliveryAddress.fullAddress,
                                        }}
                                        earnings={order.deliveryFee}
                                        distance={order.distanceKm ? `${order.distanceKm} km` : '-- km'}
                                        duration={order.etaMinutes ? `${order.etaMinutes} mins` : '-- mins'}
                                        status={order.status === 'delivered' ? 'delivered' : 'pending'}
                                        variant="compact"
                                        onClick={() => {
                                            const activeStatuses = [
                                                'rider_assigned', 'confirmed', 'packed', 'ready_for_pickup',
                                                'driver_arrived_warehouse', 'order_picked_up', 'dispatched',
                                                'out_for_delivery', 'return_scheduled', 'return_dispatched',
                                                'return_picked_up', 'return_at_warehouse',
                                            ];
                                            if (activeStatuses.includes(order.status)) {
                                                if (['out_for_delivery', 'return_scheduled', 'return_dispatched', 'return_picked_up'].includes(order.status) || order.orderType === 'return') {
                                                    navigate(`/delivery/${order.orderId}`);
                                                } else {
                                                    navigate(`/warehouse/${order.orderId}`);
                                                }
                                            }
                                        }}
                                    />
                                ))}
                            </div>
                        </motion.div>
                    ))
                )}
            </main>

            <BottomNavigation />
        </RiderShell>
    );
}

export default OrderHistoryPage;
