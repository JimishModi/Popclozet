/**
 * Dispatch Page — Mobile Layout
 * Assign riders to packed orders and dispatch.
 * Uses lifecycle_state = 'packed', riders from profiles.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Truck, User, MapPin, RefreshCw, CheckCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '@popclozet/auth';
import { supabase } from '@popclozet/api-client';
import { markAsReadyForPickup, getPackedOrders, type OrderWithItems } from '../services/fulfillmentService';
import { useToast } from '../contexts/ToastContext';
import { useRealtimeOrders } from '../hooks/useRealtimeOrders';

interface Rider {
    user_id: string;
    full_name?: string;
}

export function DispatchPage() {
    const { showToast } = useToast();
    const { user } = useAuth();
    const [orders, setOrders] = useState<OrderWithItems[]>([]);
    const [riders, setRiders] = useState<Rider[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedRiders, setSelectedRiders] = useState<Record<string, string>>({});
    const [dispatching, setDispatching] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        try {
            const [packedOrders, ridersRes] = await Promise.all([
                getPackedOrders(),
                supabase.from('profiles').select('user_id, full_name').eq('role', 'rider'),
            ]);
            setOrders(packedOrders);
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
            await markAsReadyForPickup(orderId, user.id, riderId);
            showToast('Rider assigned! Ready for pickup.');
            await loadData();
        } catch (err) {
            showToast('Assignment failed', 'error');
        } finally {
            setDispatching(null);
        }
    };

    if (loading) {
        return (
            <div className="px-4 py-5 space-y-4">
                <div className="h-8 w-32 bg-surface-card rounded-lg animate-pulse" />
                {[...Array(3)].map((_, i) => <div key={i} className="bg-surface-card rounded-xl h-32 animate-pulse" />)}
            </div>
        );
    }

    return (
        <div className="px-4 py-5 space-y-4">
            <div>
                <h1 className="text-lg font-bold text-white flex items-center gap-2">
                    <Truck size={20} className="text-blue-400" /> Dispatch
                </h1>
                <p className="text-xs text-zinc-500">{orders.length} packed orders • {riders.length} riders</p>
            </div>

            <div className="mb-3 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <p className="text-xs text-blue-300">
                    💡 Select a rider and press Go to mark as <strong>Ready for Pickup</strong>. The rider will then navigate to the warehouse and confirm collection from their app.
                </p>
            </div>

            <div className="space-y-2.5">
                <AnimatePresence>
                    {orders.length === 0 ? (
                        <div className="text-center py-12">
                            <Truck size={32} className="mx-auto text-zinc-600 mb-2" />
                            <p className="text-zinc-500 text-sm">No packed orders</p>
                        </div>
                    ) : (
                        orders.map(order => (
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
                                        <p className="text-[10px] text-zinc-400 line-clamp-2">{order.addresses.full_address}</p>
                                    </div>
                                )}

                                <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-1.5 flex-1">
                                        <User size={14} className="text-zinc-500 shrink-0" />
                                        <select
                                            value={selectedRiders[order.id] || ''}
                                            onChange={(e) => setSelectedRiders(s => ({ ...s, [order.id]: e.target.value }))}
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
            </div>
        </div>
    );
}
