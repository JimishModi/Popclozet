import { motion } from "framer-motion";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Package, Truck, RotateCcw, CheckCircle2, X } from "lucide-react";
import { useOrders, Order } from "@/hooks/useOrders";

// Statuses that qualify for the banner and their display config
const BANNER_CONFIG: Record<string, {
    label: string;
    sublabel: string;
    color: string;
    border: string;
    bg: string;
    Icon: React.ElementType;
    pulse: boolean;
}> = {
    pending:                  { label: "Order Placed",         sublabel: "We're getting your order ready",      color: "text-zinc-300",   border: "border-zinc-600",   bg: "bg-zinc-500/10",   Icon: Package,       pulse: false },
    confirmed:                { label: "Order Confirmed",      sublabel: "Being packed for you",                color: "text-blue-300",   border: "border-blue-500",   bg: "bg-blue-500/10",   Icon: Package,       pulse: true  },
    packed:                   { label: "Order Packed",         sublabel: "Ready to be picked up by rider",      color: "text-blue-300",   border: "border-blue-400",   bg: "bg-blue-500/10",   Icon: Package,       pulse: true  },
    ready_for_pickup:         { label: "Ready for Pickup",     sublabel: "Waiting for rider at warehouse",      color: "text-indigo-300", border: "border-indigo-400", bg: "bg-indigo-500/10", Icon: Package,       pulse: true  },
    rider_assigned:           { label: "Rider Assigned",       sublabel: "Rider is heading to warehouse",       color: "text-cyan-300",   border: "border-cyan-400",   bg: "bg-cyan-500/10",   Icon: Truck,         pulse: true  },
    driver_arrived_warehouse: { label: "Rider at Warehouse",   sublabel: "Picking up your order now",          color: "text-orange-300", border: "border-orange-400", bg: "bg-orange-500/10", Icon: Truck,         pulse: true  },
    order_picked_up:          { label: "Order Picked Up",      sublabel: "Rider has your order",               color: "text-pink-300",   border: "border-pink-400",   bg: "bg-pink-500/10",   Icon: Truck,         pulse: true  },
    dispatched:               { label: "On the Way",           sublabel: "Your order is heading to you",       color: "text-pink-300",   border: "border-pink-400",   bg: "bg-pink-500/10",   Icon: Truck,         pulse: true  },
    out_for_delivery:         { label: "Out for Delivery",     sublabel: "Arriving soon!",                     color: "text-[#f2546d]",  border: "border-[#f2546d]",  bg: "bg-[#f2546d]/10",  Icon: Truck,         pulse: true  },
    delivered:                { label: "Delivered",            sublabel: "Your order has arrived",             color: "text-green-300",  border: "border-green-500",  bg: "bg-green-500/10",  Icon: CheckCircle2,  pulse: false },
    in_use:                   { label: "Rental Active",        sublabel: "Enjoy your outfit!",                 color: "text-green-300",  border: "border-green-500",  bg: "bg-green-500/10",  Icon: CheckCircle2,  pulse: false },
    return_requested:         { label: "Return Requested",     sublabel: "Scheduling your pickup",             color: "text-orange-300", border: "border-orange-400", bg: "bg-orange-500/10", Icon: RotateCcw,     pulse: false },
    return_scheduled:         { label: "Return Pickup Scheduled", sublabel: "Rider will collect soon",        color: "text-blue-300",   border: "border-blue-400",   bg: "bg-blue-500/10",   Icon: RotateCcw,     pulse: false },
    return_dispatched:        { label: "Rider On the Way",     sublabel: "Coming to collect your order",       color: "text-indigo-300", border: "border-indigo-400", bg: "bg-indigo-500/10", Icon: RotateCcw,     pulse: true  },
    return_picked_up:         { label: "Return Collected",     sublabel: "Heading back to warehouse",          color: "text-green-300",  border: "border-green-500",  bg: "bg-green-500/10",  Icon: RotateCcw,     pulse: false },
    return_at_warehouse:      { label: "Return Received",      sublabel: "Items arrived at warehouse",         color: "text-green-300",  border: "border-green-500",  bg: "bg-green-500/10",  Icon: RotateCcw,     pulse: false },
    returned:                 { label: "Return Completed",     sublabel: "Process completed successfully",      color: "text-green-300",  border: "border-green-500",  bg: "bg-green-500/10",  Icon: CheckCircle2,  pulse: false },
};

// Which statuses to surface in the banner (excludes very terminal ones)
const BANNER_STATUSES = new Set(Object.keys(BANNER_CONFIG));

