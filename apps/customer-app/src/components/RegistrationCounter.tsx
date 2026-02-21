import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, TrendingUp, Flame } from "lucide-react";
import { getSignupCount } from "@/utils/getSignupCount";

interface RegistrationCounterProps {
    targetCount?: number;
    refreshInterval?: number; // milliseconds
    className?: string;
}

export default function RegistrationCounter({
    targetCount = 1000,
    refreshInterval = 30000, // Refresh every 30 seconds
    className = "",
}: RegistrationCounterProps) {
    const [count, setCount] = useState<number>(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchCount = async () => {
            const result = await getSignupCount();
            if (result.error) {
                setError(result.error);
            } else {
                setCount(result.count);
                setError(null);
            }
            setLoading(false);
        };

        // Initial fetch
        fetchCount();

        // Set up periodic refresh
        const interval = setInterval(fetchCount, refreshInterval);

        return () => clearInterval(interval);
    }, [refreshInterval]);

    const percentage = Math.min((count / targetCount) * 100, 100);
    const isHot = count > targetCount * 0.5; // More than 50% filled
    const isAlmostFull = count > targetCount * 0.8; // More than 80% filled

    if (loading) {
        return (
            <div className={`flex items-center gap-2 ${className}`}>
                <div className="w-4 h-4 rounded-full bg-pink-400/30 animate-pulse" />
                <span className="text-sm text-muted-foreground">Loading registrations...</span>
            </div>
        );
    }

    // Don't show error to users, just show nothing or a fallback
    if (error) {
        return null;
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className={`relative ${className}`}
        >
            {/* Main Counter Container */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#EB76C2]/10 via-[#C084FC]/10 to-[#7DD3FC]/10 dark:from-[#EB76C2]/20 dark:via-[#C084FC]/20 dark:to-[#7DD3FC]/20 backdrop-blur-sm border border-[#EB76C2]/20 p-4 sm:p-5">
                {/* Animated background glow */}
                <motion.div
                    className="absolute inset-0 opacity-30"
                    animate={{
                        background: [
                            "radial-gradient(circle at 0% 0%, rgba(235,118,194,0.3) 0%, transparent 50%)",
                            "radial-gradient(circle at 100% 100%, rgba(192,132,252,0.3) 0%, transparent 50%)",
                            "radial-gradient(circle at 0% 100%, rgba(125,211,252,0.3) 0%, transparent 50%)",
                            "radial-gradient(circle at 0% 0%, rgba(235,118,194,0.3) 0%, transparent 50%)",
                        ],
                    }}
                    transition={{
                        duration: 8,
                        repeat: Infinity,
                        ease: "easeInOut",
                    }}
                />

                <div className="relative z-10">
                    {/* Header with Icon */}
                    <div className="flex items-center gap-2 mb-3">
                        <motion.div
                            animate={isHot ? { scale: [1, 1.1, 1] } : {}}
                            transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
                        >
                            {isAlmostFull ? (
                                <Flame className="w-5 h-5 text-orange-500" />
                            ) : isHot ? (
                                <TrendingUp className="w-5 h-5 text-[#EB76C2]" />
                            ) : (
                                <Users className="w-5 h-5 text-[#C084FC]" />
                            )}
                        </motion.div>
                        <span className="text-xs sm:text-sm font-bold uppercase tracking-widest text-foreground/80">
                            {isAlmostFull ? "🔥 Almost Full!" : isHot ? "Trending Now" : "Join the Waitlist"}
                        </span>
                    </div>

                    {/* Main Count Display */}
                    <div className="flex flex-wrap items-baseline gap-2 mb-3">
                        <motion.span
                            key={count}
                            initial={{ scale: 1.2, color: "#EB76C2" }}
                            animate={{ scale: 1, color: "inherit" }}
                            className="text-3xl sm:text-4xl font-playfair font-black bg-gradient-to-r from-[#EB76C2] via-[#C084FC] to-[#7DD3FC] bg-clip-text text-transparent"
                        >
                            {count.toLocaleString()}
                        </motion.span>
                        <span className="text-lg sm:text-xl text-foreground/60 font-medium">
                            / {targetCount.toLocaleString()}
                        </span>
                        <span className="text-sm sm:text-base text-foreground/70 font-medium">
                            registrations
                        </span>
                    </div>

                    {/* Urgency Message */}
                    <p className="text-sm sm:text-base font-semibold text-foreground/80 mb-4">
                        {isAlmostFull ? (
                            <span className="text-orange-600 dark:text-orange-400">
                                Hurry! Only {targetCount - count} spots left! 🏃‍♀️
                            </span>
                        ) : isHot ? (
                            <span className="text-[#EB76C2]">
                                Hurry up! Don't miss your free outfit! 🎁
                            </span>
                        ) : (
                            <span>
                                Be among the first to get exclusive access! ✨
                            </span>
                        )}
                    </p>

                    {/* Progress Bar */}
                    <div className="relative h-3 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                        <motion.div
                            className="absolute inset-y-0 left-0 rounded-full"
                            style={{
                                background: isAlmostFull
                                    ? "linear-gradient(90deg, #f97316, #ea580c)"
                                    : "linear-gradient(90deg, #EB76C2, #C084FC, #7DD3FC)",
                            }}
                            initial={{ width: 0 }}
                            animate={{ width: `${percentage}%` }}
                            transition={{ duration: 1, ease: "easeOut" }}
                        />
                        {/* Shimmer effect on progress bar */}
                        <motion.div
                            className="absolute inset-y-0 w-20 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                            animate={{ x: ["-100%", "400%"] }}
                            transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                        />
                    </div>

                    {/* Percentage Label */}
                    <div className="mt-2 flex justify-between items-center text-xs text-foreground/60">
                        <span>{percentage.toFixed(0)}% full</span>
                        <span className="flex items-center gap-1">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                            </span>
                            Live counter
                        </span>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
