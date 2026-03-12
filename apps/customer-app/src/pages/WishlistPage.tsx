// src/pages/WishlistPage.tsx
import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Heart, ChevronLeft, Trash2, ShoppingBag, Loader2 } from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { BottomNavBar } from "@/components/layout/BottomNavBar";
import { useWishlist } from "@/context/WishlistContext";
import { supabase } from "@popclozet/api-client";
import { thumbImage } from "@/lib/optimizeImage";

interface Product {
    id: string;
    name: string;
    brand: string;
    rental_price: number;
    images: string[];
    category: string;
}

const WishlistPage: React.FC = () => {
    const navigate = useNavigate();
    const { wishlistItems, removeFromWishlist } = useWishlist();
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (wishlistItems.length === 0) {
            setProducts([]);
            setLoading(false);
            return;
        }

        const fetchProducts = async () => {
            setLoading(true);
            try {
                const { data, error } = await supabase
                    .from("products")
                    .select("id, name, brand, rental_price, images, category")
                    .in("id", wishlistItems);
                if (error) throw error;
                // Preserve wishlist order
                const ordered = wishlistItems
                    .map(id => (data || []).find((p: Product) => p.id === id))
                    .filter(Boolean) as Product[];
                setProducts(ordered);
            } catch (err) {
                console.error("Failed to fetch wishlist products:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchProducts();
    }, [wishlistItems]);

    return (
        <MobileShell className="bg-black text-white">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-gradient-to-b from-black/90 to-black/70 backdrop-blur-2xl border-b border-white/5 px-4 py-3">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate("/profile")}
                        className="p-2 -ml-2 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all"
                    >
                        <ChevronLeft className="w-5 h-5 text-zinc-400" />
                    </button>
                    <h1 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400">
                        My Wishlist
                    </h1>
                    {wishlistItems.length > 0 && (
                        <span className="ml-auto px-2.5 py-1 rounded-full bg-[#ff4d6d]/20 text-[#ff4d6d] text-xs font-bold">
                            {wishlistItems.length}
                        </span>
                    )}
                </div>
            </div>

            <main className="flex-1 overflow-y-auto px-4 py-4 pb-24">
                {/* Loading */}
                {loading && (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-6 h-6 text-[#ff4d6d] animate-spin" />
                    </div>
                )}

                {/* Empty */}
                {!loading && wishlistItems.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-64 text-center">
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-white/8 to-white/3 border border-white/5 flex items-center justify-center mb-4">
                            <Heart className="w-10 h-10 text-zinc-600" />
                        </div>
                        <p className="text-white font-semibold text-lg mb-1">Nothing saved yet</p>
                        <p className="text-zinc-600 text-sm max-w-[200px]">Tap the heart on any item to save it here</p>
                        <button
                            onClick={() => navigate("/collections")}
                            className="mt-6 px-6 py-3 rounded-2xl bg-gradient-to-r from-[#ff4d6d] to-pink-600 text-white font-bold text-sm"
                        >
                            Browse Collections
                        </button>
                    </div>
                )}

                {/* Products Grid */}
                {!loading && products.length > 0 && (
                    <div className="grid grid-cols-2 gap-3">
                        <AnimatePresence>
                            {products.map((product, index) => (
                                <motion.div
                                    key={product.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    transition={{ delay: index * 0.05 }}
                                    className="relative rounded-2xl overflow-hidden bg-[#1C1C1E] border border-white/5 cursor-pointer group"
                                >
                                    {/* Image */}
                                    <div
                                        className="aspect-[3/4] bg-[#2A2A2E] relative overflow-hidden"
                                        onClick={() => navigate(`/product/${product.id}`)}
                                    >
                                        {product.images?.[0] ? (
                                            <img
                                                src={thumbImage(product.images[0])}
                                                alt={product.name}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                loading="lazy"
                                            />
                                        ) : (
                                            <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center">
                                                <Heart className="w-8 h-8 text-zinc-700 opacity-50" />
                                            </div>
                                        )}
                                        {/* Remove from wishlist */}
                                        <button
                                            onClick={e => { e.stopPropagation(); removeFromWishlist(product.id); }}
                                            className="absolute top-3 right-3 p-2 rounded-full bg-black/40 backdrop-blur-sm hover:bg-red-500/40 transition-colors z-10"
                                        >
                                            <Trash2 className="w-4 h-4 text-white" />
                                        </button>
                                    </div>

                                    {/* Info */}
                                    <div
                                        className="p-3"
                                        onClick={() => navigate(`/product/${product.id}`)}
                                    >
                                        <h3 className="text-sm font-semibold text-white mb-0.5 truncate">{product.name}</h3>
                                        <p className="text-xs text-zinc-500 mb-2">{product.brand}</p>
                                        <div className="flex items-center justify-between">
                                            <span className="text-base font-bold text-white">₹{product.rental_price}</span>
                                            <button
                                                onClick={e => { e.stopPropagation(); navigate(`/product/${product.id}`); }}
                                                className="p-1.5 rounded-lg bg-[#ff4d6d]/20 hover:bg-[#ff4d6d]/30 transition-colors"
                                            >
                                                <ShoppingBag className="w-3.5 h-3.5 text-[#ff4d6d]" />
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </main>

            <BottomNavBar />
        </MobileShell>
    );
};

export default WishlistPage;
