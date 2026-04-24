import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { thumbImage, markImageLoaded, isImageLoaded, prefetchImages } from "@/lib/optimizeImage";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useSearchParams, useParams } from "react-router-dom";
import { MobileShell } from "@/components/layout/MobileShell";
import { ChevronLeft, SlidersHorizontal, Loader, Search, X, ShoppingBag, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import type { Product } from "@/services/productService";
import { productService } from "@/services/productService";
import { cacheProductsBatchDB } from "@/lib/db";
import { getProductsWithFakeMix, fetchRotatedFakeProducts } from "@/services/fakeProductMixService";

import { useCart } from "@/context/CartContext";
import { useWishlist } from "@/context/WishlistContext";

type FilterTab = "size" | "price" | "brand";

const DEFAULT_PRICE_RANGE = { min: 0, max: 2000 };
const MAX_PRICE_LIMIT = DEFAULT_PRICE_RANGE.max;
const PRICE_STEP = 100;

const PRICE_PRESETS = [
    { label: "All", min: 0, max: 2000 },
    { label: "Under 500", min: 0, max: 500 },
    { label: "500 - 1000", min: 500, max: 1000 },
    { label: "1000 - 1500", min: 1000, max: 1500 },
    { label: "1500+", min: 1500, max: 2000 },
] as const;

const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
    }).format(value);

const getProductPrice = (product: Product) =>
    Number(
        product.rental_price_1d ??
        product.rentalPrice ??
        product.rental_price ??
        product.price ??
        0
    ) || 0;

const isDefaultPriceRange = (range: { min: number; max: number }) =>
    range.min === DEFAULT_PRICE_RANGE.min && range.max === DEFAULT_PRICE_RANGE.max;

