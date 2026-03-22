import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { MobileShell } from "@/components/layout/MobileShell";
import { BottomNavBar } from "@/components/layout/BottomNavBar";
import { ChevronLeft, Search, ChevronRight, Loader } from "lucide-react";
import { cn } from "@/lib/utils";
import { productService } from "@/services/productService";

// Category filter
const CATEGORIES = ["All", "Luxury", "Streetwear", "Casual", "Sports"];

const BrandsPage: React.FC = () => {
    const navigate = useNavigate();
    const [activeCategory, setActiveCategory] = useState("All");
    const [searchQuery, setSearchQuery] = useState("");
    const [brands, setBrands] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchBrands = async () => {
            try {
                const uniqueBrands = await productService.getUniqueBrands();
                setBrands(uniqueBrands);
            } catch (err) {
                console.error("Failed to fetch brands:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchBrands();
    }, []);

    const filteredBrands = brands.filter((brand) => {
        const matchesSearch = !searchQuery || brand.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesSearch;
    });

    // Helper to get brand color (random but consistent for sessions)
    const getBrandColor = (name: string) => {
        const colors = ["#F2546D", "#3B82F6", "#A855F7", "#EF4444", "#22C55E", "#F59E0B", "#8B5CF6"];
        const idx = name.length % colors.length;
        return colors[idx];
    };

    return (
        <MobileShell className="bg-[#111111] text-white">
            <main className="flex-1 overflow-y-auto pb-24">

                {/* ─── Top Bar ─── */}
                <div className="sticky top-0 z-30 bg-[#111111]/95 backdrop-blur-md px-4 pt-4 pb-3">
                    <div className="flex items-center gap-3 mb-4">
                        <button
                            onClick={() => navigate(-1)}
                            className="w-10 h-10 flex items-center justify-center rounded-full bg-[#232323] hover:bg-[#303030] transition-all active:scale-95 flex-shrink-0"
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
                    {loading ? (
                        <div className="flex flex-col items-center py-20">
                            <Loader className="w-8 h-8 text-[#f2546d] animate-spin mb-4" />
                            <p className="text-zinc-500 text-sm">Loading brands...</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-4">
                            {filteredBrands.map((brand, index) => {
                                const color = getBrandColor(brand);
                                return (
                                    <motion.div
                                        key={brand}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                        whileTap={{ scale: 0.97 }}
                                        onClick={() => navigate(`/category?brand=${encodeURIComponent(brand)}`)}
                                        className="relative rounded-2xl overflow-hidden cursor-pointer group"
                                        style={{ background: `linear-gradient(135deg, ${color}15, ${color}08)` }}
                                    >
                                        <div className="p-5 pb-4 border border-white/5 rounded-2xl hover:border-white/10 transition-colors h-full flex flex-col">
                                            <div
                                                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-lg"
                                                style={{ backgroundColor: `${color}25`, boxShadow: `0 4px 20px ${color}15` }}
                                            >
                                                <span className="text-xl font-black" style={{ color }}>
                                                    {brand.charAt(0)}
                                                </span>
                                            </div>

                                            <h3 className="text-base font-bold text-white mb-0.5 group-hover:text-[#f2546d] transition-colors">
                                                {brand}
                                            </h3>

                                            <p className="text-[11px] text-zinc-500 mb-3">Shop {brand}</p>

                                            <div className="flex items-center justify-end mt-auto">
                                                <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-[#f2546d]/20 transition-colors">
                                                    <ChevronRight className="w-3 h-3 text-zinc-400 group-hover:text-[#f2546d] transition-colors" />
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    )}

                    {/* Empty state */}
                    {!loading && filteredBrands.length === 0 && (
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
