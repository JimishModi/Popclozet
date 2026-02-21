/**
 * Admin Dashboard Page
 * 
 * Phase 3: Aggregated operational visibility
 * 
 * Design Principles:
 * - Read-only: No state mutations
 * - Aggregated: No raw rider tracking (clustered views only)
 * - Advisory: Telemetry confidence visible to ops, never customers
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '@/services/supabase';
import { Loader } from '@/components/ui/Loader';
import { motion } from 'framer-motion';

interface DashboardStats {
    totalOrders: number;
    activeDeliveries: number;
    pendingOrders: number;
    completedToday: number;
    openIncidents: number;
}

interface RecentIncident {
    id: string;
    incident_type: string;
    severity: string;
    description: string;
    created_at: string;
    status: string;
}

export const DashboardPage: React.FC = () => {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [incidents, setIncidents] = useState<RecentIncident[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            // Fetch order stats (aggregated, not individual tracking)
            const [ordersResult, incidentsResult] = await Promise.all([
                supabase.from('orders').select('id, status, created_at'),
                supabase.from('incident_log')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(5),
            ]);

            if (ordersResult.data) {
                const orders = ordersResult.data;
                const today = new Date().toISOString().split('T')[0];

                setStats({
                    totalOrders: orders.length,
                    activeDeliveries: orders.filter(o =>
                        ['dispatched', 'out_for_delivery'].includes(o.status)
                    ).length,
                    pendingOrders: orders.filter(o => o.status === 'pending').length,
                    completedToday: orders.filter(o =>
                        o.status === 'delivered' &&
                        o.created_at.startsWith(today)
                    ).length,
                    openIncidents: incidentsResult.data?.filter(i => i.status === 'open').length || 0,
                });
            }

            if (incidentsResult.data) {
                setIncidents(incidentsResult.data);
            }
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'critical': return 'bg-red-500/20 text-red-400 border-red-500/30';
            case 'high': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
            case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
            default: return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
                <Loader size="lg" text="Loading dashboard..." />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0a0a0a] p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-white">Operations Dashboard</h1>
                    <p className="text-zinc-400 mt-1">Real-time aggregated view (read-only)</p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                    <StatCard
                        label="Total Orders"
                        value={stats?.totalOrders || 0}
                        color="text-white"
                    />
                    <StatCard
                        label="Active Deliveries"
                        value={stats?.activeDeliveries || 0}
                        color="text-blue-400"
                    />
                    <StatCard
                        label="Pending"
                        value={stats?.pendingOrders || 0}
                        color="text-yellow-400"
                    />
                    <StatCard
                        label="Completed Today"
                        value={stats?.completedToday || 0}
                        color="text-green-400"
                    />
                    <StatCard
                        label="Open Incidents"
                        value={stats?.openIncidents || 0}
                        color={stats?.openIncidents ? 'text-red-400' : 'text-zinc-400'}
                    />
                </div>

                {/* Recent Incidents */}
                <div className="bg-gradient-to-br from-white/8 to-white/3 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
                    <h2 className="text-xl font-semibold text-white mb-4">Recent Incidents</h2>

                    {incidents.length === 0 ? (
                        <p className="text-zinc-500">No incidents recorded</p>
                    ) : (
                        <div className="space-y-3">
                            {incidents.map((incident) => (
                                <motion.div
                                    key={incident.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5"
                                >
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3">
                                            <span className={`px-2 py-1 text-xs font-medium rounded border ${getSeverityColor(incident.severity)}`}>
                                                {incident.severity.toUpperCase()}
                                            </span>
                                            <span className="text-sm text-zinc-300">
                                                {incident.incident_type.replace(/_/g, ' ')}
                                            </span>
                                        </div>
                                        <p className="text-xs text-zinc-500 mt-1">{incident.description}</p>
                                    </div>
                                    <div className="text-right">
                                        <span className={`text-xs ${incident.status === 'open' ? 'text-yellow-400' : 'text-green-400'}`}>
                                            {incident.status}
                                        </span>
                                        <p className="text-xs text-zinc-600 mt-1">
                                            {new Date(incident.created_at).toLocaleTimeString()}
                                        </p>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Admin Notice */}
                <div className="mt-8 p-4 bg-zinc-900/50 rounded-xl border border-zinc-800">
                    <p className="text-xs text-zinc-500 text-center">
                        Admin dashboard is read-only. State changes must be performed by authorized roles via standard workflows.
                    </p>
                </div>
            </div>
        </div>
    );
};

// Stat Card Component
const StatCard: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
    <div className="bg-gradient-to-br from-white/8 to-white/3 backdrop-blur-xl rounded-xl p-4 border border-white/10">
        <p className="text-xs text-zinc-400 uppercase tracking-wide">{label}</p>
        <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
);
