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
            <header className="sticky top-0 z-40 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-zinc-800/50">
                <div className="flex items-center gap-4 px-4 h-16">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 -ml-2 text-zinc-400 hover:text-white transition-colors"
                    >
                        <ArrowLeft size={24} />
                    </button>
                    <h1 className="text-lg font-semibold text-white">Order History</h1>
                </div>

                {/* Search bar */}
                <div className="px-4 pb-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search by order ID..."
                            className={clsx(
                                "w-full h-10 pl-10 pr-4 rounded-xl",
                                "bg-zinc-900 border border-zinc-800",
                                "text-white placeholder:text-zinc-600 text-sm",
                                "focus:outline-none focus:border-zinc-700"
                            )}
                        />
                    </div>
                </div>

                {/* Tabs */}
                <div className="px-4 pb-4 flex gap-2">
                    {(['all', 'delivered', 'cancelled'] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={clsx(
                                "px-4 py-1.5 rounded-full text-sm font-medium transition-colors capitalize",
                                activeTab === tab
                                    ? "bg-blue-500 text-white"
                                    : "bg-zinc-800 text-zinc-400 hover:text-white"
                            )}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </header>

            <main className="px-4 py-4 space-y-6 flex-1">
                {isLoading ? (
                    // Loading skeletons
                    <div className="space-y-4">
                        <OrderCardSkeleton />
                        <OrderCardSkeleton />
                        <OrderCardSkeleton />
                    </div>
                ) : Object.keys(groupedOrders).length === 0 ? (
                    // Empty state
                    <div className="text-center py-12">
                        <div className="text-4xl mb-4">📋</div>
                        <h3 className="text-white font-medium mb-1">No orders found</h3>
                        <p className="text-zinc-500 text-sm">Your delivery history will appear here</p>
                    </div>
                ) : (
                    // Grouped order list
                    Object.entries(groupedOrders).map(([date, dateOrders], groupIndex) => (
                        <motion.div
                            key={date}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: groupIndex * 0.1 }}
                        >
                            <h3 className="text-sm font-medium text-zinc-500 mb-3 flex items-center gap-2">
                                <Calendar size={14} />
                                {date}
                            </h3>
                            <div className="space-y-3">
                                {dateOrders.map((order) => (
                                    <OrderCard
                                        key={order.id}
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
                                        onClick={() => navigate(`/order/${order.orderId}`)}
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
