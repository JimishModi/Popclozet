/**
 * Swipe To Accept Component
 * 
 * Swipeable button for accepting orders with haptic feedback
 */

import { useState, useRef } from 'react';
import { motion, PanInfo, useAnimation } from 'framer-motion';
import { ArrowRight, Check } from 'lucide-react';
import { clsx } from 'clsx';

interface SwipeToAcceptProps {
    onAccept: () => void;
    text?: string;
    disabled?: boolean;
    className?: string;
}

export function SwipeToAccept({
    onAccept,
    text = "Swipe to Accept",
    disabled = false,
    className
}: SwipeToAcceptProps) {
    const [isComplete, setIsComplete] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const controls = useAnimation();

    const handleDragEnd = async (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        const containerWidth = containerRef.current?.offsetWidth || 300;
        const threshold = containerWidth * 0.6; // 60% to trigger accept

        if (info.offset.x >= threshold) {
            // Swipe completed
            setIsComplete(true);

            // Haptic feedback if available
            if (navigator.vibrate) {
                navigator.vibrate([50, 30, 50]);
            }

            await controls.start({ x: containerWidth - 64 });

            // Small delay for visual feedback
            setTimeout(() => {
                onAccept();
            }, 200);
        } else {
            // Spring back
            controls.start({ x: 0 });
        }
    };

    return (
        <div
            ref={containerRef}
            className={clsx(
                "relative h-14 rounded-full overflow-hidden",
                "bg-gradient-to-r from-blue-600 to-blue-500",
                "shadow-lg shadow-blue-500/30",
                disabled && "opacity-50 pointer-events-none",
                className
            )}
        >
            {/* Background pattern */}
            <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
                {/* Animated arrows */}
                <div className="flex items-center gap-2 text-white/30 animate-pulse">
                    <ArrowRight size={20} />
                    <ArrowRight size={20} />
                    <ArrowRight size={20} />
                </div>
            </div>

            {/* Text */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-white font-semibold text-base tracking-wide">
                    {isComplete ? "Accepted!" : text}
                </span>
            </div>

            {/* Progress track */}
            <motion.div
                className="absolute left-0 top-0 h-full bg-blue-400/30 rounded-full"
                style={{ width: "0%" }}
            />

            {/* Draggable thumb */}
            <motion.div
                drag={disabled || isComplete ? false : "x"}
                dragConstraints={{ left: 0, right: containerRef.current ? containerRef.current.offsetWidth - 64 : 236 }}
                dragElastic={0.1}
                onDragEnd={handleDragEnd}
                animate={controls}
                className={clsx(
                    "absolute left-1 top-1 w-12 h-12 rounded-full",
                    "bg-white shadow-lg cursor-grab active:cursor-grabbing",
                    "flex items-center justify-center",
                    isComplete && "bg-green-500"
                )}
                whileDrag={{ scale: 1.05 }}
            >
                {isComplete ? (
                    <Check className="text-white" size={24} />
                ) : (
                    <ArrowRight className="text-blue-600" size={24} />
                )}
            </motion.div>
        </div>
    );
}

export default SwipeToAccept;
