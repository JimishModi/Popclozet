import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MobileShell } from "@/components/layout/MobileShell";
import { BottomNavBar } from "@/components/layout/BottomNavBar";
import { ChevronLeft, SlidersHorizontal, Heart } from "lucide-react";
import { cn } from "@/lib/utils";

// Mock product data
const MOCK_PRODUCTS = [
    { id: "1", title: "Haldi Outfit", brand: "Fabindia", price: 699, image: "" },
    { id: "2", title: "Haldi Outfit", brand: "Fabindia", price: 699, image: "" },
    { id: "3", title: "Haldi Outfit", brand: "Fabindia", price: 699, image: "" },
    { id: "4", title: "Haldi Outfit", brand: "Fabindia", price: 699, image: "" },
    { id: "5", title: "Haldi Outfit", brand: "Fabindia", price: 699, image: "" },
    { id: "6", title: "Haldi Outfit", brand: "Fabindia", price: 699, image: "" },
];

const SIZES = ["XS", "S", "M", "L", "XL", "XXL"];
const BRANDS = ["Zara", "H&M", "Mango", "Forever 21", "Uniqlo", "Gap"];

type FilterTab = "size" | "price" | "brand";

const CategoryProductsPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const categoryTitle = searchParams.get("title") || "Products";

    const [wishlist, setWishlist] = useState<Set<string>>(new Set());
    const [showFilters, setShowFilters] = useState(false);
    const [activeFilterTab, setActiveFilterTab] = useState<FilterTab>("size");

    // Filter states
    const [selectedSizes, setSelectedSizes] = useState<Set<string>>(new Set());
    const [priceRange, setPriceRange] = useState({ min: 100, max: 1200 });
    const [selectedBrands, setSelectedBrands] = useState<Set<string>>(new Set());

    const toggleWishlist = (productId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setWishlist(prev => {
            const newSet = new Set(prev);
            if (newSet.has(productId)) {
                newSet.delete(productId);
            } else {
                newSet.add(productId);
            }
            return newSet;
        });
    };

    const toggleSize = (size: string) => {
        setSelectedSizes(prev => {
            const newSet = new Set(prev);
            if (newSet.has(size)) {
                newSet.delete(size);
            } else {
                newSet.add(size);
            }
            return newSet;
        });
    };

    const toggleBrand = (brand: string) => {
        setSelectedBrands(prev => {
            const newSet = new Set(prev);
            if (newSet.has(brand)) {
                newSet.delete(brand);
            } else {
                newSet.add(brand);
            }
            return newSet;
        });
    };

    const handleProductClick = (productId: string) => {
        navigate(`/product/${productId}`);
    };

    const handleApplyFilters = () => {
        setShowFilters(false);
        // Filter logic would go here
    };

    return (
        <MobileShell className="bg-[#050505] text-white">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-[#050505]/90 backdrop-blur-xl border-b border-white/5">
                <div className="flex items-center justify-between px-4 py-4">
                    <div className="flex items-center gap-3">
                        <button onClick={() => navigate(-1)} className="p-1 -ml-1">
                            <ChevronLeft className="w-6 h-6 text-white" />
                        </button>
                        <h1 className="text-xl font-bold tracking-tight text-white capitalize">
                            {categoryTitle}
                        </h1>
                    </div>

                    <button
                        onClick={() => setShowFilters(true)}
                        className="p-2.5 rounded-full bg-[#1C1C1E] border border-white/10"
                    >
                        <SlidersHorizontal className="w-5 h-5 text-zinc-400" />
                    </button>
                </div>
            </div>

            {/* Product Grid */}
            <div className="flex-1 overflow-y-auto px-4 py-4 pb-28">
                <div className="grid grid-cols-2 gap-3">
                    {MOCK_PRODUCTS.map((product, index) => (
                        <motion.div
                            key={product.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            onClick={() => handleProductClick(product.id)}
                            className="relative rounded-2xl overflow-hidden bg-[#1C1C1E] border border-white/5 cursor-pointer group"
                        >
                            <div className="aspect-[3/4] bg-[#2A2A2E] relative">
                                <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-900" />
                                <button
                                    onClick={(e) => toggleWishlist(product.id, e)}
                                    className="absolute top-3 right-3 p-2 rounded-full bg-black/30 backdrop-blur-sm hover:bg-black/50 transition-colors z-10"
                                >
                                    <Heart
                                        className={`w-4 h-4 transition-colors ${wishlist.has(product.id)
                                            ? "text-[#FF4D6D] fill-[#FF4D6D]"
                                            : "text-white"
                                            }`}
                                    />
                                </button>
                            </div>
                            <div className="p-3">
                                <h3 className="text-sm font-semibold text-white mb-0.5 truncate">{product.title}</h3>
                                <p className="text-xs text-zinc-500 mb-2">{product.brand}</p>
                                <span className="text-base font-bold text-white">₹{product.price}</span>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Filter Modal */}
            <AnimatePresence>
                {showFilters && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowFilters(false)}
                            className="fixed inset-0 bg-black/60 z-50"
                        />

                        {/* Filter Sheet – slides from top, matches Figma */}
                        <motion.div
                            initial={{ y: "-100%" }}
                            animate={{ y: 0 }}
                            exit={{ y: "-100%" }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            className="fixed top-0 left-0 right-0 z-50 max-w-[430px] mx-auto pt-[56px]"
                        >
                            <div className="bg-[#2A2A2E] rounded-b-3xl px-5 py-5 shadow-2xl">
                                {/* Tab pills – 3 equal width */}
                                <div className="flex items-center gap-3 mb-5">
                                    {(["size", "price", "brand"] as FilterTab[]).map((tab) => (
                                        <button
                                            key={tab}
                                            onClick={() => setActiveFilterTab(tab)}
                                            className={cn(
                                                "flex-1 py-2.5 rounded-lg text-sm font-semibold capitalize transition-all",
                                                activeFilterTab === tab
                                                    ? "bg-[#3E3E42] text-white"
                                                    : "text-zinc-500"
                                            )}
                                        >
                                            {tab}
                                        </button>
                                    ))}
                                </div>

                                {/* === Size Tab === */}
                                {activeFilterTab === "size" && (
                                    <div className="grid grid-cols-4 gap-2.5">
                                        {SIZES.map((size) => {
                                            const isSelected = selectedSizes.has(size);
                                            return (
                                                <button
                                                    key={size}
                                                    onClick={() => toggleSize(size)}
                                                    className={cn(
                                                        "flex items-center gap-2 px-3 py-2.5 rounded-lg transition-all",
                                                        isSelected
                                                            ? "bg-white"
                                                            : "bg-transparent"
                                                    )}
                                                >
                                                    {/* Checkbox */}
                                                    <div className={cn(
                                                        "w-5 h-5 rounded flex-shrink-0 flex items-center justify-center border-2 transition-all",
                                                        isSelected
                                                            ? "bg-black border-black"
                                                            : "border-zinc-600 bg-transparent"
                                                    )}>
                                                        {isSelected && (
                                                            <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
                                                                <polyline points="20 6 9 17 4 12" />
                                                            </svg>
                                                        )}
                                                    </div>
                                                    <span className={cn(
                                                        "text-sm font-semibold",
                                                        isSelected ? "text-black" : "text-white"
                                                    )}>
                                                        {size}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* === Price Tab === */}
                                {activeFilterTab === "price" && (
                                    <div className="space-y-5">
                                        {/* Min / Max inputs */}
                                        <div className="flex gap-3">
                                            <input
                                                type="text"
                                                value={`Min : ₹ ${priceRange.min}`}
                                                readOnly
                                                className="flex-1 px-4 py-2.5 rounded-xl bg-transparent border border-zinc-600 text-white text-sm font-medium text-center"
                                            />
                                            <input
                                                type="text"
                                                value={`Max : ₹ ${priceRange.max}`}
                                                readOnly
                                                className="flex-1 px-4 py-2.5 rounded-xl bg-transparent border border-zinc-600 text-white text-sm font-medium text-center"
                                            />
                                        </div>

                                        {/* Range slider track */}
                                        <div className="relative pt-3 pb-1 px-1">
                                            {/* Track background with dots */}
                                            <div className="relative h-[2px] bg-zinc-600 rounded-full">
                                                {/* Active track */}
                                                <div
                                                    className="absolute h-full bg-[#FF4D6D] rounded-full"
                                                    style={{
                                                        left: `${(priceRange.min / 2000) * 100}%`,
                                                        width: `${((priceRange.max - priceRange.min) / 2000) * 100}%`
                                                    }}
                                                />
                                                {/* Dot markers along track */}
                                                {[0, 25, 50, 75, 100].map((pct) => (
                                                    <div
                                                        key={pct}
                                                        className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-zinc-500"
                                                        style={{ left: `calc(${pct}% - 3px)` }}
                                                    />
                                                ))}
                                                {/* Min handle */}
                                                <div
                                                    className="absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-zinc-400 rounded-full border-[3px] border-[#FF4D6D] shadow-md"
                                                    style={{ left: `calc(${(priceRange.min / 2000) * 100}% - 10px)` }}
                                                />
                                                {/* Max handle */}
                                                <div
                                                    className="absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-zinc-400 rounded-full border-[3px] border-[#FF4D6D] shadow-md"
                                                    style={{ left: `calc(${(priceRange.max / 2000) * 100}% - 10px)` }}
                                                />
                                            </div>
                                            {/* Invisible range inputs */}
                                            <input
                                                type="range"
                                                min="0"
                                                max="2000"
                                                value={priceRange.min}
                                                onChange={(e) => setPriceRange(prev => ({
                                                    ...prev,
                                                    min: Math.min(Number(e.target.value), prev.max - 100)
                                                }))}
                                                className="absolute top-0 left-0 w-full h-8 opacity-0 cursor-pointer"
                                            />
                                            <input
                                                type="range"
                                                min="0"
                                                max="2000"
                                                value={priceRange.max}
                                                onChange={(e) => setPriceRange(prev => ({
                                                    ...prev,
                                                    max: Math.max(Number(e.target.value), prev.min + 100)
                                                }))}
                                                className="absolute top-0 left-0 w-full h-8 opacity-0 cursor-pointer"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* === Brand Tab === */}
                                {activeFilterTab === "brand" && (
                                    <div>
                                        <div className="grid grid-cols-3 gap-2.5">
                                            {BRANDS.map((brand) => (
                                                <button
                                                    key={brand}
                                                    onClick={() => toggleBrand(brand)}
                                                    className={cn(
                                                        "aspect-[3/2] rounded-xl border transition-all",
                                                        selectedBrands.has(brand)
                                                            ? "bg-[#3E3E42] border-[#FF4D6D]/50"
                                                            : "bg-[#1C1C1E] border-zinc-700/30"
                                                    )}
                                                />
                                            ))}
                                        </div>
                                        <button className="mt-3 text-[#FF4D6D] text-sm font-semibold w-full text-right pr-1">
                                            See all
                                        </button>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            <BottomNavBar />
        </MobileShell>
    );
};

export default CategoryProductsPage;
