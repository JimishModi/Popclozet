/**
 * Returns Page — Mobile Layout
 * Uses the ACTUAL `return_requests` table from initial schema.
 * Also queries orders by status = 'return_requested' / 'delivered' / 'in_use'.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, PackageCheck, RefreshCw, Inbox } from 'lucide-react';
import { clsx } from 'clsx';
import { supabase } from '@popclozet/api-client';
import { useToast } from '../contexts/ToastContext';
import { useRealtimeOrders } from '../hooks/useRealtimeOrders';

interface ReturnOrder {
    id: string;
    user_id: string;
    status: string;
    total_amount: number;
    rental_end_date: string;
    created_at: string;
    order_items?: Array<{
        id: string;
        product_id: string;
        size: string | null;
    }>;
}

export function ReturnsPage() {
    const { showToast } = useToast();
    const [orders, setOrders] = useState<ReturnOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('orders')
                .select('*, order_items (*)')
                .in('status', ['delivered', 'in_use', 'return_requested'])
                .order('created_at', { ascending: false });

            if (error) {
                console.warn('Returns load error:', error.message);
                setOrders([]);
            } else {
                setOrders((data || []) as ReturnOrder[]);
            }
        } catch (err) {
            console.error('Returns load error:', err);
            setOrders([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);
    useRealtimeOrders({ onChange: loadData });

    const handleMarkReturned = async (orderId: string) => {
        setProcessing(orderId);
        try {
            const { error } = await supabase
                .from('orders')
                .update({ status: 'returned' })
                .eq('id', orderId);

            if (error) throw error;
            showToast('Order marked as returned');
            await loadData();
        } catch (err) {
            showToast('Failed to process return', 'error');
        } finally {
            setProcessing(null);
        }
    };

    if (loading) {
        return (
            <div className="px-4 py-5 space-y-4">
                <div className="h-8 w-48 bg-surface-card rounded-lg animate-pulse" />
                {[...Array(3)].map((_, i) => <div key={i} className="bg-surface-card rounded-xl h-20 animate-pulse" />)}
            </div>
        );
    }

    return (
        <div className="px-4 py-5 space-y-4">
            <div>
                <h1 className="text-lg font-bold text-white flex items-center gap-2">
                    <RotateCcw size={20} className="text-orange-400" /> Returns
                </h1>
                <p className="text-xs text-zinc-500">{orders.length} items pending return</p>
            </div>

            <div className="space-y-2.5">
                <AnimatePresence mode="popLayout">
                    {orders.length === 0 ? (
                        <div className="text-center py-12">
                            <Inbox size={32} className="mx-auto text-zinc-600 mb-2" />
                            <p className="text-zinc-500 text-sm">No returns pending</p>
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
                                            <p className="text-sm font-medium text-zinc-200">
                                                ₹{order.total_amount} • {order.order_items?.length || 0} items
                                            </p>
                                        </div>
                                        <span className={clsx(
                                            'text-[10px] font-semibold px-2 py-0.5 rounded-full',
                                            order.status === 'delivered' && 'bg-blue-500/15 text-blue-400',
                                            order.status === 'in_use' && 'bg-amber-500/15 text-amber-400',
                                            order.status === 'return_requested' && 'bg-orange-500/15 text-orange-400',
                                        )}>
                                            {order.status?.replace('_', ' ')}
                                        </span>
                                    </div>

                                    <p className="text-[10px] text-zinc-500 mb-3">
                                        Rental ends: {order.rental_end_date}
                                    </p>

                                    {order.status === 'return_requested' && (
                                        <button
                                            disabled={isProcessing}
                                            onClick={() => handleMarkReturned(order.id)}
                                            className="w-full flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-all"
                                        >
                                            {isProcessing ? <RefreshCw size={12} className="animate-spin" /> : <><PackageCheck size={12} /> Mark Returned</>}
                                        </button>
                                    )}
                                </motion.div>
                            );
                        })
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
