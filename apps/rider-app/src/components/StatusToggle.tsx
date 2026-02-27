/**
 * Status Toggle Component
 * 
 * Online/Offline toggle for rider status
 */

import { motion } from 'framer-motion';
import { clsx } from 'clsx';

interface StatusToggleProps {
    isOnline: boolean;
    onToggle: () => void;
    isLoading?: boolean;
    disabled?: boolean;
    className?: string;
}

export function StatusToggle({
    isOnline,
    onToggle,
    isLoading = false,
    disabled = false,
    className,
}: StatusToggleProps) {
    return (
        <div className={clsx("flex items-center gap-3", className)}>
            <span className={clsx(
                "text-sm font-medium transition-colors",
                isOnline ? "text-green-500" : "text-zinc-400"
            )}>
                You are {isOnline ? 'Online' : 'Offline'}
            </span>

            <button
                onClick={onToggle}
                disabled={disabled || isLoading}
                className={clsx(
                    "relative w-14 h-7 rounded-full transition-colors duration-300",
                    "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-900",
                    isOnline ? "bg-green-500 focus:ring-green-500/50" : "bg-zinc-700 focus:ring-zinc-500/50",
                    (disabled || isLoading) && "opacity-50 cursor-not-allowed"
                )}
            >
                {/* Track glow */}
                {isOnline && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="absolute inset-0 rounded-full bg-green-500/50 blur-md"
                    />
                )}

                {/* Thumb */}
                <motion.div
                    layout
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    className={clsx(
                        "absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md",
                        "flex items-center justify-center",
                        isOnline ? "left-[calc(100%-1.625rem)]" : "left-0.5"
                    )}
                >
                    {isLoading && (
                        <div className="w-3 h-3 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
                    )}
                </motion.div>
            </button>
        </div>
    );
}

/**
 * Large Status Toggle with animation
 */
interface LargeStatusToggleProps extends StatusToggleProps {
    searchingText?: string;
}

export function LargeStatusToggle({
    isOnline,
    onToggle,
    isLoading = false,
    disabled = false,
    searchingText,
    className,
}: LargeStatusToggleProps) {
    return (
        <div className={clsx("flex flex-col items-center gap-4", className)}>
            {/* Status indicator */}
            <div className="relative">
                {/* Pulse rings when online */}
                {isOnline && !isLoading && (
                    <>
                        <motion.div
                            animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="absolute inset-0 rounded-full bg-green-500"
                        />
                        <motion.div
                            animate={{ scale: [1, 1.8], opacity: [0.3, 0] }}
                            transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                            className="absolute inset-0 rounded-full bg-green-500"
                        />
                    </>
                )}

                {/* Main button */}
                <motion.button
                    onClick={onToggle}
                    disabled={disabled || isLoading}
                    whileTap={{ scale: 0.95 }}
                    className={clsx(
                        "relative w-24 h-24 rounded-full",
                        "flex items-center justify-center",
                        "shadow-lg transition-colors duration-300",
                        "focus:outline-none focus:ring-4",
                        isOnline
                            ? "bg-green-500 shadow-green-500/30 focus:ring-green-500/30"
                            : "bg-zinc-800 shadow-zinc-900/50 focus:ring-zinc-500/30",
                        (disabled || isLoading) && "opacity-50 cursor-not-allowed"
                    )}
                >
                    {/* Power icon */}
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={clsx(
                            "w-10 h-10",
                            isOnline ? "text-white" : "text-zinc-400"
                        )}
                    >
                        <line x1="12" y1="2" x2="12" y2="12" />
                        <path d="M17 6a8 8 0 1 1-10 0" />
                    </svg>
                </motion.button>
            </div>

            {/* Status text */}
            <div className="text-center">
                <p className={clsx(
                    "text-lg font-semibold",
                    isOnline ? "text-green-500" : "text-zinc-400"
                )}>
                    {isLoading ? "Updating..." : isOnline ? "Online" : "Offline"}
                </p>
                {isOnline && searchingText && (
                    <p className="text-sm text-zinc-500 mt-1">
                        {searchingText}
                    </p>
                )}
            </div>
        </div>
    );
}

export default StatusToggle;
