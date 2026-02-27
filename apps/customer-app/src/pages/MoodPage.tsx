import React, { useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, ChevronLeft, SlidersHorizontal } from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { BottomNavBar } from "@/components/layout/BottomNavBar";
import { cn } from "@/lib/utils";
import SignupModal from "@/components/SignupModal";
import { useCart } from "@/context/CartContext";
import { useWishlist } from "@/context/WishlistContext";
import { FilterModal } from "@/components/collections/FilterModal";
import { PRODUCTS } from "@/config/products";

const MoodPage: React.FC = () => {
    const { moodId } = useParams();
    const navigate = useNavigate();
    const { addToCart } = useCart();
    const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist();
    const [isSignupOpen, setIsSignupOpen] = useState(false);

    // Get mood name from URL param
    const moodName = moodId ? moodId.charAt(0).toUpperCase() + moodId.slice(1) : "Collection";

    // Use real products from config
    const filteredProducts = PRODUCTS;

    const toggleWishlist = (id: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (isInWishlist(id)) {
            removeFromWishlist(id);
        } else {
            addToWishlist(id);
        }
    };

    const handleRent = (id: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        addToCart(id);
    };

    return (
        <MobileShell className="bg-black text-white">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-4 sticky top-0 z-50 bg-black/90 backdrop-blur-md">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-1 rounded-full hover:bg-white/10 transition-colors"
                    >
                        <ChevronLeft className="w-6 h-6 text-white" />
                    </button>
                    <h1 className="text-xl font-bold text-white">{moodName}</h1>
                </div>
            </div>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto pb-24">
                {/* Moodboard Title + Filter */}
                <div className="flex items-center justify-between px-4 py-4">
                    <h2 className="text-2xl font-bold text-white">Moodboard</h2>
                    <FilterModal>
                        <button className="p-3 rounded-full bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 transition-colors">
                            <SlidersHorizontal className="w-5 h-5 text-white" />
                        </button>
                    </FilterModal>
                </div>

                {/* Product Grid */}
                <div className="px-4">
                    <div className="grid grid-cols-2 gap-3">
                        {filteredProducts.map((product) => (
                            <Link to={`/product/${product.id}`} key={product.id}>
                                <motion.div
                                    className="rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800"
                                    whileTap={{ scale: 0.98 }}
                                >
                                    {/* Image */}
                                    <div className="aspect-[3/4] relative bg-zinc-800">
                                        <img
                                            src={product.image}
                                            alt={product.name}
                                            className="w-full h-full object-cover"
                                        />
                                        {/* Wishlist Button */}
                                        <button
                                            className="absolute top-3 right-3 p-2"
                                            onClick={(e) => toggleWishlist(product.id, e)}
                                        >
                                            <Heart
                                                className={cn(
                                                    "w-5 h-5",
                                                    isInWishlist(product.id)
                                                        ? "fill-[#ff4d6d] text-[#ff4d6d]"
                                                        : "text-white/70"
                                                )}
                                            />
                                        </button>
                                    </div>

                                    {/* Product Info */}
                                    <div className="p-3">
                                        <h3 className="font-semibold text-white text-sm truncate">{product.name}</h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-xs text-zinc-500 line-through">
                                                ₹ {product.price}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between mt-2">
                                            <span className="font-bold text-white">₹ {Math.round(product.price * 0.15)}</span>
                                            <button
                                                onClick={(e) => handleRent(product.id, e)}
                                                className="px-4 py-1.5 rounded-full bg-[#ff4d6d] text-white text-xs font-semibold hover:bg-[#ff3d5d] transition-colors"
                                            >
                                                Rent
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            </Link>
                        ))}
                    </div>
                </div>
            </main>

            <BottomNavBar />
            <SignupModal isOpen={isSignupOpen} onClose={() => setIsSignupOpen(false)} />
        </MobileShell>
    );
};

export default MoodPage;
