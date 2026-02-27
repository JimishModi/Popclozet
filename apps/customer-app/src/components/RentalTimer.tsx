/**
 * Rental Timer Component
 * 
 * Shows countdown timer for active rentals
 * Displays remaining days/hours/minutes until pickup
 */

import { useState, useEffect } from 'react';
import { Clock, Package, AlertTriangle, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';

interface RentalTimerProps {
    rentalEndDate: string;  // ISO date string
    onExpired?: () => void;
    className?: string;
}

interface TimeRemaining {
    expired: boolean;
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    totalHours: number;
}

function calculateTimeRemaining(endDate: string): TimeRemaining {
    const end = new Date(endDate);
    const now = new Date();
    const diffMs = end.getTime() - now.getTime();

    if (diffMs <= 0) {
        return { expired: true, days: 0, hours: 0, minutes: 0, seconds: 0, totalHours: 0 };
    }

    const totalSeconds = Math.floor(diffMs / 1000);
    const totalMinutes = Math.floor(totalSeconds / 60);
    const totalHours = Math.floor(totalMinutes / 60);
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    const minutes = totalMinutes % 60;
    const seconds = totalSeconds % 60;

    return { expired: false, days, hours, minutes, seconds, totalHours };
}

export function RentalTimer({ rentalEndDate, onExpired, className }: RentalTimerProps) {
    const [timeRemaining, setTimeRemaining] = useState<TimeRemaining>(
        calculateTimeRemaining(rentalEndDate)
    );

    useEffect(() => {
        const timer = setInterval(() => {
            const remaining = calculateTimeRemaining(rentalEndDate);
            setTimeRemaining(remaining);

            if (remaining.expired && onExpired) {
                onExpired();
                clearInterval(timer);
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [rentalEndDate, onExpired]);

    // Determine urgency level for styling
    const isUrgent = timeRemaining.totalHours <= 6;
    const isWarning = timeRemaining.totalHours <= 24 && !isUrgent;
    const isNormal = !isUrgent && !isWarning && !timeRemaining.expired;

    if (timeRemaining.expired) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={clsx(
                    "p-4 rounded-2xl",
                    "bg-orange-500/10 border border-orange-500/30",
                    className
                )}
            >
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                        <Package className="w-5 h-5 text-orange-400" />
                    </div>
                    <div>
                        <h4 className="text-white font-semibold">Rental Period Ended</h4>
                        <p className="text-sm text-orange-400">Pickup is being scheduled</p>
                    </div>
                </div>
                <div className="text-xs text-zinc-400">
                    A rider will contact you shortly to collect the items.
                </div>
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={clsx(
                "p-4 rounded-2xl",
                isUrgent && "bg-red-500/10 border border-red-500/30",
                isWarning && "bg-amber-500/10 border border-amber-500/30",
                isNormal && "bg-zinc-800/50 border border-zinc-700/50",
                className
            )}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    {isUrgent && <AlertTriangle className="w-4 h-4 text-red-400" />}
                    {isWarning && <Clock className="w-4 h-4 text-amber-400" />}
                    {isNormal && <CheckCircle className="w-4 h-4 text-green-400" />}
                    <span className={clsx(
                        "text-sm font-medium",
                        isUrgent && "text-red-400",
                        isWarning && "text-amber-400",
                        isNormal && "text-zinc-300"
                    )}>
                        {isUrgent ? 'Return Soon!' : isWarning ? 'Rental Ending Soon' : 'Rental Active'}
                    </span>
                </div>
            </div>

            {/* Timer Display */}
            <div className="flex justify-center gap-3">
                {/* Days */}
                <div className="text-center">
                    <motion.div
                        key={timeRemaining.days}
                        initial={{ scale: 1.2, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className={clsx(
                            "text-3xl font-bold tabular-nums",
                            isUrgent ? "text-red-400" : isWarning ? "text-amber-400" : "text-white"
                        )}
                    >
                        {String(timeRemaining.days).padStart(2, '0')}
                    </motion.div>
                    <div className="text-xs text-zinc-500 uppercase tracking-wide">Days</div>
                </div>

                <div className="text-2xl text-zinc-600 font-light">:</div>

                {/* Hours */}
                <div className="text-center">
                    <motion.div
                        key={timeRemaining.hours}
                        initial={{ scale: 1.2, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className={clsx(
                            "text-3xl font-bold tabular-nums",
                            isUrgent ? "text-red-400" : isWarning ? "text-amber-400" : "text-white"
                        )}
                    >
                        {String(timeRemaining.hours).padStart(2, '0')}
                    </motion.div>
                    <div className="text-xs text-zinc-500 uppercase tracking-wide">Hrs</div>
                </div>

                <div className="text-2xl text-zinc-600 font-light">:</div>

                {/* Minutes */}
                <div className="text-center">
                    <motion.div
                        key={timeRemaining.minutes}
                        initial={{ scale: 1.2, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className={clsx(
                            "text-3xl font-bold tabular-nums",
                            isUrgent ? "text-red-400" : isWarning ? "text-amber-400" : "text-white"
                        )}
                    >
                        {String(timeRemaining.minutes).padStart(2, '0')}
                    </motion.div>
                    <div className="text-xs text-zinc-500 uppercase tracking-wide">Min</div>
                </div>

                <div className="text-2xl text-zinc-600 font-light">:</div>

                {/* Seconds */}
                <div className="text-center">
                    <motion.div
                        key={timeRemaining.seconds}
                        initial={{ scale: 1.1, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className={clsx(
                            "text-3xl font-bold tabular-nums",
                            isUrgent ? "text-red-400" : isWarning ? "text-amber-400" : "text-zinc-400"
                        )}
                    >
                        {String(timeRemaining.seconds).padStart(2, '0')}
                    </motion.div>
                    <div className="text-xs text-zinc-500 uppercase tracking-wide">Sec</div>
                </div>
            </div>

            {/* Info text */}
            <p className="text-center text-xs text-zinc-500 mt-3">
                {isUrgent
                    ? 'Pickup will be scheduled automatically when timer ends'
                    : 'Items must be returned when rental period ends'
                }
            </p>
        </motion.div>
    );
}

export default RentalTimer;
