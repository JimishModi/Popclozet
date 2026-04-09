import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronLeft, Heart, ShoppingBag, Loader, Star, StarHalf, Trash2 } from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { cn } from "@/lib/utils";
import { useCart } from "@/context/CartContext";
import { useWishlist } from "@/context/WishlistContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@popclozet/api-client";
import { Drawer } from "vaul";
import type { Product } from "@/services/productService";
import { fullImage } from "@/lib/optimizeImage";
import shareButtonIcon from "@/assets/icons/share-button.svg";
import { RecommendedProducts } from "@/components/product/RecommendedProducts";
import { toast } from "sonner";
import type { PricingPlan } from "@/context/CartContext";
import { computeInventoryAvailability } from "@/lib/inventoryAvailability";
// import { ALL_MOCK_PRODUCTS } from "@/mocks/allProducts";

const dmSans = { fontFamily: "'DM Sans', sans-serif" };

/* Inline chevron-up icon */
const ChevronUpIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 19 12" fill="none">
        <path
            d="M17.815 12.043a1.19 1.19 0 0 1-.841-.447l-6.08-7.803a2.5 2.5 0 0 0-.643-.55 2.5 2.5 0 0 0-.758-.195c-.261 0-.518.066-.759.194-.24.127-.459.315-.643.551l-6.076 7.793a1.19 1.19 0 0 1-.836.428 1.19 1.19 0 0 1-.831-.447A1.52 1.52 0 0 1 0 10.5c-.003-.4.117-.785.334-1.073l6.072-7.792C7.224.587 8.332 0 9.488 0c1.156 0 2.265.588 3.083 1.636l6.081 7.803c.166.213.279.484.325.78.046.295.023.602-.067.88a1.32 1.32 0 0 1-.436.685 1.14 1.14 0 0 1-.659.259Z"
            fill="currentColor"
        />
    </svg>
);

/* Inline edit icon */
const EditIcon = () => (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
        <path
            d="M9.5 1.5l2 2-7 7H2.5v-2l7-7z"
            stroke="white"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
);

/* Inline ruler/size-guide icon */
const RulerIcon = () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect
            x="1"
            y="5"
            width="14"
            height="6"
            rx="1"
            stroke="#f2546d"
            strokeWidth="1.2"
            transform="rotate(-45 8 8)"
        />
        <line x1="4" y1="7" x2="4" y2="9" stroke="#f2546d" strokeWidth="1" />
        <line x1="6" y1="6" x2="6" y2="9" stroke="#f2546d" strokeWidth="1" />
        <line x1="8" y1="7" x2="8" y2="9" stroke="#f2546d" strokeWidth="1" />
        <line x1="10" y1="6" x2="10" y2="9" stroke="#f2546d" strokeWidth="1" />
        <line x1="12" y1="7" x2="12" y2="9" stroke="#f2546d" strokeWidth="1" />
    </svg>
);

// Inventory row returned from Supabase
interface InventoryRow {
    size: string;
    available_stock: number;
    went_for_wash: number;
    total_stock: number;
    all_products?: { status?: string | null }[];
}

