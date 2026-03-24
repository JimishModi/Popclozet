/**
 * Dispatch Page — Mobile Layout
 * Assign riders to packed orders and dispatch.
 * Also shows dispatched orders with a live Track button.
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Truck, User, MapPin, RefreshCw, CheckCircle, Navigation, Radio, Package, Clock } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '@popclozet/auth';
import { supabase } from '@popclozet/api-client';
import {
    dispatchOrder,
    getPackedOrders,
    getDispatchedOrders,
    type OrderWithItems,
} from '../services/fulfillmentService';
import { useToast } from '../contexts/ToastContext';
import { useRealtimeOrders } from '../hooks/useRealtimeOrders';

interface Rider {
    user_id: string;
    full_name?: string;
}

export function DispatchPage() {
    const { showToast } = useToast();
    const { user } = useAuth();
    const navigate = useNavigate();

    const [packedOrders, setPackedOrders] = useState<OrderWithItems[]>([]);
    const [dispatchedOrders, setDispatchedOrders] = useState<OrderWithItems[]>([]);
    const [riders, setRiders] = useState<Rider[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedRiders, setSelectedRiders] = useState<Record<string, string>>({});
    const [dispatching, setDispatching] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        try {
            const [packed, dispatched, ridersRes] = await Promise.all([
                getPackedOrders(),
                getDispatchedOrders(),
                supabase.from('profiles').select('user_id, full_name'),
            ]);
            setPackedOrders(packed);
            setDispatchedOrders(dispatched);
            if (ridersRes.data) {
                setRiders(ridersRes.data.map((r: any) => ({
                    user_id: r.user_id,
                    full_name: r.full_name || 'Rider',
                })));
            }
        } catch (err) {
            console.error('Dispatch load error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);
    useRealtimeOrders({ onChange: loadData });

    const handleDispatch = async (orderId: string) => {
        const riderId = selectedRiders[orderId];
        if (!riderId || !user) {
            showToast('Select a rider first', 'error');
            return;
        }

        setDispatching(orderId);
        try {
            await dispatchOrder(orderId, user.id, riderId);
            showToast('Order dispatched!');
            await loadData();
        } catch {
            showToast('Dispatch failed', 'error');
        } finally {
            setDispatching(null);
        }
    };

    const riderName = (riderId: string | null) =>
        riders.find(r => r.user_id === riderId)?.full_name ?? 'Unknown rider';

    if (loading) {
        return (
            <div className="px-4 py-5 space-y-4">
                <div className="h-8 w-32 bg-surface-card rounded-lg animate-pulse" />
                {[...Array(3)].map((_, i) => (
                    <div key={i} className="bg-surface-card rounded-xl h-32 animate-pulse" />
                ))}
            </div>
        );
    }

    return (
        <div className="px-4 py-5 space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-lg font-bold text-white flex items-center gap-2">
                    <Truck size={20} className="text-blue-400" /> Dispatch
                </h1>
                <p className="text-xs text-zinc-500">
                    {packedOrders.length} ready · {dispatchedOrders.length} out
                </p>
            </div>

            {/* ── PACKED — ready to assign & dispatch ── */}
            <section className="space-y-2.5">
                <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                    Ready to Dispatch
                </p>
                <AnimatePresence>
                    {packedOrders.length === 0 ? (
                        <div className="text-center py-8">
                            <CheckCircle size={28} className="mx-auto text-zinc-700 mb-2" />
                            <p className="text-zinc-500 text-sm">No packed orders</p>
                        </div>
                    ) : (
                        packedOrders.map(order => (
                            <motion.div
                                key={order.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-surface-card border border-surface-border rounded-xl p-3.5 space-y-3"
                            >
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-xs text-zinc-500">#{order.id.slice(0, 8)}</p>
                                        <p className="text-sm font-medium text-zinc-200">₹{order.total_amount}</p>
                                    </div>
                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-warehouse-500/15 text-warehouse-400">
                                        packed
                                    </span>
                                </div>

                                {order.addresses?.full_address && (
                                    <div className="flex items-start gap-1.5">
                                        <MapPin size={12} className="text-zinc-500 mt-0.5 shrink-0" />
                                        <p className="text-[10px] text-zinc-400 line-clamp-2">
                                            {order.addresses.full_address}
                                        </p>
                                    </div>
                                )}

                                <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-1.5 flex-1">
                                        <User size={14} className="text-zinc-500 shrink-0" />
                                        <select
                                            value={selectedRiders[order.id] || ''}
                                            onChange={e =>
                                                setSelectedRiders(s => ({ ...s, [order.id]: e.target.value }))
                                            }
                                            className="flex-1 h-8 rounded-lg bg-surface border border-surface-border text-zinc-300 text-xs px-2 appearance-none"
                                        >
                                            <option value="">Select rider...</option>
                                            {riders.map(r => (
                                                <option key={r.user_id} value={r.user_id}>
                                                    {r.full_name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <button
                                        disabled={dispatching === order.id || !selectedRiders[order.id]}
                                        onClick={() => handleDispatch(order.id)}
                                        className={clsx(
                                            'flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all',
                                            selectedRiders[order.id]
                                                ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
                                                : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                                        )}
                                    >
                                        {dispatching === order.id ? (
                                            <RefreshCw size={12} className="animate-spin" />
                                        ) : (
                                            <><CheckCircle size={12} /> Go</>
                                        )}
                                    </button>
                                </div>
                            </motion.div>
                        ))
                    )}
                </AnimatePresence>
            </section>

            {/* ── DISPATCHED — active riders out on delivery ── */}
            <section className="space-y-2.5">
                <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                    Out for Delivery
                </p>
                <AnimatePresence>
                    {dispatchedOrders.length === 0 ? (
                        <div className="text-center py-8">
                            <Truck size={28} className="mx-auto text-zinc-700 mb-2" />
                            <p className="text-zinc-500 text-sm">No active deliveries</p>
                        </div>
                    ) : (
                        dispatchedOrders.map(order => {
                            const isOutForDelivery = order.status === 'out_for_delivery';
                            const isDispatched = order.status === 'dispatched';
                            const isPickedUp = ['order_picked_up', 'picked_up'].includes(order.status);

                            const statusBadge = isOutForDelivery
                                ? { label: 'Out for Delivery', color: 'bg-emerald-500/15 text-emerald-400' }
                                : isDispatched
                                    ? { label: 'Dispatched', color: 'bg-blue-500/15 text-blue-400' }
                                    : isPickedUp
                                        ? { label: 'Picked Up', color: 'bg-amber-500/15 text-amber-400' }
                                        : { label: order.status, color: 'bg-zinc-500/15 text-zinc-400' };

                            return (
                                <motion.div
                                    key={order.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-surface-card border border-surface-border rounded-xl p-3.5 space-y-3"
                                >
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="text-xs text-zinc-500">#{order.id.slice(0, 8)}</p>
                                            <p className="text-sm font-medium text-zinc-200">₹{order.total_amount}</p>
                                        </div>
                                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusBadge.color}`}>
                                            {statusBadge.label}
                                        </span>
                                    </div>

                                    {/* Rider name */}
                                    {order.rider_id && (
                                        <div className="flex items-center gap-1.5">
                                            <User size={12} className="text-zinc-500 shrink-0" />
                                            <p className="text-[10px] text-zinc-400">{riderName(order.rider_id)}</p>
                                        </div>
                                    )}

                                    {order.addresses?.full_address && (
                                        <div className="flex items-start gap-1.5">
                                            <MapPin size={12} className="text-zinc-500 mt-0.5 shrink-0" />
                                            <p className="text-[10px] text-zinc-400 line-clamp-2">
                                                {order.addresses.full_address}
                                            </p>
                                        </div>
                                    )}

                                    {/* Track Live — only for out_for_delivery orders */}
                                    {isOutForDelivery && (
                                        <button
                                            onClick={() => navigate(`/track/${order.id}`)}
                                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/20 transition-colors"
                                        >
                                            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                            <Radio size={12} />
                                            Track Rider Live
                                            <Navigation size={12} />
                                        </button>
                                    )}

                                    {/* Status indicator for non-trackable orders */}
                                    {isDispatched && (
                                        <div className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-blue-500/5 border border-blue-500/10 text-blue-400/60 text-xs">
                                            <Package size={12} />
                                            Rider assigned — awaiting pickup
                                        </div>
                                    )}
                                    {isPickedUp && (
                                        <div className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-amber-500/5 border border-amber-500/10 text-amber-400/60 text-xs">
                                            <Clock size={12} />
                                            Package collected — heading out soon
                                        </div>
                                    )}
                                </motion.div>
                            );
                        })
                    )}
                </AnimatePresence>
            </section>
        </div>
    );
}
