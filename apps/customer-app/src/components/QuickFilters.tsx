import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, DollarSign, Zap, Calendar } from "lucide-react";

const QuickFilters = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedFilters, setSelectedFilters] = useState<string[]>([]);

    const occasions = ["Casual", "Party", "Pop", "Street", "Vacation"];
    const deliveryTimes = ["< 30 min", "< 60 min", "< 2 hrs"];
    const priceRanges = ["Under ₹500", "₹500-₹1000", "Above ₹1000"];
    const colors = [
        { name: "Red", hex: "#EF4444" },
        { name: "Blue", hex: "#3B82F6" },
        { name: "Green", hex: "#10B981" },
        { name: "Black", hex: "#000000" },
        { name: "White", hex: "#FFFFFF" },
        { name: "Pink", hex: "#EC4899" },
    ];

    const toggleFilter = (filter: string) => {
        setSelectedFilters((prev) =>
            prev.includes(filter) ? prev.filter((f) => f !== filter) : [...prev, filter]
        );
    };

    return (
        <>
            {/* Filter Panel - Only visible when opened from somewhere else */}
            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
                            onClick={() => setIsOpen(false)}
                        />

                        {/* Panel */}
                        <motion.div
                            initial={{ x: "100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "100%" }}
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="fixed right-0 top-0 bottom-0 w-full md:w-96 bg-white dark:bg-card z-50 shadow-glow overflow-y-auto"
                        >
                            <div className="p-4 sm:p-6">
                                {/* Header */}
                                <div className="flex items-center justify-between mb-6 sm:mb-8">
                                    <h2 className="text-xl sm:text-2xl font-bold">Filters</h2>
                                    <button
                                        onClick={() => setIsOpen(false)}
                                        className="w-12 h-12 rounded-full hover:bg-secondary flex items-center justify-center transition-colors touch-manipulation min-w-[48px] min-h-[48px]"
                                        aria-label="Close filters"
                                    >
                                        <X className="w-6 h-6" />
                                    </button>
                                </div>

                                {/* Selected Filters */}
                                {selectedFilters.length > 0 && (
                                    <div className="mb-6">
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-sm font-semibold text-muted-foreground">
                                                Selected ({selectedFilters.length})
                                            </span>
                                            <button
                                                onClick={() => setSelectedFilters([])}
                                                className="text-sm text-primary font-semibold hover:underline"
                                            >
                                                Clear All
                                            </button>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {selectedFilters.map((filter) => (
                                                <motion.div
                                                    key={filter}
                                                    initial={{ scale: 0.8, opacity: 0 }}
                                                    animate={{ scale: 1, opacity: 1 }}
                                                    exit={{ scale: 0.8, opacity: 0 }}
                                                    className="bg-gradient-to-r from-primary to-secondary text-white px-3 py-1.5 rounded-full text-sm font-semibold flex items-center gap-2"
                                                >
                                                    {filter}
                                                    <button
                                                        onClick={() => toggleFilter(filter)}
                                                        className="hover:bg-white/20 rounded-full p-0.5 transition-colors"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </motion.div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Occasions */}
                                <div className="mb-8">
                                    <h3 className="font-bold mb-4 flex items-center gap-2">
                                        <Calendar className="w-5 h-5 text-primary" />
                                        Occasion
                                    </h3>
                                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                                        {occasions.map((occasion) => (
                                            <motion.button
                                                key={occasion}
                                                onClick={() => toggleFilter(occasion)}
                                                className={`px-3 sm:px-4 py-3 sm:py-3 rounded-xl font-semibold text-sm sm:text-base transition-all touch-manipulation min-h-[48px] ${selectedFilters.includes(occasion)
                                                    ? "bg-gradient-to-r from-primary to-secondary text-white shadow-glow"
                                                    : "bg-secondary hover:bg-secondary/80"
                                                    }`}
                                                whileHover={{ scale: 1.02 }}
                                                whileTap={{ scale: 0.98 }}
                                            >
                                                {occasion}
                                            </motion.button>
                                        ))}
                                    </div>
                                </div>

                                {/* Delivery Time */}
                                <div className="mb-8">
                                    <h3 className="font-bold mb-4 flex items-center gap-2">
                                        <Zap className="w-5 h-5 text-primary" />
                                        Delivery Time
                                    </h3>
                                    <div className="space-y-2">
                                        {deliveryTimes.map((time) => (
                                            <motion.button
                                                key={time}
                                                onClick={() => toggleFilter(time)}
                                                className={`w-full px-4 py-3.5 rounded-xl font-semibold text-left transition-all touch-manipulation min-h-[48px] text-sm sm:text-base ${selectedFilters.includes(time)
                                                    ? "bg-gradient-to-r from-primary to-secondary text-white shadow-glow"
                                                    : "bg-secondary hover:bg-secondary/80"
                                                    }`}
                                                whileHover={{ scale: 1.01 }}
                                                whileTap={{ scale: 0.99 }}
                                            >
                                                {time}
                                            </motion.button>
                                        ))}
                                    </div>
                                </div>

                                {/* Price Range */}
                                <div className="mb-8">
                                    <h3 className="font-bold mb-4 flex items-center gap-2">
                                        <DollarSign className="w-5 h-5 text-primary" />
                                        Price Range
                                    </h3>
                                    <div className="space-y-2">
                                        {priceRanges.map((range) => (
                                            <motion.button
                                                key={range}
                                                onClick={() => toggleFilter(range)}
                                                className={`w-full px-4 py-3.5 rounded-xl font-semibold text-left transition-all touch-manipulation min-h-[48px] text-sm sm:text-base ${selectedFilters.includes(range)
                                                    ? "bg-gradient-to-r from-primary to-secondary text-white shadow-glow"
                                                    : "bg-secondary hover:bg-secondary/80"
                                                    }`}
                                                whileHover={{ scale: 1.01 }}
                                                whileTap={{ scale: 0.99 }}
                                            >
                                                {range}
                                            </motion.button>
                                        ))}
                                    </div>
                                </div>

                                {/* Colors */}
                                <div className="mb-8">
                                    <h3 className="font-bold mb-4">Color</h3>
                                    <div className="flex flex-wrap gap-3">
                                        {colors.map((color) => (
                                            <motion.button
                                                key={color.name}
                                                onClick={() => toggleFilter(color.name)}
                                                className={`w-12 h-12 rounded-full transition-all ${selectedFilters.includes(color.name)
                                                    ? "ring-4 ring-primary ring-offset-2"
                                                    : "ring-2 ring-border"
                                                    }`}
                                                style={{ backgroundColor: color.hex }}
                                                whileHover={{ scale: 1.1 }}
                                                whileTap={{ scale: 0.9 }}
                                                title={color.name}
                                            />
                                        ))}
                                    </div>
                                </div>

                                {/* Apply Button */}
                                <motion.button
                                    className="w-full btn-primary text-base sm:text-lg py-4 touch-manipulation min-h-[56px]"
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => setIsOpen(false)}
                                >
                                    Apply Filters
                                </motion.button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
};

export default QuickFilters;
