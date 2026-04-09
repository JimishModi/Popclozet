/**
 * Rider Dashboard Page
 * 
 * Main dashboard for delivery riders
 * 
 * Features:
 * - View assigned/available orders
 * - Accept delivery jobs
 * - Navigate to active delivery
 * - Submit location telemetry (background)
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@popclozet/auth';
import { supabase, transitionOrderState } from '@popclozet/api-client';
import { Loader } from '@popclozet/ui';
import { formatCurrency } from '@/utils/helpers';
import { motion } from 'framer-motion';
import { Button } from '@/components/Button';
import { useToast } from '@/contexts/ToastContext';

interface RiderOrder {
    id: string;
    status: string;
    total_amount: number;
    created_at: string;
    delivery_address: {
        full_address: string;
        latitude: number;
        longitude: number;
    };
    user_id: string;
    payment_method: string | null;
    customer_profiles?: {
        full_name: string | null;
        phone: string | null;
    };
}

export const RiderDashboardPage: React.FC = () => {
    const { user, profile } = useAuth();
    const { showToast } = useToast();
    const navigate = useNavigate();

    const [assignedOrders, setAssignedOrders] = useState<RiderOrder[]>([]);
    const [activeDelivery, setActiveDelivery] = useState<RiderOrder | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAssignedOrders();
    }, [user?.id]);

    const fetchAssignedOrders = async () => {
        if (!user?.id) return;

        try {
            const { data, error } = await supabase
                .from('orders')
                .select(`
                    id, status, total_amount, created_at, user_id, payment_method,
                    delivery_address:addresses(full_address, latitude, longitude),
                    customer_profiles!orders_user_id_fkey1(full_name, phone)
                `)
                .eq('rider_id', user.id)
                .in('status', ['ready_for_pickup', 'driver_arrived_warehouse', 'order_picked_up', 'dispatched', 'out_for_delivery'])
                .order('created_at', { ascending: false });

            if (error) throw error;

            const orders: RiderOrder[] = (data || []).map(o => ({
                ...o,
                delivery_address: Array.isArray(o.delivery_address)
                    ? o.delivery_address[0]
                    : o.delivery_address,
                customer_profiles: Array.isArray(o.customer_profiles)
                    ? o.customer_profiles[0]
                    : o.customer_profiles
            }));

            setAssignedOrders(orders);

            // Find active delivery (out_for_delivery status)
            const active = orders.find(o => o.status === 'out_for_delivery');
            setActiveDelivery(active || null);
        } catch (error) {
            console.error('Error fetching assigned orders:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleStartDelivery = async (orderId: string) => {
        try {
            const result = await transitionOrderState(
                orderId,
                'out_for_delivery',
                'rider',
                user!.id
            );

            if (!result.success) {
                throw new Error(result.message || 'Failed to start delivery');
            }

            showToast('Delivery started!', 'success');
            fetchAssignedOrders();
        } catch (error: any) {
            showToast(error.message || 'Failed to start delivery', 'error');
        }
    };

    const handleCompleteDelivery = async (orderId: string) => {
        try {
            const result = await transitionOrderState(
                orderId,
                'delivered',
                'rider',
                user!.id
            );

            if (!result.success) {
                throw new Error(result.message || 'Failed to complete delivery');
            }

            showToast('Delivery completed!', 'success');
            fetchAssignedOrders();
        } catch (error: any) {
            showToast(error.message || 'Failed to complete delivery', 'error');
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'ready_for_pickup':
            case 'driver_arrived_warehouse':
            case 'order_picked_up':
                return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
            case 'dispatched':
                return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
            case 'out_for_delivery':
                return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
            default:
                return 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30';
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
                <Loader size="lg" text="Loading deliveries..." />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0a0a0a] p-6">
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-white">Rider Dashboard</h1>
                    <p className="text-zinc-400 mt-1">
                        Welcome, {profile?.full_name || 'Rider'}
                    </p>
                </div>

                {/* Active Delivery Card */}
                {activeDelivery && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-6 p-5 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-2xl border border-blue-500/30"
                    >
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-2xl">🚴</span>
                            <h2 className="text-lg font-bold text-white">Active Delivery</h2>
                        </div>
                        <p className="text-sm text-zinc-300 mb-1">
                            {activeDelivery.delivery_address?.full_address || 'Address not available'}
                        </p>
                        {activeDelivery.customer_profiles?.phone && (
                            <p className="text-sm text-zinc-400 mb-1">
                                📞 {activeDelivery.customer_profiles.full_name ? `${activeDelivery.customer_profiles.full_name} — ` : ''}{activeDelivery.customer_profiles.phone}
                            </p>
                        )}
                        {activeDelivery.payment_method && (
                            <span className={`inline-block px-2 py-0.5 text-[10px] font-bold uppercase rounded mb-3 ${
                                activeDelivery.payment_method === 'cod'
                                    ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                                    : 'bg-green-500/20 text-green-400 border border-green-500/30'
                            }`}>
                                {activeDelivery.payment_method === 'cod' ? 'Pay on Delivery' : 'Paid Online'}
                            </span>
                        )}
                        <div className="flex gap-3">
                            <Button
                                onClick={() => navigate(`/delivery/${activeDelivery.id}`)}
                                className="flex-1"
                            >
                                Navigate
                            </Button>
                            <Button
                                onClick={() => handleCompleteDelivery(activeDelivery.id)}
                                variant="outline"
                                className="flex-1"
                            >
                                Mark Delivered
                            </Button>
                        </div>
                    </motion.div>
                )}

                {/* Assigned Orders */}
                <div className="bg-gradient-to-br from-white/8 to-white/3 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
                    <h2 className="text-xl font-semibold text-white mb-4">
                        Assigned Orders ({assignedOrders.length})
                    </h2>

                    {assignedOrders.length === 0 ? (
                        <div className="text-center py-8">
                            <span className="text-4xl block mb-3">📦</span>
                            <p className="text-zinc-400">No assigned orders</p>
                            <p className="text-zinc-500 text-sm">Check back soon for new deliveries</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {assignedOrders.map((order) => (
                                <motion.div
                                    key={order.id}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="p-4 bg-white/5 rounded-xl border border-white/5"
                                >
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-sm font-mono text-zinc-400">
                                            #{order.id.slice(0, 8)}
                                        </span>
                                        <span className={`px-2 py-1 text-xs font-medium rounded border ${getStatusBadge(order.status)}`}>
                                            {order.status.replace(/_/g, ' ')}
                                        </span>
                                    </div>
                                    <p className="text-sm text-white mb-1 line-clamp-2">
                                        📍 {order.delivery_address?.full_address || 'Address not available'}
                                    </p>
                                    {order.customer_profiles?.phone && (
                                        <p className="text-sm text-zinc-400 mb-1">
                                            📞 {order.customer_profiles.full_name ? `${order.customer_profiles.full_name} — ` : ''}{order.customer_profiles.phone}
                                        </p>
                                    )}
                                    {order.payment_method && (
                                        <span className={`inline-block px-2 py-0.5 text-[10px] font-bold uppercase rounded mb-2 ${
                                            order.payment_method === 'cod'
                                                ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                                                : 'bg-green-500/20 text-green-400 border border-green-500/30'
                                        }`}>
                                            {order.payment_method === 'cod' ? 'Pay on Delivery' : 'Paid Online'}
                                        </span>
                                    )}
                                    <div className="flex items-center justify-between">
                                        <span className="text-lg font-bold text-[#ff4d6d]">
                                            {formatCurrency(order.total_amount)}
                                        </span>
                                        {order.status === 'dispatched' ? (
                                            <Button
                                                onClick={() => handleStartDelivery(order.id)}
                                                size="sm"
                                            >
                                                Start Delivery
                                            </Button>
                                        ) : ['ready_for_pickup', 'driver_arrived_warehouse', 'order_picked_up'].includes(order.status) ? (
                                            <Button
                                                onClick={() => navigate(`/warehouse-navigation/${order.id}`)}
                                                size="sm"
                                                variant="outline"
                                            >
                                                Warehouse Pickup
                                            </Button>
                                        ) : null}
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Rider Stats (placeholder) */}
                <div className="mt-6 grid grid-cols-2 gap-4">
                    <div className="bg-gradient-to-br from-white/8 to-white/3 rounded-xl p-4 border border-white/10 text-center">
                        <p className="text-2xl font-bold text-white">—</p>
                        <p className="text-xs text-zinc-400">Today's Deliveries</p>
                    </div>
                    <div className="bg-gradient-to-br from-white/8 to-white/3 rounded-xl p-4 border border-white/10 text-center">
                        <p className="text-2xl font-bold text-green-400">—</p>
                        <p className="text-xs text-zinc-400">Earnings</p>
                    </div>
                </div>
            </div>
        </div>
    );
};
