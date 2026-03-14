/**
 * Dashboard Page — Mobile Layout
 * Stock overview cards, low stock alerts, recent orders, quick actions.
 * Uses realtime subscriptions for live data.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Package, Droplets, ShoppingBag, AlertTriangle, TrendingUp, ArrowRight, RefreshCw, Warehouse } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getStockSummary, getStockByCategory, getOrderCounts, type StockSummary, type CategoryStock } from '../services/analyticsService';
import { getLowStockItems, type InventoryWithProduct } from '../services/inventoryService';
import { useRealtimeInventory } from '../hooks/useRealtimeInventory';
import { useRealtimeOrders } from '../hooks/useRealtimeOrders';

function StatCard({ icon: Icon, label, value, color, delay }: {
    icon: any; label: string; value: number | string; color: string; delay: number;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay }}
            className="bg-surface-card border border-surface-border rounded-xl p-4"
        >
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-xs text-zinc-400 mb-0.5">{label}</p>
                    <p className="text-2xl font-bold text-white">{value}</p>
                </div>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
                    <Icon size={18} />
                </div>
            </div>
        </motion.div>
    );
}

export function DashboardPage() {
    const [summary, setSummary] = useState<StockSummary | null>(null);
    const [categories, setCategories] = useState<CategoryStock[]>([]);
    const [lowStock, setLowStock] = useState<InventoryWithProduct[]>([]);
    const [orderCounts, setOrderCounts] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);

    const [error, setError] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        try {
            setError(null);
            console.log('[Dashboard] Starting data fetch...');
            
            // 5 second timeout wrapper
            const withTimeout = (promise: Promise<any>, name: string) => {
                const timeout = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error(`${name} timed out after 5s`)), 5000)
                );
                return Promise.race([promise, timeout]);
            };

            console.log('[Dashboard] 1. Calling getStockSummary()');
            const s = await withTimeout(getStockSummary(), 'getStockSummary');
            
            console.log('[Dashboard] 2. Calling getStockByCategory()');
            const c = await withTimeout(getStockByCategory(), 'getStockByCategory');
            
            console.log('[Dashboard] 3. Calling getLowStockItems()');
            const ls = await withTimeout(getLowStockItems(3), 'getLowStockItems');
            
            console.log('[Dashboard] 4. Calling getOrderCounts()');
            const oc = await withTimeout(getOrderCounts(), 'getOrderCounts');

            console.log('[Dashboard] All data fetched successfully');
            setSummary(s as any);
            setCategories(c as any);
            setLowStock(ls as any);
            setOrderCounts(oc as any);
        } catch (err: any) {
            console.error('[Dashboard] load error:', err);
            setError(err.message || 'Failed to load dashboard data');
            
            // Set empty/fallback states so we can still render the page structure
            if (!summary) setSummary({ total_stock: 0, available_stock: 0, went_for_wash: 0, in_rental: 0, total_products: 0 });
            if (categories.length === 0) setCategories([]);
            if (lowStock.length === 0) setLowStock([]);
            if (Object.keys(orderCounts).length === 0) setOrderCounts({});
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    // Realtime subscriptions
    useRealtimeInventory({ onChange: loadData, includeItems: true });
    useRealtimeOrders({ onChange: loadData });

    if (loading) {
        return (
            <div className="px-4 py-5 space-y-4">
                <div className="h-8 w-48 bg-surface-card rounded-lg animate-pulse" />
                <div className="grid grid-cols-2 gap-3">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="bg-surface-card rounded-xl h-24 animate-pulse" />
                    ))}
                </div>
            </div>
        );
    }

    const pendingCount = (orderCounts['pending'] || 0) + (orderCounts['confirmed'] || 0);

    return (
        <div className="px-4 py-5 space-y-5">
            {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-4 flex items-start gap-3">
                    <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5" />
                    <div>
                        <h3 className="text-sm font-semibold text-red-400">Data Load Error</h3>
                        <p className="text-xs text-red-300 mt-1">{error}</p>
                        <p className="text-[10px] text-red-400/80 mt-1">Please check if all required Supabase views and tables exist.</p>
                    </div>
                </div>
            )}
            
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-warehouse-500 to-warehouse-700 flex items-center justify-center">
                        <Warehouse size={20} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-white">Dashboard</h1>
                        <p className="text-xs text-zinc-500">Live overview</p>
                    </div>
                </div>
                <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] text-emerald-400 font-semibold">LIVE</span>
                </div>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-2 gap-3">
                <StatCard icon={Package} label="Total Stock" value={summary?.total_stock ?? 0} color="bg-warehouse-500/15 text-warehouse-400" delay={0} />
                <StatCard icon={TrendingUp} label="Available" value={summary?.available_stock ?? 0} color="bg-emerald-500/15 text-emerald-400" delay={0.05} />
                <StatCard icon={Droplets} label="In Wash" value={summary?.went_for_wash ?? 0} color="bg-amber-500/15 text-amber-400" delay={0.1} />
                <StatCard icon={ShoppingBag} label="Pending" value={pendingCount} color="bg-blue-500/15 text-blue-400" delay={0.15} />
            </div>

            {/* Low Stock Alerts */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-surface-card border border-surface-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                        <AlertTriangle size={14} className="text-amber-400" />
                        Low Stock
                    </h2>
                    <Link to="/inventory" className="text-xs text-warehouse-400 hover:text-warehouse-300 flex items-center gap-1">
                        All <ArrowRight size={12} />
                    </Link>
                </div>
                {lowStock.length === 0 ? (
                    <p className="text-zinc-500 text-xs py-3 text-center">All stock levels healthy ✓</p>
                ) : (
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                        {lowStock.slice(0, 5).map((item) => (
                            <div key={item.id} className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-surface-hover">
                                <div>
                                    <p className="text-xs font-medium text-zinc-200">{(item as any).products?.name || 'Unknown'}</p>
                                    <p className="text-[10px] text-zinc-500">Size {item.size}</p>
                                </div>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${(item.available_stock ?? 0) === 0 ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400'}`}>
                                    {item.available_stock ?? 0} left
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </motion.div>

            {/* Stock by Category */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="bg-surface-card border border-surface-border rounded-xl p-4">
                <h2 className="text-sm font-semibold text-white mb-3">By Category</h2>
                {categories.length === 0 ? (
                    <p className="text-zinc-500 text-xs py-3 text-center">No data</p>
                ) : (
                    <div className="space-y-2.5">
                        {categories.map((cat) => {
                            const pct = cat.total > 0 ? (cat.available / cat.total) * 100 : 0;
                            return (
                                <div key={cat.category}>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs text-zinc-300 capitalize">{cat.category}</span>
                                        <span className="text-[10px] text-zinc-500">{cat.available}/{cat.total}</span>
                                    </div>
                                    <div className="h-1.5 bg-surface-hover rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-warehouse-500 to-warehouse-400 rounded-full transition-all duration-500"
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </motion.div>

            {/* Quick Actions */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <h2 className="text-sm font-semibold text-white mb-3">Quick Actions</h2>
                <div className="grid grid-cols-2 gap-2.5">
                    {[
                        { to: '/wash', label: 'Send to Wash', icon: Droplets, color: 'text-amber-400' },
                        { to: '/orders', label: 'Pack Orders', icon: ShoppingBag, color: 'text-blue-400' },
                        { to: '/returns', label: 'Returns', icon: Package, color: 'text-emerald-400' },
                        { to: '/intake', label: 'Add Product', icon: Package, color: 'text-warehouse-400' },
                    ].map(({ to, label, icon: Icon, color }) => (
                        <Link
                            key={to}
                            to={to}
                            className="flex flex-col items-center gap-1.5 py-3 px-3 rounded-xl bg-surface-hover hover:bg-surface-border transition-all duration-200 group"
                        >
                            <Icon size={20} className={`${color} group-hover:scale-110 transition-transform`} />
                            <span className="text-xs text-zinc-300 font-medium">{label}</span>
                        </Link>
                    ))}
                </div>
            </motion.div>
        </div>
    );
}
