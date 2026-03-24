import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MobileShell } from "@/components/layout/MobileShell";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { PRODUCTS } from "@/config/products";
import { formatPrice } from "@/utils/format";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

const COLORS = [
    { name: "All", hex: "#ffffff", gradient: "linear-gradient(to bottom right, #ffffff, #f3f4f6)" },
    { name: "Blue", hex: "#3b82f6", gradient: "linear-gradient(to bottom right, #1e3a8a, #3b82f6)" },
    { name: "Red", hex: "#ef4444", gradient: "linear-gradient(to bottom right, #7f1d1d, #ef4444)" },
    { name: "Black", hex: "#000000", gradient: "linear-gradient(to bottom right, #000000, #1f2937)" },
    { name: "Pink", hex: "#ec4899", gradient: "linear-gradient(to bottom right, #831843, #ec4899)" },
    { name: "Orange", hex: "#f97316", gradient: "linear-gradient(to bottom right, #7c2d12, #f97316)" },
    { name: "Grey", hex: "#6b7280", gradient: "linear-gradient(to bottom right, #374151, #9ca3af)" },
];

const ChromaticClosetPage = () => {
    const [activeColor, setActiveColor] = useState(COLORS[0]);

    const filteredItems = useMemo(() => {
        if (activeColor.name === "All") return PRODUCTS;
        return PRODUCTS.filter(p => p.color === activeColor.name);
    }, [activeColor]);

    return (
        <MobileShell>
            <MobileHeader />

            <main className="flex-1 overflow-y-auto bg-background dark:bg-[#0a0a0a]">
                {/* Header */}
                <header className="sticky top-0 z-50 bg-[#0a0a0a]/90 backdrop-blur-xl px-4 py-4 border-b border-white/5">
                    <div className="flex items-center gap-3">
                        <Link to="/home" className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-all active:scale-95">
                            <ArrowLeft className="w-5 h-5 text-white" />
                        </Link>
                        <div>
                            <h1 className="text-xl font-bold text-white">Chromatic <span className="text-primary">Closet</span></h1>
                            <p className="text-xs text-white/60">Shop by mood & color</p>
                        </div>
                    </div>
                </header>

                {/* Color Palette */}
                <div className="px-4 py-4">
                    <div className={cn(
                        "flex gap-2 p-2 rounded-full overflow-x-auto",
                        "bg-muted/30 dark:bg-white/5",
                        "border border-border/20 dark:border-white/10"
                    )}>
                        {COLORS.map((color) => (
                            <button
                                key={color.name}
                                onClick={() => setActiveColor(color)}
                                className={cn(
                                    "w-8 h-8 rounded-full flex-shrink-0 border-2 transition-all duration-300",
                                    activeColor.name === color.name
                                        ? "scale-110 border-primary shadow-lg ring-2 ring-primary/30"
                                        : "border-transparent hover:scale-105"
                                )}
                                style={{ backgroundColor: color.hex }}
                                title={color.name}
                                aria-label={`Filter by ${color.name}`}
                            />
                        ))}
                    </div>
                    <p className="text-center text-xs text-muted-foreground dark:text-white/50 mt-2">
                        {activeColor.name === "All" ? "All Colors" : activeColor.name} • {filteredItems.length} items
                    </p>
                </div>

                {/* Product Grid */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeColor.name}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.05 }}
                        transition={{ duration: 0.3 }}
                        className="px-4 pb-6"
                    >
                        {filteredItems.length > 0 ? (
                            <div className="grid grid-cols-2 gap-3">
                                {filteredItems.map((item, idx) => (
                                    <Link to={`/product/${item.id}`} key={item.id}>
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: idx * 0.05 }}
                                            className={cn(
                                                "rounded-2xl overflow-hidden",
                                                "bg-card dark:bg-[#1a1a1a]",
                                                "border-2 transition-all",
                                                activeColor.name === "All"
                                                    ? "border-border/20 dark:border-white/10"
                                                    : "border-opacity-30"
                                            )}
                                            style={{
                                                borderColor: activeColor.name === "All" ? undefined : activeColor.hex + "50"
                                            }}
                                        >
                                            <div className="aspect-[3/4] overflow-hidden">
                                                <img
                                                    src={item.image}
                                                    alt={item.name}
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                            <div className="p-3">
                                                <h3 className="font-semibold text-sm text-foreground dark:text-white truncate">{item.name}</h3>
                                                <p className="text-xs text-muted-foreground dark:text-white/50">{item.category}</p>
                                                <p className="text-sm font-bold text-primary mt-1">{formatPrice(item.price)}/day</p>
                                            </div>
                                        </motion.div>
                                    </Link>
                                ))}
                            </div>
                        ) : (
                            <div className={cn(
                                "flex flex-col items-center justify-center py-16 px-4 text-center rounded-2xl",
                                "bg-muted/30 dark:bg-white/5",
                                "border border-dashed border-border/50 dark:border-white/10"
                            )}>
                                <p className="text-muted-foreground dark:text-white/60">No items found in {activeColor.name}</p>
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </main>
        </MobileShell>
    );
};

export default ChromaticClosetPage;

