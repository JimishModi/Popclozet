/**
 * Order Card Component
 * 
 * Displays order details with pickup/dropoff locations
 */

import { Navigation, Clock, IndianRupee, Phone, MessageSquare } from 'lucide-react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';

export interface OrderCardProps {
    id: string;
    orderType?: 'delivery' | 'pickup'; // NEW: Order type for badge
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
    customerName?: string; // NEW: Customer name for display
    itemCount?: number;    // NEW: Number of items
    onCall?: () => void;
    onMessage?: () => void;
    onClick?: () => void;
    variant?: 'default' | 'compact' | 'detailed';
    className?: string;
}

const statusColors = {
    pending: 'bg-amber-500',
    accepted: 'bg-blue-500',
    picked_up: 'bg-purple-500',
    delivering: 'bg-cyan-500',
    delivered: 'bg-green-500',
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
    customerName: _customerName,
    itemCount: _itemCount,
    onCall,
    onMessage,
    onClick,
    variant = 'default',
    className,
}: OrderCardProps) {
    return (
        <motion.div
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={onClick}
            className={clsx(
                "relative rounded-2xl overflow-hidden",
                "bg-zinc-900 border border-zinc-800",
                onClick && "cursor-pointer",
                className
            )}
        >
            {/* Order Type badge (DELIVERY / PICKUP) */}
            <div className="absolute top-3 left-3 z-10 flex flex-col gap-1">
                {orderType && (
                    <span className={clsx(
                        "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide",
                        orderType === 'delivery'
                            ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                            : "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                    )}>
                        {orderType === 'delivery' ? '📦 Delivery' : '🔄 Pickup'}
                    </span>
                )}
                <span className="px-2 py-0.5 rounded-lg text-[9px] font-mono font-bold bg-zinc-800/80 text-zinc-400 border border-zinc-700/50 backdrop-blur-sm self-start">
                    #{_id.slice(0, 8).toUpperCase()}
                </span>
            </div>

            {/* Status badge */}
            {status && (
                <div className={clsx("absolute top-3 z-10", orderType ? "right-3" : "right-3")}>
                    <span className={clsx(
                        "px-2.5 py-1 rounded-full text-xs font-medium text-white",
                        statusColors[status]
                    )}>
                        {statusLabels[status]}
                    </span>
                </div>
            )}

            {/* Content */}
            <div className="p-4">
                {/* Locations */}
                <div className="relative pl-6">
                    {/* Vertical line */}
                    <div className="absolute left-[7px] top-3 bottom-3 w-0.5 bg-gradient-to-b from-blue-500 to-green-500" />

                    {/* Pickup */}
                    <div className="relative mb-4">
                        <div className="absolute -left-6 top-0.5 w-3.5 h-3.5 rounded-full bg-blue-500 border-2 border-zinc-900" />
                        <div>
                            <span className="text-xs text-zinc-500 uppercase tracking-wider">Pickup</span>
                            <h4 className="text-white font-medium">{pickup.name}</h4>
                            {variant !== 'compact' && (
                                <p className="text-sm text-zinc-400 line-clamp-1">{pickup.address}</p>
                            )}
                        </div>
                    </div>

                    {/* Dropoff */}
                    <div className="relative">
                        <div className="absolute -left-6 top-0.5 w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-zinc-900" />
                        <div>
                            <span className="text-xs text-zinc-500 uppercase tracking-wider">Dropoff</span>
                            <h4 className="text-white font-medium">{dropoff.name}</h4>
                            {variant !== 'compact' && (
                                <p className="text-sm text-zinc-400 line-clamp-1">{dropoff.address}</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Divider */}
                <div className="my-4 border-t border-zinc-800" />

                {/* Footer stats */}
                <div className="flex items-center justify-between">
                    {/* Distance & Duration */}
                    <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1.5 text-zinc-400">
                            <Navigation size={14} className="text-zinc-500" />
                            <span>{distance}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-zinc-400">
                            <Clock size={14} className="text-zinc-500" />
                            <span>{duration}</span>
                        </div>
                    </div>

                    {/* Earnings */}
                    <div className="flex items-center gap-1 text-green-500 font-semibold">
                        <IndianRupee size={16} />
                        <span>{earnings}</span>
                    </div>
                </div>

                {/* Contact buttons (for detailed variant) */}
                {variant === 'detailed' && customerPhone && (
                    <div className="flex gap-3 mt-4">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onCall?.();
                            }}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-500/10 text-blue-500 font-medium hover:bg-blue-500/20 transition-colors"
                        >
                            <Phone size={18} />
                            <span>Call</span>
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onMessage?.();
                            }}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-zinc-800 text-white font-medium hover:bg-zinc-700 transition-colors"
                        >
                            <MessageSquare size={18} />
                            <span>Message</span>
                        </button>
                    </div>
                )}
            </div>
        </motion.div>
    );
}

/**
 * Order Card Skeleton for loading states
 */
export function OrderCardSkeleton() {
    return (
        <div className="rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800 p-4 animate-pulse">
            <div className="relative pl-6">
                <div className="absolute left-[7px] top-3 bottom-3 w-0.5 bg-zinc-800" />

                {/* Pickup skeleton */}
                <div className="relative mb-4">
                    <div className="absolute -left-6 top-0.5 w-3.5 h-3.5 rounded-full bg-zinc-800" />
                    <div className="h-3 w-12 bg-zinc-800 rounded mb-2" />
                    <div className="h-4 w-32 bg-zinc-800 rounded mb-1" />
                    <div className="h-3 w-48 bg-zinc-800 rounded" />
                </div>

                {/* Dropoff skeleton */}
                <div className="relative">
                    <div className="absolute -left-6 top-0.5 w-3.5 h-3.5 rounded-full bg-zinc-800" />
                    <div className="h-3 w-12 bg-zinc-800 rounded mb-2" />
                    <div className="h-4 w-28 bg-zinc-800 rounded mb-1" />
                    <div className="h-3 w-40 bg-zinc-800 rounded" />
                </div>
            </div>

            <div className="my-4 border-t border-zinc-800" />

            <div className="flex items-center justify-between">
                <div className="flex gap-4">
                    <div className="h-4 w-16 bg-zinc-800 rounded" />
                    <div className="h-4 w-16 bg-zinc-800 rounded" />
                </div>
                <div className="h-5 w-12 bg-zinc-800 rounded" />
            </div>
        </div>
    );
}

export default OrderCard;
