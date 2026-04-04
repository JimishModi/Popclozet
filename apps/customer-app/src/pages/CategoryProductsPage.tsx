import React, { useState, useEffect, useCallback, useMemo } from "react";
import { thumbImage } from "@/lib/optimizeImage";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useSearchParams, useParams } from "react-router-dom";
import { MobileShell } from "@/components/layout/MobileShell";
import { ChevronLeft, SlidersHorizontal, Loader, Search, X, ShoppingBag, Heart } from "lucide-react";
import { ClosetIcon } from "@/components/icons/ClosetIcon";
import { cn } from "@/lib/utils";
import { supabase } from "@popclozet/api-client";
import type { Product } from "@/services/productService";
import { fetchRotatedFakeProducts } from "@/services/fakeProductMixService";
import { getProductsByCategoryDB, cacheProductsBatchDB } from "@/lib/db";



import { useCart } from "@/context/CartContext";

type FilterTab = "size" | "price" | "brand";

const CategoryProductsPage: React.FC = () => {
    const navigate = useNavigate();
    const { totalItems } = useCart();
    const [searchParams] = useSearchParams();
    const { gender: genderFromPath } = useParams();

    // Category and title from search params
    const category = searchParams.get('category') || '';
    const brandParam = searchParams.get('brand') || '';
    const categoryTitle = searchParams.get('title') || (category ? category.charAt(0).toUpperCase() + category.slice(1) : (brandParam || 'Products'));

    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true); // Start true so skeleton shows immediately, no flash of empty state

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
    const [wishlist, setWishlist] = useState<Set<string>>(new Set());
    const [showFilters, setShowFilters] = useState(false);
    const [activeFilterTab, setActiveFilterTab] = useState<FilterTab>("size");

    // Filter states (applied)
    const [selectedSizes, setSelectedSizes] = useState<Set<string>>(new Set());
    const [priceRange, setPriceRange] = useState({ min: 0, max: 2000 });
    const [selectedBrands, setSelectedBrands] = useState<Set<string>>(new Set());

    // Staging states (for modal)
    const [tempSelectedSizes, setTempSelectedSizes] = useState<Set<string>>(new Set());
    const [tempPriceRange, setTempPriceRange] = useState({ min: 0, max: 2000 });
    const [tempSelectedBrands, setTempSelectedBrands] = useState<Set<string>>(new Set());


    const [nameQuery, setNameQuery] = useState(""); // text search by name

    const maxAvailablePrice = 2000;

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
                gender: genderFromPath,
                nameQuery: nameQuery,
                brands: Array.from(selectedBrands),
                sizes: Array.from(selectedSizes),
            });
        }, 400); // 400ms debounce

        return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [category, genderFromPath, nameQuery, priceRange.min, priceRange.max, brandsKey, sizesKey]);

    // Fix: Ensure priceRange stays within the 2000 limit for UI consistency
    useEffect(() => {
        if (priceRange.max > 2000) {
            setPriceRange(prev => ({ ...prev, max: 2000 }));
            setTempPriceRange(prev => ({ ...prev, max: 2000 }));
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

        let query = supabase
            .from('products')
            .select('*, inventory(available_stock)')
            .eq('is_available', true);

        if (filters.category) {
            query = query.eq('category', filters.category);
        }

        if (dbGender && dbGender !== 'all') {
            query = query.in('gender', [dbGender, 'unisex']);
        }

        // Backend name search — filter at DB level
        if (filters.nameQuery && filters.nameQuery.trim() !== '') {
            query = query.ilike('name', `%${filters.nameQuery.trim()}%`);
        }
        try {
            const { data, error } = await query;

            if (error) {
                console.error('❌ Supabase error:', error.message);
                setLoading(false);
                return;
            }

            if (data) {
                const mapped = data.map((p: any) => ({
                    ...p,
                    price: parseFloat(p.rental_price ?? p.price ?? '0'),
                    rentalPrice: parseFloat(p.rental_price ?? p.price ?? '0'),
                    imageUrl: p.images?.[0] || '',
                    // Map DB 'sizes_available' to app 'sizes'
                    sizes: p.sizes_available ? (Array.isArray(p.sizes_available) ? p.sizes_available : (typeof p.sizes_available === 'object' ? Object.values(p.sizes_available) : [])) : [],
                    // Normalize DB gender ('men'/'women') back to app gender ('mens'/'womens')
                    gender: p.gender === 'men' ? 'mens' : (p.gender === 'women' ? 'womens' : p.gender),
                    isRentedOut: (p.inventory || []).length > 0 && (p.inventory || []).reduce((acc: number, item: any) => acc + (item.available_stock || 0), 0) === 0
                }));

                // Show real products immediately, then mix in fakes
                setProducts(mapped);

                // Update local cache for next time (non-blocking, real products only)
                if (mapped.length > 0) {
                    cacheProductsBatchDB(mapped);
                }

                // Non-blocking: fetch fake "currently rented" products and mix in
                if (filters.category) {
                    const fakeCount = Math.max(3, Math.floor(mapped.length * 0.5));
                    fetchRotatedFakeProducts(filters.category, undefined, fakeCount).then(fakes => {
                        if (fakes.length > 0) {
                            setProducts(prev => {
                                // Avoid duplicates if called multiple times
                                const existingIds = new Set(prev.map(p => p.id));
                                const newFakes = fakes.filter(f => !existingIds.has(f.id));
                                if (newFakes.length === 0) return prev;
                                // Shuffle fakes into the list at random positions
                                const merged = [...prev];
                                for (const fake of newFakes) {
                                    const pos = Math.floor(Math.random() * (merged.length + 1));
                                    merged.splice(pos, 0, fake);
                                }
                                return merged;
                            });
                        }
                    }).catch(() => { /* silent degradation */ });
                }
            }
        } catch (err) {
            console.error('CRITICAL: Supabase fetch failed:', err);
        } finally {
            setLoading(false);
        }
    };

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

    const handleProductClick = (productId: string) => {
        navigate(`/product/${productId}`);
    };

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
        setPriceRange({ min: 0, max: 2000 });
        setTempSelectedSizes(new Set());
        setTempSelectedBrands(new Set());
        setTempPriceRange({ min: 0, max: 2000 });
        setNameQuery("");
    }

    const filteredProducts = useMemo(() => {
        let filtered = [...products];

        // Case-insensitive category filter — fake products have "Jackets", URL has "jackets"
        if (category) {
            const catLower = category.toLowerCase();
            filtered = filtered.filter((p: any) => 
                (p.category || '').toLowerCase() === catLower
            );
        }

        // Filter by gender — include unisex in both mens and womens
        // Skip for fake products (they show for all genders)
        if (genderFromPath && genderFromPath !== 'all') {
            filtered = filtered.filter((p: any) => {
                if ((p as any)._isFake) return true; // fakes always visible
                return !p.gender || p.gender === genderFromPath || p.gender === 'unisex';
            });
        }

        // Filter by name query
        if (nameQuery.trim() !== "") {
            const q = nameQuery.trim().toLowerCase();
            filtered = filtered.filter((p: any) => p.name.toLowerCase().includes(q));
        }

        // Filter by price — skip for fake products (they don't have standardised pricing)
        filtered = filtered.filter((p: any) => {
            if ((p as any)._isFake) return true;
            const price = p.price || p.rental_price || 0;
            return price >= priceRange.min && price <= priceRange.max;
        });

        // Filter by brands
        if (selectedBrands.size > 0) {
            filtered = filtered.filter((p: any) => selectedBrands.has(p.brand));
        }

        // Filter by sizes — skip for fake products (they have no sizes)
        if (selectedSizes.size > 0) {
            filtered = filtered.filter((p: any) => {
                if ((p as any)._isFake) return false; // fake = no sizes = excluded when size filter active
                if (!p.sizes || p.sizes.length === 0) return false;
                return p.sizes.some((sz: string) => selectedSizes.has(sz));
            });
        }

        return filtered;
    }, [products, category, selectedSizes, selectedBrands, priceRange, nameQuery, genderFromPath]);

    return (
        <div className="flex flex-col min-h-screen bg-[#050505] text-white">
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
                            className="p-2.5 rounded-full bg-[#1C1C1E] border border-white/10"
                        >
                            <ClosetIcon className="w-4 h-4 text-zinc-400" />
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
                            {(selectedSizes.size > 0 || selectedBrands.size > 0 || priceRange.min !== 0 || priceRange.max !== maxAvailablePrice) && (
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
                                genderFromPath === g
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
                                    // _isFake = product from fake_products table (simulated "rented" items)
                                    // isRentedOut = REAL product with zero available stock
                                    const isFake = (product as any)._isFake === true;
                                    const isRealRentedOut = !isFake && (product as any).isRentedOut === true;
                                    const imgSrc = product.images?.[0] || (product as any).imageUrl || '';
                                    return (
                                    <motion.div
                                        key={product.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                        onClick={() => isFake
                                            ? navigate(`/product/${product.id}`, { state: { fakeProduct: product, isRented: true } })
                                            : handleProductClick(product.id)
                                        }
                                        className="relative rounded-2xl overflow-hidden bg-[#1C1C1E] border border-white/5 cursor-pointer group"
                                    >
                                        <div className="aspect-square md:aspect-[3/4] bg-[#2A2A2E] relative overflow-hidden">
                                            {imgSrc ? (
                                                <img
                                                    src={thumbImage(imgSrc)}
                                                    alt={product.name}
                                                    className={cn(
                                                        "w-full h-full object-cover transition-transform duration-300",
                                                        // Only blur FAKE products — real rented-out stays crisp (NOW: Blur removed as requested)
                                                        isFake
                                                            ? "grayscale opacity-25"
                                                            : "group-hover:scale-105"
                                                    )}
                                                    loading="lazy"
                                                />
                                            ) : (
                                                <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center">
                                                    <Heart className="w-8 h-8 text-zinc-700 opacity-50" />
                                                </div>
                                            )}

                                            {/* Fake product — "Currently Rented" with blur overlay */}
                                            {isFake && (
                                                <div className="absolute top-2 left-2 z-10">
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white backdrop-blur-sm">
                                                        <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                                                        Currently Rented
                                                    </span>
                                                </div>
                                            )}

                                            {/* Real product that is rented out — badge only, no blur */}
                                            {isRealRentedOut && (
                                                <div className="absolute top-2 left-2 z-10">
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-red-500/90 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white backdrop-blur-sm">
                                                        <span className="h-1.5 w-1.5 rounded-full bg-white/50" />
                                                        Rented Out
                                                    </span>
                                                </div>
                                            )}

                                            {/* Wishlist — visible for all non-fake products */}
                                            {!isFake && (
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
                                            )}
                                        </div>
                                        <div className="p-3">
                                            <h3 className={cn("text-sm font-semibold mb-0.5 truncate", isFake ? "text-zinc-500" : "text-white")}>{product.name}</h3>
                                            <p className="text-xs text-zinc-500 mb-2">{product.brand}</p>
                                            {isFake ? (
                                                <span className="text-xs text-zinc-600 font-medium">Currently Unavailable</span>
                                            ) : isRealRentedOut ? (
                                                <span className="text-xs text-red-500 font-medium">All Rented — Check Back Soon</span>
                                            ) : (
                                                <span className="text-base font-bold text-white">₹{product.rental_price_1d ?? product.rentalPrice ?? product.price}</span>
                                            )}
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
                                            const isSelected = selectedSizes.has(size);
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
                                        {/* Min / Max inputs */}
                                        <div className="flex gap-3">
                                            <input
                                                type="text"
                                                value={`Min : ₹ ${tempPriceRange.min}`}
                                                readOnly
                                                className="flex-1 px-4 py-2.5 rounded-xl bg-transparent border border-zinc-600 text-white text-sm font-medium text-center"
                                            />
                                            <input
                                                type="text"
                                                value={`Max : ₹ ${tempPriceRange.max}`}
                                                readOnly
                                                className="flex-1 px-4 py-2.5 rounded-xl bg-transparent border border-zinc-600 text-white text-sm font-medium text-center"
                                            />
                                        </div>

                                        {/* Range slider track */}
                                        <div className="relative pt-3 pb-1 px-1 overflow-hidden">
                                            {/* Track background with dots */}
                                            <div className="relative h-[2px] bg-zinc-600 rounded-full">
                                                {/* Active track */}
                                                <div
                                                    className="absolute h-full bg-[#FF4D6D] rounded-full"
                                                    style={{
                                                        left: `${(tempPriceRange.min / 2000) * 100}%`,
                                                        width: `${((tempPriceRange.max - tempPriceRange.min) / 2000) * 100}%`
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
                                                    className="absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-zinc-400 rounded-full border-[3px] border-[#FF4D6D] shadow-md z-10"
                                                    style={{
                                                        left: `calc(${(tempPriceRange.min / 2000) * 100}% - 10px)`,
                                                        pointerEvents: 'none' // visuals only
                                                    }}
                                                />
                                                {/* Max handle */}
                                                <div
                                                    className="absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-zinc-400 rounded-full border-[3px] border-[#FF4D6D] shadow-md z-10"
                                                    style={{
                                                        left: `calc(${(tempPriceRange.max / 2000) * 100}% - 10px)`,
                                                        pointerEvents: 'none' // visuals only
                                                    }}
                                                />
                                            </div>
                                            {/* Invisible range inputs */}
                                            <input
                                                type="range"
                                                min="0"
                                                max="2000"
                                                step="500"
                                                value={tempPriceRange.min}
                                                onChange={(e) => {
                                                    const val = Number(e.target.value);
                                                    setTempPriceRange(prev => ({
                                                        ...prev,
                                                        min: Math.min(val, prev.max - 1)
                                                    }));
                                                }}
                                                className="absolute top-0 left-0 w-full h-8 opacity-0 cursor-pointer z-30"
                                                style={{ pointerEvents: tempPriceRange.min > 1000 ? 'auto' : 'none' }}
                                            />
                                            <input
                                                type="range"
                                                min="0"
                                                max="2000"
                                                step="500"
                                                value={tempPriceRange.max}
                                                onChange={(e) => {
                                                    const val = Number(e.target.value);
                                                    setTempPriceRange(prev => ({
                                                        ...prev,
                                                        max: Math.max(val, prev.min + 1)
                                                    }));
                                                }}
                                                className="absolute top-0 left-0 w-full h-8 opacity-0 cursor-pointer z-20"
                                            />
                                            {/* Supplementary input for Min when it's on the left to ensure it's always pickable */}
                                            <input
                                                type="range"
                                                min="0"
                                                max="2000"
                                                step="500"
                                                value={tempPriceRange.min}
                                                onChange={(e) => {
                                                    const val = Number(e.target.value);
                                                    setTempPriceRange(prev => ({
                                                        ...prev,
                                                        min: Math.min(val, prev.max - 1)
                                                    }));
                                                }}
                                                className="absolute top-0 left-0 w-full h-8 opacity-0 cursor-pointer z-40"
                                                style={{ width: '50%', pointerEvents: tempPriceRange.min <= 1000 ? 'auto' : 'none' }}
                                            />
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
                                        Apply ({tempSelectedSizes.size + tempSelectedBrands.size})
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
