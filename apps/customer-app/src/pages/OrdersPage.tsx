import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronLeft, Package, MapPin, Clock, ChevronRight, Filter, Loader2 } from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { useOrders, Order } from "@/hooks/useOrders";

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
    pending: { label: "Pending", color: "text-zinc-400", bgColor: "bg-zinc-500/20" },
    confirmed: { label: "Confirmed", color: "text-blue-400", bgColor: "bg-blue-500/20" },
    packed: { label: "Packed", color: "text-blue-300", bgColor: "bg-blue-500/10" },
    ready_for_pickup: { label: "Ready", color: "text-indigo-400", bgColor: "bg-indigo-500/20" },
    rider_assigned: { label: "Rider Assigned", color: "text-cyan-400", bgColor: "bg-cyan-500/20" },
    preparing: { label: "Preparing", color: "text-yellow-400", bgColor: "bg-yellow-500/20" },
    driver_arrived_warehouse: { label: "At Warehouse", color: "text-orange-400", bgColor: "bg-orange-500/20" },
    order_picked_up: { label: "Picked Up", color: "text-pink-400", bgColor: "bg-pink-500/20" },
    dispatched: { label: "Dispatched", color: "text-pink-500", bgColor: "bg-pink-500/20" },
    out_for_delivery: { label: "Out for Delivery", color: "text-pink-400", bgColor: "bg-pink-500/20" },
    pickup_scheduled: { label: "Pickup Scheduled", color: "text-purple-400", bgColor: "bg-purple-500/20" },
    delivered: { label: "Delivered", color: "text-green-400", bgColor: "bg-green-500/20" },
    picked_up: { label: "Picked Up", color: "text-green-400", bgColor: "bg-green-500/20" },
    return_requested: { label: "Return Requested", color: "text-orange-400", bgColor: "bg-orange-500/10" },
    return_scheduled: { label: "Pickup Scheduled", color: "text-blue-400", bgColor: "bg-blue-500/10" },
    return_dispatched: { label: "Rider On The Way", color: "text-indigo-400", bgColor: "bg-indigo-500/10" },
    return_picked_up: { label: "Completed", color: "text-emerald-400", bgColor: "bg-emerald-500/20" },
    return_at_warehouse: { label: "Completed", color: "text-emerald-400", bgColor: "bg-emerald-500/20" },
    returned: { label: "Completed", color: "text-emerald-400", bgColor: "bg-emerald-500/20" },
    return_completed: { label: "Completed", color: "text-emerald-400", bgColor: "bg-emerald-500/20" },
    completed: { label: "Completed", color: "text-emerald-400", bgColor: "bg-emerald-500/20" },
    cancelled: { label: "Cancelled", color: "text-red-400", bgColor: "bg-red-500/20" },
};

