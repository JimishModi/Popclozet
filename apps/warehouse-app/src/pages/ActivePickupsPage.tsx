/**
 * Active Pickups Page — Warehouse Dashboard
 * Shows orders currently being handled by riders.
 * Statuses: ready_for_pickup, driver_arrived_warehouse, order_picked_up, dispatched
 * Uses realtime subscriptions for live updates.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Truck, Package, MapPin, User, Clock, CheckCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { KeyRound, RefreshCw } from 'lucide-react';
import { getActivePickups, generateWarehouseOtp, type OrderWithItems } from '../services/fulfillmentService';
import { useToast } from '../contexts/ToastContext';
import { useRealtimeOrders } from '../hooks/useRealtimeOrders';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    ready_for_pickup: {
        label: 'Awaiting Rider',
        color: 'text-amber-400',
        bg: 'bg-amber-500/15',
    },
    driver_arrived_warehouse: {
        label: 'Rider at Warehouse',
        color: 'text-blue-400',
        bg: 'bg-blue-500/15',
    },
    order_picked_up: {
        label: 'Picked Up',
        color: 'text-purple-400',
        bg: 'bg-purple-500/15',
    },
    dispatched: {
        label: 'Dispatched',
        color: 'text-emerald-400',
        bg: 'bg-emerald-500/15',
    },
};

export function ActivePickupsPage() {
    const { showToast } = useToast();
    const [orders, setOrders] = useState<OrderWithItems[]>([]);
    const [loading, setLoading] = useState(true);
    const [generatingOtp, setGeneratingOtp] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        try {
            const data = await getActivePickups();
            setOrders(data);
        } catch (err) {
            console.error('ActivePickups load error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);
    useRealtimeOrders({ onChange: loadData });

    const handleGenerateOtp = async (orderId: string) => {
        setGeneratingOtp(orderId);
        try {
            const { otp } = await generateWarehouseOtp(orderId);
            showToast('OTP generated successfully!', 'success');
            // Optimistically update the local order state
            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, warehouse_otp: otp } : o));
        } catch (err: any) {
            console.error('Failed to generate OTP:', err);
            showToast(err.message || 'Failed to generate OTP', 'error');
        } finally {
            setGeneratingOtp(null);
        }
    };

    if (loading) {
        return (
            <div className="px-4 py-5 space-y-4">
                <div className="h-8 w-48 bg-surface-card rounded-lg animate-pulse" />
                {[...Array(3)].map((_, i) => <div key={i} className="bg-surface-card rounded-xl h-32 animate-pulse" />)}
            </div>
        );
    }

    return (
        <div className="px-4 py-5 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-bold text-white flex items-center gap-2">
                        <Truck size={20} className="text-purple-400" /> Active Pickups
                    </h1>
                    <p className="text-xs text-zinc-500">{orders.length} orders in progress</p>
                </div>
                <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] text-emerald-400 font-semibold">LIVE</span>
                </div>
            </div>

            {/* Orders List */}
            <div className="space-y-3">
                <AnimatePresence>
                    {orders.length === 0 ? (
                        <div className="text-center py-12">
                            <Package size={32} className="mx-auto text-zinc-600 mb-2" />
                            <p className="text-zinc-500 text-sm">No active pickups</p>
                            <p className="text-zinc-600 text-xs mt-1">Orders will appear here when marked as Ready for Pickup</p>
                        </div>
                    ) : (
                        orders.map(order => {
                            const statusInfo = STATUS_CONFIG[order.status] || {
                                label: order.status,
                                color: 'text-zinc-400',
                                bg: 'bg-zinc-500/15',
                            };
                            const riderName = (order as any).rider?.full_name || 'Unassigned';
                            const itemCount = order.order_items?.length || 0;

                            return (
                                <motion.div
                                    key={order.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="bg-surface-card border border-surface-border rounded-xl p-4 space-y-3"
                                >
                                    {/* Order ID + Status Badge */}
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="text-xs text-zinc-500">Order #{order.id.slice(0, 8)}</p>
                                            <p className="text-sm font-semibold text-zinc-200 mt-0.5">₹{order.total_amount}</p>
                                        </div>
                                        <span className={clsx(
                                            'text-[10px] font-bold px-2.5 py-1 rounded-full',
                                            statusInfo.bg,
                                            statusInfo.color
                                        )}>
                                            {statusInfo.label}
                                        </span>
                                    </div>

                                    {/* Package Details */}
                                    <div className="flex items-center gap-2">
                                        <Package size={14} className="text-zinc-500 shrink-0" />
                                        <p className="text-xs text-zinc-400">
                                            {itemCount} item{itemCount !== 1 ? 's' : ''}
                                        </p>
                                    </div>

                                    {/* Delivery Address */}
                                    {order.addresses?.full_address && (
                                        <div className="flex items-start gap-2">
                                            <MapPin size={14} className="text-zinc-500 mt-0.5 shrink-0" />
                                            <p className="text-xs text-zinc-400 line-clamp-1">{order.addresses.full_address}</p>
                                        </div>
                                    )}

                                    {/* Rider + Time */}
                                    <div className="flex items-center justify-between pt-2 border-t border-surface-border">
                                        <div className="flex items-center gap-2">
                                            <User size={14} className="text-purple-400" />
                                            <span className="text-xs font-medium text-zinc-300">{riderName}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <Clock size={12} className="text-zinc-600" />
                                            <span className="text-[10px] text-zinc-500">
                                                {new Date(order.created_at).toLocaleTimeString('en-IN', {
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                })}
                                            </span>
                                        </div>
                                    </div>

                                    {/* OTP Section (Only for ready_for_pickup) */}
                                    {order.status === 'ready_for_pickup' && (
                                        <div className="mt-3 p-3 bg-zinc-800/50 rounded-lg border border-zinc-700/50 flex flex-col items-center justify-center gap-2">
                                            {order.warehouse_otp ? (
                                                <>
                                                    <div className="flex items-center gap-2 text-zinc-400 text-xs">
                                                        <KeyRound size={14} /> Arrival PIN for Driver
                                                    </div>
                                                    <div className="text-2xl font-mono font-bold tracking-[0.2em] text-white">
                                                        {order.warehouse_otp}
                                                    </div>
                                                    <button
                                                        onClick={() => handleGenerateOtp(order.id)}
                                                        disabled={generatingOtp === order.id}
                                                        className="mt-1 flex items-center gap-1.5 text-[10px] text-zinc-400 hover:text-white transition-colors"
                                                    >
                                                        <RefreshCw size={10} className={clsx(generatingOtp === order.id && "animate-spin")} />
                                                        Regenerate PIN
                                                    </button>
                                                </>
                                            ) : (
                                                <button
                                                    onClick={() => handleGenerateOtp(order.id)}
                                                    disabled={generatingOtp === order.id}
                                                    className="w-full py-2 bg-purple-500/15 text-purple-400 border border-purple-500/30 rounded-lg text-xs font-semibold hover:bg-purple-500/25 transition-all flex items-center justify-center gap-2"
                                                >
                                                    {generatingOtp === order.id ? (
                                                        <RefreshCw size={14} className="animate-spin" />
                                                    ) : (
                                                        <KeyRound size={14} />
                                                    )}
                                                    Generate Arrival PIN
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {/* Progress Indicator */}
                                    <div className="flex items-center gap-1">
                                        {['ready_for_pickup', 'driver_arrived_warehouse', 'order_picked_up', 'dispatched'].map((s, i) => (
                                            <div
                                                key={s}
                                                className={clsx(
                                                    'h-1 flex-1 rounded-full transition-all duration-500',
                                                    ['ready_for_pickup', 'driver_arrived_warehouse', 'order_picked_up', 'dispatched']
                                                        .indexOf(order.status) >= i
                                                        ? 'bg-gradient-to-r from-purple-500 to-emerald-500'
                                                        : 'bg-zinc-800'
                                                )}
                                            />
                                        ))}
                                    </div>
                                </motion.div>
                            );
                        })
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
