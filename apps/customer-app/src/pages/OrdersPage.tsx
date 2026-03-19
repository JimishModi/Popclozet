import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronLeft, Package, MapPin, Clock, ChevronRight, Filter, Loader2 } from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { BottomNavBar } from "@/components/layout/BottomNavBar";
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
    return_picked_up: { label: "Return Collected", color: "text-green-500", bgColor: "bg-green-500/10" },
    return_at_warehouse: { label: "At Warehouse", color: "text-amber-400", bgColor: "bg-amber-500/10" },
    returned: { label: "Back At Warehouse", color: "text-amber-400", bgColor: "bg-amber-500/10" },
    return_completed: { label: "Available Again", color: "text-green-400", bgColor: "bg-green-500/20" },
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

    const handleOrderClick = (order: Order) => {
        if (order.status === "delivered" || order.status === "picked_up") {
            navigate(`/order/${order.id}/delivered`);
        } else if (order.status === "pickup_scheduled") {
            navigate(`/pickup/${order.id}`);
        } else {
            navigate(`/tracking/${order.id}`);
        }
    };

    return (
        <MobileShell className="bg-black text-white">
            {/* Header - Matches ProfilePage style */}
            <div className="sticky top-0 z-50 bg-gradient-to-b from-black/90 to-black/70 backdrop-blur-2xl border-b border-white/5 px-4 py-3">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate("/profile")}
                        className="p-2 -ml-2 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all"
                    >
                        <ChevronLeft className="w-5 h-5 text-zinc-400" />
                    </button>
                    <h1 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400">
                        My Orders
                    </h1>
                    <div className="flex-1" />
                    <button className="p-2.5 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all">
                        <Filter className="w-5 h-5 text-zinc-400" />
                    </button>
                </div>
            </div>

            {/* Tabs - Premium Glass Style */}
            <div className="sticky top-[57px] z-40 bg-black/90 backdrop-blur-md border-b border-white/5 px-4 py-3">
                <div className="flex gap-2">
                    <button
                        onClick={() => setActiveTab("active")}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === "active"
                            ? "bg-gradient-to-r from-[#ff4d6d] to-pink-600 text-white shadow-[0_10px_30px_rgba(255,77,109,0.3)]"
                            : "bg-white/5 border border-white/5 text-zinc-500 hover:text-white hover:bg-white/10"
                            }`}
                    >
                        Active ({activeOrders.length})
                    </button>
                    <button
                        onClick={() => setActiveTab("past")}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === "past"
                            ? "bg-gradient-to-r from-[#ff4d6d] to-pink-600 text-white shadow-[0_10px_30px_rgba(255,77,109,0.3)]"
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
                                    className="bg-gradient-to-br from-white/8 to-white/3 backdrop-blur-xl rounded-2xl border border-white/5 p-4 hover:border-[#ff4d6d]/30 transition-all cursor-pointer group"
                                >
                                    {/* Header */}
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-white font-bold">
                                                    #{order.id.slice(-6).toUpperCase()}
                                                </span>
                                                <div
                                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${statusConfig.bgColor} ${statusConfig.color}`}
                                                >
                                                    {statusConfig.label}
                                                </div>
                                            </div>
                                            <p className="text-zinc-600 text-xs font-medium">
                                                {formatDate(order.createdAt)}
                                            </p>
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-zinc-700 group-hover:text-[#ff4d6d] group-hover:translate-x-0.5 transition-all" />
                                    </div>

                                    {/* Details */}
                                    <div className="space-y-2 mb-3">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-zinc-500">Items</span>
                                            <span className="text-white font-medium">
                                                {order.itemCount} item{order.itemCount > 1 ? "s" : ""}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-zinc-500">Total</span>
                                            <span className="text-white font-bold">
                                                ₹{order.totalAmount.toLocaleString()}
                                            </span>
                                        </div>
                                    </div>

                                    {/* ETA for active delivery orders */}
                                    {order.etaMinutes !== undefined && order.etaMinutes > 0 && order.status === "out_for_delivery" && (
                                        <div className="flex items-center gap-2 py-2 border-t border-white/5">
                                            <div className="p-1.5 rounded-lg bg-[#ff4d6d]/20">
                                                <Clock className="w-4 h-4 text-[#ff4d6d]" />
                                            </div>
                                            <span className="text-[#ff4d6d] text-sm font-bold">
                                                Arriving in {order.etaMinutes} min
                                            </span>
                                        </div>
                                    )}

                                    {/* Address for active orders */}
                                    {activeTab === "active" && order.address && (
                                        <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                                            <MapPin className="w-4 h-4 text-zinc-600" />
                                            <span className="text-zinc-500 text-xs truncate">
                                                {order.address.fullAddress}
                                            </span>
                                        </div>
                                    )}

                                    {/* Track Button for Active Orders */}
                                    {activeTab === "active" && (
                                        <div className="mt-3 pt-3 border-t border-white/5">
                                            <button className="w-full py-2.5 rounded-xl bg-[#ff4d6d]/10 border border-[#ff4d6d]/20 text-[#ff4d6d] text-sm font-bold hover:bg-[#ff4d6d]/20 transition-colors">
                                                Track Order
                                            </button>
                                        </div>
                                    )}
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </main>

            <BottomNavBar />
        </MobileShell>
    );
}