export default function OrdersPage() {
    const navigate = useNavigate();
    const { activeOrders, pastOrders, loading, error } = useOrders();
    const [activeTab, setActiveTab] = useState<"active" | "past">("active");

    const displayOrders = activeTab === "active" ? activeOrders : pastOrders;

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    };

    const RETURN_STATUSES = ["return_scheduled", "return_dispatched"];
    const DELIVERED_STATUSES = ["delivered", "in_use"];
    const COMPLETED_STATUSES = ["picked_up", "return_picked_up", "return_at_warehouse", "returned", "return_completed", "completed"];

    const handleOrderClick = (order: Order) => {
        if (RETURN_STATUSES.includes(order.status)) {
            navigate(`/pickup-tracking/${order.id}`);
        } else if (DELIVERED_STATUSES.includes(order.status) || COMPLETED_STATUSES.includes(order.status)) {
            navigate(`/order/${order.id}/delivered`);
        } else {
            navigate(`/tracking/${order.id}`);
        }
    };

    const getActionLabel = (order: Order) => {
        if (RETURN_STATUSES.includes(order.status)) return "Track Return";
        if (DELIVERED_STATUSES.includes(order.status) || COMPLETED_STATUSES.includes(order.status)) return "View Order";
        return "Track Order";
    };

    return (
        <div className="bg-black text-white min-h-screen">
            <Helmet>
                <title>My Orders | Popclozet</title>
                <meta name="robots" content="noindex" />
            </Helmet>
            {/* Header - Matches ProfilePage style */}
            <div className="sticky top-0 z-50 bg-gradient-to-b from-black/90 to-black/70 backdrop-blur-2xl border-b border-white/5 px-4 py-3">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate(-1)}
                        className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-full bg-white/5 border border-white/10 transition-all active:scale-95"
                    >
                        <ChevronLeft className="w-4 h-4 md:w-5 md:h-5 text-white" />
                    </button>
                    <h1 className="text-lg md:text-xl font-bold text-white tracking-tight" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                        My Orders
                    </h1>
                    <div className="flex-1" />
                    <button className="p-2.5 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all">
                        <Filter className="w-4 h-4 md:w-5 md:h-5 text-zinc-400" />
                    </button>
                </div>
            </div>

            {/* Tabs - Premium Glass Style */}
            <div className="sticky top-[57px] z-40 bg-black/90 backdrop-blur-md border-b border-white/5 px-4 py-3">
                <div className="flex gap-2">
                    <button
                        onClick={() => setActiveTab("active")}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === "active"
                            ? "bg-gradient-to-r from-[#f2546d] to-pink-600 text-white shadow-[0_10px_30px_rgba(242,84,109,0.3)]"
                            : "bg-white/5 border border-white/5 text-zinc-500 hover:text-white hover:bg-white/10"
                            }`}
                    >
                        Active ({activeOrders.length})
                    </button>
                    <button
                        onClick={() => setActiveTab("past")}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === "past"
                            ? "bg-gradient-to-r from-[#f2546d] to-pink-600 text-white shadow-[0_10px_30px_rgba(242,84,109,0.3)]"
                            : "bg-white/5 border border-white/5 text-zinc-500 hover:text-white hover:bg-white/10"
                            }`}
                    >
                        Past ({pastOrders.length})
                    </button>
                </div>
            </div>

            {/* Content */}
            <main className="flex-1 overflow-y-auto px-4 py-4 pb-24">
                {/* Loading State */}
                {loading && (
                    <div className="space-y-3">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="bg-white/5 rounded-2xl border border-white/5 p-4 animate-pulse">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="space-y-1.5">
                                        <div className="h-4 bg-white/10 rounded-lg w-28" />
                                        <div className="h-3 bg-white/5 rounded-lg w-16" />
                                    </div>
                                    <div className="h-5 bg-white/5 rounded-full w-20" />
                                </div>
                                <div className="space-y-2">
                                    <div className="h-3 bg-white/5 rounded w-full" />
                                    <div className="h-3 bg-white/5 rounded w-2/3" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Error State */}
                {error && !loading && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-center">
                        <p className="text-red-400 mb-2">{error}</p>
                        <button className="text-pink-500 text-sm font-medium">Retry</button>
                    </div>
                )}

                {/* Empty State */}
                {!loading && !error && displayOrders.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-64 text-center">
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-white/8 to-white/3 border border-white/5 flex items-center justify-center mb-4">
                            <Package className="w-10 h-10 text-zinc-600" />
                        </div>
                        <p className="text-white font-semibold text-lg mb-1">
                            No {activeTab} orders
                        </p>
                        <p className="text-zinc-600 text-sm max-w-[200px]">
                            {activeTab === "active"
                                ? "Your active orders will appear here"
                                : "Your order history will appear here"}
                        </p>
                    </div>
                )}

                {/* Orders List */}
                {!loading && !error && displayOrders.length > 0 && (
                    <div className="space-y-3">
                        {displayOrders.map((order, index) => {
                            const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
                            return (
                                <motion.div
                                    key={order.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    onClick={() => handleOrderClick(order)}
                                    className="bg-gradient-to-br from-white/8 to-white/3 backdrop-blur-xl rounded-2xl border border-white/5 p-4 hover:border-[#f2546d]/30 transition-all cursor-pointer group"
                                >
                                    {/* Header */}
                                    <div className="flex items-start gap-3 mb-3">
                                        {/* Product thumbnail */}
                                        <div className="w-14 h-14 rounded-2xl bg-zinc-800 border border-white/5 overflow-hidden flex-shrink-0">
                                            {order.firstItemImage ? (
                                                <img src={order.firstItemImage} alt={order.firstItemName} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <Package className="w-6 h-6 text-zinc-600" />
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2 mb-1">
                                                <span className="text-white font-bold text-sm">
                                                    #{order.id.slice(0, 8).toUpperCase()}
                                                </span>
                                                <div
                                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${statusConfig.bgColor} ${statusConfig.color}`}
                                                >
                                                    {statusConfig.label}
                                                </div>
                                            </div>
                                            {order.firstItemName && (
                                                <p className="text-zinc-300 text-xs font-medium truncate">{order.firstItemName}{order.itemCount > 1 ? ` +${order.itemCount - 1} more` : ''}</p>
                                            )}
                                            <p className="text-zinc-600 text-xs mt-0.5">
                                                {formatDate(order.createdAt)} · ₹{order.totalAmount.toLocaleString()}
                                            </p>
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-zinc-700 group-hover:text-[#f2546d] group-hover:translate-x-0.5 transition-all flex-shrink-0 mt-1" />
                                    </div>

                                    {/* ETA for active delivery orders */}
                                    {order.etaMinutes !== undefined && order.etaMinutes > 0 && order.status === "out_for_delivery" && (
                                        <div className="flex items-center gap-2 py-2 border-t border-white/5">
                                            <div className="p-1.5 rounded-lg bg-[#f2546d]/20">
                                                <Clock className="w-4 h-4 text-[#f2546d]" />
                                            </div>
                                            <span className="text-[#f2546d] text-sm font-bold">
                                                Arriving in {order.etaMinutes} min
                                            </span>
                                        </div>
                                    )}

                                    {/* Address for active orders */}
                                    {activeTab === "active" && order.address && (
                                        <div className="pt-2 border-t border-white/5 space-y-1.5">
                                            <div className="flex items-center gap-2">
                                                <MapPin className="w-4 h-4 text-zinc-600" />
                                                <span className="text-zinc-500 text-xs truncate">
                                                    {order.address.fullAddress}
                                                </span>
                                            </div>
                                            {order.manualAddressSummary && (
                                                <div className="flex items-center gap-2">
                                                    <MapPin className="w-4 h-4 text-[#f2546d]" />
                                                    <span className="text-zinc-400 text-xs truncate">
                                                        {order.manualAddressSummary}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Action Button */}
                                    <div className="mt-3 pt-3 border-t border-white/5">
                                        <button className="w-full py-2.5 rounded-xl bg-[#f2546d]/10 border border-[#f2546d]/20 text-[#f2546d] text-sm font-bold hover:bg-[#f2546d]/20 transition-colors">
                                            {getActionLabel(order)}
                                        </button>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </main>
        </div>
    );
}
