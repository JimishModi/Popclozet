// src/components/QuickViewModal.tsx
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    X,
    ChevronLeft,
    ChevronRight,
    Calendar,
    Check,
    ShoppingBag,
    Ruler,
    Heart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCart } from "@/context/CartContext";

interface Product {
    id: string | number;
    name: string;
    brand: string;
    price: number;
    retailPrice?: number;
    images: string[];
    sizes: string[];
    color?: string;
    description?: string;
    modelStats?: {
        height: string;
        size: string;
    };
}

interface QuickViewModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: Product | null;
}

export default function QuickViewModal({
    isOpen,
    onClose,
    product,
}: QuickViewModalProps) {
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [selectedSize, setSelectedSize] = useState<string | null>(null);
    const [selectedDates, setSelectedDates] = useState<{
        start: Date | null;
        end: Date | null;
    }>({ start: null, end: null });
    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
    const [isAdded, setIsAdded] = useState(false);
    const [isWishlisted, setIsWishlisted] = useState(false);

    const { addToCart } = useCart();

    if (!product) return null;

    const hasValidDates = selectedDates.start && selectedDates.end;
    const canAddToCart = hasValidDates && selectedSize;

    const handlePrevImage = () => {
        setCurrentImageIndex((prev) =>
            prev === 0 ? product.images.length - 1 : prev - 1
        );
    };

    const handleNextImage = () => {
        setCurrentImageIndex((prev) =>
            prev === product.images.length - 1 ? 0 : prev + 1
        );
    };

    const handleSelectQuickDate = (days: number) => {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(end.getDate() + days);
        setSelectedDates({ start, end });
    };

    const handleAddToCart = () => {
        if (!canAddToCart) return;

        // Use the Cart Context's addToCart which takes a productId
        addToCart(String(product.id));

        setIsAdded(true);
        setTimeout(() => {
            setIsAdded(false);
            onClose();
        }, 1500);
    };

    const formatDateRange = () => {
        if (!selectedDates.start || !selectedDates.end) return null;
        const options: Intl.DateTimeFormatOptions = {
            month: "short",
            day: "numeric",
        };
        return `${selectedDates.start.toLocaleDateString("en-US", options)} - ${selectedDates.end.toLocaleDateString("en-US", options)}`;
    };

    const getRentalDays = () => {
        if (!selectedDates.start || !selectedDates.end) return 0;
        const diff = selectedDates.end.getTime() - selectedDates.start.getTime();
        return Math.ceil(diff / (1000 * 60 * 60 * 24));
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4"
                >
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={onClose}
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 20 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="relative w-full max-w-4xl max-h-[90vh] bg-background rounded-3xl shadow-2xl overflow-hidden"
                    >
                        {/* Close Button */}
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 z-10 p-2 rounded-full bg-background/80 backdrop-blur hover:bg-muted transition-colors"
                            aria-label="Close"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="flex flex-col md:flex-row h-full max-h-[90vh] overflow-y-auto">
                            {/* Image Gallery */}
                            <div className="relative md:w-1/2 bg-gradient-to-br from-muted/30 to-muted/10">
                                <div className="aspect-[3/4] relative">
                                    <AnimatePresence mode="wait">
                                        <motion.img
                                            key={currentImageIndex}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            src={product.images[currentImageIndex]}
                                            alt={`${product.name} - Image ${currentImageIndex + 1}`}
                                            className="w-full h-full object-cover"
                                        />
                                    </AnimatePresence>

                                    {/* Image Navigation */}
                                    {product.images.length > 1 && (
                                        <>
                                            <button
                                                onClick={handlePrevImage}
                                                className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-background/80 backdrop-blur hover:bg-background transition-colors"
                                                aria-label="Previous image"
                                            >
                                                <ChevronLeft className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={handleNextImage}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-background/80 backdrop-blur hover:bg-background transition-colors"
                                                aria-label="Next image"
                                            >
                                                <ChevronRight className="w-5 h-5" />
                                            </button>

                                            {/* Dots */}
                                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                                                {product.images.map((_, idx) => (
                                                    <button
                                                        key={idx}
                                                        onClick={() => setCurrentImageIndex(idx)}
                                                        className={cn(
                                                            "w-2 h-2 rounded-full transition-all",
                                                            idx === currentImageIndex
                                                                ? "bg-primary w-6"
                                                                : "bg-muted-foreground/50"
                                                        )}
                                                        aria-label={`Go to image ${idx + 1}`}
                                                    />
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Product Details */}
                            <div className="md:w-1/2 p-6 flex flex-col">
                                {/* Header */}
                                <div className="mb-6">
                                    <p className="text-sm text-muted-foreground font-medium uppercase tracking-wide mb-1">
                                        {product.brand}
                                    </p>
                                    <h2 className="text-2xl font-bold mb-2">{product.name}</h2>
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl font-bold text-primary">
                                            ₹{product.price}
                                        </span>
                                        {product.retailPrice && (
                                            <span className="text-sm text-muted-foreground line-through">
                                                Retail: ₹{product.retailPrice}
                                            </span>
                                        )}
                                        <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-medium">
                                            per rental
                                        </span>
                                    </div>
                                </div>

                                {/* Date Selection - CRITICAL: Must select dates first */}
                                <div className="mb-6">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Calendar className="w-4 h-4 text-primary" />
                                        <h3 className="font-semibold">
                                            Select Rental Dates
                                            <span className="text-destructive ml-1">*</span>
                                        </h3>
                                    </div>

                                    {hasValidDates ? (
                                        <div className="flex items-center justify-between p-3 rounded-xl bg-primary/10 border border-primary/20">
                                            <div className="flex items-center gap-2">
                                                <Check className="w-4 h-4 text-primary" />
                                                <span className="font-medium">{formatDateRange()}</span>
                                                <span className="text-sm text-muted-foreground">
                                                    ({getRentalDays()} days)
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => setSelectedDates({ start: null, end: null })}
                                                className="text-sm text-primary font-medium hover:underline"
                                            >
                                                Change
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <p className="text-sm text-muted-foreground">
                                                Choose when you'd like to have this outfit:
                                            </p>
                                            <div className="grid grid-cols-3 gap-2">
                                                {[
                                                    { days: 1, label: "1 Day" },
                                                    { days: 3, label: "3 Days" },
                                                    { days: 7, label: "1 Week" },
                                                ].map((option) => (
                                                    <button
                                                        key={option.days}
                                                        onClick={() => handleSelectQuickDate(option.days)}
                                                        className={cn(
                                                            "px-4 py-3 rounded-xl text-sm font-medium transition-all",
                                                            "bg-muted hover:bg-muted/80 border border-border hover:border-primary/50"
                                                        )}
                                                    >
                                                        {option.label}
                                                    </button>
                                                ))}
                                            </div>
                                            <button
                                                onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
                                                className="w-full px-4 py-3 rounded-xl text-sm font-medium bg-secondary/50 hover:bg-secondary transition-colors flex items-center justify-center gap-2"
                                            >
                                                <Calendar className="w-4 h-4" />
                                                Choose Custom Dates
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Size Selection - Only shown after dates */}
                                <div className={cn("mb-6 transition-opacity", !hasValidDates && "opacity-50 pointer-events-none")}>
                                    <div className="flex items-center gap-2 mb-3">
                                        <Ruler className="w-4 h-4 text-primary" />
                                        <h3 className="font-semibold">
                                            Select Size
                                            <span className="text-destructive ml-1">*</span>
                                        </h3>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {product.sizes.map((size) => (
                                            <button
                                                key={size}
                                                onClick={() => setSelectedSize(size)}
                                                disabled={!hasValidDates}
                                                className={cn(
                                                    "w-14 h-14 rounded-xl font-bold text-sm transition-all",
                                                    selectedSize === size
                                                        ? "bg-gradient-to-r from-primary to-secondary text-white shadow-lg"
                                                        : "bg-muted hover:bg-muted/80 border border-border hover:border-primary/50"
                                                )}
                                            >
                                                {size}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Model Stats */}
                                    {product.modelStats && (
                                        <div className="mt-3 p-3 rounded-xl bg-muted/50 text-sm">
                                            <span className="text-muted-foreground">Model is </span>
                                            <span className="font-medium">{product.modelStats.height}</span>
                                            <span className="text-muted-foreground"> and wearing size </span>
                                            <span className="font-medium">{product.modelStats.size}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Spacer */}
                                <div className="flex-1" />

                                {/* Add to Cart Button */}
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setIsWishlisted(!isWishlisted)}
                                        className={cn(
                                            "p-4 rounded-xl transition-all",
                                            isWishlisted
                                                ? "bg-pink-500/10 text-pink-500"
                                                : "bg-muted hover:bg-muted/80"
                                        )}
                                        aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
                                    >
                                        <Heart className={cn("w-5 h-5", isWishlisted && "fill-current")} />
                                    </button>

                                    <motion.button
                                        onClick={handleAddToCart}
                                        disabled={!canAddToCart}
                                        className={cn(
                                            "flex-1 py-4 rounded-xl font-bold text-base transition-all flex items-center justify-center gap-2",
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
                                        ) : canAddToCart ? (
                                            <>
                                                <ShoppingBag className="w-5 h-5" />
                                                Add to Bag
                                            </>
                                        ) : (
                                            <>
                                                <Calendar className="w-5 h-5" />
                                                {hasValidDates ? "Select Size" : "Select Dates First"}
                                            </>
                                        )}
                                    </motion.button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
