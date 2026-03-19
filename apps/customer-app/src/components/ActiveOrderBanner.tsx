import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Package, MapPin, Clock, X, ChevronRight, Truck } from "lucide-react";
import { useActiveOrder } from "@/hooks/useActiveOrder";

import { ActiveOrder } from "@/hooks/useActiveOrder";

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; bgColor: string }> = {
    pending: {
        label: "Order Placed",
        icon: <Package className="w-4 h-4" />,
        color: "text-zinc-400",
        bgColor: "bg-zinc-500/20",
    },
    confirmed: {
        label: "Order Confirmed",
        icon: <Package className="w-4 h-4" />,
        color: "text-blue-400",
        bgColor: "bg-blue-500/20",
    },
    packed: {
        label: "Order Packed",
        icon: <Package className="w-4 h-4" />,
        color: "text-blue-400",
        bgColor: "bg-blue-500/20",
    },
    ready_for_pickup: {
        label: "Ready for Pickup",
        icon: <Package className="w-4 h-4" />,
        color: "text-indigo-400",
        bgColor: "bg-indigo-500/20",
    },
    rider_assigned: {
        label: "Rider Assigned",
        icon: <Truck className="w-4 h-4" />,
        color: "text-cyan-400",
        bgColor: "bg-cyan-500/20",
    },
    driver_arrived_warehouse: {
        label: "Rider at Warehouse",
        icon: <MapPin className="w-4 h-4" />,
        color: "text-purple-400",
        bgColor: "bg-purple-500/20",
    },
    order_picked_up: {
        label: "Package Collected",
        icon: <Package className="w-4 h-4" />,
        color: "text-purple-400",
        bgColor: "bg-purple-500/20",
    },
    dispatched: {
        label: "Dispatched",
        icon: <MapPin className="w-4 h-4" />,
        color: "text-orange-400",
        bgColor: "bg-orange-500/20",
    },
    out_for_delivery: {
        label: "On the Way",
        icon: <MapPin className="w-4 h-4" />,
        color: "text-pink-400",
        bgColor: "bg-pink-500/20",
    },
    delivered: {
        label: "Delivered",
        icon: <Package className="w-4 h-4" />,
        color: "text-green-400",
        bgColor: "bg-green-500/20",
    },
};

export function ActiveOrderBanner() {
    const navigate = useNavigate();
    const { activeOrder, loading } = useActiveOrder();
    const [isDismissed, setIsDismissed] = useState(false);

    const handleTrackOrder = () => {
        if (activeOrder) {
            navigate(`/tracking/${activeOrder.id}`);
        }
    };

    const handleDismiss = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsDismissed(true);
        // Store dismissal in session storage (will show again on page refresh)
        sessionStorage.setItem(`dismissed_order_${activeOrder?.id}`, "true");
    };

    if (loading || !activeOrder || isDismissed) return null;

    const statusConfig = STATUS_CONFIG[activeOrder.status];

    return (
        <AnimatePresence>
            <motion.div
                initial={{ y: -100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -100, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="fixed top-0 left-0 right-0 z-[100] px-4 pt-2"
            >
                <div
                    onClick={handleTrackOrder}
                    className="bg-gradient-to-r from-zinc-900 to-black border border-zinc-800 rounded-2xl p-3 shadow-lg backdrop-blur-md cursor-pointer hover:border-pink-500/50 transition-all group"
                >
                    <div className="flex items-center gap-3">
                        {/* Status Icon */}
                        <div className={`p-2 rounded-lg ${statusConfig.bgColor}`}>
                            <div className={statusConfig.color}>
                                {statusConfig.icon}
                            </div>
                        </div>

                        {/* Order Info */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                                <p className={`text-sm font-semibold ${statusConfig?.color || 'text-zinc-400'}`}>
                                    {statusConfig?.label || "Order Update"}
                                </p>
                                {activeOrder.estimated_delivery && (
                                    <div className="flex items-center gap-1 text-xs text-zinc-400">
                                        <Clock className="w-3 h-3" />
                                        <span>ETA: {new Date(activeOrder.estimated_delivery).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                )}
                            </div>
                            <p className="text-xs text-zinc-500 truncate">
                                Total: ₹{activeOrder.total_amount}
                                {activeOrder.rider_name && ` • Rider: ${activeOrder.rider_name}`}
                            </p>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1">
                            <button
                                onClick={handleDismiss}
                                className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                            <div className="p-1.5 text-pink-500 group-hover:translate-x-0.5 transition-transform">
                                <ChevronRight className="w-5 h-5" />
                            </div>
                        </div>
                    </div>

                    {/* Progress Bar (optional) */}
                    {activeOrder.status === "out_for_delivery" && (
                        <div className="mt-2 h-1 bg-zinc-800 rounded-full overflow-hidden">
                            <motion.div
                                initial={{ width: "0%" }}
                                animate={{ width: "60%" }}
                                transition={{ duration: 1 }}
                                className="h-full bg-gradient-to-r from-pink-500 to-[#ff4d6d]"
                            />
                        </div>
                    )}
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
