/**
 * Admin Orders Page
 * 
 * Phase 3: Read-only order visibility for operations
 * 
 * Design Principles:
 * - Read-only: Cannot modify orders (use state machine via authorized roles)
 * - Full visibility: Can see all orders regardless of user
 * - Audit access: Links to audit trail for each order
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '@/services/supabase';
import { Loader } from '@/components/ui/Loader';
import { formatCurrency } from '@/utils/helpers';
import { formatDate } from '@/utils/date';
import { motion } from 'framer-motion';

interface AdminOrder {
    id: string;
    status: string;
    total_amount: number;
    created_at: string;
    user_id: string;
    rider_id: string | null;
}

interface AuditEntry {
    id: string;
    from_status: string;
    to_status: string;
    actor_role: string;
    transition_result: { success: boolean; code?: string };
    confidence_score: number | null;
    created_at: string;
}

export const OrdersAdminPage: React.FC = () => {
    const [orders, setOrders] = useState<AdminOrder[]>([]);
    const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
    const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [auditLoading, setAuditLoading] = useState(false);

    useEffect(() => {
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        try {
            const { data, error } = await supabase
                .from('orders')
                .select('id, status, total_amount, created_at, user_id, rider_id')
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;
            setOrders(data || []);
        } catch (error) {
            console.error('Error fetching orders:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchAuditLog = async (orderId: string) => {
        setAuditLoading(true);
        setSelectedOrder(orderId);

        try {
            const { data, error } = await supabase
                .from('order_audit_log')
                .select('id, from_status, to_status, actor_role, transition_result, confidence_score, created_at')
                .eq('order_id', orderId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setAuditLog(data || []);
        } catch (error) {
            console.error('Error fetching audit log:', error);
        } finally {
            setAuditLoading(false);
        }
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

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
                <Loader size="lg" text="Loading orders..." />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0a0a0a] p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-white">Orders (Admin View)</h1>
                    <p className="text-zinc-400 mt-1">Read-only visibility with audit trail</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Orders List */}
                    <div className="bg-gradient-to-br from-white/8 to-white/3 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
                        <h2 className="text-xl font-semibold text-white mb-4">Recent Orders</h2>

                        <div className="space-y-3 max-h-[600px] overflow-y-auto">
                            {orders.map((order) => (
                                <motion.div
                                    key={order.id}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    onClick={() => fetchAuditLog(order.id)}
                                    className={`p-4 rounded-xl cursor-pointer transition-all ${selectedOrder === order.id
                                            ? 'bg-[#ff4d6d]/20 border-[#ff4d6d]/30'
                                            : 'bg-white/5 hover:bg-white/10'
                                        } border border-white/5`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-zinc-300 font-mono">
                                                #{order.id.slice(0, 8)}
                                            </p>
                                            <p className="text-xs text-zinc-500 mt-1">
                                                {formatDate(order.created_at)}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(order.status)}`}>
                                                {order.status.replace(/_/g, ' ')}
                                            </span>
                                            <p className="text-sm font-bold text-white mt-1">
                                                {formatCurrency(order.total_amount)}
                                            </p>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>

                    {/* Audit Log Panel */}
                    <div className="bg-gradient-to-br from-white/8 to-white/3 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
                        <h2 className="text-xl font-semibold text-white mb-4">Audit Trail</h2>

                        {!selectedOrder ? (
                            <p className="text-zinc-500">Select an order to view audit log</p>
                        ) : auditLoading ? (
                            <Loader size="sm" text="Loading audit..." />
                        ) : auditLog.length === 0 ? (
                            <p className="text-zinc-500">No audit entries for this order</p>
                        ) : (
                            <div className="space-y-3 max-h-[600px] overflow-y-auto">
                                {auditLog.map((entry) => (
                                    <div
                                        key={entry.id}
                                        className="p-3 bg-white/5 rounded-lg border border-white/5"
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs text-zinc-400">
                                                {entry.actor_role}
                                            </span>
                                            <span className={`text-xs ${entry.transition_result.success ? 'text-green-400' : 'text-red-400'}`}>
                                                {entry.transition_result.success ? '✓ Success' : `✗ ${entry.transition_result.code}`}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm">
                                            <span className="text-zinc-500">{entry.from_status}</span>
                                            <span className="text-zinc-600">→</span>
                                            <span className="text-white">{entry.to_status}</span>
                                        </div>
                                        {entry.confidence_score !== null && (
                                            <div className="mt-2 flex items-center gap-2">
                                                <span className="text-xs text-zinc-500">Confidence:</span>
                                                <span className={`text-xs ${entry.confidence_score >= 0.8 ? 'text-green-400' :
                                                        entry.confidence_score >= 0.5 ? 'text-yellow-400' :
                                                            'text-red-400'
                                                    }`}>
                                                    {(entry.confidence_score * 100).toFixed(0)}%
                                                </span>
                                            </div>
                                        )}
                                        <p className="text-xs text-zinc-600 mt-2">
                                            {new Date(entry.created_at).toLocaleString()}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Read-only Notice */}
                <div className="mt-8 p-4 bg-zinc-900/50 rounded-xl border border-zinc-800">
                    <p className="text-xs text-zinc-500 text-center">
                        This view is read-only. Order state cannot be modified from admin dashboard.
                    </p>
                </div>
            </div>
        </div>
    );
};
