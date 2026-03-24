import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { MobileShell } from "@/components/layout/MobileShell";
import { ChevronLeft, Search, ChevronRight, Loader } from "lucide-react";
import { cn } from "@/lib/utils";
import { productService } from "@/services/productService";

const BrandsPage: React.FC = () => {
    const navigate = useNavigate();
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
                                return (
                                    <motion.div
                                        key={brand}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                        whileTap={{ scale: 0.97 }}
                                        onClick={() => navigate(`/category?brand=${encodeURIComponent(brand)}`)}
                                        className="relative rounded-3xl overflow-hidden cursor-pointer bg-[#1E1E1E] border border-white/5 hover:border-[#E95466]/50 transition-all group flex flex-col items-center p-6 text-center shadow-lg"
                                    >
                                        <div className="w-16 h-16 rounded-full bg-black/50 border border-white/5 flex items-center justify-center mb-4 group-hover:bg-[#E95466]/10 transition-colors">
                                            <span className="text-2xl font-black text-white group-hover:text-[#E95466] transition-colors uppercase">
                                                {brand.charAt(0)}
                                            </span>
                                        </div>
                                        <h3 className="text-sm font-bold text-white mb-1 group-hover:text-[#E95466] w-full truncate transition-colors">
                                            {brand}
                                        </h3>
                                        <p className="text-[10px] text-zinc-500 font-medium tracking-wider uppercase">Collection</p>
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
        </MobileShell>
    );
};

export default BrandsPage;
