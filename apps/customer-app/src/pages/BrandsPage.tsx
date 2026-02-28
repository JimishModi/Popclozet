import React, { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { MobileShell } from "@/components/layout/MobileShell";
import { BottomNavBar } from "@/components/layout/BottomNavBar";
import { ChevronLeft, Search, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Brand data with images and product counts ──
const BRANDS = [
    { id: "nike", name: "Nike", tagline: "Just Do It", color: "#F2546D", products: 5 },
    { id: "adidas", name: "Adidas", tagline: "Impossible is Nothing", color: "#3B82F6", products: 5 },
    { id: "zara", name: "Zara", tagline: "Love your curves", color: "#A855F7", products: 5 },
    { id: "hm", name: "H&M", tagline: "Fashion & Quality", color: "#EF4444", products: 5 },
    { id: "gucci", name: "Gucci", tagline: "Made in Italy", color: "#22C55E", products: 5 },
    { id: "prada", name: "Prada", tagline: "Milano dal 1913", color: "#F59E0B", products: 5 },
    { id: "levis", name: "Levi's", tagline: "Quality Never Goes Out", color: "#EF4444", products: 5 },
    { id: "uniqlo", name: "Uniqlo", tagline: "LifeWear", color: "#DC2626", products: 5 },
    { id: "versace", name: "Versace", tagline: "Medusa Head", color: "#F59E0B", products: 5 },
    { id: "dior", name: "Dior", tagline: "J'adore Dior", color: "#8B5CF6", products: 5 },
];

// ── Category filter ──
const CATEGORIES = ["All", "Luxury", "Streetwear", "Casual", "Sports"];
const BRAND_CATEGORIES: Record<string, string> = {
    nike: "Sports", adidas: "Sports",
    zara: "Casual", hm: "Casual", uniqlo: "Casual",
    gucci: "Luxury", prada: "Luxury", versace: "Luxury", dior: "Luxury",
    levis: "Streetwear",
};

const BrandsPage: React.FC = () => {
    const navigate = useNavigate();
    const [activeCategory, setActiveCategory] = useState("All");
    const [searchQuery, setSearchQuery] = useState("");

    const filteredBrands = BRANDS.filter((brand) => {
        const matchesCategory = activeCategory === "All" || BRAND_CATEGORIES[brand.id] === activeCategory;
        const matchesSearch = !searchQuery || brand.name.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    return (
        <MobileShell className="bg-[#111111] text-white">
            <main className="flex-1 overflow-y-auto pb-24">

                {/* ─── Top Bar ─── */}
                <div className="sticky top-0 z-30 bg-[#111111]/95 backdrop-blur-md px-4 pt-4 pb-3">
                    <div className="flex items-center gap-3 mb-4">
                        <button
                            onClick={() => navigate(-1)}
                            className="w-10 h-10 flex items-center justify-center rounded-full bg-[#232323] hover:bg-[#303030] transition-colors flex-shrink-0"
                        >
                            <ChevronLeft className="w-5 h-5 text-white" />
                        </button>
                        <h1 className="text-xl font-bold text-white tracking-tight">All Brands</h1>
                    </div>

                    {/* Search brands */}
                    <div className="relative mb-3">
                        <Search className="w-4 h-4 text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search brands..."
                            className="w-full h-10 bg-[#232323] text-white text-sm font-medium pl-11 pr-4 rounded-full outline-none placeholder:text-zinc-500"
                        />
                    </div>

                    {/* Category filter pills */}
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                        {CATEGORIES.map((cat) => (
                            <button
                                key={cat}
                                onClick={() => setActiveCategory(cat)}
                                className={cn(
                                    "px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all",
                                    activeCategory === cat
                                        ? "bg-[#f2546d] text-white shadow-lg shadow-[#f2546d]/20"
                                        : "bg-[#232323] text-zinc-400 hover:text-white"
                                )}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ─── Brands Grid ─── */}
                <div className="px-4 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                        {filteredBrands.map((brand, index) => (
                            <motion.div
                                key={brand.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                                whileTap={{ scale: 0.97 }}
                                onClick={() => navigate(`/search?q=${encodeURIComponent(brand.name)}`)}
                                className="relative rounded-2xl overflow-hidden cursor-pointer group"
                                style={{ background: `linear-gradient(135deg, ${brand.color}15, ${brand.color}08)` }}
                            >
                                {/* Brand card content */}
                                <div className="p-5 pb-4 border border-white/5 rounded-2xl hover:border-white/10 transition-colors h-full flex flex-col">
                                    {/* Brand initial circle */}
                                    <div
                                        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-lg"
                                        style={{ backgroundColor: `${brand.color}25`, boxShadow: `0 4px 20px ${brand.color}15` }}
                                    >
                                        <span className="text-xl font-black" style={{ color: brand.color }}>
                                            {brand.name.charAt(0)}
                                        </span>
                                    </div>

                                    {/* Brand name */}
                                    <h3 className="text-base font-bold text-white mb-0.5 group-hover:text-[#f2546d] transition-colors">
                                        {brand.name}
                                    </h3>

                                    {/* Tagline */}
                                    <p className="text-[11px] text-zinc-500 mb-3">{brand.tagline}</p>

                                    {/* Products count + arrow */}
                                    <div className="flex items-center justify-between mt-auto">
                                        <span className="text-xs font-semibold text-zinc-400">
                                            {brand.products} Products
                                        </span>
                                        <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-[#f2546d]/20 transition-colors">
                                            <ChevronRight className="w-3 h-3 text-zinc-400 group-hover:text-[#f2546d] transition-colors" />
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    {/* Empty state */}
                    {filteredBrands.length === 0 && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex flex-col items-center py-16"
                        >
                            <div className="w-16 h-16 rounded-full bg-[#232323] flex items-center justify-center mb-3">
                                <Search className="w-6 h-6 text-zinc-600" />
                            </div>
                            <p className="text-sm text-zinc-500">No brands found</p>
                        </motion.div>
                    )}
                </div>

                <div className="h-8" />
            </main>

            <BottomNavBar />
        </MobileShell>
    );
};

export default BrandsPage;