const MobileProductDetailPage: React.FC = () => {
    const { id: productId } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();

    // Fake "rented out" product — passed via router state, never fetched from DB
    const isRented: boolean = location.state?.isRented === true;
    const fakeProductData = location.state?.fakeProduct ?? null;

    const { addToCart, cartItems, totalItems } = useCart();
    const { wishlistItems, addToWishlist, removeFromWishlist, isInWishlist } = useWishlist();
    const { user, profile, updateProfile } = useAuth();

    const handleShare = async () => {
        const url = window.location.href;
        const title = product?.name || 'Popclozet Fashion';
        
        if (navigator.share) {
            try {
                await navigator.share({
                    title: title,
                    text: `Check out this ${title} on Popclozet!`,
                    url: url,
                });
            } catch (err) {
                if ((err as Error).name !== 'AbortError') {
                    console.error('Error sharing:', err);
                }
            }
        } else {
            try {
                await navigator.clipboard.writeText(url);
                toast.success('Link copied to clipboard!');
            } catch (err) {
                console.error('Failed to copy link:', err);
                toast.error('Failed to copy link');
            }
        }
    };
    const [selectedSize, setSelectedSize] = useState("S");
    const [showProductDetails, setShowProductDetails] = useState(true);
    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const [selectedPlan, setSelectedPlan] = useState<PricingPlan>("1d");

    const [product, setProduct] = useState<Product | null>(null);
    const [loading, setLoading] = useState(true);
    const [inventory, setInventory] = useState<InventoryRow[]>([]);
    const [isProductRentedOut, setIsProductRentedOut] = useState(false);
    const [isProductSoldOut, setIsProductSoldOut] = useState(false);

    // New states for discounts and reviews
    const [discount, setDiscount] = useState<{ type: string, value: number } | null>(null);
    const [ratingStats, setRatingStats] = useState<{ average: number, total: number }>({ average: 0, total: 0 });
    const [recentReviews, setRecentReviews] = useState<any[]>([]);

    // Review Modal States
    const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
    const [reviewRating, setReviewRating] = useState(0);
    const [reviewText, setReviewText] = useState("");
    const [reviewerName, setReviewerName] = useState("");
    const [isSubmittingReview, setIsSubmittingReview] = useState(false);

    useEffect(() => {
        if (profile?.full_name && !reviewerName) {
            setReviewerName(profile.full_name);
        }
    }, [profile?.full_name]);

    // Size Guide State
    const [isSizeGuideOpen, setIsSizeGuideOpen] = useState(false);

    useEffect(() => {
        const fetchProduct = async () => {
            if (!productId) {
                setLoading(false);
                return;
            }

            // Fake/rented product — use router state data directly, skip DB fetch
            if (isRented && fakeProductData) {
                const imgSrc = fakeProductData.imageUrl || fakeProductData.images?.[0] || '';
                setProduct({
                    ...fakeProductData,
                    imageUrl: imgSrc,
                    images: imgSrc ? [imgSrc] : [],
                    isAvailable: false,
                } as any);
                setLoading(false);
                return;
            }

            try {
                // Fetch product, inventory, rating, and recent reviews in parallel
                const [productRes, inventoryRes, ratingRes, reviewsRes] = await Promise.all([
                    supabase
                        .from('products')
                        .select('*, product_discounts(*)')
                        .eq('id', productId)
                        .single(),
                    supabase
                        .from('inventory')
                        .select('size, available_stock, went_for_wash, total_stock, all_products(status)')
                        .eq('product_id', productId)
                        .order('size'),
                    supabase
                        .rpc('get_product_rating', { pid: productId }),
                    supabase
                        .from('product_reviews')
                        .select('id, rating, review_text, reviewer_name, created_at, user_id, profiles:customer_profiles(full_name)')
                        .eq('product_id', productId)
                        .not('review_text', 'is', null)
                        .order('created_at', { ascending: false })
                        .limit(10)
                ]);

                if (productRes.error) throw productRes.error;

                if (productRes.data) {
                    const dbProduct = productRes.data;
                    const originalPriceValue = parseFloat(dbProduct.rental_price ?? dbProduct.price ?? '0');
                    const disc = dbProduct.product_discounts?.[0];

                    let finalPrice = originalPriceValue;
                    if (disc) {
                        if (disc.discount_type === 'percentage') {
                            finalPrice = originalPriceValue - (originalPriceValue * (disc.discount_value / 100));
                        } else if (disc.discount_type === 'fixed_amount') {
                            finalPrice = Math.max(0, originalPriceValue - disc.discount_value);
                        }
                    }
                    finalPrice = Math.round(finalPrice);

                    setProduct({
                        ...dbProduct,
                        price: originalPriceValue,
                        rentalPrice: finalPrice,
                        discount_type: disc?.discount_type,
                        discount_value: disc?.discount_value,
                        discounted_price: finalPrice,
                        imageUrl: dbProduct.images?.[0] || '',
                        sizes: [],  // sizes now come from inventory
                        gender: dbProduct.gender === 'men' ? 'mens' : (dbProduct.gender === 'women' ? 'womens' : dbProduct.gender),
                        category: dbProduct.category || '',
                        eventCategory: (dbProduct.occasion?.[0] || dbProduct.category) as any,
                        mrp: dbProduct.mrp ? parseFloat(dbProduct.mrp) : undefined,
                        occasions: dbProduct.occasion || []
                    });
                }

                if (!inventoryRes.error && inventoryRes.data) {
                    const rows = inventoryRes.data as InventoryRow[];
                    setInventory(rows);
                    const availability = computeInventoryAvailability(rows);
                    const isSold = availability.isSoldOut;
                    const allRented = availability.isRentedOut;

                    // Fallback to empty object if productRes.data is not available (it should be)
                    const _dbProduct = productRes.data || {};
                    const isStrictlyUnavailable = _dbProduct.is_available === false;
                    const isNotYetReleased = _dbProduct.early_access_until ? new Date() < new Date(_dbProduct.early_access_until) : false;
                    
                    if (isStrictlyUnavailable || isNotYetReleased) {
                        setIsProductRentedOut(false);
                        setIsProductSoldOut(true);
                    } else {
                        setIsProductRentedOut(allRented);
                        setIsProductSoldOut(isSold);
                    }

                    const firstAvailable = rows.find(r => r.available_stock > 0);
                    if (firstAvailable && !isStrictlyUnavailable && !isNotYetReleased) setSelectedSize(firstAvailable.size);
                }

                if (!ratingRes.error && ratingRes.data && ratingRes.data.length > 0) {
                    setRatingStats({
                        average: Number(ratingRes.data[0].average_rating),
                        total: Number(ratingRes.data[0].total_reviews)
                    });
                }

                if (!reviewsRes.error && reviewsRes.data) {
                    setRecentReviews(reviewsRes.data);
                }

            } catch (err) {
                console.error('CRITICAL: Supabase detail fetch failed:', err);
                setProduct(null);
            } finally {
                setLoading(false);
            }
        };

        fetchProduct();
    }, [productId]);

    const cartKey = product && selectedSize ? `${product.id}_${selectedSize}_${selectedPlan}` : null;
    const isAdded = cartKey ? !!cartItems[cartKey] : false;

    // Calculate final prices based on discount
    // 1. If we have a promotional discount: Current Rental vs Original Rental
    // 2. Otherwise: Current Rental vs MRP (Market Value)
    const baseRental = product?.price || 699;
    const currentRental = product?.discounted_price || baseRental;
    const mrp = product?.mrp || (baseRental * 5);

    const getPlanPrice = (plan: PricingPlan) => {
        if (!product) return 0;
        switch (plan) {
            case '1d': return product.rental_price_1d;
            case '2d': return product.rental_price_2d;
            case '3d': return product.rental_price_3d || product.rentalPrice;
            case 'buy': return product.buy_price;
            default: return product.rentalPrice;
        }
    };

    const currentPlanPrice = getPlanPrice(selectedPlan) || 0;
    const savingsPercent = mrp > currentPlanPrice ? Math.round(((mrp - currentPlanPrice) / mrp) * 100) : 0;
    const showSavings = savingsPercent > 0;

    const toggleWishlist = () => {
        if (!product) return;
        if (isInWishlist(product.id)) {
            removeFromWishlist(product.id);
        } else {
            addToWishlist(product.id);
        }
    };

    const handleAddToCart = () => {
        if (product && selectedSize) {
            const sizeStock = inventory.find(r => r.size === selectedSize)?.available_stock || 0;
            if (sizeStock > 0) {
                addToCart(product.id, selectedSize, selectedPlan);
            } else {
                alert("Sorry, this size is currently out of stock.");
            }
        }
    };

    const submitReview = async () => {
        if (!user) {
            alert("You must be logged in to leave a review.");
            return;
        }
        if (reviewRating === 0) {
            alert("Please select a star rating.");
            return;
        }

        setIsSubmittingReview(true);
        try {
            // Update name if changed
            if (reviewerName && reviewerName.trim() !== profile?.full_name) {
                try {
                    await updateProfile({ full_name: reviewerName.trim() });
                } catch (e) {
                    console.error("Failed to update profile name:", e);
                }
            }

            const nameToSave = reviewerName.trim() || profile?.full_name || user?.user_metadata?.full_name || user?.user_metadata?.name || 'Anonymous';

            const { data, error } = await supabase
                .from('product_reviews')
                .insert([
                    { product_id: productId, user_id: user.id, rating: reviewRating, review_text: reviewText, reviewer_name: nameToSave }
                ])
                .select('id, rating, review_text, reviewer_name, created_at')
                .single();

            if (error) throw error;

            // Update local state instantly so the user sees their new review
            if (data) {
                const newReview = {
                    ...data,
                    user_id: user.id,
                    reviewer_name: nameToSave,
                    profiles: { full_name: nameToSave }
                };

                setRecentReviews(prev => {
                    const currentReviews = Array.isArray(prev) ? prev : [];
                    return [newReview, ...currentReviews].slice(0, 10);
                });
                // Recalculate average naively
                setRatingStats(prev => {
                    const currentTotal = prev?.total || 0;
                    const currentAvg = prev?.average || 0;
                    return {
                        average: ((currentAvg * currentTotal) + reviewRating) / (currentTotal + 1),
                        total: currentTotal + 1
                    };
                });
            }

            setIsReviewModalOpen(false);
            setReviewRating(0);
            setReviewText("");
        } catch (error: any) {
            console.error("REVIEW SUBMISSION ERROR:", error);
            const errorMsg = error.message || (typeof error === 'string' ? error : "Unknown error");
            alert(`Failed to submit review: ${errorMsg}. Trace: ${JSON.stringify(error)}`);
        } finally {
            setIsSubmittingReview(false);
        }
    };

    const handleDeleteReview = async (reviewId: string) => {
        if (!window.confirm("Are you sure you want to delete your review?")) return;

        try {
            const { error } = await supabase
                .from('product_reviews')
                .delete()
                .eq('id', reviewId);

            if (error) throw error;

            // Update local state instantly
            const reviewToDelete = recentReviews.find(r => r.id === reviewId);
            setRecentReviews(prev => prev.filter(r => r.id !== reviewId));

            // Update stats naively
            if (reviewToDelete) {
                setRatingStats(prev => {
                    const currentTotal = prev?.total || 0;
                    const currentAvg = prev?.average || 0;
                    if (currentTotal <= 1) return { average: 0, total: 0 };

                    const newTotal = currentTotal - 1;
                    const newAvg = ((currentAvg * currentTotal) - reviewToDelete.rating) / newTotal;
                    return {
                        average: Math.max(0, newAvg),
                        total: newTotal
                    };
                });
            }
        } catch (error: any) {
            console.error("DELETE REVIEW ERROR:", error);
            alert(`Failed to delete review: ${error.message || "Unknown error"}`);
        }
    };

    if (loading) {
        return (
        <div className="bg-[#050505] min-h-screen text-white">
            {/* Skeleton header */}
                <div className="flex items-center justify-between px-4 py-3">
                    <div className="w-10 h-10 rounded-full bg-white/5" />
                    <div className="flex gap-2">
                        <div className="w-10 h-10 rounded-full bg-white/5" />
                        <div className="w-10 h-10 rounded-full bg-white/5" />
                    </div>
                </div>
                <div className="animate-pulse">
                    {/* Image skeleton */}
                    <div className="aspect-[344/360] bg-white/5 mx-0" />
                    {/* Text skeletons */}
                    <div className="px-5 mt-6 space-y-4">
                        <div className="flex items-start justify-between">
                            <div className="h-6 bg-white/5 rounded-lg w-2/3" />
                            <div className="h-4 bg-white/5 rounded w-24" />
                        </div>
                        <div className="flex gap-3">
                            <div className="h-7 bg-white/5 rounded-lg w-16" />
                            <div className="h-7 bg-white/5 rounded-lg w-16" />
                            <div className="h-5 bg-white/5 rounded-lg w-20" />
                        </div>
                        <div className="h-5 bg-white/5 rounded-lg w-24 mt-6" />
                        <div className="flex gap-3 mt-2">
                            {[...Array(6)].map((_, i) => (
                                <div key={i} className="w-10 h-10 rounded-lg bg-white/5" />
                            ))}
                        </div>
                        <div className="h-32 bg-white/5 rounded-2xl mt-6" />
                    </div>
                </div>
            </div>
        );
    }

    if (!product) {
        return (
            <div className="bg-[#111111] text-white min-h-screen">
                <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
                    <h2 className="text-xl font-bold mb-2">Product Not Found</h2>
                    <p className="text-zinc-400 mb-6">
                        The product you're looking for doesn't exist.
                    </p>
                    <Link
                        to="/home"
                        className="px-6 py-3 rounded-full bg-[#f2546d] text-white font-semibold"
                    >
                        Back to Home
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <MobileShell className="bg-[#0A0A0A] text-white">
            {/* ─── HEADER ─── */}
            <div className="flex items-center justify-between px-4 py-4 sticky top-0 z-50 bg-[#0A0A0A]/90 backdrop-blur-xl border-b border-white/5">
                <button
                    onClick={() => navigate(-1)}
                    className="p-2 rounded-full hover:bg-white/10 transition-colors"
                >
                    <ChevronLeft className="w-5 h-5 md:w-6 md:h-6 text-white" />
                </button>
                <div className="flex items-center gap-2">
                    <button
                        onClick={toggleWishlist}
                        className="p-2 rounded-full bg-[#232323]"
                    >
                        <Heart
                            className={cn(
                                "w-4 h-4",
                                isInWishlist(product.id)
                                    ? "fill-[#f2546d] text-[#f2546d]"
                                    : "text-zinc-400"
                            )}
                        />
                    </button>
                    <button
                        onClick={() => navigate('/cart')}
                        className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center relative"
                    >
                        <ShoppingBag className="w-4 h-4 md:w-5 md:h-5 text-white" />
                        {totalItems > 0 && (
                            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-[#f2546d] text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-[#050505] px-1">
                                {totalItems > 9 ? '9+' : totalItems}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* ─── MAIN CONTENT ─── */}
            <main className="flex-1 overflow-y-auto pb-28 lg:pb-12 lg:px-8 w-full max-w-7xl mx-auto">
                <div className="lg:flex lg:gap-12 lg:items-start lg:mt-6">
                    {/* Left Column: Images */}
                    <div className="lg:w-1/2">
                        <div className="relative group lg:rounded-[32px] lg:overflow-hidden lg:shadow-2xl lg:shadow-black/50">
                            <div
                        onScroll={(e) => {
                            const scrollLeft = e.currentTarget.scrollLeft;
                            const width = e.currentTarget.offsetWidth;
                            setActiveImageIndex(Math.round(scrollLeft / width));
                        }}
                        className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar bg-[#141414]"
                    >
                        {(product.images?.length ? product.images : [product.imageUrl]).map((img, idx) => (
                            <div key={idx} className="min-w-full snap-center aspect-[344/360] flex items-center justify-center overflow-hidden">
                                {img ? (
                                    <motion.img
                                        initial={{ opacity: 0, scale: 1.1 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ duration: 0.6 }}
                                        src={fullImage(img)}
                                        alt={`${product.name} ${idx + 1}`}
                                        className={cn(
                                            "w-full h-full object-cover",
                                            (isRented || isProductRentedOut) && "grayscale opacity-50"
                                        )}
                                    />
                                ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center">
                                        <div className="text-zinc-600">No image</div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Rented Out / Sold Out Badge Overlay */}
                    {(isRented || isProductRentedOut || isProductSoldOut) && (
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="px-6 py-3 rounded-full bg-black/80 backdrop-blur-xl border border-red-500/50 flex items-center gap-3 shadow-2xl"
                            >
                                <span className={cn("h-2 w-2 rounded-full", isProductSoldOut ? "bg-zinc-400" : "bg-red-400 animate-pulse")} />
                                <span className="text-sm font-black uppercase tracking-widest text-white">
                                    {isProductSoldOut ? "Sold Out" : "Currently Rented Out"}
                                </span>
                            </motion.div>
                        </div>
                    )}

                    {/* Pagination Dots (only if multiple images) */}
                    {(product.images?.length > 1) && (
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10 px-3 py-2 rounded-2xl bg-black/40 backdrop-blur-xl border border-white/5">
                            {(product.images).map((_, idx) => (
                                <div
                                    key={idx}
                                    className={cn(
                                        "h-1.5 rounded-full transition-all duration-300",
                                        idx === activeImageIndex ? "bg-[#f2546d] w-6" : "bg-white/20 w-1.5"
                                    )}
                                />
                            ))}
                        </div>
                    )}

                    {/* Share Button Floating Overlay */}
                    <button 
                        onClick={handleShare}
                        className="absolute top-4 right-4 z-10 p-2.5 rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 active:scale-95 transition-all"
                    >
                        <img
                            src={shareButtonIcon}
                            alt="Share"
                            className="w-5 h-5 brightness-200"
                        />
                    </button>

                    {/* Edit Outfit Button Removed */}
                        </div>
                    </div>

                    {/* Right Column: Product Info */}
                    <div className="lg:w-1/2 px-4 lg:px-0 mt-4 lg:mt-0 flex flex-col lg:sticky lg:top-24 lg:h-[calc(100vh-120px)] lg:overflow-y-auto no-scrollbar">
                        <div className="flex-1">
                            {/* Name + Rating */}
                    <div className="flex items-start justify-between">
                        <h1
                            className="text-lg md:text-2xl font-semibold text-[#b4b4b4] tracking-[-0.72px]"
                            style={dmSans}
                        >
                            {product.name || "Haldi Outfit"}
                        </h1>
                        <div className="flex flex-col items-end">
                            <div className="flex items-center gap-0.5">
                                {[...Array(5)].map((_, i) => (
                                    <Star
                                        key={i}
                                        className={cn(
                                            "w-[15px] h-[15px]",
                                            i < Math.round(ratingStats.average) ? "fill-[#f2546d] text-[#f2546d]" : "text-zinc-600 fill-zinc-600"
                                        )}
                                    />
                                ))}
                            </div>
                            <span className="text-xs text-zinc-400 mt-1">{ratingStats.total} reviews</span>
                        </div>
                    </div>

                    {/* Pricing */}
                    <div className="flex items-center gap-2 md:gap-3 mt-2 md:mt-4">
                        <span
                            className="text-xl md:text-2xl font-semibold text-white tracking-[-0.72px]"
                            style={dmSans}
                        >
                            ₹ {currentPlanPrice}
                        </span>
                        {selectedPlan !== 'buy' && mrp > currentPlanPrice && (
                            <>
                                <span className="relative">
                                    <span
                                        className="text-xl md:text-2xl font-semibold text-[#5f606a] tracking-[-0.72px]"
                                        style={dmSans}
                                    >
                                        ₹ {mrp}
                                    </span>
                                    <span className="absolute left-0 right-0 top-1/2 h-[2px] bg-[#5f606a]" />
                                </span>
                                <span
                                    className="text-base md:text-lg font-semibold text-[#f2546d] tracking-[-0.54px] leading-[21.6px]"
                                    style={dmSans}
                                >
                                    Save {Math.round(((mrp - currentPlanPrice) / mrp) * 100)}%
                                </span>
                            </>
                        )}
                    </div>

                    {/* ─── SELECT DURATION ─── */}
                    <div className="mt-8">
                        <span
                            className="text-lg font-semibold text-white tracking-[-0.54px] leading-[21.6px]"
                            style={dmSans}
                        >
                            Select Duration
                        </span>
                        <div className="flex flex-wrap gap-2 mt-4">
                            {[
                                { id: '1d', label: '1 Day', price: product.rental_price_1d },
                                { id: '2d', label: '2 Days', price: product.rental_price_2d },
                                { id: '3d', label: '3 Days', price: product.rental_price_3d || product.rentalPrice },
                                { id: 'buy', label: 'Instant Buy', price: product.buy_price },
                            ].map((plan) => {
                                const isSelected = selectedPlan === plan.id;
                                const hasPrice = plan.price && plan.price > 0;
                                if (!hasPrice && plan.id !== '3d') return null; // Only show plans with valid prices

                                return (
                                    <button
                                        key={plan.id}
                                        onClick={() => setSelectedPlan(plan.id as PricingPlan)}
                                        className={cn(
                                            "flex flex-col items-center justify-center p-3 rounded-2xl min-w-[80px] border transition-all duration-300",
                                            isSelected 
                                                ? "bg-[#f2546d] border-[#f2546d] text-white shadow-lg shadow-[#f2546d]/20 scale-105" 
                                                : "bg-[#1A1A1A] border-white/5 text-zinc-400 hover:border-white/10"
                                        )}
                                    >
                                        <span className="text-[10px] font-bold uppercase tracking-wider mb-1 opacity-70">
                                            {plan.label}
                                        </span>
                                        <span className="text-sm font-black">
                                            ₹{plan.price || 'N/A'}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* ─── SELECT SIZE ─── */}
                    <div className="flex items-center justify-between mt-6 md:mt-10">
                        <span
                            className="text-base md:text-lg font-semibold text-white tracking-[-0.54px] leading-[21.6px]"
                            style={dmSans}
                        >
                            Select Size
                        </span>
                        <button
                            onClick={() => setIsSizeGuideOpen(true)}
                            className="flex items-center gap-1.5"
                        >
                            <RulerIcon />
                            <span
                                className="text-sm font-semibold text-[#f2546d] tracking-[-0.42px]"
                                style={dmSans}
                            >
                                Size Guide
                            </span>
                        </button>
                    </div>

                    {/* Size buttons — show all standard sizes, mark unavailable ones as out of stock */}
                    <div className="flex items-center gap-2 md:gap-3 mt-3 md:mt-5 relative flex-wrap pb-2">
                        {(['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const).map((size) => {
                            const row = inventory.find(r => r.size === size);
                            const isSelected = selectedSize === size;
                            const isOutOfStock = !row || row.available_stock <= 0;

                            return (
                                <div key={size} className="relative flex flex-col items-center gap-2">
                                    <button
                                        onClick={() =>
                                            setSelectedSize(size)
                                        }
                                        title={isOutOfStock ? 'Out of stock' : `${row?.available_stock || 0} available`}
                                        className={cn(
                                            "w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center relative",
                                            "text-base md:text-lg font-black tracking-tighter transition-all duration-300",
                                            isSelected
                                                ? "bg-[#f2546d] text-white shadow-lg shadow-[#f2546d]/20 scale-105"
                                                : isOutOfStock
                                                    ? "text-zinc-700 bg-[#1A1A1A] border border-white/5 opacity-50"
                                                    : "text-zinc-400 bg-[#1A1A1A] border border-white/5 hover:bg-white/5 hover:text-white"
                                        )}
                                    >
                                        <span className={isOutOfStock ? "line-through" : ""}>
                                            {size}
                                        </span>
                                    </button>

                                    {isOutOfStock && (
                                        <span className="text-[10px] font-bold text-zinc-600 whitespace-nowrap -mt-1">
                                            Out
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <div className="hidden lg:block mt-8 mb-4">
                        {isProductSoldOut ? (
                             <div className="w-full h-[56px] flex items-center justify-center rounded-2xl bg-zinc-900 border border-zinc-800 gap-3">
                                 <span className="h-2 w-2 rounded-full bg-zinc-400" />
                                 <span className="text-lg font-bold text-zinc-500 tracking-tight" style={dmSans}>
                                     Sold Out
                                 </span>
                             </div>
                        ) : isProductRentedOut || isRented ? (
                            <div className="w-full h-[56px] flex items-center justify-center rounded-2xl bg-zinc-900 border border-zinc-800 gap-3">
                                <span className="h-2 w-2 rounded-full bg-red-400 animate-pulse" />
                                <span className="text-lg font-bold text-zinc-500 tracking-tight" style={dmSans}>
                                    Currently Rented Out
                                </span>
                            </div>
                        ) : (
                            (() => {
                                const selectedSizeStock = inventory.find(r => r.size === selectedSize)?.available_stock || 0;
                                const isSelectedSizeOut = selectedSizeStock <= 0;

                                return (
                                    <button
                                        onClick={isAdded ? () => navigate("/cart") : handleAddToCart}
                                        disabled={isSelectedSizeOut && !isAdded}
                                        className={cn(
                                            "w-full h-[56px] flex items-center justify-center rounded-2xl transition-all duration-300 active:scale-[0.98]",
                                            isAdded 
                                                ? "bg-zinc-800 border border-[#f2546d]/30 text-white" 
                                                : isSelectedSizeOut 
                                                    ? "bg-zinc-900 border border-white/5 text-zinc-600 cursor-not-allowed" 
                                                    : "bg-[#f2546d] shadow-lg shadow-[#f2546d]/20 text-white"
                                        )}
                                    >
                                        <span className="text-lg font-bold tracking-tight" style={dmSans}>
                                            {isAdded ? "Added to Cart →" : isSelectedSizeOut ? "Out of Stock" : "Add to Cart"}
                                        </span>
                                    </button>
                                );
                            })()
                        )}
                    </div>

                    {/* ─── PRODUCT DETAILS ─── */}
                    <div className="mt-10">
                        <button
                            onClick={() =>
                                setShowProductDetails(!showProductDetails)
                            }
                            className="flex items-center justify-between w-full"
                        >
                            <span
                                className="text-lg font-semibold text-white tracking-[-0.54px] leading-[21.6px]"
                                style={dmSans}
                            >
                                Product Details
                            </span>
                            <ChevronUpIcon
                                className={cn(
                                    "w-5 h-3 text-white transition-transform",
                                    !showProductDetails && "rotate-180"
                                )}
                            />
                        </button>

                        {showProductDetails && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                className="mt-4"
                            >
                                <p
                                    className="text-sm font-normal text-[#b4b4b4] tracking-[-0.42px] leading-[16.8px] whitespace-pre-line"
                                    style={dmSans}
                                >
                                    {product.description || "No description available for this product."}
                                </p>
                            </motion.div>
                        )}
                    </div>

                    {/* ─── SERVICE BADGES ─── */}
                    <div className="mt-8 grid grid-cols-3 gap-3 py-6 px-4 rounded-3xl border border-white/5 bg-[#141414]">
                        <div className="flex flex-col items-center gap-3 text-center">
                            <div className="w-12 h-12 rounded-2xl bg-[#F2546D]/10 flex items-center justify-center">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M1 3H4L5.3 12.3C5.4 13.3 6.3 14 7.3 14H16.7C17.7 14 18.6 13.3 18.7 12.3L20 4H5" stroke="#F2546D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    <circle cx="8" cy="19" r="2" stroke="#F2546D" strokeWidth="2" />
                                    <circle cx="17" cy="19" r="2" stroke="#F2546D" strokeWidth="2" />
                                </svg>
                            </div>
                            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider leading-tight">
                                {(() => {
                                    try {
                                        const loc = JSON.parse(localStorage.getItem('locationStorage') || '{}');
                                        return loc.delivery_estimate === 'delayed' ? 'Delayed\nDelivery' : '60-Min\nDelivery';
                                    } catch {
                                        return '60-Min\nDelivery';
                                    }
                                })().split('\n').map((line, i) => (
                                    <React.Fragment key={i}>
                                        {line}
                                        {i === 0 && <br />}
                                    </React.Fragment>
                                ))}
                            </span>
                        </div>
                        <div className="flex flex-col items-center gap-3 text-center border-x border-white/5">
                            <div className="w-12 h-12 rounded-2xl bg-[#F2546D]/10 flex items-center justify-center">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#F2546D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    <path d="M9 12l2 2 4-4" stroke="#F2546D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </div>
                            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider leading-tight">
                                Zero<br />Insurance
                            </span>
                        </div>
                        <div className="flex flex-col items-center gap-3 text-center">
                            <div className="w-12 h-12 rounded-2xl bg-[#F2546D]/10 flex items-center justify-center">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke="#F2546D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    <path d="M22 4L12 14.01l-3-3" stroke="#F2546D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </div>
                            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider leading-tight">
                                Quality<br />Assured
                            </span>
                        </div>
                    </div>

                    {/* ─── RECOMMENDED PRODUCTS ─── */}
                    <RecommendedProducts currentProduct={product} />

                    {/* ─── REVIEWS ─── */}
                    <div className="mt-12 mb-8">
                        {/* Header Area */}
                        <div className="mb-6">
                            <div className="flex items-center justify-between mb-5">
                                <h2
                                    className="text-xl font-black text-white tracking-tight flex items-center gap-3"
                                    style={dmSans}
                                >
                                    Customer Reviews
                                    {ratingStats.total > 0 && (
                                        <span className="px-2.5 py-1 rounded-full bg-[#f2546d]/10 text-xs font-black text-[#f2546d] border border-[#f2546d]/20">
                                            {ratingStats.total}
                                        </span>
                                    )}
                                </h2>
                                <button
                                    onClick={() => user ? setIsReviewModalOpen(true) : toast.error("Please log in to write a review")}
                                    className="px-4 py-2 rounded-2xl bg-[#f2546d]/10 border border-[#f2546d]/20 text-sm font-bold text-[#f2546d] hover:bg-[#f2546d]/20 transition-all active:scale-95"
                                >
                                    + Write Review
                                </button>
                            </div>
                            
                            {/* Rating Overview Card */}
                            {ratingStats.total > 0 && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-gradient-to-br from-[#161616] to-[#0f0f0f] rounded-3xl border border-white/5 p-5 mb-6 shadow-xl shadow-black/30"
                                >
                                    <div className="flex items-center gap-5">
                                        {/* Big Score */}
                                        <div className="flex flex-col items-center min-w-[70px]">
                                            <span className="text-4xl font-black text-white tracking-tight" style={dmSans}>{ratingStats.average.toFixed(1)}</span>
                                            <div className="flex gap-0.5 mt-1.5">
                                                {[1, 2, 3, 4, 5].map((star) => (
                                                    <Star
                                                        key={star}
                                                        className={cn(
                                                            "w-4 h-4",
                                                            star <= Math.round(ratingStats.average)
                                                                ? "fill-[#f2546d] text-[#f2546d] filter drop-shadow-[0_0_4px_rgba(242,84,109,0.5)]"
                                                                : "text-zinc-800 fill-zinc-900"
                                                        )}
                                                    />
                                                ))}
                                            </div>
                                            <span className="text-[10px] font-bold text-zinc-500 mt-1.5 uppercase tracking-wider">{ratingStats.total} review{ratingStats.total !== 1 ? 's' : ''}</span>
                                        </div>
                                        
                                        {/* Rating Distribution Bars */}
                                        <div className="flex-1 space-y-1.5">
                                            {[5, 4, 3, 2, 1].map((star) => {
                                                const count = recentReviews.filter(r => r.rating === star).length;
                                                const pct = recentReviews.length > 0 ? (count / recentReviews.length) * 100 : 0;
                                                return (
                                                    <div key={star} className="flex items-center gap-2">
                                                        <span className="text-[11px] font-bold text-zinc-500 w-3 text-right">{star}</span>
                                                        <Star className="w-3 h-3 fill-zinc-700 text-zinc-700" />
                                                        <div className="flex-1 h-2 bg-zinc-900/80 rounded-full overflow-hidden">
                                                            <motion.div
                                                                initial={{ width: 0 }}
                                                                animate={{ width: `${pct}%` }}
                                                                transition={{ duration: 0.8, delay: (5 - star) * 0.1 }}
                                                                className="h-full rounded-full bg-gradient-to-r from-[#f2546d] to-[#ff7b92]"
                                                            />
                                                        </div>
                                                        <span className="text-[10px] font-bold text-zinc-600 w-6 text-right">{count}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </div>

                        <div className="space-y-4">
                            {recentReviews.length === 0 ? (
                                <motion.div 
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-gradient-to-br from-[#1a1a1a] to-[#111] p-10 rounded-3xl border border-white/5 flex flex-col items-center justify-center text-center shadow-xl"
                                >
                                    <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#f2546d]/10 to-transparent flex items-center justify-center mb-5 border border-[#f2546d]/10">
                                        <Star className="w-10 h-10 text-[#f2546d]/30" />
                                    </div>
                                    <h3 className="text-white font-black text-lg mb-2 tracking-tight" style={dmSans}>No reviews yet</h3>
                                    <p className="text-zinc-500 text-sm max-w-[220px] leading-relaxed">
                                        Be the first to share your experience and help others decide.
                                    </p>
                                    <button
                                        onClick={() => user ? setIsReviewModalOpen(true) : toast.error("Please log in to write a review")}
                                        className="mt-5 px-6 py-3 rounded-2xl bg-[#f2546d] text-white text-sm font-bold shadow-lg shadow-[#f2546d]/20 active:scale-95 transition-all"
                                    >
                                        Write the First Review
                                    </button>
                                </motion.div>
                            ) : (
                                recentReviews.map((review, idx) => {
                                    // Use reviewer_name from DB row first, then fall back to profile join
                                    const profileData = Array.isArray(review.profiles) ? review.profiles[0] : review.profiles;
                                    const name = review.reviewer_name || profileData?.full_name || "Anonymous";
                                    const initial = name.charAt(0).toUpperCase();
                                    
                                    // Generate a consistent avatar color from the name
                                    const avatarColors = [
                                        ['from-[#f2546d]', 'to-[#ff7b92]', 'shadow-[#f2546d]/20'],
                                        ['from-[#6366f1]', 'to-[#818cf8]', 'shadow-[#6366f1]/20'],
                                        ['from-[#f59e0b]', 'to-[#fbbf24]', 'shadow-[#f59e0b]/20'],
                                        ['from-[#10b981]', 'to-[#34d399]', 'shadow-[#10b981]/20'],
                                        ['from-[#8b5cf6]', 'to-[#a78bfa]', 'shadow-[#8b5cf6]/20'],
                                        ['from-[#ef4444]', 'to-[#f87171]', 'shadow-[#ef4444]/20'],
                                    ];
                                    const colorIdx = name.split('').reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0) % avatarColors.length;
                                    const [gradFrom, gradTo, gradShadow] = avatarColors[colorIdx];

                                    return (
                                        <motion.div 
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: idx * 0.06 }}
                                            key={review.id} 
                                            className="group relative bg-[#141414]/90 backdrop-blur-xl p-5 rounded-3xl border border-white/[0.06] shadow-xl shadow-black/20 hover:border-white/10 hover:bg-[#1a1a1a]/90 transition-all duration-500 overflow-hidden"
                                        >
                                            {/* Decorative Glow */}
                                            <div className="absolute -top-20 -right-20 w-40 h-40 bg-[#f2546d]/[0.03] rounded-full blur-3xl group-hover:bg-[#f2546d]/[0.06] transition-all duration-700 pointer-events-none" />
                                            
                                            {/* Decorative Quote Mark */}
                                            <div className="absolute -bottom-4 -right-2 text-[100px] text-white/[0.015] font-serif leading-none select-none pointer-events-none group-hover:text-white/[0.04] transition-colors duration-700">
                                                &rdquo;
                                            </div>

                                            <div className="flex items-start justify-between mb-4 relative z-10">
                                                <div className="flex items-center gap-3.5">
                                                    {/* Avatar with dynamic color */}
                                                    <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${gradFrom} ${gradTo} flex items-center justify-center text-white font-black text-lg shadow-lg ${gradShadow} relative flex-shrink-0`}>
                                                        {initial}
                                                        <div className="absolute inset-0 rounded-2xl ring-1 ring-white/20" />
                                                    </div>
                                                    
                                                    <div className="flex flex-col">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="text-white font-bold text-[14px] tracking-tight" style={dmSans}>{name}</span>
                                                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-[8px] font-black text-emerald-400 border border-emerald-500/20 tracking-[0.1em] uppercase">Verified</span>
                                                        </div>
                                                        <div className="flex gap-0.5">
                                                            {[...Array(5)].map((_, i) => (
                                                                <Star
                                                                    key={i}
                                                                    className={cn(
                                                                        "w-3.5 h-3.5 transition-all duration-300",
                                                                        i < review.rating ? "fill-[#f2546d] text-[#f2546d]" : "text-zinc-800 fill-zinc-900"
                                                                    )}
                                                                />
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                <div className="flex flex-col items-end gap-2">
                                                    <span className="text-[10px] font-bold text-zinc-600 tracking-wider uppercase">
                                                        {new Date(review.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                                    </span>
                                                    {user && review.user_id === user.id && (
                                                        <button
                                                            onClick={() => handleDeleteReview(review.id)}
                                                            className="p-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-all duration-300"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            <p className="text-[14px] font-normal text-zinc-300 leading-[1.7] pl-1 relative z-10" style={dmSans}>{review.review_text}</p>
                                        </motion.div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                        </div> {/* end right column inner flex */}
                    </div> {/* end right column */}
                </div> {/* end lg:flex */}
            </main>

            {/* ─── WRITE REVIEW MODAL (Vaul) ─── */}
            <Drawer.Root open={isReviewModalOpen} onOpenChange={setIsReviewModalOpen}>
                <Drawer.Portal>
                    <Drawer.Overlay className="fixed inset-0 bg-black/60 z-50" />
                    <Drawer.Content className="bg-[#0A0A0A] flex flex-col rounded-t-[32px] fixed bottom-0 left-0 right-0 z-50 max-w-[430px] mx-auto h-[65vh] border-t border-white/5 shadow-2xl pb-safe">
                        <div className="p-6 bg-[#0A0A0A] rounded-t-[32px] flex-1 overflow-y-auto no-scrollbar">
                            <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-zinc-800 mb-8" />
                            <h2 className="text-2xl font-black text-white mb-2 text-center tracking-tighter">Write a Review</h2>
                            <p className="text-zinc-500 text-center text-sm mb-8">Share your experience with the community</p>

                            <div className="flex flex-col items-center mb-10">
                                <div className="flex gap-3">
                                    {[1, 2, 3, 4, 5].map(star => (
                                        <button
                                            key={star}
                                            onClick={() => setReviewRating(star)}
                                            className="p-1 transition-all duration-300 active:scale-90"
                                        >
                                            <Star
                                                className={cn(
                                                    "w-12 h-12 transition-all duration-300",
                                                    star <= reviewRating
                                                        ? "fill-[#f2546d] text-[#f2546d] filter drop-shadow-[0_0_8px_rgba(242,84,109,0.4)]"
                                                        : "text-zinc-800 fill-zinc-900"
                                                )}
                                            />
                                        </button>
                                    ))}
                                </div>
                                {reviewRating > 0 && (
                                    <motion.span
                                        initial={{ opacity: 0, y: 5 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="text-[#f2546d] text-xs font-bold mt-3 uppercase tracking-widest"
                                    >
                                        {['Poor', 'Fair', 'Good', 'Great', 'Exceptional'][reviewRating - 1]}
                                    </motion.span>
                                )}
                            </div>

                            <div className="mb-4">
                                <label className="text-[13px] font-bold text-zinc-400 uppercase tracking-wider mb-2 block text-left">Your Name</label>
                                <input
                                    type="text"
                                    placeholder="Enter your name"
                                    value={reviewerName}
                                    onChange={(e) => setReviewerName(e.target.value)}
                                    className="w-full bg-[#141414] border border-white/5 rounded-2xl p-4 text-white text-sm focus:outline-none focus:border-[#f2546d]/50 transition-all font-medium mb-4 placeholder:text-zinc-600"
                                />
                                <label className="text-[13px] font-bold text-zinc-400 uppercase tracking-wider mb-2 block text-left">Your Review</label>
                                <textarea
                                    value={reviewText}
                                    onChange={e => setReviewText(e.target.value)}
                                    placeholder="Tell us about the fit, quality, and your overall vibe..."
                                    className="w-full bg-[#141414] border border-white/5 rounded-3xl p-5 text-white text-sm focus:outline-none focus:border-[#f2546d]/50 min-h-[140px] transition-all placeholder:text-zinc-600"
                                />
                            </div>

                            <button
                                onClick={submitReview}
                                disabled={isSubmittingReview || reviewRating === 0 || !reviewerName.trim()}
                                className={cn(
                                    "w-full py-5 rounded-3xl text-white font-black tracking-tight transition-all duration-300 active:scale-[0.98]",
                                    (isSubmittingReview || reviewRating === 0 || !reviewerName.trim())
                                        ? "bg-zinc-900 text-zinc-700 border border-white/5"
                                        : "bg-[#f2546d] shadow-xl shadow-[#f2546d]/20"
                                )}
                            >
                                {isSubmittingReview ? "SUBMITTING..." : "SUBMIT REVIEW"}
                            </button>
                        </div>
                    </Drawer.Content>
                </Drawer.Portal>
            </Drawer.Root>

            {/* ─── SIZE GUIDE MODAL (Vaul) ─── */}
            <Drawer.Root open={isSizeGuideOpen} onOpenChange={setIsSizeGuideOpen}>
                <Drawer.Portal>
                    <Drawer.Overlay className="fixed inset-0 bg-black/60 z-50" />
                    <Drawer.Content className="bg-[#191919] flex flex-col rounded-t-[20px] mt-24 fixed bottom-0 left-0 right-0 z-50 max-w-[430px] mx-auto max-h-[70vh] pb-safe">
                        <div className="p-4 bg-[#191919] rounded-t-[20px] flex-1 overflow-y-auto">
                            <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-zinc-700 mb-6" />
                            <h2 className="text-xl font-bold text-white mb-6 text-center">Size Guide (Inches)</h2>

                            <div className="overflow-hidden rounded-xl border border-[#333] mb-6">
                                <table className="w-full text-left text-sm text-white">
                                    <thead className="bg-[#232323]">
                                        <tr>
                                            <th className="p-3 font-semibold text-zinc-300">Size</th>
                                            <th className="p-3 font-semibold text-zinc-300">Chest</th>
                                            <th className="p-3 font-semibold text-zinc-300">Length</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#333]">
                                        {[
                                            { s: 'S', c: '38', l: '28' },
                                            { s: 'M', c: '40', l: '29' },
                                            { s: 'L', c: '42', l: '30' },
                                            { s: 'XL', c: '44', l: '31' },
                                            { s: 'XXL', c: '46', l: '32' },
                                        ].map((row) => (
                                            <tr key={row.s} className="hover:bg-white/5 transition-colors">
                                                <td className="p-3 font-bold">{row.s}</td>
                                                <td className="p-3 text-zinc-400">{row.c}"</td>
                                                <td className="p-3 text-zinc-400">{row.l}"</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <p className="text-xs text-zinc-500 text-center px-4 mb-4">
                                Measurements are approximate and may vary slightly by specific garment style.
                            </p>

                            <button
                                onClick={() => setIsSizeGuideOpen(false)}
                                className="w-full py-4 rounded-xl text-white font-bold tracking-wide transition-colors bg-[#333] hover:bg-[#444]"
                            >
                                Close
                            </button>
                        </div>
                    </Drawer.Content>
                </Drawer.Portal>
            </Drawer.Root>

            {/* ─── BOTTOM ACTION BAR ─── */}
            <div className="fixed bottom-[85px] left-0 right-0 z-40 pointer-events-none lg:hidden pb-safe">
                <div className="max-w-[430px] mx-auto flex gap-4 px-5 py-4 pointer-events-auto">
                    {isRented || isProductRentedOut ? (
                        /* Rented-out state — cannot order */
                        <div className="w-full h-[56px] flex items-center justify-center rounded-2xl bg-zinc-900 border border-zinc-800 gap-3 shadow-xl">
                            <span className="h-2 w-2 rounded-full bg-red-400 animate-pulse" />
                            <span className="text-base font-bold text-zinc-500 tracking-tight" style={dmSans}>
                                Currently Rented Out
                            </span>
                        </div>
                    ) : (
                        <button
                            onClick={isAdded ? () => navigate("/cart") : handleAddToCart}
                            className={cn(
                                "w-full h-[56px] flex items-center justify-center rounded-2xl transition-all duration-300 active:scale-[0.98]",
                                isAdded ? "bg-zinc-800 border border-[#f2546d]/30" : "bg-[#f2546d] shadow-lg shadow-[#f2546d]/20"
                            )}
                        >
                            <span
                                className="text-lg font-bold text-white tracking-tight"
                                style={dmSans}
                            >
                                {isAdded ? "Added to Cart →" : "Add to Cart"}
                            </span>
                        </button>
                    )}
                </div>
            </div>
        </MobileShell>
    );
};

export default MobileProductDetailPage;
