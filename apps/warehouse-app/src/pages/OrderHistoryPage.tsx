/**
 * Order History Page — Warehouse App
 * View and search all past orders with status filters.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
    Search, 
    Filter, 
    History, 
    ChevronRight, 
    Calendar, 
    Package, 
    Truck, 
    CheckCircle2, 
    XCircle, 
    Clock,
    AlertCircle,
    User,
    MapPin,
    ArrowUpDown,
    RefreshCw,
    Activity
} from 'lucide-react';
import { clsx } from 'clsx';
import { getOrderHistory, type OrderWithItems } from '../services/fulfillmentService';
import { OrderTimelineOverlay } from '../components/OrderTimelineOverlay';
import { buildManualAddressSummary } from '../services/addressDetails';
import { OrderCustomerInfoPanel } from '../components/OrderCustomerInfoPanel';

import { RotateCcw } from 'lucide-react';

const statusFilters = [
    { key: 'all', label: 'All Orders', icon: History, color: 'text-zinc-400' },
    { key: 'pending', label: 'Pending', icon: Clock, color: 'text-amber-400' },
    { key: 'confirmed', label: 'Confirmed', icon: CheckCircle2, color: 'text-blue-400' },
    { key: 'packed', label: 'Packed', icon: Package, color: 'text-warehouse-400' },
    { key: 'dispatched', label: 'Dispatched', icon: Truck, color: 'text-emerald-400' },
    { key: 'delivered', label: 'Delivered', icon: CheckCircle2, color: 'text-emerald-500' },
    { key: 'returns', label: 'Returns', icon: RotateCcw, color: 'text-orange-400' },
    { key: 'return_completed', label: 'Completed', icon: CheckCircle2, color: 'text-cyan-400' },
    { key: 'cancelled', label: 'Cancelled', icon: XCircle, color: 'text-red-400' },
];

export function OrderHistoryPage() {
    const navigate = useNavigate();
    const [orders, setOrders] = useState<OrderWithItems[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [viewingActivity, setViewingActivity] = useState<string | null>(null);
    const [viewingCustomerInfo, setViewingCustomerInfo] = useState<string | null>(null);

    const fetchOrders = useCallback(async (isInitial = false) => {
        if (isInitial) setLoading(true);
        else setIsRefreshing(true);

        try {
            const data = await getOrderHistory({
                status: statusFilter,
                searchQuery: searchQuery,
                limit: 50
            });
            setOrders(data);
        } catch (err) {
            console.error('Failed to fetch orders:', err);
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    }, [statusFilter, searchQuery]);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchOrders(true);
        }, searchQuery ? 400 : 0); // Debounce search

        return () => clearTimeout(timer);
    }, [fetchOrders, searchQuery]);

    // Auto-refresh every 60 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            fetchOrders();
        }, 60000);
        return () => clearInterval(interval);
    }, [fetchOrders]);

    const getStatusStyle = (status: string) => {
        switch (status.toLowerCase()) {
            case 'pending': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
            case 'confirmed': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
            case 'packed': return 'bg-warehouse-500/10 text-warehouse-500 border-warehouse-500/20';
            case 'ready_for_pickup': return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
            case 'rider_assigned': return 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20';
            case 'dispatched': 
            case 'return_dispatched': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
            case 'delivered': return 'bg-green-500/10 text-green-500 border-green-500/20';
            case 'cancelled': return 'bg-red-500/10 text-red-500 border-red-500/20';
            case 'return_requested':
            case 'return_scheduled':
            case 'return_assigned':
            case 'return_picked_up':
            case 'return_at_warehouse':
            case 'returned': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
            case 'return_completed':
            case 'completed': return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
            default: return 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20';
        }
    };
    
    const getStatusDisplay = (status: string) => {
        if (status === 'return_completed') return 'Completed';
        if (status === 'returned') return 'Returned';
        if (status.startsWith('return_')) return 'Return ' + status.replace('return_', '').replace(/_/g, ' ');
        return status.replace(/_/g, ' ');
    };

    return (
        <div className="flex flex-col h-full bg-zinc-950">
            {/* Header */}
            <div className="px-5 pt-6 pb-4 space-y-4 shadow-sm bg-zinc-950/50 backdrop-blur-md sticky top-0 z-10 border-b border-zinc-900">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-white flex items-center gap-2">
                            <History size={20} className="text-warehouse-400" />
                            Order History
                        </h1>
                        <p className="text-xs text-zinc-500 mt-0.5">
                            {orders.length} {statusFilter === 'all' ? '' : statusFilter} orders found
                        </p>
                    </div>

                    <button 
                        onClick={() => fetchOrders()}
                        disabled={isRefreshing || loading}
                        className={clsx(
                            "p-2.5 rounded-xl border transition-all active:scale-95",
                            isRefreshing || loading
                                ? "bg-zinc-900 border-zinc-800 text-zinc-600 cursor-not-allowed"
                                : "bg-warehouse-500/10 border-warehouse-500/20 text-warehouse-400 hover:bg-warehouse-500/20"
                        )}
                        title="Refresh history"
                    >
                        <RefreshCw size={18} className={clsx(isRefreshing && "animate-spin")} />
                    </button>
                </div>

                {/* Search Bar */}
                <div className="relative group">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-warehouse-400 transition-colors" size={16} />
                    <input
                        type="text"
                        placeholder="Search by Order ID..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-warehouse-500 focus:border-warehouse-500 transition-all"
                    />
                </div>

                {/* Status Tabs */}
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                    {statusFilters.map(({ key, label, icon: Icon, color }) => (
                        <button
                            key={key}
                            onClick={() => setStatusFilter(key)}
                            className={clsx(
                                "flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all border",
                                statusFilter === key
                                    ? "bg-warehouse-500/10 text-warehouse-400 border-warehouse-500/30"
                                    : "bg-zinc-900/50 text-zinc-500 border-zinc-800 hover:border-zinc-700 hover:text-zinc-300"
                            )}
                        >
                            <Icon size={14} className={clsx(statusFilter === key ? "text-warehouse-400" : color)} />
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-4 py-5 no-scrollbar">
                <AnimatePresence mode="popLayout">
                    {loading ? (
                        <div className="space-y-3">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="h-32 bg-zinc-900/50 rounded-2xl animate-pulse border border-zinc-800/50" />
                            ))}
                        </div>
                    ) : orders.length === 0 ? (
                        <motion.div 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex flex-col items-center justify-center py-20 text-center px-10"
                        >
                            <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center mb-4 border border-zinc-800">
                                <Search size={28} className="text-zinc-600" />
                            </div>
                            <h3 className="text-white font-semibold">No orders found</h3>
                            <p className="text-zinc-500 text-sm mt-1">Try adjusting your filters or search query</p>
                            {(searchQuery || statusFilter !== 'all') && (
                                <button 
                                    onClick={() => { setSearchQuery(''); setStatusFilter('all'); }}
                                    className="mt-6 text-warehouse-400 text-sm font-medium hover:underline"
                                >
                                    Clear all filters
                                </button>
                            )}
                        </motion.div>
                    ) : (
                        <div className="space-y-3.5">
                            {orders.map((order, idx) => {
                                const returnRequest = order.return_requests?.[0];
                                const fetchedAddress =
                                    order.delivery_address_snapshot?.full_address ||
                                    order.addresses?.full_address ||
                                    '';
                                const manualAddressSummary = buildManualAddressSummary(order.manual_address_details);
                                const isViewingCustomerInfo = viewingCustomerInfo === order.id;

                                return (
                                <motion.div
                                    key={order.id}
                                    initial={{ opacity: 0, y: 15 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.03 }}
                                    className="group relative bg-zinc-900/40 hover:bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 rounded-2xl p-4 transition-all duration-200 active:scale-[0.98]"
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-bold text-zinc-500 tracking-wider">ORDER ID</span>
                                                <span className="text-sm font-bold text-white font-mono">#{order.id.slice(0, 8).toUpperCase()}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-zinc-500">
                                                <Calendar size={12} />
                                                <span className="text-[11px]">
                                                    {new Date(order.created_at).toLocaleDateString('en-IN', { 
                                                        day: 'numeric', 
                                                        month: 'short', 
                                                        year: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1.5">
                                            <div className={clsx(
                                                "px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wide",
                                                getStatusStyle(order.status)
                                            )}>
                                                {getStatusDisplay(order.status)}
                                            </div>
                                            {returnRequest && (
                                                <div className={clsx(
                                                    "px-2 py-0.5 rounded text-[9px] font-black border uppercase tracking-tight flex items-center gap-1",
                                                    returnRequest.reason === 'immediate'
                                                        ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                                                        : "bg-purple-500/10 text-purple-400 border-purple-500/20"
                                                )}>
                                                    {returnRequest.reason === 'immediate' ? 'INSTANT' : 'SCHEDULED'}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Summary Stats */}
                                    <div className="grid grid-cols-2 gap-4 py-3 border-y border-zinc-800/50 mb-3">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400">
                                                <Package size={16} />
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-zinc-500 font-medium">ITEMS</p>
                                                <p className="text-xs font-bold text-white">{order.order_items?.length || 0} Products</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-emerald-500/20 text-emerald-500">
                                                <span className="text-xs font-bold">₹</span>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-zinc-500 font-medium">TOTAL</p>
                                                <div className="flex items-center gap-1.5">
                                                    <p className="text-xs font-bold text-white">₹{order.total_amount}</p>
                                                    {order.payment_method && (
                                                        <span className={clsx(
                                                            'text-[8px] font-bold uppercase px-1 py-0.5 rounded border',
                                                            order.payment_method === 'cod'
                                                                ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
                                                                : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                                        )}>
                                                            {order.payment_method === 'cod' ? 'COD' : 'PAID'}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Clickable Items List */}
                                    <div className="mb-4 space-y-2 max-h-36 overflow-y-auto no-scrollbar">
                                        {order.order_items?.map((item) => (
                                            <button
                                                key={item.id}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (item.product_id) navigate(`/product/${item.product_id}`);
                                                }}
                                                className="w-full flex items-center gap-2.5 p-2 rounded-xl bg-zinc-900/30 hover:bg-zinc-800/50 border border-zinc-800/50 transition-all active:scale-[0.98] text-left"
                                            >
                                                <div className="w-10 h-12 rounded-lg bg-zinc-800 overflow-hidden shrink-0 border border-zinc-700">
                                                    {item.products?.images?.[0] ? (
                                                        <img src={item.products.images[0]} className="w-full h-full object-cover" alt="" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center">
                                                            <Package size={14} className="text-zinc-600" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[11px] font-bold text-white truncate uppercase tracking-tight">
                                                        {item.products?.name || 'Product'}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-warehouse-400 text-[9px] font-black">SIZE: {item.size || 'N/A'}</span>
                                                        <span className="text-zinc-600 font-bold text-[9px]">₹{item.rental_price}</span>
                                                    </div>
                                                </div>
                                                <ChevronRight size={14} className="text-zinc-700 mr-1" />
                                            </button>
                                        ))}
                                    </div>

                                    {/* Details */}
                                    <div className="space-y-2">
                                        {fetchedAddress && (
                                            <div className="flex items-start gap-2 text-zinc-400">
                                                <MapPin size={12} className="mt-0.5 shrink-0" />
                                                <div>
                                                    <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-600">Address Fetched</p>
                                                    <p className="text-[11px] line-clamp-2">{fetchedAddress}</p>
                                                </div>
                                            </div>
                                        )}
                                        {manualAddressSummary && (
                                            <div className="flex items-start gap-2 text-zinc-300">
                                                <MapPin size={12} className="mt-0.5 shrink-0 text-[#f2546d]" />
                                                <div>
                                                    <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-600">Manual Address</p>
                                                    <p className="text-[11px] line-clamp-3">{manualAddressSummary}</p>
                                                </div>
                                            </div>
                                        )}
                                        {order.rider_name && (
                                            <div className="flex items-center gap-2 text-zinc-400">
                                                <Truck size={12} className="shrink-0" />
                                                <p className="text-[11px]">Rider: <span className="text-zinc-300 font-medium">{order.rider_name}</span></p>
                                            </div>
                                        )}
                                    </div>

                                    {isViewingCustomerInfo ? (
                                        <OrderCustomerInfoPanel
                                            customerName={order.customer_profile?.full_name}
                                            customerPhone={order.customer_profile?.phone}
                                            customerEmail={order.customer_profile?.email}
                                            fetchedAddress={fetchedAddress}
                                            manualAddressDetails={order.manual_address_details}
                                            riderName={order.rider_name || order.riders?.name || order.riders?.full_name}
                                            riderPhone={order.riders?.phone}
                                        />
                                    ) : null}

                                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-800/50">
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setViewingCustomerInfo((current) => current === order.id ? null : order.id);
                                                }}
                                                className="flex items-center gap-1.5 text-[10px] text-zinc-300 hover:text-white transition-colors font-bold uppercase tracking-wider"
                                            >
                                                <User size={12} />
                                                {isViewingCustomerInfo ? 'Hide Customer Info' : 'Customer Info'}
                                            </button>
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setViewingActivity(order.id);
                                                }} 
                                                className="flex items-center gap-1.5 text-[10px] text-warehouse-400 hover:text-warehouse-300 transition-colors font-bold uppercase tracking-wider"
                                            >
                                                <Activity size={12} />
                                                View Updates
                                            </button>
                                        </div>
                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                            <ChevronRight size={18} className="text-zinc-600" />
                                        </div>
                                    </div>
                                </motion.div>
                                );
                            })}
                        </div>
                    )}
                </AnimatePresence>

                {/* Simple Footer / Pagination Info */}
                {!loading && orders.length > 0 && (
                    <div className="mt-8 py-6 text-center border-t border-zinc-900">
                        <p className="text-xs text-zinc-600 font-medium mb-1">Showing latest 50 results</p>
                        <p className="text-[10px] text-zinc-700">Refine date range for older orders (Coming Soon)</p>
                    </div>
                )}
            </div>

            {viewingActivity && (
                <OrderTimelineOverlay 
                    orderId={viewingActivity} 
                    onClose={() => setViewingActivity(null)} 
                />
            )}
        </div>
    );
}
