import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MobileShell } from "@/components/layout/MobileShell";
import { BottomNavBar } from "@/components/layout/BottomNavBar";
import { cn } from "@/lib/utils";
import { ChevronRight, Search, Heart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { locationStorage } from "@/lib/locationStorage";
import { useAuth } from "@/hooks/useAuth";
import popclozetLogo from "@/logo/logo.png";
import { AboutUsProcess } from "@/components/ui/AboutUsProcess";

// --- Mock Data ---

const COLLECTIONS = [
    { id: "jackets", title: "Jackets", image: "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=500&q=80" },
    { id: "shoes", title: "Shoes", image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500&q=80" },
];

const BRANDS = [
    { id: "brand1", label: "Zara" },
    { id: "brand2", label: "H&M" },
    { id: "brand3", label: "Gucci" },
    { id: "brand4", label: "Prada" },
    { id: "brand5", label: "Nike" },
    { id: "brand6", label: "Adidas" },
    { id: "brand7", label: "Levi's" },
    { id: "brand8", label: "Uniqlo" },
    { id: "brand9", label: "Versace" },
    { id: "brand10", label: "Dior" },
];

const CATALOGUE_ITEMS = [
    { id: "1", title: "Haldi Outfit", price: 699, originalPrice: 4000, discount: 80 },
    { id: "2", title: "Haldi Outfit", price: 699, originalPrice: 4000, discount: 80 },
    { id: "3", title: "Haldi Outfit", price: 699, originalPrice: 4000, discount: 80 },
    { id: "4", title: "Haldi Outfit", price: 699, originalPrice: 4000, discount: 80 },
];

const FEATURED_SLIDES = [
    { id: 0, title: "New Arrivals", image: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&q=80" },
    { id: 1, title: "Trending Now", image: "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800&q=80" },
    { id: 2, title: "Party Collection", image: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&q=80" },
];



const MobileHome: React.FC = () => {
    const navigate = useNavigate();
    const [activeSlide, setActiveSlide] = useState(1);
    const [activeGender, setActiveGender] = useState<"women" | "men">("women");
    const [userLocation, setUserLocation] = useState("Detecting...");
    const [isInServiceArea, setIsInServiceArea] = useState<boolean | null>(null);
    const { user } = useAuth();

    // Auto-rotate featured slides
    useEffect(() => {
        const interval = setInterval(() => {
            setActiveSlide((prev) => (prev + 1) % FEATURED_SLIDES.length);
        }, 4000);
        return () => clearInterval(interval);
    }, []);

    // Auto-detect location using GPS + Mapbox reverse geocoding
    useEffect(() => {
        const detectLocation = async () => {
            try {
                const { autoDetectLocation } = await import("@popclozet/mapbox-core");
                const result = await autoDetectLocation();

                if (result) {
                    const displayLocation = result.locality !== result.city
                        ? `${result.locality}, ${result.city}`
                        : result.city;
                    setUserLocation(displayLocation);
                    setIsInServiceArea(result.isInServiceArea);

                    locationStorage.set({
                        source: "gps",
                        lat: result.lat,
                        lng: result.lng,
                        city: result.city,
                        locality: result.locality,
                    });
                } else {
                    const stored = locationStorage.get();
                    if (stored?.source === "manual") {
                        setUserLocation(stored.city);
                    } else {
                        setUserLocation("Select Location");
                    }
                }
            } catch (error) {
                console.error("Location detection failed:", error);
                const stored = locationStorage.get();
                if (stored?.source === "manual") {
                    setUserLocation(stored.city);
                } else {
                    setUserLocation("Enable Location");
                }
            }
        };

        detectLocation();
    }, []);



    return (
        <MobileShell className="bg-[#111111] text-white">

            {/* Main Scrollable Content */}
            <main className="flex-1 overflow-y-auto pb-24">

                {/* ─── LOGO ─── */}
                <div className="px-5 pt-5 pb-1 flex items-center">
                    <img src={popclozetLogo} alt="PopClozet" className="h-7 object-contain" />
                </div>

                {/* ─── HEADER: Delivery Time + Location + Actions ─── */}
                <section className="relative px-5 pt-4 pb-4">

                    <div className="relative flex items-end justify-between">
                        {/* Left: Delivery badge + location */}
                        <div className="flex flex-col gap-1">
                            <span className="text-[#f2546d] text-xs font-bold tracking-tight">
                                ⚡ in
                            </span>
                            <h1 className="text-[32px] font-black text-white leading-none tracking-tight">
                                15 Minutes
                            </h1>
                            <div className="flex items-center gap-1.5 mt-1">
                                <svg className="w-4 h-4 text-white/70" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z" />
                                </svg>
                                <span className="text-sm font-bold text-white/90 tracking-tight">
                                    {userLocation}
                                </span>
                            </div>
                        </div>

                        {/* Right: Action buttons */}
                        <div className="flex items-center gap-2 mb-1">
                            <button
                                onClick={() => navigate('/closet?tab=wishlist')}
                                className="w-10 h-10 flex items-center justify-center bg-[#303135] rounded-full transition-colors hover:bg-[#404045]"
                            >
                                <Heart className="w-[19px] h-[19px] text-white/80" />
                            </button>
                            <button
                                onClick={() => navigate('/cart')}
                                className="w-10 h-10 flex items-center justify-center bg-[#303135] rounded-full transition-colors hover:bg-[#404045]"
                            >
                                <svg className="w-5 h-6 text-white/80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
                                    <line x1="3" y1="6" x2="21" y2="6" />
                                    <path d="M16 10a4 4 0 01-8 0" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </section>


                {/* ─── GENDER SELECTOR: Overlapping Dark Panels ─── */}
                <section className="px-5 mt-4">
                    <div className="relative h-24 flex items-center justify-center">
                        {/* Women panel (left) */}
                        <motion.div
                            className={cn(
                                "absolute left-0 w-[62%] h-24 rounded-2xl cursor-pointer transition-all duration-300 flex items-end pb-4 pl-8",
                                activeGender === "women"
                                    ? "bg-[#2a2a2a] z-20 shadow-[6px_0px_8px_rgba(0,0,0,0.4)]"
                                    : "bg-[#222222] z-10"
                            )}
                            onClick={() => setActiveGender("women")}
                            whileTap={{ scale: 0.98 }}
                        >
                            <span className={cn(
                                "text-sm font-bold tracking-wider transition-colors",
                                activeGender === "women" ? "text-white" : "text-zinc-500"
                            )}>
                                WOMEN
                            </span>
                        </motion.div>

                        {/* Men panel (right, overlapping) */}
                        <motion.div
                            className={cn(
                                "absolute right-0 w-[62%] h-24 rounded-2xl cursor-pointer transition-all duration-300 flex items-end pb-4 pl-10",
                                activeGender === "men"
                                    ? "bg-[#2a2a2a] z-20 shadow-[-9px_0px_4px_rgba(0,0,0,0.25)]"
                                    : "bg-[#222222] z-10"
                            )}
                            onClick={() => setActiveGender("men")}
                            whileTap={{ scale: 0.98 }}
                        >
                            <span className={cn(
                                "text-sm font-bold tracking-wider transition-colors",
                                activeGender === "men" ? "text-white" : "text-zinc-500"
                            )}>
                                MEN
                            </span>
                        </motion.div>
                    </div>
                </section>


                {/* ─── SEARCH: Icon Button on Dark Pill ─── */}
                <section className="px-5 mt-5">
                    <div className="flex items-center bg-[#232323] rounded-full shadow-[0px_4px_4px_rgba(0,0,0,0.25)] h-12">
                        <button
                            onClick={() => navigate('/collections')}
                            className="w-12 h-12 flex items-center justify-center bg-[#3a3a3a] rounded-full shadow-[0px_0px_4px_#f2546d] transition-all hover:bg-[#454545]"
                        >
                            <Search className="w-[18px] h-[18px] text-white/90" />
                        </button>
                        <span className="ml-4 text-sm text-zinc-500 font-semibold tracking-tight">
                            Search for dresses, tops, brands...
                        </span>
                    </div>
                </section>


                {/* ─── FEATURED CAROUSEL: 3-Card Peek ─── */}
                <section className="mt-8 overflow-hidden">
                    <div className="relative flex items-center justify-center h-[348px]">
                        {/* Side cards + Center card */}
                        <div className="flex items-center gap-4" style={{ width: '100%', justifyContent: 'center' }}>
                            {/* Left peek card */}
                            <motion.div
                                className="w-[72px] h-[280px] bg-[#232323] rounded-2xl flex-shrink-0 overflow-hidden"
                                animate={{ opacity: 0.7 }}
                            >
                                <img
                                    src={FEATURED_SLIDES[(activeSlide + FEATURED_SLIDES.length - 1) % FEATURED_SLIDES.length].image}
                                    alt="Previous"
                                    className="w-full h-full object-cover opacity-60"
                                />
                            </motion.div>

                            {/* Center card (active) */}
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={activeSlide}
                                    className="w-[260px] h-[320px] bg-[#232323] rounded-2xl shadow-[6px_6px_8px_rgba(0,0,0,0.25)] overflow-hidden flex-shrink-0 relative cursor-pointer"
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ duration: 0.4 }}
                                    onClick={() => navigate('/collections')}
                                >
                                    <img
                                        src={FEATURED_SLIDES[activeSlide].image}
                                        alt={FEATURED_SLIDES[activeSlide].title}
                                        className="w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                                    <div className="absolute bottom-4 left-4 right-4">
                                        <span className="px-3 py-1 rounded-full bg-[#f2546d] text-white text-xs font-bold uppercase tracking-wider">
                                            Trending
                                        </span>
                                        <h3 className="text-base font-bold text-white mt-2">
                                            {FEATURED_SLIDES[activeSlide].title}
                                        </h3>
                                    </div>
                                </motion.div>
                            </AnimatePresence>

                            {/* Right peek card */}
                            <motion.div
                                className="w-[72px] h-[280px] bg-[#232323] rounded-2xl flex-shrink-0 overflow-hidden"
                                animate={{ opacity: 0.7 }}
                            >
                                <img
                                    src={FEATURED_SLIDES[(activeSlide + 1) % FEATURED_SLIDES.length].image}
                                    alt="Next"
                                    className="w-full h-full object-cover opacity-60"
                                />
                            </motion.div>
                        </div>
                    </div>

                    {/* Pagination Dots */}
                    <div className="flex items-center justify-center gap-2 mt-3">
                        {FEATURED_SLIDES.map((_, idx) => (
                            <motion.button
                                key={idx}
                                onClick={() => setActiveSlide(idx)}
                                className={cn(
                                    "rounded-full transition-all duration-300",
                                    activeSlide === idx
                                        ? "w-2 h-2 bg-white"
                                        : "w-1.5 h-1.5 bg-[#b93e53]"
                                )}
                                animate={
                                    activeSlide === idx
                                        ? { boxShadow: ["0 0 6px rgba(255,255,255,0.3)", "0 0 12px rgba(255,255,255,0.6)", "0 0 6px rgba(255,255,255,0.3)"] }
                                        : {}
                                }
                                transition={{ duration: 1.5, repeat: Infinity }}
                            />
                        ))}
                    </div>
                </section>


                {/* ─── COLLECTIONS: 2 Cards with Gradient Overlay ─── */}
                <section className="px-5 mt-8">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-white tracking-tight">
                            Collections
                        </h2>
                        <button
                            onClick={() => navigate('/collections')}
                            className="text-sm font-bold text-[#f2546d] hover:text-[#f2546d]/80 transition-colors"

                        >
                            See all
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-[18px]">
                        {COLLECTIONS.map((collection, index) => (
                            <motion.div
                                key={collection.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 + index * 0.1 }}
                                whileTap={{ scale: 0.97 }}
                                onClick={() => navigate(`/shop/women?category=${collection.id}&title=${collection.title}`)}
                                className="relative h-[250px] rounded-2xl overflow-hidden cursor-pointer bg-[#232323]"
                            >
                                <img
                                    src={collection.image}
                                    alt={collection.title}
                                    className="absolute inset-0 w-full h-full object-cover"
                                />
                                {/* Gradient overlay at bottom */}
                                <div
                                    className="absolute bottom-0 left-0 right-0 h-[67px] rounded-b-2xl"
                                    style={{
                                        background: "linear-gradient(180deg, rgba(17,17,17,0) 0%, #111111 100%)",
                                        backdropFilter: "blur(9.2px)",
                                    }}
                                />
                                <span className="absolute bottom-4 left-0 right-0 text-center text-sm font-bold text-white">
                                    {collection.title}
                                </span>
                            </motion.div>
                        ))}
                    </div>
                </section>


                {/* ─── ABOUT US: Process & Brand ─── */}
                <section className="mt-8">
                    <AboutUsProcess />
                </section>


                {/* ─── BRANDS: Dual-Column Grid + See All Button ─── */}
                <section className="px-5 mt-8">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-white tracking-tight">
                            Brands
                        </h2>
                        <button className="text-sm font-bold text-[#f2546d]">
                            See all
                        </button>
                    </div>

                    {/* Dual columns – infinite scroll marquee */}
                    <div className="flex gap-5">
                        {/* Left column – scrolls UP */}
                        <div className="flex-1 overflow-hidden max-h-[380px]">
                            <motion.div
                                className="flex flex-col gap-4"
                                animate={{ y: ["0%", "-50%"] }}
                                transition={{
                                    y: {
                                        duration: 12,
                                        repeat: Infinity,
                                        ease: "linear",
                                    },
                                }}
                            >
                                {/* Duplicate items for seamless loop */}
                                {[...BRANDS.filter((_, i) => i % 2 === 0), ...BRANDS.filter((_, i) => i % 2 === 0)].map((brand, idx) => (
                                    <div
                                        key={`left-${idx}`}
                                        className="h-20 rounded-2xl bg-[#232323] flex items-center justify-center cursor-pointer hover:bg-[#2a2a2a] transition-colors flex-shrink-0"
                                    >
                                        <span className="text-sm font-bold text-zinc-300">
                                            {brand.label}
                                        </span>
                                    </div>
                                ))}
                            </motion.div>
                        </div>

                        {/* Right column (offset) – scrolls DOWN */}
                        <div className="flex-1 overflow-hidden max-h-[380px] mt-4">
                            <motion.div
                                className="flex flex-col gap-4"
                                animate={{ y: ["-50%", "0%"] }}
                                transition={{
                                    y: {
                                        duration: 12,
                                        repeat: Infinity,
                                        ease: "linear",
                                    },
                                }}
                            >
                                {/* Duplicate items for seamless loop */}
                                {[...BRANDS.filter((_, i) => i % 2 === 1), ...BRANDS.filter((_, i) => i % 2 === 1)].map((brand, idx) => (
                                    <div
                                        key={`right-${idx}`}
                                        className="h-20 rounded-2xl bg-[#232323] flex items-center justify-center cursor-pointer hover:bg-[#2a2a2a] transition-colors flex-shrink-0"
                                    >
                                        <span className="text-sm font-bold text-zinc-300">
                                            {brand.label}
                                        </span>
                                    </div>
                                ))}
                            </motion.div>
                        </div>
                    </div>

                    {/* See all Brands button */}
                    <button
                        className="w-full mt-6 h-[50px] flex items-center justify-center gap-2 bg-[#232323] rounded-2xl border border-[#484848] hover:bg-[#2a2a2a] transition-colors"
                    >
                        <span className="text-sm font-bold text-white tracking-tight">
                            See all Brands
                        </span>
                        <ChevronRight className="w-3 h-3 text-white" />
                    </button>
                </section>


                {/* ─── CATALOGUE: Product Cards Grid ─── */}
                <section className="px-5 mt-10">
                    <div className="flex items-center justify-between mb-8">
                        <h2 className="text-xl font-bold text-white tracking-tight">
                            Catalogue
                        </h2>
                        <button className="text-sm font-bold text-[#f2546d]">
                            See all
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-5">
                        {CATALOGUE_ITEMS.map((item, index) => (
                            <motion.div
                                key={item.id}
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: "-50px" }}
                                transition={{ delay: index * 0.05 }}
                                whileTap={{ scale: 0.97 }}
                                onClick={() => navigate(`/product/${item.id}`)}
                                className="relative rounded-2xl overflow-hidden bg-[#232323] border border-[#484848] cursor-pointer group"
                            >
                                {/* Heart icon */}
                                <button
                                    className="absolute top-4 right-4 z-10"
                                    onClick={(e) => { e.stopPropagation(); }}
                                >
                                    <Heart className="w-[21px] h-[21px] text-white/60 hover:text-[#f2546d] transition-colors" />
                                </button>

                                {/* Product Image Placeholder */}
                                <div className="aspect-[3/4] bg-gradient-to-br from-[#2a2a2a] to-[#1a1a1a] relative" />

                                {/* Separator line */}
                                <div className="w-full h-px bg-zinc-700" />

                                {/* Product Details */}
                                <div className="p-4 pt-3">
                                    <h3 className="text-sm font-bold text-white mb-2">
                                        {item.title}
                                    </h3>

                                    {/* Original price with strikethrough */}
                                    <div className="relative inline-block mb-2">
                                        <span className="text-xs text-[#5f606a] font-semibold">
                                            ₹ {item.originalPrice}
                                        </span>
                                        <div className="absolute top-1/2 left-0 right-0 h-px bg-[#5f606a]" />
                                    </div>

                                    {/* Current price + Discount */}
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold text-white">
                                            ₹ {item.price}
                                        </span>
                                        <span className="text-xs font-bold text-[#f2546d]">
                                            Save {item.discount}%
                                        </span>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </section>


                {/* Spacer for bottom nav */}
                <div className="h-8" />
            </main>

            <BottomNavBar />
        </MobileShell>
    );
};

export default MobileHome;
