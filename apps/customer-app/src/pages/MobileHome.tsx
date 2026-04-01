import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { ChevronRight, Search, Heart, Bell } from "lucide-react";
import { useWishlist } from "@/context/WishlistContext";
import { useCart } from "@/context/CartContext";
import { ClosetIcon } from "@/components/icons/ClosetIcon";
import { useNavigate } from "react-router-dom";
import { locationStorage } from "@/lib/locationStorage";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/useNotifications";
import { usePersistentGender } from "@/hooks/usePersistentGender";
import type { GenderType } from "@/components/ui/GenderSelector";
import { GenderSelector } from "@/components/ui/GenderSelector";
import { productService, Product } from "@/services/productService";
import { ActiveDeliveryBanner } from "@/components/ActiveDeliveryBanner";
import popclozetLogo from "@/logo/popclozet-logo.svg";
import useNearbyHubs from "@/hooks/useNearbyHubs";

const FEATURED_SLIDES = [
    { id: 0, title: "New Arrivals", image: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&q=80", gender: "womens" },
    { id: 1, title: "Trending Now", image: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800&q=80", gender: "womens" },
    { id: 2, title: "Party Collection", image: "https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?w=800&q=80", gender: "womens" },

    { id: 3, title: "Men's Streetwear", image: "https://images.unsplash.com/photo-1488161628813-04466f872be2?w=800&q=80", gender: "mens" },
    { id: 4, title: "Formal Classics", image: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=800&q=80", gender: "mens" },
    { id: 5, title: "Party Collection", image: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=800&q=80", gender: "mens" },

];



const ABOUT_US_SLIDES: { id: number; title: string; icon: React.ReactNode }[] = [
    {
        id: 0, title: "Post Cleaning", icon: <img src="/icons/icon-4.png" className="w-full h-full object-cover" alt="Post Cleaning" />,
    },
    {
        id: 1, title: "Sanitization", icon: <img src="/icons/icon-3.png" className="w-full h-full object-cover" alt="Sanitization" />,
    },
    {
        id: 2, title: "Pre Cleaning", icon: <img src="/icons/icon-2.png" className="w-full h-full object-cover" alt="Pre Cleaning" />,
    },
    {
        id: 3, title: "Quality Check", icon: <img src="/icons/icon-1.png" className="w-full h-full object-cover" alt="Quality Check" />,
    },
];

const MobileHome: React.FC = () => {
    const navigate = useNavigate();
    const [activeSlide, setActiveSlide] = useState(1);
    const [activeGender, setActiveGender] = usePersistentGender("womens");
    const [activeAboutSlide, setActiveAboutSlide] = useState(0);
    const [userLocation, setUserLocation] = useState("Detecting...");
    const [userCoords, setUserCoords] = useState<{ lat: number, lng: number } | null>(null);
    const [isInServiceArea, setIsInServiceArea] = useState<boolean | null>(null);
    const [brands, setBrands] = useState<string[]>([]);
    const [catalogueProducts, setCatalogueProducts] = useState<Product[]>([]);
    const [loadingCatalogue, setLoadingCatalogue] = useState(true);
    const [catalogueError, setCatalogueError] = useState(false);
    const catalogueRetryCount = useRef(0);
    const [deliveryEstimate, setDeliveryEstimate] = useState<'15min' | 'delayed'>('15min');
    const [collections, setCollections] = useState<{ id: string; title: string; image: string }[]>([]);

    const { selectedHub } = useNearbyHubs({
        lat: userCoords?.lat,
        lng: userCoords?.lng,
        enabled: !!userCoords
    });
    // Show delayed delivery only when delivery address is outside 6km radius of warehouse (Hostel No 2, IIT Bombay)
    const isDelayed = selectedHub ? selectedHub.distance_km > 6 : false;
    const { user } = useAuth();
    const { addToWishlist, removeFromWishlist, isInWishlist, wishlistItems } = useWishlist();
    const { totalItems: cartCount } = useCart();
    const wishlistCount = wishlistItems.length;
    const { unreadCount } = useNotifications({ limit: 5, autoSubscribe: true });

    const toggleWishlist = (productId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (isInWishlist(productId)) {
            removeFromWishlist(productId);
        } else {
            addToWishlist(productId);
        }
    };

    const isWishlisted = (productId: string) => isInWishlist(productId);

    // Filter featured slides based on gender
    const filteredSlides = React.useMemo(() => {
        return FEATURED_SLIDES.filter(s => s.gender === activeGender || s.gender === "unisex");
    }, [activeGender]);

    // Load categories from the products table
    useEffect(() => {
        productService.getCategories().then(setCollections);
    }, []);

    // Auto-rotate featured slides - Reset timer on slide change (manual or auto)
    useEffect(() => {
        const interval = setInterval(() => {
            setActiveSlide((prev) => (prev + 1) % filteredSlides.length);
        }, 3000);
        return () => clearInterval(interval);
    }, [filteredSlides.length, activeSlide]);

    // Load persisted delivery estimate
    useEffect(() => {
        const stored = locationStorage.get();
        if (stored && (stored as any).delivery_estimate) {
            setDeliveryEstimate((stored as any).delivery_estimate);
        }
    }, []);

    // Sync delivery estimate from profile
    useEffect(() => {
        if (user) {
            const fetchProfile = async () => {
                const { getCurrentProfile } = await import("@/services/profileService");
                const profile = await getCurrentProfile(user.id);
                if (profile?.delivery_estimate) {
                    console.log('👤 Profile Delivery Estimate:', profile.delivery_estimate);
                    setDeliveryEstimate(profile.delivery_estimate);
                }
            };
            fetchProfile();
        }
    }, [user]);


    // Auto-detect location using GPS + Mappls reverse geocoding
    useEffect(() => {
        let cancelled = false;

        // Timeout: if detection takes >8s, show fallback text
        const timeout = setTimeout(() => {
            if (!cancelled) setUserLocation(prev => prev === "Detecting..." ? "Select Location" : prev);
        }, 8000);

        const detectLocation = async () => {
            try {
                // If we already have a location saved, just use it and skip GPS
                const stored = locationStorage.get();
                if (stored && stored.city) {
                    const displayLocation = stored.locality && stored.locality !== stored.city
                        ? `${stored.locality}, ${stored.city}`
                        : stored.city;
                    if (!cancelled) {
                        setUserLocation(displayLocation);
                        if ('lat' in stored && 'lng' in stored && stored.lat && stored.lng) {
                            setUserCoords({ lat: stored.lat as number, lng: stored.lng as number });
                        }
                        if ((stored as any).delivery_estimate) {
                            console.log('📦 Stored Delivery Estimate:', (stored as any).delivery_estimate);
                            setDeliveryEstimate((stored as any).delivery_estimate);
                        }
                    }
                    return; // Skip GPS detection entirely
                }

                // Only hit GPS + reverse geocode if we have no location at all
                const { autoDetectLocation } = await import("@popclozet/map-core");
                const result = await autoDetectLocation();

                if (cancelled) return;

                if (result) {
                    const displayLocation = result.locality !== result.city
                        ? `${result.locality}, ${result.city}`
                        : result.city;
                    setUserLocation(displayLocation);
                    setIsInServiceArea(result.isInServiceArea);

                    setUserCoords({ lat: result.lat, lng: result.lng });

                    // Recalculate Road Distance for New Detection
                    try {
                        const { getRoadDistance } = await import("@/services/mapServices");
                        const WAREHOUSE_COORDS = { lat: 19.1305, lng: 72.9135 };
                        const distRes = await getRoadDistance(WAREHOUSE_COORDS, {
                            lat: result.lat,
                            lng: result.lng
                        });

                        let estimate: '15min' | 'delayed' = '15min';
                        if (distRes.status === 'success') {
                            estimate = distRes.distanceKm > 6 ? 'delayed' : '15min';
                            console.log(`🌐 Auto-detected Road Distance: ${distRes.distanceKm.toFixed(2)}km -> ${estimate}`);
                        }

                        if (!cancelled) setDeliveryEstimate(estimate);

                        locationStorage.set({
                            source: "gps",
                            lat: result.lat,
                            lng: result.lng,
                            city: result.city,
                            locality: result.locality,
                            delivery_estimate: estimate
                        });
                    } catch (err) {
                        console.warn('Auto-detect distance calc failed:', err);
                        locationStorage.set({
                            source: "gps",
                            lat: result.lat,
                            lng: result.lng,
                            city: result.city,
                            locality: result.locality,
                        });
                    }
                } else {
                    setUserLocation("Select Location");
                }
            } catch (error) {
                console.error("Location detection failed:", error);
                if (cancelled) return;
                const stored = locationStorage.get();
                if (stored?.source === "manual") {
                    setUserLocation(stored.city);
                } else {
                    setUserLocation("Select Location");
                }
            }
        };

        detectLocation();
        return () => { cancelled = true; clearTimeout(timeout); };
    }, []);

    // Fetch brands from database
    useEffect(() => {
        const fetchBrands = async () => {
            try {
                const uniqueBrands = await productService.getUniqueBrands(activeGender);
                setBrands(uniqueBrands);
            } catch (error) {
                console.error("Failed to fetch brands:", error);
            }
        };
        fetchBrands();
    }, [activeGender]);

    // Fetch catalogue products from database (with retry on failure)
    const fetchCatalogue = useCallback(async (isRetry = false) => {
        if (!isRetry) setCatalogueError(false);
        setLoadingCatalogue(true);
        try {
            const products = await productService.getProductsByGender(activeGender);
            if (products.length > 0) {
                setCatalogueProducts(products.slice(0, 4));
                catalogueRetryCount.current = 0;
            } else if (catalogueRetryCount.current < 2) {
                // Products came back empty — might be a stale IDB on fresh install.
                // Try a full sync then re-fetch.
                catalogueRetryCount.current += 1;
                console.log(`🔄 Empty product list, syncing... (attempt ${catalogueRetryCount.current})`);
                await productService.syncProducts();
                const synced = await productService.getProductsByGender(activeGender);
                setCatalogueProducts(synced.slice(0, 4));
            }
        } catch (error) {
            console.error("Failed to fetch catalogue products:", error);
            setCatalogueError(true);
        } finally {
            setLoadingCatalogue(false);
        }
    }, [activeGender]);

    useEffect(() => {
        catalogueRetryCount.current = 0;
        fetchCatalogue();
    }, [fetchCatalogue]);

    // Auto-switch About Us slides
    useEffect(() => {
        const interval = setInterval(() => {
            setActiveAboutSlide((prev) => (prev + 1) % ABOUT_US_SLIDES.length);
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="bg-black text-white min-h-screen">
            <header className="sticky top-0 z-[60] bg-gradient-to-b from-black/80 to-transparent backdrop-blur-md px-4 py-2 md:py-3 flex items-center justify-between">
                <div className="flex items-center">
                    <img src={popclozetLogo} alt="Popclozet" className="h-10 w-auto object-contain" />
                </div>
            </header>

            {/* Main Scrollable Content */}
            <main className="flex-1 overflow-y-auto pb-24">

                {/* ─── HEADER: Delivery Time + Location + Actions ─── */}
                <section className="relative px-4 pt-3 pb-3 md:px-5 md:pt-4 md:pb-4">

                    <div className="relative flex items-end justify-between">
                        {/* Left: Delivery badge + location */}
                        <div
                            className={cn(
                                "flex flex-col gap-0.5 cursor-pointer transition-all duration-500",
                                isDelayed && "drop-shadow-[0_0_8px_rgba(245,158,11,0.2)]"
                            )}
                            onClick={() => navigate('/checkout/address', { state: { returnTo: '/home' } })}
                        >
                            <span className={cn(
                                "text-[10px] md:text-xs font-bold tracking-wider uppercase opacity-70",
                                isDelayed ? "text-amber-500" : "text-[#f2546d]"
                            )}>
                                {isDelayed ? "Expected" : "Delivery in"}
                            </span>
                            <div className="flex items-center gap-2">
                                <h1 className={cn(
                                    "font-bold leading-none tracking-tight transition-all duration-500 flex items-center gap-1.5 md:gap-2",
                                    isDelayed ? "text-amber-500 text-lg md:text-2xl" : "text-white text-2xl md:text-3xl"
                                )}>
                                    {isDelayed ? (
                                        <>
                                            <span className="text-lg md:text-xl">🕐</span>
                                            <span>Delayed Delivery</span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="text-[#f2546d]">⚡</span>
                                            <span>60 Minutes</span>
                                        </>
                                    )}
                                </h1>
                            </div>
                            <div className="flex items-center gap-1 mt-0.5 md:gap-1.5">
                                <svg className={cn("w-3 h-3 md:w-3.5 md:h-3.5 transition-colors", isDelayed ? "text-amber-500/70" : "text-white/60")} viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z" />
                                </svg>
                                <span className="text-[11px] md:text-xs font-semibold text-white/80 tracking-tight">
                                    {userLocation}
                                </span>
                            </div>
                        </div>


                        {/* Right: Action buttons */}
                        <div className="flex items-center gap-2 mb-1">
                            <button
                                onClick={() => navigate('/notifications')}
                                className="relative w-8 h-8 md:w-10 md:h-10 flex items-center justify-center bg-[#303135] rounded-full transition-colors hover:bg-[#404045]"
                            >
                                <Bell className="w-3.5 h-3.5 md:w-4 md:h-4 text-white/80" />
                                {unreadCount > 0 && (
                                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 flex items-center justify-center text-[9px] font-bold text-white bg-[#f2546d] rounded-full px-1 shadow-lg shadow-[#f2546d]/30">
                                        {unreadCount > 9 ? '9+' : unreadCount}
                                    </span>
                                )}
                            </button>                            <button
                                onClick={() => navigate('/closet?tab=wishlist')}
                                className="relative w-8 h-8 md:w-10 md:h-10 flex items-center justify-center bg-[#303135] rounded-full transition-colors hover:bg-[#404045]"
                            >
                                <ClosetIcon className="w-3.5 h-3.5 md:w-4 md:h-4 text-white/80" />
                                {wishlistCount > 0 && (
                                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 flex items-center justify-center text-[9px] font-bold text-white bg-[#f2546d] rounded-full px-1 shadow-lg shadow-[#f2546d]/30">
                                        {wishlistCount > 9 ? '9+' : wishlistCount}
                                    </span>
                                )}
                            </button>
                            <button
                                onClick={() => navigate('/cart')}
                                className="relative w-8 h-8 md:w-10 md:h-10 flex items-center justify-center bg-[#303135] rounded-full transition-colors hover:bg-[#404045]"
                            >
                                <svg className="w-3.5 h-3.5 md:w-4 md:h-4 text-white/80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
                                    <line x1="3" y1="6" x2="21" y2="6" />
                                    <path d="M16 10a4 4 0 01-8 0" />
                                </svg>
                                {cartCount > 0 && (
                                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 flex items-center justify-center text-[9px] font-bold text-white bg-[#f2546d] rounded-full px-1 shadow-lg shadow-[#f2546d]/30">
                                        {cartCount > 9 ? '9+' : cartCount}
                                    </span>
                                )}
                            </button>
                        </div>
                    </div>
                </section>


                {/* ─── GENDER SELECTOR ─── */}
                <section className="px-4 mt-5 md:px-5 md:mt-6">
                    <GenderSelector
                        value={activeGender as GenderType}
                        onChange={(g) => setActiveGender(g)}
                    />
                </section>



                {/* ─── SEARCH: Clickable Pill → opens /search ─── */}
                <section className="px-4 mt-4 md:px-5 md:mt-5">
                    <div
                        onClick={() => navigate('/search')}
                        className="flex items-center bg-[#232323] rounded-full shadow-[0px_4px_4px_rgba(0,0,0,0.25)] h-10 md:h-12 cursor-pointer hover:bg-[#2a2a2a] transition-colors"
                    >
                        <div
                            className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center bg-[#3a3a3a] rounded-full shadow-[0px_0px_4px_#f2546d] flex-shrink-0"
                        >
                            <Search className="w-4 h-4 md:w-[18px] md:h-[18px] text-white/90" />
                        </div>
                        <span className="ml-3 md:ml-4 text-[11px] md:text-sm text-zinc-500 font-medium tracking-tight">
                            Search for dresses, tops, brands...
                        </span>
                    </div>
                </section>


                {/* ─── ACTIVE DELIVERY BANNER ─── */}
                <ActiveDeliveryBanner />

                {/* ─── FEATURED CAROUSEL: 3-Card Peek with Swipe Support ─── */}
                <section className="mt-5 md:mt-8 overflow-hidden">
                    <motion.div 
                        className="overflow-hidden w-full relative flex items-center justify-center h-[240px] md:h-[348px] touch-pan-y"
                        onPanEnd={(e, info) => {
                            const threshold = 50;
                            if (info.offset.x > threshold) {
                                // Swipe Right -> Previous Slide
                                setActiveSlide(prev => (prev - 1 + filteredSlides.length) % filteredSlides.length);
                            } else if (info.offset.x < -threshold) {
                                // Swipe Left -> Next Slide
                                setActiveSlide(prev => (prev + 1) % filteredSlides.length);
                            }
                        }}
                    >

                        {/* Side cards + Center card */}
                        <div className="flex items-center gap-3 md:gap-6" style={{ width: '100%', justifyContent: 'center' }}>
                            {/* Left peek card */}
                            <motion.div
                                className="w-[30px] h-[160px] md:w-[40px] md:h-[220px] bg-zinc-900 rounded-2xl flex-shrink-0 overflow-hidden"
                                animate={{ opacity: 0.4, scale: 0.9 }}
                            >
                                <img
                                    src={filteredSlides[(activeSlide + filteredSlides.length - 1) % filteredSlides.length].image}
                                    alt="Previous"
                                    className="w-full h-full object-cover grayscale blur-[2px]"
                                />
                            </motion.div>

                            {/* Center card (active) */}
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={activeSlide}
                                    initial={{ opacity: 0, scale: 0.95, x: 20 }}
                                    animate={{ opacity: 1, scale: 1, x: 0 }}
                                    exit={{ opacity: 0, scale: 1.05, x: -20 }}
                                    transition={{ duration: 0.4, ease: "easeOut" }}
                                    className="relative w-[220px] h-[220px] md:w-[260px] md:h-[340px] rounded-[24px] md:rounded-[32px] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] cursor-pointer bg-zinc-900"
                                    onClick={() => {
                                        const slide = filteredSlides[activeSlide];
                                        const categoryMap: Record<string, string> = {
                                            'New Arrivals': 'Casual',
                                            'Trending Now': 'Party',
                                            'Party Collection': 'Party',
                                            "Men's Streetwear": 'Casual',
                                            'Formal Classics': 'Formal'
                                        };
                                        const cat = categoryMap[slide.title] || 'Casual';
                                        navigate(`/category?title=${encodeURIComponent(slide.title)}&category=${cat}`);
                                    }}
                                >
                                    <img
                                        src={filteredSlides[activeSlide].image}
                                        alt={filteredSlides[activeSlide].title}
                                        className="w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                                    <div className="absolute bottom-3 left-3 right-3 md:bottom-6 md:left-6 md:right-6 backdrop-blur-md bg-white/10 border border-white/20 rounded-xl md:rounded-2xl p-2.5 md:p-4 text-center">
                                        <span className="inline-block px-2 py-0.5 rounded-full bg-[#f2546d] text-white text-[8px] md:text-[10px] font-bold uppercase tracking-wider mb-1 md:mb-2">
                                            Trending
                                        </span>
                                        <h3 className="text-base md:text-xl font-bold text-white tracking-tight">
                                            {filteredSlides[activeSlide].title}
                                        </h3>
                                    </div>
                                </motion.div>
                            </AnimatePresence>

                            {/* Right peek card */}
                            <motion.div
                                className="w-[30px] h-[160px] md:w-[40px] md:h-[220px] bg-zinc-900 rounded-2xl flex-shrink-0 overflow-hidden"
                                animate={{ opacity: 0.4, scale: 0.9 }}
                            >
                                <img
                                    src={filteredSlides[(activeSlide + 1) % filteredSlides.length].image}
                                    alt="Next"
                                    className="w-full h-full object-cover grayscale blur-[2px]"
                                />
                            </motion.div>
                        </div>


                    </motion.div>

                    {/* Pagination Dots */}
                    <div className="flex items-center justify-center gap-1.5 mt-2 md:gap-2 md:mt-3">
                        {filteredSlides.map((_, idx) => (
                            <motion.button
                                key={idx}
                                data-dot
                                onClick={() => setActiveSlide(idx)}
                                className={cn(
                                    "rounded-full transition-all duration-300",
                                    activeSlide === idx
                                        ? "w-4 h-1.5 bg-white"
                                        : "w-1.5 h-1.5 bg-zinc-600"
                                )}
                                animate={
                                    activeSlide === idx
                                        ? { scale: [1, 1.05, 1], boxShadow: ["0 0 4px rgba(255,255,255,0.2)", "0 0 8px rgba(255,255,255,0.4)", "0 0 4px rgba(255,255,255,0.2)"] }
                                        : {}
                                }
                                transition={{ duration: 1.5, repeat: Infinity }}
                            />
                        ))}
                    </div>
                </section>


                {/* ─── COLLECTIONS: 2 Cards with Gradient Overlay ─── */}
                <section className="px-4 mt-5 md:px-5 md:mt-8">
                    <div className="flex items-center justify-between mb-4 md:mb-6">
                        <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">
                            Collections
                        </h2>
                        <button
                            onClick={() => navigate('/collections')}
                            className="text-sm font-bold text-[#f2546d] hover:text-[#f2546d]/80 transition-colors"

                        >
                            See all
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 md:gap-[18px]">
                        {collections.slice(0, 5).map((collection, index) => (
                            <motion.div
                                key={collection.id}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.1 + index * 0.1, type: "spring", stiffness: 200 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => navigate(`/shop/${activeGender}?category=${collection.id}&title=${collection.title}`)}
                                className="relative h-[160px] md:h-[250px] w-full rounded-[24px] shadow-xl overflow-hidden cursor-pointer bg-[#232323] border border-white/5 group hover:border-[#f2546d]/40 transition-colors"
                            >
                                {collection.image ? (
                                    <motion.img
                                        src={collection.image}
                                        alt={collection.title}
                                        className="absolute inset-0 w-full h-full object-cover"
                                        whileHover={{ scale: 1.05 }}
                                        transition={{ duration: 0.4 }}
                                    />
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#2a2a2a] to-[#1a1a1a]">
                                        <span className="text-4xl font-bold text-white/10">{collection.title.charAt(0)}</span>
                                    </div>
                                )}
                                {/* Gradient overlay at bottom */}
                                <div
                                    className="absolute bottom-0 left-0 right-0 h-[100px] rounded-b-[24px]"
                                    style={{
                                        background: "linear-gradient(180deg, rgba(17,17,17,0) 0%, rgba(17,17,17,0.8) 50%, #111111 100%)",
                                    }}
                                />
                                <div className="absolute bottom-5 left-0 right-0 text-center transform translate-y-2 group-hover:translate-y-0 transition-transform">
                                    <span className="text-base md:text-lg font-bold text-white px-4 border-b border-white/0 group-hover:border-[#f2546d] pb-1 transition-all">
                                        {collection.title}
                                    </span>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </section>


                {/* ─── ABOUT US: Card with Progress Dots ─── */}
                <section className="px-4 mt-5 md:px-5 md:mt-8">
                    <div
                        onClick={() => navigate('/about-us')}
                        className="bg-[#232323] rounded-2xl px-6 py-6 cursor-pointer active:scale-[0.98] transition-all hover:bg-[#2a2a2a]"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">
                                About Us
                            </h2>
                            <ChevronRight className="w-4 h-4 text-zinc-400" />
                        </div>

                        {/* Inner card */}
                        <div className="bg-[#191919] rounded-2xl px-6 py-6">
                            {/* Icon + Title */}
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-14 h-14 rounded-xl bg-[#232323] border border-zinc-700/50 flex items-center justify-center overflow-hidden">
                                    {ABOUT_US_SLIDES[activeAboutSlide].icon}
                                </div>
                                <span className="text-base font-bold text-white tracking-tight">
                                    {ABOUT_US_SLIDES[activeAboutSlide].title}
                                </span>
                            </div>

                            {/* Progress indicator: dots connected by lines */}
                            <div className="flex items-center w-full">
                                {ABOUT_US_SLIDES.map((slide, idx) => (
                                    <React.Fragment key={slide.id}>
                                        {/* Dot */}
                                        <motion.div
                                            className={cn(
                                                "w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors duration-300",
                                                idx < activeAboutSlide
                                                    ? "bg-[#f2546d]"
                                                    : idx === activeAboutSlide
                                                        ? "bg-white"
                                                        : "bg-[#3a3a3a]"
                                            )}
                                            animate={idx === activeAboutSlide ? { scale: [1, 1.1, 1] } : {}}
                                            transition={{ duration: 1.5, repeat: Infinity }}
                                        />
                                        {/* Connecting line (except after last dot) */}
                                        {idx < ABOUT_US_SLIDES.length - 1 && (
                                            <div className="flex-1 h-px mx-1">
                                                <div
                                                    className={cn(
                                                        "h-full transition-colors duration-300",
                                                        idx < activeAboutSlide ? "bg-[#f2546d]/60" : "bg-zinc-700"
                                                    )}
                                                />
                                            </div>
                                        )}
                                    </React.Fragment>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>


                {/* ─── BRANDS: Dual-Column Grid + See All Button ─── */}
                <section className="px-4 mt-5 md:px-5 md:mt-8 max-w-4xl mx-auto">
                    <div className="flex items-center justify-between mb-4 md:mb-6">
                        <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">
                            Brands
                        </h2>
                        <button onClick={() => navigate('/brands')} className="text-sm font-bold text-[#f2546d] hover:text-[#f2546d]/80 transition-colors">
                            See all
                        </button>
                    </div>

                    {/* Dual columns – infinite scroll marquee */}
                    <div className="flex gap-5">
                        {/* Left column – scrolls UP */}
                        <div className="flex-1 overflow-hidden max-h-[380px]">
                            <motion.div
                                className="flex flex-col gap-4"
                                animate={{ y: brands.length > 0 ? ["0%", "-50%"] : "0%" }}
                                transition={{
                                    y: {
                                        duration: 12,
                                        repeat: Infinity,
                                        ease: "linear",
                                    },
                                }}
                            >
                                {/* Duplicate items for seamless loop */}
                                {brands.length > 0 ? (
                                    [...brands.filter((_, i) => i % 2 === 0), ...brands.filter((_, i) => i % 2 === 0)].map((brand, idx) => (
                                        <div
                                            key={`left-${idx}`}
                                            className="h-20 rounded-2xl bg-[#232323] flex items-center justify-center cursor-pointer hover:bg-[#2a2a2a] transition-colors flex-shrink-0"
                                            onClick={() => navigate(`/category?brand=${encodeURIComponent(brand)}`)}
                                        >
                                            <span className="text-xs md:text-sm font-semibold text-zinc-300">
                                                {brand}
                                            </span>
                                        </div>
                                    ))
                                ) : (
                                    <div className="h-20 rounded-2xl bg-[#232323]/50 animate-pulse flex-shrink-0" />
                                )}
                            </motion.div>
                        </div>

                        {/* Right column (offset) – scrolls DOWN */}
                        <div className="flex-1 overflow-hidden max-h-[380px] mt-4">
                            <motion.div
                                className="flex flex-col gap-4"
                                animate={{ y: brands.length > 0 ? ["-50%", "0%"] : "0%" }}
                                transition={{
                                    y: {
                                        duration: 12,
                                        repeat: Infinity,
                                        ease: "linear",
                                    },
                                }}
                            >
                                {/* Duplicate items for seamless loop */}
                                {brands.length > 0 ? (
                                    [...brands.filter((_, i) => i % 2 === 1), ...brands.filter((_, i) => i % 2 === 1)].map((brand, idx) => (
                                        <div
                                            key={`right-${idx}`}
                                            className="h-20 rounded-2xl bg-[#232323] flex items-center justify-center cursor-pointer hover:bg-[#2a2a2a] transition-colors flex-shrink-0"
                                            onClick={() => navigate(`/category?brand=${encodeURIComponent(brand)}`)}
                                        >
                                            <span className="text-xs md:text-sm font-semibold text-zinc-300">
                                                {brand}
                                            </span>
                                        </div>
                                    ))
                                ) : (
                                    <div className="h-20 rounded-2xl bg-[#232323]/50 animate-pulse flex-shrink-0 mt-4" />
                                )}
                            </motion.div>
                        </div>
                    </div>
                </section>


                {/* ─── CATALOGUE: Product Cards Grid ─── */}
                <section className="px-4 mt-6 md:px-5 md:mt-10">
                    <div className="flex items-center justify-between mb-5 md:mb-8">
                        <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">
                            Catalogue
                        </h2>
                        <button
                            onClick={() => navigate(`/shop/${activeGender}`)}
                            className="text-sm font-bold text-[#f2546d] hover:text-[#f2546d]/80 transition-colors"
                        >
                            See all
                        </button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5">
                        {catalogueError ? (
                            // Error state with retry button
                            <div className="col-span-2 md:col-span-3 lg:col-span-4 flex flex-col items-center justify-center py-12 gap-4">
                                <p className="text-sm text-zinc-400">Couldn't load products</p>
                                <button
                                    onClick={() => fetchCatalogue(true)}
                                    className="px-6 py-2.5 rounded-full bg-[#f2546d] text-white text-sm font-semibold hover:bg-[#f2546d]/90 transition-colors"
                                >
                                    Retry
                                </button>
                            </div>
                        ) : loadingCatalogue ? (
                            // Skeleton loaders
                            [...Array(4)].map((_, i) => (
                                <div key={`skel-${i}`} className="relative rounded-2xl bg-[#232323] aspect-square md:aspect-[3/4] animate-pulse border border-[#484848]" />
                            ))
                        ) : catalogueProducts.map((item, index) => {
                            const isFake = (item as any)._isFake === true;
                            const imgSrc = item.imageUrl || (item as any).images?.[0] || '';
                            return (
                                <motion.div
                                    key={item.id}
                                    initial={{ opacity: 0, y: 30 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true, margin: "-50px" }}
                                    transition={{ delay: index * 0.05 }}
                                    whileTap={{ scale: 0.97 }}
                                    onClick={() => isFake
                                        ? navigate(`/product/${item.id}`, { state: { fakeProduct: item, isRented: true } })
                                        : navigate(`/product/${item.id}`)
                                    }
                                    className="relative rounded-2xl overflow-hidden bg-[#232323] border border-[#484848] cursor-pointer group flex flex-col"
                                >
                                    {/* Wishlist — hidden for fake items */}
                                    {!isFake && (
                                        <button
                                            className="absolute top-4 right-4 z-10"
                                            onClick={(e) => toggleWishlist(item.id, e)}
                                        >
                                            <Heart
                                                className={cn(
                                                    "w-4 h-4 transition-colors",
                                                    isWishlisted(item.id) ? "text-[#f2546d] fill-[#f2546d]" : "text-white/60"
                                                )}
                                            />
                                        </button>
                                    )}

                                    {/* Product Image */}
                                    <div className="aspect-square md:aspect-[3/4] bg-[#2a2a2a] relative overflow-hidden">
                                        {imgSrc ? (
                                            <img
                                                src={imgSrc}
                                                alt={item.name}
                                                className={cn(
                                                    "w-full h-full object-cover transition-transform duration-500",
                                                    isFake ? "grayscale opacity-20 blur-[2px]" : "group-hover:scale-105"
                                                )}
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs text-center p-2">
                                                No Image
                                            </div>
                                        )}

                                        {/* Currently Rented badge */}
                                        {isFake && (
                                            <div className="absolute top-2 left-2 z-10">
                                                <span className="inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white backdrop-blur-sm">
                                                    <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                                                    Currently Rented
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Separator line */}
                                    <div className="w-full h-px bg-[#484848]/50" />

                                    {/* Product Details */}
                                    <div className="p-4 pt-3 flex-1 flex flex-col justify-between">
                                        <h3 className={cn("text-xs md:text-sm font-semibold mb-2 line-clamp-2", isFake ? "text-zinc-500" : "text-white")}>
                                            {item.name}
                                        </h3>

                                        <div className="mt-auto">
                                            {isFake ? (
                                                <span className="text-xs text-zinc-600 font-medium">Unavailable</span>
                                            ) : (
                                                <>
                                                    {item.price > (item.rentalPrice || item.price) && (
                                                        <div className="relative inline-block mb-1">
                                                            <span className="text-[11px] text-[#5f606a] font-semibold">
                                                                ₹{item.price}
                                                            </span>
                                                            <div className="absolute top-1/2 left-0 right-0 h-px bg-[#5f606a]" />
                                                        </div>
                                                    )}
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-bold text-white">
                                                            ₹{item.rental_price_1d ?? item.rentalPrice ?? item.price}
                                                        </span>
                                                        {item.price > (item.rentalPrice || item.price) && (
                                                            <span className="text-[10px] font-bold text-[#f2546d]">
                                                                Save {Math.round(((item.price - (item.rentalPrice || item.price)) / item.price) * 100)}%
                                                            </span>
                                                        )}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                </section>


                {/* Spacer for bottom nav */}
                <div className="h-8" />
            </main>
        </div>
    );
};

export default MobileHome;