function formatEta(etaStr: string): string {
    const eta = new Date(etaStr);
    const diffMs = eta.getTime() - Date.now();
    if (diffMs <= 0) return "Arriving now";
    const mins = Math.round(diffMs / 60000);
    if (mins < 60) return `~${mins} min`;
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return rem > 0 ? `~${hrs}h ${rem}m` : `~${hrs}h`;
}

function pickPriorityOrder(orders: Order[]): Order | null {
    // Priority: active delivery > return in progress > others
    const priorityOrder = [
        "out_for_delivery", "dispatched", "order_picked_up",
        "driver_arrived_warehouse", "rider_assigned", "ready_for_pickup",
        "packed", "confirmed", "pending",
        "return_dispatched", "return_scheduled", "return_requested",
        "delivered", "in_use", "return_picked_up",
    ];
    for (const status of priorityOrder) {
        const found = orders.find(o => o.status === status);
        if (found) return found;
    }
    return orders.find(o => BANNER_STATUSES.has(o.status)) ?? null;
}

export function ActiveDeliveryBanner() {
    const navigate = useNavigate();
    const { activeOrders, loading } = useOrders();
    const [dismissedIds, setDismissedIds] = useState<string[]>(() => {
        try {
            return JSON.parse(localStorage.getItem("dismissed_order_banners") || "[]");
        } catch {
            return [];
        }
    });

    const handleDismiss = (e: React.MouseEvent, orderId: string) => {
        e.stopPropagation();
        const next = [...dismissedIds, orderId].slice(-20); // Keep last 20
        setDismissedIds(next);
        localStorage.setItem("dismissed_order_banners", JSON.stringify(next));
    };

    if (loading || activeOrders.length === 0) return null;

    const filteredOrders = activeOrders.filter(o => !dismissedIds.includes(o.id));
    if (filteredOrders.length === 0) return null;

    const order = pickPriorityOrder(filteredOrders.filter(o => BANNER_STATUSES.has(o.status)));
    if (!order) return null;

    const config = BANNER_CONFIG[order.status];
    if (!config) return null;

    const { Icon, label, sublabel, color, border, bg, pulse } = config;

    const handleClick = () => {
        if (order.status === "delivered" || order.status === "in_use") {
            navigate(`/orders`);
        } else {
            navigate(`/tracking/${order.id}`);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="fixed bottom-[calc(var(--mobile-floating-banner-offset))] left-0 right-0 z-50 px-0 pb-1 md:relative md:bottom-auto md:left-auto md:right-auto md:z-auto md:mt-3 md:pb-0 md:px-4"
        >
            <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleClick}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-none border-t border-[#f2546d]/60 bg-black shadow-[0_0_18px_rgba(242,84,109,0.25)]"
            >
                {/* Icon */}
                <div className="relative flex-shrink-0">
                    {pulse && (
                        <span className="absolute inset-0 rounded-full animate-ping opacity-30 bg-[#f2546d]" />
                    )}
                    <div className="w-10 h-10 rounded-full bg-[#f2546d]/10 border border-[#f2546d]/30 flex items-center justify-center text-[#f2546d]">
                        <Icon className="w-5 h-5" />
                    </div>
                </div>

                {/* Text */}
                <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-bold leading-tight text-white">{label}</p>
                    <p className="text-xs text-zinc-400 mt-0.5 truncate">
                        {order.estimatedDeliveryAt && pulse
                            ? `ETA ${formatEta(order.estimatedDeliveryAt)}`
                            : sublabel}
                    </p>
                </div>

                {/* Right side */}
                <div className="flex items-center gap-2 flex-shrink-0">
                    {filteredOrders.length > 1 && (
                        <span className="text-[10px] font-bold text-white bg-[#f2546d]/20 border border-[#f2546d]/30 px-1.5 py-0.5 rounded-full">
                            +{filteredOrders.length - 1}
                        </span>
                    )}
                    
                    {/* Dismiss Button - only for terminal active states like Delivered */}
                    {(order.status === "delivered" || order.status === "in_use" || order.status === "return_picked_up" || order.status === "return_at_warehouse" || order.status === "returned") && (
                        <button
                            onClick={(e) => handleDismiss(e, order.id)}
                            className="p-1 hover:bg-white/10 rounded-full transition-colors mr-1"
                        >
                            <X className="w-5 h-5 text-zinc-400" />
                        </button>
                    )}
                    
                    <ChevronRight className="w-4 h-4 text-[#f2546d]" />
                </div>
            </motion.button>
        </motion.div>
    );
}
