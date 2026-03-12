/**
 * Order Fulfillment Page — Mobile Layout
 * Filter by status + action buttons to transition orders.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ClipboardList, Check, PackageCheck, Truck, Clock, RefreshCw, MapPin } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '@popclozet/auth';
import { getFulfillmentOrders, confirmOrder, packOrder, dispatchOrder, type OrderWithItems } from '../services/fulfillmentService';
import { useToast } from '../contexts/ToastContext';
import { useRealtimeOrders } from '../hooks/useRealtimeOrders';

type StatusFilter = 'pending' | 'confirmed' | 'packed' | 'dispatched';

const filterTabs: { key: StatusFilter; label: string; icon: any; color: string }[] = [
    { key: 'pending', label: 'New', icon: Clock, color: 'text-amber-400' },
    { key: 'confirmed', label: 'Confirmed', icon: Check, color: 'text-blue-400' },
    { key: 'packed', label: 'Packed', icon: PackageCheck, color: 'text-warehouse-400' },
    { key: 'dispatched', label: 'Sent', icon: Truck, color: 'text-emerald-400' },
];

export function OrderFulfillmentPage() {
    const { showToast } = useToast();
    const { user } = useAuth();
    const [filter, setFilter] = useState<StatusFilter>('pending');
    const [allOrders, setAllOrders] = useState<OrderWithItems[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState<string | null>(null);

    const loadOrders = useCallback(async () => {
        try {
            const data = await getFulfillmentOrders();
            setAllOrders(data);
        } catch (err) {
            console.error('Load orders error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadOrders(); }, [loadOrders]);
    useRealtimeOrders({ onChange: loadOrders });

    const orders = allOrders.filter(o => o.status === filter);

    const handleAction = async (order: OrderWithItems) => {
        setProcessing(order.id);
        try {
            const actorId = user?.id || 'anonymous';
            if (filter === 'pending') {
                await confirmOrder(order.id, actorId);
                showToast('Order confirmed');
            } else if (filter === 'confirmed') {
                await packOrder(order.id, actorId);
                showToast('Order packed');
            } else if (filter === 'packed') {
                await dispatchOrder(order.id, actorId);
                showToast('Order dispatched');
            }
            await loadOrders();
        } catch (err: any) {
            console.error('Order action error:', err);
            showToast(err.message || 'Action failed', 'error');
        } finally {
            setProcessing(null);
        }
    };

    const actionLabel: Record<StatusFilter, string> = {
        pending: 'Confirm',
        confirmed: 'Pack',
        packed: 'Dispatch',
        dispatched: '',
    };

    return (
        <div className="px-4 py-5 space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-bold text-white flex items-center gap-2">
                        <ClipboardList size={20} className="text-blue-400" /> Orders
                    </h1>
                    <p className="text-xs text-zinc-500">{orders.length} {filter} orders</p>
                </div>
                <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] text-emerald-400 font-semibold">LIVE</span>
                </div>
            </div>

            <div className="flex gap-2 overflow-x-auto no-scrollbar">
                {filterTabs.map(({ key, label, icon: Icon, color }) => (
                    <button
                        key={key}
                        onClick={() => setFilter(key)}
                        className={clsx(
                            'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shrink-0',
                            filter === key
                                ? 'bg-warehouse-500/15 text-warehouse-300 border border-warehouse-500/30'
                                : 'bg-surface-card text-zinc-500 border border-surface-border hover:text-zinc-300'
                        )}
                    >
                        <Icon size={14} className={filter === key ? 'text-warehouse-400' : color} />
                        {label}
                    </button>
                ))}
            </div>

            <div className="space-y-2.5">
                <AnimatePresence mode="popLayout">
                    {loading ? (
                        [...Array(3)].map((_, i) => <div key={i} className="bg-surface-card rounded-xl h-24 animate-pulse" />)
                    ) : orders.length === 0 ? (
                        <div className="text-center py-12">
                            <ClipboardList size={32} className="mx-auto text-zinc-600 mb-2" />
                            <p className="text-zinc-500 text-sm">No {filter} orders</p>
                        </div>
                    ) : (
                        orders.map(order => {
                            const isProcessing = processing === order.id;
                            return (
                                <motion.div
                                    key={order.id}
                                    layout
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="bg-surface-card border border-surface-border rounded-xl p-3.5"
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <div>
                                            <p className="text-xs text-zinc-500">#{order.id.slice(0, 8)}</p>
                                            <p className="text-sm font-medium text-zinc-200 mt-0.5">₹{order.total_amount}</p>
                                        </div>
                                        <span className={clsx(
                                            'text-[10px] font-semibold px-2 py-0.5 rounded-full',
                                            filter === 'pending' && 'bg-amber-500/15 text-amber-400',
                                            filter === 'confirmed' && 'bg-blue-500/15 text-blue-400',
                                            filter === 'packed' && 'bg-warehouse-500/15 text-warehouse-400',
                                            filter === 'dispatched' && 'bg-emerald-500/15 text-emerald-400',
                                        )}>
                                            {order.status}
                                        </span>
                                    </div>

                                    {order.addresses?.full_address && (
                                        <div className="flex items-start gap-1.5 mb-2">
                                            <MapPin size={12} className="text-zinc-500 mt-0.5 shrink-0" />
                                            <p className="text-[10px] text-zinc-400 line-clamp-1">{order.addresses.full_address}</p>
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between">
                                        <p className="text-[10px] text-zinc-500">
                                            {new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                        </p>

                                        {actionLabel[filter] && (
                                            <button
                                                disabled={isProcessing}
                                                onClick={() => handleAction(order)}
                                                className={clsx(
                                                    'flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                                                    isProcessing ? 'opacity-50 cursor-not-allowed' : '',
                                                    filter === 'pending' && 'bg-blue-500/15 text-blue-400 hover:bg-blue-500/25',
                                                    filter === 'confirmed' && 'bg-warehouse-500/15 text-warehouse-400 hover:bg-warehouse-500/25',
                                                    filter === 'packed' && 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25',
                                                )}
                                            >
                                                {isProcessing ? <RefreshCw size={12} className="animate-spin" /> : actionLabel[filter]}
                                            </button>
                                        )}
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
