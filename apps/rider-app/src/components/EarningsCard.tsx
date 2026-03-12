/**
 * Earnings Card Component
 * 
 * Displays today's earnings with stats
 */

import { Clock, TrendingUp, Package } from 'lucide-react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';

interface EarningsCardProps {
    todayEarnings: number;
    predictedEarnings?: number;
    ordersCount: number;
    onlineHours: number;
    bonusPay?: number;
    bonusProgress?: number; // 0-100
    isOnline?: boolean;
    onClick?: () => void;
    className?: string;
}

export function EarningsCard({
    todayEarnings,
    predictedEarnings,
    ordersCount,
    onlineHours,
    bonusPay: _bonusPay = 0,
    bonusProgress: _bonusProgress = 0,
    isOnline = false,
    onClick,
    className,
}: EarningsCardProps) {
    return (
        <motion.div
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={onClick}
            className={clsx(
                "rounded-2xl overflow-hidden",
                "bg-gradient-to-br from-zinc-900 to-zinc-800",
                "border border-zinc-700/50",
                onClick && "cursor-pointer",
                className
            )}
        >
            {/* Header */}
            <div className="p-4 pb-0">
                <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-zinc-400">Today's Earnings</span>
                    {isOnline && (
                        <span className="flex items-center gap-1 text-xs text-green-500">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                            Live
                        </span>
                    )}
                </div>

                {/* Main amount */}
                <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-white">{todayEarnings}</span>
                    <span className="text-2xl text-zinc-400">₹</span>
                </div>

                {/* Predicted earnings */}
                {isOnline && predictedEarnings && (
                    <div className="flex items-center gap-1.5 mt-2 text-sm">
                        <TrendingUp size={14} className="text-blue-400" />
                        <span className="text-zinc-400">Predicted:</span>
                        <span className="text-blue-400 font-medium">{predictedEarnings} ₹</span>
                    </div>
                )}
            </div>

            {/* Stats row */}
            <div className="flex items-center justify-around p-4 mt-2 border-t border-zinc-800">
                <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-zinc-400 mb-1">
                        <Package size={14} />
                    </div>
                    <span className="text-lg font-semibold text-white">{ordersCount}</span>
                    <span className="block text-xs text-zinc-500">Orders</span>
                </div>

                <div className="w-px h-8 bg-zinc-800" />

                <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-zinc-400 mb-1">
                        <Clock size={14} />
                    </div>
                    <span className="text-lg font-semibold text-white">{onlineHours}h</span>
                    <span className="block text-xs text-zinc-500">Online</span>
                </div>
            </div>
        </motion.div>
    );
}

/**
 * Bonus Progress Card
 */
interface BonusCardProps {
    bonusPay: number;
    currentOrders: number;
    targetOrders: number;
    milestones: number[];
    className?: string;
}

export function BonusCard({
    bonusPay,
    currentOrders,
    targetOrders,
    milestones,
    className,
}: BonusCardProps) {
    const progress = (currentOrders / targetOrders) * 100;

    return (
        <div className={clsx(
            "rounded-2xl overflow-hidden p-4",
            "bg-gradient-to-r from-amber-500/10 to-orange-500/10",
            "border border-amber-500/20",
            className
        )}>
            <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-amber-400/80">Today's Bonus Pay</span>
                <div className="flex items-baseline gap-0.5">
                    <span className="text-xl font-bold text-amber-400">{bonusPay}</span>
                    <span className="text-sm text-amber-400/60">₹</span>
                </div>
            </div>

            {/* Progress bar */}
            <div className="relative">
                <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(progress, 100)}%` }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                        className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full"
                    />
                </div>

                {/* Milestone dots */}
                <div className="absolute top-0 left-0 right-0 flex items-center justify-between h-2">
                    {milestones.map((milestone, index) => {
                        const position = (milestone / targetOrders) * 100;
                        const isReached = currentOrders >= milestone;
                        return (
                            <div
                                key={index}
                                className={clsx(
                                    "w-2.5 h-2.5 rounded-full border-2 border-zinc-900",
                                    isReached ? "bg-amber-500" : "bg-zinc-700"
                                )}
                                style={{ marginLeft: index === 0 ? `${position}%` : 'auto' }}
                            />
                        );
                    })}
                </div>
            </div>

            {/* Milestone labels */}
            <div className="flex justify-between mt-2 text-xs text-zinc-500">
                <span>{currentOrders} orders</span>
                <span>{targetOrders} target</span>
            </div>
        </div>
    );
}

export default EarningsCard;
