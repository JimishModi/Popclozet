import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/services/supabase';
import { transitionOrderState } from '@/services/orderStateMachine';
import type { Order } from '@/types';
import { SkeletonOrderCard } from '@/components/ui/Skeleton';
import { formatCurrency } from '@/utils/helpers';
import { formatDate } from '@/utils/date';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';

const containerVariants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.06,
        },
    },
};

const itemVariants = {
    hidden: { opacity: 0, y: 16, scale: 0.98 },
    show: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: {
            type: 'spring',
            stiffness: 300,
            damping: 24,
        },
    },
};

export const OrdersPage: React.FC = () => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (user) {
            fetchOrders();
        }
    }, [user]);

    const fetchOrders = async () => {
        try {
            const { data, error } = await supabase
                .from('orders')
                .select(`
          *,
          items:order_items(
            *,
            product:products(*)
          )
        `)
                .eq('user_id', user!.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setOrders(data || []);
        } catch (error) {
            console.error('Error fetching orders:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCancelOrder = async (orderId: string, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent navigation to order details

        const confirmed = window.confirm(
            'Are you sure you want to cancel this order?\n\n' +
            'This action cannot be undone.'
        );

        if (!confirmed) return;

        try {
            // PHASE 1: Use state machine RPC instead of direct update
            // This enforces server-side transition validation
            const result = await transitionOrderState(
                orderId,
                'cancelled',
                'customer',
                user!.id
            );

            if (!result.success) {
                // Handle specific error cases
                if (result.code === 'INVALID_TRANSITION') {
                    throw new Error(`Cannot cancel order: ${result.message || 'Order is no longer cancellable'}`);
                } else if (result.code === 'NOT_ORDER_OWNER') {
                    throw new Error('You can only cancel your own orders');
                } else {
                    throw new Error(result.message || 'Failed to cancel order');
                }
            }

            // Update local state immediately
            setOrders(prevOrders =>
                prevOrders.map(order =>
                    order.id === orderId
                        ? { ...order, status: 'cancelled' as const }
                        : order
                )
            );

            alert('Order cancelled successfully');
        } catch (error: any) {
            console.error('Error cancelling order:', error);
            alert(error.message || 'Failed to cancel order');
        }
    };

    const canCancelOrder = (status: string) => {
        return !['delivered', 'cancelled', 'returned'].includes(status);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'delivered':
            case 'completed':
                return 'bg-green-500/20 text-green-400';
            case 'out_for_delivery':
            case 'dispatched':
                return 'bg-blue-500/20 text-blue-400';
            case 'cancelled':
                return 'bg-red-500/20 text-red-400';
            default:
                return 'bg-yellow-500/20 text-yellow-400';
        }
    };

    const getStatusText = (status: string) => {
        return status.split('_').map(word =>
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] py-6 px-4">
                <div className="h-7 w-32 bg-white/5 rounded-lg mb-6 relative overflow-hidden">
                    <div className="absolute inset-0 skeleton-shimmer" />
                </div>
                <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: i * 0.08 }}
                        >
                            <SkeletonOrderCard />
                        </motion.div>
                    ))}
                </div>
            </div>
        );
    }

    if (orders.length === 0) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                    className="text-center"
                >
                    <svg
                        className="mx-auto h-20 w-20 text-zinc-600 mb-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                        />
                    </svg>
                    <h2 className="text-2xl font-bold text-white mb-2">No orders yet</h2>
                    <p className="text-zinc-400 mb-6">Start shopping to see your orders here</p>
                    <Button onClick={() => navigate('/products')}>Browse Products</Button>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0a0a0a] py-6 px-4">
            <motion.h1
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-2xl font-bold text-white mb-6"
            >
                My Orders
            </motion.h1>

            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="space-y-4"
            >
                {orders.map((order) => (
                    <motion.div
                        key={order.id}
                        variants={itemVariants}
                        onClick={() => navigate(`/orders/${order.id}`)}
                        whileTap={{ scale: 0.98 }}
                        className="bg-gradient-to-br from-white/8 to-white/3 backdrop-blur-xl rounded-2xl p-4 border border-white/10 cursor-pointer hover:border-[#ff4d6d]/30 transition-all"
                    >
                        <div className="flex items-start justify-between mb-3">
                            <div>
                                <p className="text-sm text-zinc-500">Order #{order.id.slice(0, 8)}</p>
                                <p className="text-xs text-zinc-600 mt-1">
                                    Placed on {formatDate(order.created_at)}
                                </p>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(order.status)}`}>
                                {getStatusText(order.status)}
                            </span>
                        </div>

                        <div className="flex items-center gap-3 mb-4">
                            {order.items?.slice(0, 3).map((item: any) => (
                                <div key={item.id} className="w-14 h-18 bg-zinc-800 rounded-lg overflow-hidden">
                                    {item.product?.images?.[0] && (
                                        <img
                                            src={item.product.images[0]}
                                            alt={item.product.name}
                                            className="w-full h-full object-cover"
                                        />
                                    )}
                                </div>
                            ))}
                            {order.items && order.items.length > 3 && (
                                <div className="text-sm text-zinc-500">
                                    +{order.items.length - 3} more
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-white/5">
                            <p className="text-lg font-bold text-white">
                                {formatCurrency(order.total_amount)}
                            </p>
                            <div className="flex gap-2">
                                {canCancelOrder(order.status) && (
                                    <button
                                        onClick={(e) => handleCancelOrder(order.id, e)}
                                        className="px-3 py-1.5 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                                    >
                                        Cancel
                                    </button>
                                )}
                                <span className="text-[#ff4d6d] font-medium text-sm">
                                    View Details →
                                </span>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </motion.div>
        </div>
    );
};