const CategoryProductsPage: React.FC = () => {
    const navigate = useNavigate();
    const { totalItems } = useCart();
    const [searchParams] = useSearchParams();
    const { gender: genderFromPath } = useParams();

    // Category and title from search params
    const category = searchParams.get('category') || '';
    const brandParam = searchParams.get('brand') || '';

    // Fallback gender from localStorage if path is missing it (e.g. /category?brand=X)
    const effectiveGender = genderFromPath || localStorage.getItem('activeGender') || 'womens';

    const categoryTitle = searchParams.get('title') || (category ? category.charAt(0).toUpperCase() + category.slice(1) : (brandParam || 'Products'));

    // Instant restore from memory cache on re-mount (back navigation)
    const cacheKey = `cat_${category}_${effectiveGender}_${brandParam}`;
    const cachedProducts = productService.getFromMemoryCache(cacheKey);
    const [products, setProducts] = useState<Product[]>(cachedProducts || []);
    const [loading, setLoading] = useState(!cachedProducts); // Skip skeleton if we have cached data

    // Derive available sizes and brands dynamically from the fetched products
    // Size sorting helper
    const sortSizes = (sizes: string[]) => {
        const order = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL'];
        return [...sizes].sort((a, b) => {
            const aIdx = order.indexOf(a.toUpperCase());
            const bIdx = order.indexOf(b.toUpperCase());

            if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
            if (aIdx !== -1) return -1;
            if (bIdx !== -1) return 1;

            // Numeric comparison for numbered sizes
            const aNum = parseInt(a);
            const bNum = parseInt(b);
            if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;

            return a.localeCompare(b);
        });
    };

    const availableSizes = useMemo(() => {
        const sizesSet = new Set<string>();
        products.forEach(p => {
            if (p.sizes) {
                p.sizes.forEach((s: string) => sizesSet.add(s));
            }
        });
        return sortSizes(Array.from(sizesSet));
    }, [products]);

    const availableBrands = useMemo(() => {
        const brandsSet = new Set<string>();
        products.forEach(p => {
            if (p.brand) brandsSet.add(p.brand);
        });
        return Array.from(brandsSet).sort();
    }, [products]);
    const { wishlistItems, addToWishlist, removeFromWishlist, isInWishlist } = useWishlist();
    const [showFilters, setShowFilters] = useState(false);
    const [activeFilterTab, setActiveFilterTab] = useState<FilterTab>("size");

    // Filter states (applied)
    const [selectedSizes, setSelectedSizes] = useState<Set<string>>(new Set());
    const [priceRange, setPriceRange] = useState(DEFAULT_PRICE_RANGE);
    const [selectedBrands, setSelectedBrands] = useState<Set<string>>(new Set());

    // Staging states (for modal)
    const [tempSelectedSizes, setTempSelectedSizes] = useState<Set<string>>(new Set());
    const [tempPriceRange, setTempPriceRange] = useState(DEFAULT_PRICE_RANGE);
    const [tempSelectedBrands, setTempSelectedBrands] = useState<Set<string>>(new Set());


    const [nameQuery, setNameQuery] = useState(""); // text search by name

    const appliedFilterCount =
        selectedSizes.size + selectedBrands.size + (isDefaultPriceRange(priceRange) ? 0 : 1);
    const stagedFilterCount =
        tempSelectedSizes.size + tempSelectedBrands.size + (isDefaultPriceRange(tempPriceRange) ? 0 : 1);

    // Load products on mount or when category/gender/brand changes
    useEffect(() => {
        // Reset scroll
        window.scrollTo(0, 0);

        // Update persistent gender preference if path gender changes
        if (genderFromPath === 'mens') {
            localStorage.setItem('activeGender', 'mens');
        } else if (genderFromPath === 'womens') {
            localStorage.setItem('activeGender', 'womens');
        }

        // Reset display filters on route change
        resetFilters();

        // Initialize display filters if brand is in URL
        if (brandParam) {
            setSelectedBrands(new Set([brandParam]));
        }
    }, [category, genderFromPath, brandParam]);

    // Combined debounced background fetch effect.
    // IMPORTANT: selectedBrands/selectedSizes are Sets — they are always referentially new
    // after resetFilters(), causing an infinite loop. We serialize to string for stable comparison.
    const brandsKey = JSON.stringify(Array.from(selectedBrands).sort());
    const sizesKey = JSON.stringify(Array.from(selectedSizes).sort());

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchProductsInBackground({
                category: category,
                gender: effectiveGender,
                nameQuery: nameQuery,
                brands: Array.from(selectedBrands),
                sizes: Array.from(selectedSizes),
            });
        }, 400); // 400ms debounce

        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [category, effectiveGender, nameQuery, priceRange.min, priceRange.max, brandsKey, sizesKey]);

    // Fix: Ensure priceRange stays within the 2000 limit for UI consistency
    useEffect(() => {
        if (priceRange.max > MAX_PRICE_LIMIT) {
            setPriceRange(prev => ({ ...prev, max: MAX_PRICE_LIMIT }));
            setTempPriceRange(prev => ({ ...prev, max: MAX_PRICE_LIMIT }));
        }
    }, [priceRange.max]);

    interface ProductFilters {
        category?: string;
        gender?: string;
        nameQuery?: string;
        priceMin?: number;
        priceMax?: number;
        brands?: string[];
        sizes?: string[];
    }

    // Background fetch helper
    const fetchProductsInBackground = async (filters: ProductFilters = {}) => {
        // Only show main loader if we have NO products at all (first load)
        if (products.length === 0) {
            setLoading(true);
        }

        // Map app gender ('mens'/'womens') to DB gender ('men'/'women')
        let dbGender = filters.gender;
        if (filters.gender === 'mens') dbGender = 'men';
        if (filters.gender === 'womens') dbGender = 'women';

        try {
            let mixedProducts: Product[];

            if (!filters.category) {
                // No category — fetch all products for this gender + mix in some fakes
                const gender = filters.gender === 'mens' || filters.gender === 'womens' ? filters.gender : undefined;
                const realProducts = gender
                    ? await productService.getProductsByGender(gender as any)
                    : [];

                // Fetch some rotated fakes for the general view (from a few top categories)
                const topCategories = ['Jackets', 'Footwear']; // These were found in DB
                const fakeBatches = await Promise.all(
                    topCategories.map(cat => fetchRotatedFakeProducts(cat, undefined, 5))
                );

                const dbGender = gender === 'mens' ? 'men' : gender === 'womens' ? 'women' : undefined;

                const fakeProducts = fakeBatches.flat().filter(p => {
                    const pGender = (p.gender as string || '').toLowerCase();
                    const targetGender = (gender || '').toLowerCase();
                    const targetDbGender = (dbGender || '').toLowerCase();

                    // Allow match if pGender matches app string ('mens'), db string ('men'), or is 'unisex'
                    return !gender ||
                        pGender === targetGender ||
                        pGender === targetDbGender ||
                        pGender === 'unisex';
                });

                // Blend them together
                mixedProducts = [...realProducts, ...fakeProducts];
            } else {
                mixedProducts = await getProductsWithFakeMix(
                    filters.category,
                    filters.brands && filters.brands.length === 1 ? filters.brands[0] : undefined,
                    filters.gender === 'mens' || filters.gender === 'womens' ? filters.gender : undefined
                );
            }

            const filteredByName = filters.nameQuery && filters.nameQuery.trim() !== ''
                ? mixedProducts.filter((product) =>
                    product.name.toLowerCase().includes(filters.nameQuery!.trim().toLowerCase())
                )
                : mixedProducts;

            setProducts(filteredByName);

            // Save to memory cache for instant back-navigation
            productService.setMemoryCache(cacheKey, filteredByName);

            // Prefetch first 8 product thumbnails for instant rendering
            prefetchImages(filteredByName.slice(0, 8).map(p => p.images?.[0] || (p as any).imageUrl));

            // Prefetch other gender's products so MEN/WOMEN switch is instant
            const otherGender = effectiveGender === 'mens' ? 'womens' : 'mens';
            productService.getProductsByGender(otherGender as any).then(otherProducts => {
                prefetchImages(otherProducts.slice(0, 8).map(p => p.imageUrl));
            }).catch(() => {});

            // Cache only real products for offline use.
            const realProducts = filteredByName.filter((product: any) => product._isFake !== true);
            if (realProducts.length > 0) {
                cacheProductsBatchDB(realProducts);
            }
        } catch (err) {
            console.error('CRITICAL: Supabase fetch failed:', err);
        } finally {
            setLoading(false);
        }
    };

    const toggleWishlist = (productId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (isInWishlist(productId)) {
            removeFromWishlist(productId);
        } else {
            addToWishlist(productId);
        }
    };

    const toggleSize = (size: string) => {
        setTempSelectedSizes(prev => {
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
        setTempSelectedBrands(prev => {
            const newSet = new Set(prev);
            if (newSet.has(brand)) {
                newSet.delete(brand);
            } else {
                newSet.add(brand);
            }
            return newSet;
        });
    };

    const handleProductClick = (product: Product) => {
        const isFake = (product as any)._isFake === true;
        const isSoldOut = (product as any).isSoldOut === true;

        if (isFake) {
            navigate(`/product/${product.id}`, {
                state: {
                    fakeProduct: product,
                    isRented: !isSoldOut,
                    isSold: isSoldOut,
                },
            });
            return;
        }

        navigate(`/product/${product.id}`);
    };

    const setClampedTempPriceRange = useCallback((nextMin: number, nextMax: number) => {
        const min = Math.max(DEFAULT_PRICE_RANGE.min, Math.min(nextMin, MAX_PRICE_LIMIT));
        const max = Math.max(min, Math.min(nextMax, MAX_PRICE_LIMIT));
        setTempPriceRange({ min, max });
    }, []);

    const handleApplyFilters = () => {
        setSelectedSizes(new Set(tempSelectedSizes));
        setSelectedBrands(new Set(tempSelectedBrands));
        setPriceRange({ ...tempPriceRange });
        setShowFilters(false);
    };

    const openFilters = () => {
        setTempSelectedSizes(new Set(selectedSizes));
        setTempSelectedBrands(new Set(selectedBrands));
        setTempPriceRange({ ...priceRange });
        setShowFilters(true);
    };

    function resetFilters() {
        setSelectedSizes(new Set());
        setSelectedBrands(new Set());
        setPriceRange(DEFAULT_PRICE_RANGE);
        setTempSelectedSizes(new Set());
        setTempSelectedBrands(new Set());
        setTempPriceRange(DEFAULT_PRICE_RANGE);
        setNameQuery("");
    }

    const filteredProducts = useMemo(() => {
        let filtered = [...products];

        // Show all products in "See All" view - available, rented, sold out, and fake products correctly mixed.
        // We no longer filter them out here because the user wants to see everything when they click "See All".

        // Case-insensitive category filter
        if (category) {
            const catLower = category.toLowerCase();
            filtered = filtered.filter((p: any) =>
                (p.category || '').toLowerCase() === catLower
            );
        }

        // Filter by gender — include unisex in both mens and womens
        // Normalize app gender ('womens'/'mens') to DB gender ('women'/'men') for comparison
        if (effectiveGender && effectiveGender !== 'all') {
            filtered = filtered.filter((p: any) => {
                const pGender = (p.gender as string || '').toLowerCase();
                const targetGender = effectiveGender.toLowerCase();
                const dbGender = targetGender === 'womens' ? 'women' : targetGender === 'mens' ? 'men' : targetGender;
                return pGender === dbGender || pGender === targetGender || pGender === 'unisex';
            });
        }

        // Filter by name query
        if (nameQuery.trim() !== "") {
            const q = nameQuery.trim().toLowerCase();
            filtered = filtered.filter((p: any) => p.name.toLowerCase().includes(q));
        }

        // Filter by price
        filtered = filtered.filter((p: any) => {
            const price = getProductPrice(p);
            return price >= priceRange.min && price <= priceRange.max;
        });

        // Filter by brands
        if (selectedBrands.size > 0) {
            filtered = filtered.filter((p: any) => selectedBrands.has(p.brand));
        }

        // Filter by sizes
        if (selectedSizes.size > 0) {
            filtered = filtered.filter((p: any) => {
                if (!p.sizes || p.sizes.length === 0) return false;
                return p.sizes.some((sz: string) => selectedSizes.has(sz));
            });
        }

        // Sort: available first, then rented-out / sold-out, fake products last
        filtered.sort((a, b) => {
            const aFake = (a as any)._isFake === true;
            const bFake = (b as any)._isFake === true;
            const aUnavail = !aFake && (a.isSoldOut || a.isRentedOut);
            const bUnavail = !bFake && (b.isSoldOut || b.isRentedOut);
            if (aFake && !bFake) return 1;
            if (!aFake && bFake) return -1;
            if (aUnavail && !bUnavail) return 1;
            if (!aUnavail && bUnavail) return -1;
            return 0;
        });

        return filtered;
    }, [products, category, selectedSizes, selectedBrands, priceRange, nameQuery, genderFromPath]);

    return (
        <div className="flex flex-col min-h-screen bg-[#050505] text-white">
            <Helmet>
                <title>{`${categoryTitle} | Popclozet`}</title>
                <meta name="description" content={`Shop premium ${categoryTitle.toLowerCase()} fashion. Rent or buy from our exclusive collection.`} />
            </Helmet>
            {/* Header */}
            <div className="sticky top-0 z-50 bg-[#050505]/90 backdrop-blur-xl border-b border-white/5">
                {/* Title row */}
                <div className="flex items-center justify-between px-4 pt-4 pb-2">
                    <div className="flex items-center gap-3">
                        <button onClick={() => navigate(-1)} className="p-1 -ml-1 transition-all active:scale-95">
                            <ChevronLeft className="w-6 h-6 text-white" />
                        </button>
                        <h1 className="text-xl font-bold tracking-tight text-white capitalize">
                            {categoryTitle}
                        </h1>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => navigate('/closet?tab=wishlist')}
                            className="relative p-2.5 rounded-full bg-[#1C1C1E] border border-white/10"
                        >
                            <Heart className="w-4 h-4 text-zinc-400" />
                            {wishlistItems.length > 0 && (
                                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 flex items-center justify-center text-[9px] font-bold text-white bg-[#f2546d] rounded-full px-1 shadow-lg shadow-[#f2546d]/30">
                                    {wishlistItems.length > 9 ? '9+' : wishlistItems.length}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => navigate('/cart')}
                            className="relative p-2.5 rounded-full bg-[#1C1C1E] border border-white/10"
                        >
                            <ShoppingBag className="w-4 h-4 text-zinc-400" />
                            {totalItems > 0 && (
                                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 flex items-center justify-center text-[9px] font-bold text-white bg-[#f2546d] rounded-full px-1 shadow-lg shadow-[#f2546d]/30">
                                    {totalItems > 9 ? '9+' : totalItems}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={openFilters}
                            className="relative p-2.5 rounded-full bg-[#1C1C1E] border border-white/10"
                        >
                            <SlidersHorizontal className="w-5 h-5 text-zinc-400" />
                            {appliedFilterCount > 0 && (
                                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#FF4D6D]" />
                            )}
                        </button>
                    </div>
                </div>

                {/* Search bar row */}
                <div className="px-4 pb-3">
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-2xl bg-[#1C1C1E] border border-white/8">
                        <Search className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                        <input
                            type="text"
                            value={nameQuery}
                            onChange={(e) => setNameQuery(e.target.value)}
                            placeholder={`Search in ${categoryTitle}...`}
                            className="flex-1 bg-transparent text-white text-sm placeholder:text-zinc-600 outline-none min-w-0"
                        />
                        {nameQuery.trim() !== "" && (
                            <button
                                onClick={() => setNameQuery("")}
                                className="flex-shrink-0 p-0.5 rounded-full bg-zinc-700 hover:bg-zinc-600 transition-colors"
                            >
                                <X className="w-3 h-3 text-zinc-300" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Gender Toggle */}
                <div className="flex items-center gap-2 px-4 pb-3">
                    {["mens", "womens"].map((g) => (
                        <button
                            key={g}
                            onClick={() => {
                                localStorage.setItem('activeGender', g);
                                const params = new URLSearchParams(searchParams);
                                navigate(`/shop/${g}?${params.toString()}`, { replace: true });
                            }}
                            className={cn(
                                "flex-1 py-2 rounded-xl text-sm font-bold border transition-all text-center uppercase",
                                effectiveGender === g
                                    ? "bg-[#FF4D6D]/10 border-[#FF4D6D] text-[#FF4D6D]"
                                    : "bg-[#1C1C1E] border-white/10 text-zinc-400"
                            )}
                        >
                            {g === 'mens' ? 'Men' : 'Women'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Product Grid */}
            <div className="flex-1 overflow-y-auto px-4 py-4 pb-28">
                {loading && products.length === 0 ? (
                    <div className="grid grid-cols-2 gap-3">
                        {[...Array(6)].map((_, i) => (
                            <div key={i} className="rounded-2xl overflow-hidden bg-[#1C1C1E] border border-white/5 animate-pulse">
                                <div className="aspect-square md:aspect-[3/4] bg-white/5" />
                                <div className="p-3 space-y-2">
                                    <div className="h-3.5 bg-white/5 rounded-lg w-3/4" />
                                    <div className="h-3 bg-white/5 rounded-lg w-1/2" />
                                    <div className="h-4 bg-white/5 rounded-lg w-1/3" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <>
                        {loading && (
                            <div className="flex justify-center mb-4">
                                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 animate-pulse">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#FF4D6D]" />
                                    <span className="text-[10px] text-zinc-400 uppercase tracking-tighter font-medium">Updating Live...</span>
                                </div>
                            </div>
                        )}
                        {filteredProducts.length === 0 ? (
                            <div className="text-center py-20 text-zinc-400">
                                No products available.
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
                                {filteredProducts.map((product, index) => {
                                    const isFake = (product as any)._isFake === true;
                                    const isSoldOut = product.isSoldOut === true;
                                    const isRentedOut = product.isRentedOut === true;
                                    const isUnavailable = isFake || isSoldOut || isRentedOut;

                                    const imgSrc = product.images?.[0] || (product as any).imageUrl || '';
                                    const optimizedSrc = thumbImage(imgSrc);
                                    const alreadyCached = isImageLoaded(optimizedSrc);

                                    return (
                                        <motion.div
                                            key={product.id}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.05 }}
                                            onClick={() => handleProductClick(product)}
                                            className="relative rounded-2xl overflow-hidden bg-[#1C1C1E] border border-white/5 cursor-pointer group"
                                        >
                                            <div className="aspect-square md:aspect-[3/4] bg-[#2A2A2E] relative overflow-hidden">
                                                {imgSrc ? (
                                                    <>
                                                        {/* Shimmer skeleton — hidden if image already cached */}
                                                        {!alreadyCached && (
                                                            <div className="absolute inset-0 overflow-hidden">
                                                                <div className="absolute inset-y-0 w-1/2 animate-shimmer-slide bg-gradient-to-r from-transparent via-white/5 to-transparent" />
                                                            </div>
                                                        )}
                                                        <img
                                                            src={optimizedSrc}
                                                            alt={product.name}
                                                            className={cn(
                                                                "relative w-full h-full object-cover group-hover:scale-105",
                                                                alreadyCached
                                                                    ? "opacity-100"
                                                                    : "transition-[opacity,transform] duration-300 opacity-0 data-[loaded]:opacity-100"
                                                            )}
                                                            loading={index < 4 ? "eager" : "lazy"}
                                                            fetchPriority={index < 4 ? "high" : "auto"}
                                                            decoding="async"
                                                            onLoad={(e) => {
                                                                e.currentTarget.dataset.loaded = "1";
                                                                markImageLoaded(optimizedSrc);
                                                            }}
                                                        />
                                                    </>
                                                ) : (
                                                    <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center">
                                                        <Heart className="w-8 h-8 text-zinc-700 opacity-50" />
                                                    </div>
                                                )}

                                                {/* Status badge — relocated to top-right */}
                                                {isUnavailable && (
                                                    <div className="absolute top-3 right-3 z-20 p-0 pointer-events-none">
                                                        <span className="bg-black/80 backdrop-blur-md px-2.5 py-1.5 rounded-full border border-white/10 text-[10px] md:text-[11px] font-bold uppercase tracking-wider text-white shadow-2xl flex items-center gap-1.5">
                                                            <span className={cn("h-1.5 w-1.5 rounded-full", isFake ? "bg-blue-400" : isSoldOut ? "bg-zinc-400" : "bg-red-400")} />
                                                            {isFake ? "Coming Soon" : isSoldOut ? "Sold" : "Rented Out"}
                                                        </span>
                                                    </div>
                                                )}

                                                {!isFake && (
                                                    <button
                                                        onClick={(e) => toggleWishlist(product.id, e)}
                                                        className={cn("absolute top-3 p-2 rounded-full bg-black/30 backdrop-blur-sm hover:bg-black/50 transition-all duration-300 z-10", isUnavailable ? "left-3" : "right-3")}
                                                    >
                                                        <Heart
                                                            className={`w-4 h-4 transition-colors ${isInWishlist(product.id)
                                                                ? "text-[#FF4D6D] fill-[#FF4D6D]"
                                                                : "text-white"
                                                                }`}
                                                        />
                                                    </button>
                                                )}
                                            </div>
                                            <div className="p-3">
                                                <h3 className="text-sm font-semibold mb-0.5 truncate text-white">{product.name}</h3>
                                                <p className="text-xs text-zinc-500 mb-2">{product.brand}</p>
                                                <span className="text-base font-bold text-white">
                                                    ₹{product.rental_price_1d ?? product.rentalPrice ?? product.price}
                                                </span>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        )}
                    </>
                )}
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

                        {/* Filter Sheet – slides from top */}
                        <motion.div
                            initial={{ y: "-100%" }}
                            animate={{ y: 0 }}
                            exit={{ y: "-100%" }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            className="fixed top-0 left-0 right-0 z-50 max-w-[430px] mx-auto pt-[56px]"
                        >
                            <div className="bg-[#2A2A2E] rounded-b-3xl px-5 py-5 shadow-2xl">
                                {/* Tab pills */}
                                <div className="flex items-center gap-3 mb-5">
                                    {(["size", "price", "brand"] as FilterTab[])
                                        .filter((tab) => {
                                            if (tab === "size") return availableSizes.length > 0;
                                            if (tab === "brand") return availableBrands.length > 0;
                                            return true; // price always
                                        })
                                        .map((tab) => (
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
                                {activeFilterTab === "size" && availableSizes.length > 0 && (
                                    <div className="grid grid-cols-4 gap-2.5">
                                        {availableSizes.filter(s => s && s.trim() !== "").map((size) => {
                                            return (
                                                <button
                                                    key={size}
                                                    onClick={() => toggleSize(size)}
                                                    className={cn(
                                                        "h-11 rounded-xl text-sm font-bold border transition-all flex items-center justify-center uppercase truncate px-1",
                                                        tempSelectedSizes.has(size)
                                                            ? "bg-[#FF4D6D]/10 border-[#FF4D6D] text-[#FF4D6D]"
                                                            : "bg-[#1C1C1E] border-white/10 text-zinc-400 hover:border-white/20"
                                                    )}
                                                >
                                                    {size}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* === Price Tab === */}
                                {activeFilterTab === "price" && (
                                    <div className="space-y-5">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="rounded-2xl border border-white/10 bg-[#1C1C1E] px-4 py-3">
                                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                                                    Min
                                                </p>
                                                <p className="mt-1 text-base font-bold text-white">
                                                    {formatCurrency(tempPriceRange.min)}
                                                </p>
                                            </div>
                                            <div className="rounded-2xl border border-white/10 bg-[#1C1C1E] px-4 py-3">
                                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                                                    Max
                                                </p>
                                                <p className="mt-1 text-base font-bold text-white">
                                                    {formatCurrency(tempPriceRange.max)}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="rounded-2xl border border-white/10 bg-[#1C1C1E] px-4 py-5">
                                            <Slider
                                                value={[tempPriceRange.min, tempPriceRange.max]}
                                                min={DEFAULT_PRICE_RANGE.min}
                                                max={MAX_PRICE_LIMIT}
                                                step={PRICE_STEP}
                                                minStepsBetweenThumbs={1}
                                                onValueChange={(values) => {
                                                    if (values.length !== 2) return;
                                                    setClampedTempPriceRange(values[0], values[1]);
                                                }}
                                                className="my-1"
                                            />
                                            <div className="mt-3 flex items-center justify-between text-[11px] font-medium text-zinc-500">
                                                <span>{formatCurrency(DEFAULT_PRICE_RANGE.min)}</span>
                                                <span>{formatCurrency(MAX_PRICE_LIMIT)}</span>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2">
                                            {PRICE_PRESETS.map((preset) => {
                                                const isActive =
                                                    tempPriceRange.min === preset.min &&
                                                    tempPriceRange.max === preset.max;

                                                return (
                                                    <button
                                                        key={preset.label}
                                                        onClick={() => setClampedTempPriceRange(preset.min, preset.max)}
                                                        className={cn(
                                                            "rounded-xl border px-3 py-2.5 text-xs font-semibold transition-all",
                                                            isActive
                                                                ? "border-[#FF4D6D] bg-[#FF4D6D]/10 text-[#FF4D6D]"
                                                                : "border-white/10 bg-[#1C1C1E] text-zinc-300 hover:border-white/20"
                                                        )}
                                                    >
                                                        {preset.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* === Brand Tab === */}
                                {activeFilterTab === "brand" && (
                                    <div>
                                        <div className="grid grid-cols-3 gap-2.5">
                                            {availableBrands.map((brand) => (
                                                <button
                                                    key={brand}
                                                    onClick={() => toggleBrand(brand)}
                                                    className={cn(
                                                        "text-xs font-bold py-2.5 rounded-xl border transition-all text-center px-1 truncate",
                                                        tempSelectedBrands.has(brand)
                                                            ? "bg-[#FF4D6D]/10 border-[#FF4D6D] text-[#FF4D6D]"
                                                            : "bg-transparent border-white/10 text-zinc-400"
                                                    )}
                                                >
                                                    {brand}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* filter footer buttons */}
                                <div className="mt-5 flex justify-end gap-3">
                                    <button
                                        className="px-4 py-2 text-sm font-semibold rounded-lg bg-zinc-800 text-zinc-300 hover:text-white"
                                        onClick={resetFilters}
                                    >
                                        Reset
                                    </button>
                                    <button
                                        className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#FF4D6D] text-white hover:bg-[#FF3355]"
                                        onClick={handleApplyFilters}
                                    >
                                        Apply ({stagedFilterCount})
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};

export default CategoryProductsPage;
