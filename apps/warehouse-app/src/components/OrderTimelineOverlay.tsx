import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, PackageCheck, Truck, RefreshCw, AlertCircle, FileText } from 'lucide-react';
import { clsx } from 'clsx';
import { supabase } from '@popclozet/api-client';

interface ActivityLog {
    id: string;
    action: string;
    entity_type: string;
    details: any;
    created_at: string;
    actor_id?: string;
}

interface Props {
    orderId: string;
    onClose: () => void;
}

export function OrderTimelineOverlay({ orderId, onClose }: Props) {
    const [logs, setLogs] = useState<ActivityLog[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchLogs() {
            setLoading(true);
            try {
                const { data, error } = await supabase
                    .from('warehouse_activity_log')
                    .select('*')
                    .eq('entity_id', orderId)
                    .order('created_at', { ascending: false });

                if (!error && data) {
                    setLogs(data);
                }
            } catch (err) {
                console.error('Failed to load activity logs:', err);
            } finally {
                setLoading(false);
            }
        }

        if (orderId) {
            fetchLogs();
        }
    }, [orderId]);

    const getIconForAction = (action: string) => {
        if (action.includes('created')) return <FileText size={14} className="text-blue-400" />;
        if (action.includes('packed') || action.includes('return_at_warehouse')) return <PackageCheck size={14} className="text-warehouse-400" />;
        if (action.includes('dispatched') || action.includes('delivery')) return <Truck size={14} className="text-emerald-400" />;
        if (action.includes('return')) return <RefreshCw size={14} className="text-amber-400" />;
        return <Clock size={14} className="text-zinc-400" />;
    };

    const formatActionText = (log: ActivityLog) => {
        const { action, details } = log;
        if (action === 'status_updated') {
            return `Status changed from ${details?.old_status} to ${details?.new_status}`;
        }
        if (action === 'order_created') {
            return `Order created (Status: ${details?.status})`;
        }
        if (action === 'return_status_updated') {
            return `Return status updated to ${details?.new_status}`;
        }
        if (action === 'return_request_created') {
            return `Return scheduled`;
        }
        if (action === 'auto_inventory_deduction') {
            return 'Inventory automatically deducted';
        }
        return action;
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="fixed inset-0 bg-black/60 z-[100] backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
            >
                <motion.div
                    initial={{ y: '100%' }}
                    animate={{ y: 0 }}
                    exit={{ y: '100%' }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    onClick={e => e.stopPropagation()}
                    className="w-full sm:max-w-md bg-surface-card rounded-t-3xl sm:rounded-3xl border sm:border-surface-border border-transparent overflow-hidden flex flex-col h-[85vh] sm:h-auto sm:max-h-[85vh]"
                >
                    <div className="flex-none p-4 pb-2 border-b border-surface-border bg-surface-card z-10">
                        <div className="w-12 h-1 bg-zinc-800 rounded-full mx-auto mb-4 sm:hidden" />
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-white leading-tight">Order Activity</h2>
                                <p className="text-xs text-zinc-400">#{orderId.split('-')[0].toUpperCase()}</p>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 rounded-full bg-surface hover:bg-surface-hover text-zinc-400 hover:text-white transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                        {loading ? (
                            <div className="flex items-center justify-center h-32">
                                <RefreshCw size={24} className="text-warehouse-500 animate-spin" />
                            </div>
                        ) : logs.length === 0 ? (
                            <div className="text-center py-8">
                                <AlertCircle size={32} className="mx-auto text-zinc-600 mb-2" />
                                <p className="text-sm text-zinc-400">No activity recorded yet.</p>
                            </div>
                        ) : (
                            <div className="relative pl-6 space-y-6 before:absolute before:inset-0 before:ml-2.5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-surface-border before:to-transparent">
                                {logs.map((log, index) => (
                                    <div key={log.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                        {/* Timeline Dot */}
                                        <div className="flex items-center justify-center w-6 h-6 rounded-full border-4 border-surface-card bg-surface-card absolute -left-6 translate-x-[-2px] shrink-0 z-10 shadow">
                                            {getIconForAction(log.action)}
                                        </div>

                                        {/* Card */}
                                        <div className="w-full mb-1 p-3 rounded-xl bg-surface-card border border-surface-border shadow-sm">
                                            <div className="flex items-start justify-between gap-4 mb-1">
                                                <h3 className="text-xs font-bold text-white capitalize">
                                                    {formatActionText(log)}
                                                </h3>
                                                <time className="text-[10px] text-zinc-500 font-medium shrink-0">
                                                    {new Date(log.created_at).toLocaleString('en-IN', {
                                                        day: 'numeric', month: 'short',
                                                        hour: '2-digit', minute: '2-digit'
                                                    })}
                                                </time>
                                            </div>
                                            {(log.details?.old_status || log.details?.new_status) && (
                                                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                                    {log.details.old_status && (
                                                        <span className="px-1.5 py-0.5 rounded-md bg-zinc-800 text-[10px] text-zinc-400 font-medium">
                                                            {log.details.old_status}
                                                        </span>
                                                    )}
                                                    {log.details.old_status && log.details.new_status && (
                                                        <span className="text-zinc-600 text-[10px]">→</span>
                                                    )}
                                                    {log.details.new_status && (
                                                        <span className="px-1.5 py-0.5 rounded-md bg-warehouse-500/10 text-warehouse-400 border border-warehouse-500/20 text-[10px] font-bold">
                                                            {log.details.new_status}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}

export default OrderTimelineOverlay;
