/**
 * Order Card Component
 * 
 * Displays order details with pickup/dropoff locations, items, and status.
 * Updated with premium glassmorphism design.
 */

import { Navigation, Clock, IndianRupee, Phone, MessageSquare, Package, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';

export interface OrderCardProps {
    id: string;
    orderType?: 'delivery' | 'pickup' | 'return';
    pickup: {
        name: string;
        address: string;
    };
    dropoff: {
        name: string;
        address: string;
    };
    earnings: number;
    distance: string;
    duration: string;
    status?: 'pending' | 'accepted' | 'picked_up' | 'delivering' | 'delivered';
    customerPhone?: string;
    customerName?: string;
    paymentMethod?: string | null;
    items?: Array<{ name: string; qty: number; imageUrl?: string }>;
    onCall?: () => void;
    onMessage?: () => void;
    onClick?: () => void;
    variant?: 'default' | 'compact' | 'detailed';
    className?: string;
}

const statusColors = {
    pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    accepted: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    picked_up: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    delivering: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    delivered: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
};

const statusLabels = {
    pending: 'New Order',
    accepted: 'Accepted',
    picked_up: 'Picked Up',
    delivering: 'On The Way',
    delivered: 'Delivered',
};

export function OrderCard({
    id: _id,
    orderType,
    pickup,
    dropoff,
    earnings,
    distance,
    duration,
    status = 'pending',
    customerPhone,
    customerName,
    paymentMethod,
    items = [],
    onCall,
    onMessage,
    onClick,
    variant = 'default',
    className,
}: OrderCardProps) {
    const isDetailed = variant === 'detailed' || status === 'pending';

    return (
        <motion.div
            whileHover={{ scale: onClick ? 1.01 : 1 }}
            whileTap={{ scale: onClick ? 0.99 : 1 }}
            onClick={onClick}
            className={clsx(
                "relative rounded-3xl overflow-hidden",
                "bg-zinc-900/40 backdrop-blur-xl border border-white/10",
                "shadow-2xl shadow-black/20",
                onClick && "cursor-pointer",
                className
            )}
        >
            {/* Header / Badges */}
            <div className="px-5 pt-5 flex items-center justify-between gap-2">
                <div className="flex flex-col gap-1.5">
                    {orderType && (
                        <span className={clsx(
                            "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest",
                            orderType === 'delivery'
                                ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                : orderType === 'return'
                                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                    : "bg-orange-500/10 text-orange-400 border border-orange-500/20"
                        )}>
                            {orderType === 'delivery' ? '📦 Delivery' : orderType === 'return' ? '↩ Return' : '🔄 Pickup'}
                        </span>
                    )}
                    <span className="text-[10px] font-mono font-medium text-zinc-500">
                        #{_id.slice(0, 8).toUpperCase()}
                    </span>
                </div>

                <div className="flex flex-col items-end gap-1.5">
                    <span className={clsx(
                        "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                        statusColors[status]
                    )}>
                        {statusLabels[status]}
                    </span>
                    {customerName && (
                        <span className="text-[10px] text-zinc-400 font-medium truncate max-w-[100px]">
                            👤 {customerName}
                        </span>
                    )}
                    {paymentMethod && (
                        <span className={clsx(
                            'text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border',
                            paymentMethod === 'cod'
                                ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                                : 'bg-green-500/20 text-green-400 border-green-500/30'
                        )}>
                            {paymentMethod === 'cod' ? 'POD' : 'PAID'}
                        </span>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="p-5">
                {/* Locations Timeline */}
                <div className="relative pl-7 space-y-6">
                    {/* Vertical line */}
                    <div className="absolute left-[11px] top-2 bottom-2 w-[1px] bg-white/10" />

                    {/* Pickup */}
                    <div className="relative group">
                        <div className="absolute -left-7 top-1 w-[22px] h-[22px] rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                            <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                        </div>
                        <div>
                            <span className="text-[10px] text-zinc-500 uppercase tracking-widest block mb-0.5">Pickup</span>
                            <h4 className="text-sm text-white font-semibold leading-tight">{pickup.name}</h4>
                            {variant !== 'compact' && (
                                <p className="text-xs text-zinc-400 mt-1 line-clamp-1 italic">{pickup.address}</p>
                            )}
                        </div>
                    </div>

                    {/* Dropoff */}
                    <div className="relative group">
                        <div className="absolute -left-7 top-1 w-[22px] h-[22px] rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                        </div>
                        <div>
                            <span className="text-[10px] text-zinc-500 uppercase tracking-widest block mb-0.5">Dropoff</span>
                            <h4 className="text-sm text-white font-semibold leading-tight">{dropoff.name}</h4>
                            {variant !== 'compact' && (
                                <p className="text-xs text-zinc-400 mt-1 line-clamp-1 italic">{dropoff.address}</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Items Section (Detailed View) */}
                {isDetailed && items.length > 0 && (
                    <div className="mt-6 pt-5 border-t border-white/10">
                        <div className="flex items-center gap-2 mb-3">
                            <Package size={14} className="text-zinc-500" />
                            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">
                                {items.length} {items.length === 1 ? 'Item' : 'Items'} to pick up
                            </span>
                        </div>
                        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
                            {items.map((item, idx) => (
                                <div key={idx} className="flex-shrink-0 w-44 bg-white/5 rounded-2xl p-3 border border-white/5">
                                    <div className="flex gap-3">
                                        <div className="w-12 h-12 rounded-lg bg-zinc-800 flex-shrink-0 overflow-hidden border border-white/10">
                                            {item.imageUrl ? (
                                                <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-zinc-600 font-mono text-[10px]">
                                                    IMG
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs text-white font-medium truncate">{item.name}</p>
                                            <p className="text-[10px] text-zinc-500 mt-0.5">Qty: {item.qty}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Bottom Bar */}
                <div className="mt-6 pt-5 border-t border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex flex-col">
                            <span className="text-[9px] text-zinc-500 uppercase tracking-tighter">Distance</span>
                            <div className="flex items-center gap-1 text-xs text-zinc-200">
                                <Navigation size={12} className="text-blue-500" />
                                <span className="font-semibold">{distance}</span>
                            </div>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[9px] text-zinc-500 uppercase tracking-tighter">Time</span>
                            <div className="flex items-center gap-1 text-xs text-zinc-200">
                                <Clock size={12} className="text-amber-500" />
                                <span className="font-semibold">{duration}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col items-end">
                        <span className="text-[9px] text-zinc-500 uppercase tracking-tighter">Earnings</span>
                        <div className="flex items-center gap-0.5 text-lg font-bold text-emerald-400">
                            <IndianRupee size={16} />
                            <span>{earnings}</span>
                        </div>
                    </div>
                </div>

                {/* Dynamic Contact Bar */}
                {variant === 'detailed' && customerPhone && (
                    <div className="flex gap-3 mt-5">
                        <button
                            onClick={(e) => { e.stopPropagation(); onCall?.(); }}
                            className="flex-1 h-12 flex items-center justify-center gap-2 rounded-2xl bg-blue-500/10 text-blue-400 font-bold text-xs uppercase tracking-widest border border-blue-500/20 active:scale-95 transition-all hover:bg-blue-500/20"
                        >
                            <Phone size={16} />
                            Call
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onMessage?.(); }}
                            className="flex-1 h-12 flex items-center justify-center gap-2 rounded-2xl bg-white/5 text-white font-bold text-xs uppercase tracking-widest border border-white/10 active:scale-95 transition-all hover:bg-white/10"
                        >
                            <MessageSquare size={16} />
                            Message
                        </button>
                    </div>
                )}
            </div>

            {/* Click Indicator */}
            {onClick && (
                <div className="absolute top-2 right-2 p-1 text-zinc-700">
                    <ChevronRight size={16} />
                </div>
            )}
        </motion.div>
    );
}

export function OrderCardSkeleton() {
    return (
        <div className="rounded-3xl bg-zinc-900 animate-pulse border border-white/5 h-[300px]">
            <div className="p-5 h-full flex flex-col">
                <div className="flex justify-between mb-8">
                    <div className="h-4 w-20 bg-zinc-800 rounded-full" />
                    <div className="h-4 w-24 bg-zinc-800 rounded-full" />
                </div>
                <div className="flex-1 space-y-6 pl-7 relative">
                    <div className="absolute left-[11px] top-2 bottom-2 w-[1px] bg-zinc-800" />
                    <div className="space-y-2">
                        <div className="h-3 w-12 bg-zinc-800 rounded" />
                        <div className="h-5 w-32 bg-zinc-800 rounded" />
                    </div>
                    <div className="space-y-2">
                        <div className="h-3 w-12 bg-zinc-800 rounded" />
                        <div className="h-5 w-40 bg-zinc-800 rounded" />
                    </div>
                </div>
                <div className="pt-5 border-t border-zinc-800 flex justify-between">
                    <div className="flex gap-4">
                        <div className="h-8 w-12 bg-zinc-800 rounded-lg" />
                        <div className="h-8 w-12 bg-zinc-800 rounded-lg" />
                    </div>
                    <div className="h-8 w-16 bg-zinc-800 rounded-lg" />
                </div>
            </div>
        </div>
    );
}

export default OrderCard;
