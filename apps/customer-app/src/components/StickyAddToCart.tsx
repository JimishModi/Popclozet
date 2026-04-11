// src/components/StickyAddToCart.tsx
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    ArrowLeft,
    Calendar,
    ShoppingBag,
    Check,
    ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCart, PricingPlan } from "@/context/CartContext";
import { useNavigate } from "react-router-dom";

interface StickyAddToCartProps {
    productId: string;
    productName: string;
    productPrice: number;
    selectedSize: string | null;
    selectedDates: { start: Date | null; end: Date | null };
    onSelectDates: () => void;
    onSelectSize: () => void;
    className?: string;
}

export default function StickyAddToCart({
    productId,
    productName,
    productPrice,
    selectedSize,
    selectedDates,
    onSelectDates,
    onSelectSize,
    className,
}: StickyAddToCartProps) {
    const [isVisible, setIsVisible] = useState(false);
    const [isAdded, setIsAdded] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);
    const { addToCart } = useCart();
    const navigate = useNavigate();

    // Detect PWA standalone mode (for iOS back navigation)
    useEffect(() => {
        const mediaQuery = window.matchMedia("(display-mode: standalone)");
        setIsStandalone(mediaQuery.matches);

        const handler = (e: MediaQueryListEvent) => setIsStandalone(e.matches);
        mediaQuery.addEventListener("change", handler);
        return () => mediaQuery.removeEventListener("change", handler);
    }, []);

    // Show sticky bar when scrolled past a certain point
    useEffect(() => {
        const handleScroll = () => {
            const scrollThreshold = 400; // Show after scrolling 400px
            setIsVisible(window.scrollY > scrollThreshold);
        };

        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const hasValidDates = !!(selectedDates.start && selectedDates.end);
    const canAddToCart = !!(hasValidDates && selectedSize);

    const getRentalDays = () => {
        if (!selectedDates.start || !selectedDates.end) return 0;
        const diff = selectedDates.end.getTime() - selectedDates.start.getTime();
        return Math.ceil(diff / (1000 * 60 * 60 * 24));
    };

    const [isAdding, setIsAdding] = useState(false);

    const handleAddToCart = async () => {
        if (!canAddToCart || isAdding) return;
        setIsAdding(true);

        try {
            const days = getRentalDays();
            let plan: PricingPlan = '3d';
            if (days === 1) plan = '1d';
            else if (days === 2) plan = '2d';

            await addToCart(productId, selectedSize!, plan);
            setIsAdded(true);

            setTimeout(() => {
                setIsAdded(false);
            }, 2000);
        } finally {
            setIsAdding(false);
        }
    };

    const formatDateRange = () => {
        if (!selectedDates.start || !selectedDates.end) return null;
        const options: Intl.DateTimeFormatOptions = {
            month: "short",
            day: "numeric",
        };
        return `${selectedDates.start.toLocaleDateString("en-US", options)} - ${selectedDates.end.toLocaleDateString("en-US", options)}`;
    };

    const handleBack = () => {
        if (window.history.length > 1) {
            navigate(-1);
        } else {
            navigate("/home");
        }
    };

    // Only show on mobile (< 768px)
    if (typeof window !== "undefined" && window.innerWidth >= 768) {
        return null;
    }

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 100, opacity: 0 }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className={cn(
                        "fixed bottom-0 left-0 right-0 z-50 md:hidden",
                        "bg-background/95 backdrop-blur-xl",
                        "border-t border-border shadow-2xl",
                        "pb-safe", // Safe area for iPhone notch
                        className
                    )}
                >
                    {/* iOS Back Navigation - only show in standalone mode */}
                    {isStandalone && (
                        <div className="flex items-center px-4 py-2 border-b border-border/50">
                            <button
                                onClick={handleBack}
                                className="flex items-center gap-2 text-primary font-medium"
                            >
                                <ArrowLeft className="w-5 h-5" />
                                Back
                            </button>
                        </div>
                    )}

                    <div className="px-4 py-3">
                        {/* Product Summary */}
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-sm truncate">{productName}</h3>
                                <p className="text-primary font-bold text-lg">₹{productPrice}</p>
                            </div>

                            {/* Selection Summary */}
                            <div className="flex items-center gap-2 text-xs">
                                {hasValidDates && (
                                    <span className="bg-primary/10 text-primary px-2 py-1 rounded-full">
                                        {formatDateRange()}
                                    </span>
                                )}
                                {selectedSize && (
                                    <span className="bg-muted px-2 py-1 rounded-full font-medium">
                                        {selectedSize}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3">
                            {/* Date/Size Selection Button */}
                            {!canAddToCart && (
                                <button
                                    onClick={hasValidDates ? onSelectSize : onSelectDates}
                                    className={cn(
                                        "flex-1 py-4 rounded-xl font-bold text-base transition-all",
                                        "flex items-center justify-center gap-2",
                                        "bg-secondary text-secondary-foreground hover:bg-secondary/80",
                                        "min-h-[56px]" // Thumb-accessible
                                    )}
                                >
                                    {hasValidDates ? (
                                        <>
                                            <ChevronUp className="w-5 h-5" />
                                            Select Size
                                        </>
                                    ) : (
                                        <>
                                            <Calendar className="w-5 h-5" />
                                            Select Dates First
                                        </>
                                    )}
                                </button>
                            )}

                            {/* Add to Cart Button */}
                            <motion.button
                                onClick={handleAddToCart}
                                disabled={!canAddToCart || isAdding}
                                className={cn(
                                    "py-4 rounded-xl font-bold text-base transition-all",
                                    "flex items-center justify-center gap-2",
                                    "min-h-[56px]", // Thumb-accessible
                                    canAddToCart ? "flex-1" : "hidden",
                                    canAddToCart
                                        ? isAdded
                                            ? "bg-green-500 text-white"
                                            : "bg-gradient-to-r from-primary to-secondary text-white shadow-lg hover:shadow-xl"
                                        : "bg-muted text-muted-foreground cursor-not-allowed"
                                )}
                                whileHover={canAddToCart && !isAdded ? { scale: 1.02 } : {}}
                                whileTap={canAddToCart && !isAdded ? { scale: 0.98 } : {}}
                            >
                                {isAdded ? (
                                    <>
                                        <Check className="w-5 h-5" />
                                        Added!
                                    </>
                                ) : (
                                    <>
                                        <ShoppingBag className="w-5 h-5" />
                                        Add to Bag
                                    </>
                                )}
                            </motion.button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
