import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MobileShell } from "@/components/layout/MobileShell";
import { BottomNavBar } from "@/components/layout/BottomNavBar";
import { ChevronLeft, Search, Heart, X, TrendingUp, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRODUCTS } from "@/config/products";

// ── Extended product type for search (with brand support) ──
interface SearchProduct {
    id: string;
    name: string;
    price: number;
    image: string;
    category: string;
    color: string;
    brand?: string;
    rating?: number;
}

// ── Brand mapping for brand-keyword search ──
const BRAND_PRODUCTS: Record<string, string[]> = {
    "Nike": ["Sports Jacket", "Running Shoes", "Athletic Wear", "Training Shorts", "Air Max Sneakers"],
    "Adidas": ["Track Suit", "Ultraboost Shoes", "Originals Tee", "Football Jersey", "Stan Smith Sneakers"],
    "Zara": ["Floral Midi Dress", "Linen Blazer", "Satin Blouse", "Wide Leg Trousers", "Knit Cardigan"],
    "H&M": ["Basic Tee", "Denim Jacket", "Cotton Dress", "Chino Pants", "Ribbed Tank Top"],
    "Gucci": ["Logo Belt", "Bamboo Bag", "Silk Scarf", "Ace Sneakers", "Horsebit Loafers"],
    "Prada": ["Nylon Bag", "Platform Shoes", "Triangle Logo Tee", "Re-Edition Bag", "Saffiano Wallet"],
    "Levi's": ["501 Jeans", "Trucker Jacket", "Denim Shorts", "Vintage Fit Tee", "Ribcage Jeans"],
    "Uniqlo": ["Heattech Top", "Ultra Light Down", "AIRism Tee", "EZY Jeans", "Fleece Jacket"],
    "Versace": ["Medusa Chain", "Baroque Print Shirt", "La Greca Sneakers", "Crystal Dress", "Safety Pin Bag"],
    "Dior": ["Saddle Bag", "Book Tote", "J'adior Slingback", "Oblique Shirt", "Lady Dior Bag"],
};

// Create searchable products from brands
const BRAND_SEARCH_PRODUCTS: SearchProduct[] = Object.entries(BRAND_PRODUCTS).flatMap(
    ([brand, products]) =>
        products.map((name, idx) => ({
            id: `brand-${brand}-${idx}`,
            name,
            price: Math.floor(Math.random() * 800) + 299,
            image: `https://images.unsplash.com/photo-${1500000000000 + Math.floor(Math.random() * 100000000000)}?w=400&q=80`,
            category: "Fashion",
            color: "",
            brand,
            rating: Number((4 + Math.random()).toFixed(1)),
        }))
);

// Merge config products with brand products
const ALL_PRODUCTS: SearchProduct[] = [
    ...PRODUCTS.map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        image: p.image,
        category: p.category,
        color: p.color,
        brand: undefined as string | undefined,
        rating: p.rating,
    })),
    ...BRAND_SEARCH_PRODUCTS,
];

// ── All brand names for autocomplete ──
const ALL_BRANDS = Object.keys(BRAND_PRODUCTS);

// ── Trending & recent searches ──
const TRENDING_SEARCHES = ["Jackets", "Party Wear", "Saree", "Casual Dresses", "Blazer"];

// ── Fuzzy match helper ──
function fuzzyMatch(text: string, query: string): boolean {
    return text.toLowerCase().includes(query.toLowerCase());
}

// ── Autocomplete suggestions generator ──
function getAutocompleteSuggestions(query: string): { type: "brand" | "product" | "category"; text: string; subtext?: string }[] {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    const results: { type: "brand" | "product" | "category"; text: string; subtext?: string }[] = [];
    const seen = new Set<string>();

    // Match brands first (highest priority)
    for (const brand of ALL_BRANDS) {
        if (brand.toLowerCase().includes(q) && !seen.has(brand.toLowerCase())) {
            results.push({ type: "brand", text: brand, subtext: `${BRAND_PRODUCTS[brand].length} products` });
            seen.add(brand.toLowerCase());
        }
    }

    // Match categories
    const categories = ["Wedding", "Party", "Casual", "Office"];
    for (const cat of categories) {
        if (cat.toLowerCase().includes(q) && !seen.has(cat.toLowerCase())) {
            results.push({ type: "category", text: cat, subtext: "Category" });
            seen.add(cat.toLowerCase());
        }
    }

    // Match product names
    for (const product of ALL_PRODUCTS) {
        const nameKey = product.name.toLowerCase();
        if (nameKey.includes(q) && !seen.has(nameKey)) {
            results.push({ type: "product", text: product.name, subtext: `₹${product.price}` });
            seen.add(nameKey);
        }
        if (results.length >= 8) break;
    }

    return results.slice(0, 8);
}

const SearchResultsPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const initialQuery = searchParams.get("q") || "";

    const [query, setQuery] = useState(initialQuery);
    const [submittedQuery, setSubmittedQuery] = useState(initialQuery);
    const [wishlist, setWishlist] = useState<Set<string>>(new Set());
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [recentSearches, setRecentSearches] = useState<string[]>(() => {
        try {
            return JSON.parse(localStorage.getItem("recent_searches") || "[]");
        } catch { return []; }
    });

    const inputRef = useRef<HTMLInputElement>(null);

    // Auto-focus input if no query
    useEffect(() => {
        if (!initialQuery && inputRef.current) {
            inputRef.current.focus();
            setShowSuggestions(true);
        }
    }, []);

    // Autocomplete suggestions
    const suggestions = useMemo(() => getAutocompleteSuggestions(query), [query]);

    // Search results
    const results = useMemo(() => {
        if (!submittedQuery.trim()) return [];
        const q = submittedQuery.toLowerCase();
        return ALL_PRODUCTS.filter(
            (p) =>
                fuzzyMatch(p.name, q) ||
                fuzzyMatch(p.category, q) ||
                fuzzyMatch(p.color, q) ||
                (p.brand && fuzzyMatch(p.brand, q))
        );
    }, [submittedQuery]);

    const handleSubmit = (searchTerm?: string) => {
        const term = searchTerm || query;
        if (!term.trim()) return;
        setSubmittedQuery(term);
        setShowSuggestions(false);
        setSearchParams({ q: term });

        // Save to recent searches
        const updated = [term, ...recentSearches.filter((s) => s.toLowerCase() !== term.toLowerCase())].slice(0, 6);
        setRecentSearches(updated);
        localStorage.setItem("recent_searches", JSON.stringify(updated));
        inputRef.current?.blur();
    };

    const handleSuggestionClick = (text: string) => {
        setQuery(text);
        handleSubmit(text);
    };

    const toggleWishlist = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setWishlist((prev) => {
            const s = new Set(prev);
            s.has(id) ? s.delete(id) : s.add(id);
            return s;
        });
    };

    const clearRecentSearches = () => {
        setRecentSearches([]);
        localStorage.removeItem("recent_searches");
    };

    return (
        <MobileShell className="bg-[#111111] text-white">
            <main className="flex-1 overflow-y-auto pb-24">

                {/* ─── Top Bar: Back + Search Input ─── */}
                <div className="sticky top-0 z-30 bg-[#111111]/95 backdrop-blur-md px-4 pt-4 pb-3 border-b border-white/5">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate(-1)}
                            className="w-10 h-10 flex items-center justify-center rounded-full bg-[#232323] hover:bg-[#303030] transition-colors flex-shrink-0"
                        >
                            <ChevronLeft className="w-5 h-5 text-white" />
                        </button>

                        <form
                            onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}
                            className="flex-1 relative"
                        >
                            <div className="relative flex items-center bg-[#232323] rounded-full h-11 shadow-[0px_4px_4px_rgba(0,0,0,0.25)]">
                                <Search className="w-4 h-4 text-zinc-500 absolute left-4" />
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={query}
                                    onChange={(e) => {
                                        setQuery(e.target.value);
                                        setShowSuggestions(true);
                                    }}
                                    onFocus={() => setShowSuggestions(true)}
                                    placeholder="Search dresses, brands, jackets..."
                                    className="w-full h-full bg-transparent text-white text-sm font-medium pl-11 pr-10 rounded-full outline-none placeholder:text-zinc-500"
                                    autoComplete="off"
                                />
                                {query && (
                                    <button
                                        type="button"
                                        onClick={() => { setQuery(""); setSubmittedQuery(""); setShowSuggestions(true); inputRef.current?.focus(); }}
                                        className="absolute right-3 p-1"
                                    >
                                        <X className="w-4 h-4 text-zinc-400" />
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                </div>

                {/* ─── Autocomplete Suggestions Dropdown ─── */}
                <AnimatePresence>
                    {showSuggestions && (query.length > 0 ? suggestions.length > 0 : true) && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                            className="relative z-20 mx-4 mt-2 bg-[#1e1e1e] rounded-2xl border border-white/5 overflow-hidden shadow-xl"
                        >
                            {/* Live suggestions */}
                            {query.length > 0 && suggestions.length > 0 && (
                                <div className="py-2">
                                    {suggestions.map((s, i) => (
                                        <motion.button
                                            key={`${s.type}-${s.text}-${i}`}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: i * 0.03 }}
                                            onClick={() => handleSuggestionClick(s.text)}
                                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
                                        >
                                            <div className={cn(
                                                "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                                                s.type === "brand" ? "bg-[#f2546d]/20" : s.type === "category" ? "bg-blue-500/20" : "bg-white/10"
                                            )}>
                                                <Search className="w-3.5 h-3.5 text-zinc-300" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-white truncate">
                                                    {/* Highlight matching part */}
                                                    {(() => {
                                                        const idx = s.text.toLowerCase().indexOf(query.toLowerCase());
                                                        if (idx === -1) return s.text;
                                                        return (
                                                            <>
                                                                {s.text.slice(0, idx)}
                                                                <span className="text-[#f2546d]">{s.text.slice(idx, idx + query.length)}</span>
                                                                {s.text.slice(idx + query.length)}
                                                            </>
                                                        );
                                                    })()}
                                                </p>
                                                {s.subtext && (
                                                    <p className="text-xs text-zinc-500 mt-0.5">{s.subtext}</p>
                                                )}
                                            </div>
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 bg-white/5 px-2 py-0.5 rounded-full">
                                                {s.type}
                                            </span>
                                        </motion.button>
                                    ))}
                                </div>
                            )}

                            {/* Empty query: show recent + trending */}
                            {query.length === 0 && (
                                <div className="py-3">
                                    {/* Recent Searches */}
                                    {recentSearches.length > 0 && (
                                        <div className="mb-4">
                                            <div className="flex items-center justify-between px-4 mb-2">
                                                <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Recent</span>
                                                <button onClick={clearRecentSearches} className="text-xs text-[#f2546d] font-semibold">Clear</button>
                                            </div>
                                            {recentSearches.map((term, i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => handleSuggestionClick(term)}
                                                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors text-left"
                                                >
                                                    <Clock className="w-4 h-4 text-zinc-500" />
                                                    <span className="text-sm text-zinc-300">{term}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {/* Trending Searches */}
                                    <div>
                                        <div className="flex items-center px-4 mb-2">
                                            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Trending</span>
                                        </div>
                                        {TRENDING_SEARCHES.map((term, i) => (
                                            <button
                                                key={i}
                                                onClick={() => handleSuggestionClick(term)}
                                                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors text-left"
                                            >
                                                <TrendingUp className="w-4 h-4 text-[#f2546d]" />
                                                <span className="text-sm text-zinc-300">{term}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ─── Dismiss overlay ─── */}
                {showSuggestions && (
                    <div
                        className="fixed inset-0 z-10"
                        onClick={() => setShowSuggestions(false)}
                    />
                )}

                {/* ─── Search Results ─── */}
                {submittedQuery && !showSuggestions && (
                    <div className="px-4 mt-4">
                        {/* Results header */}
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-white">
                                Results for "<span className="text-[#f2546d]">{submittedQuery}</span>"
                            </h2>
                            <span className="text-xs font-semibold text-zinc-500">
                                {results.length} item{results.length !== 1 ? "s" : ""}
                            </span>
                        </div>

                        {results.length > 0 ? (
                            <div className="grid grid-cols-2 gap-4">
                                {results.map((product, index) => (
                                    <motion.div
                                        key={product.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.04 }}
                                        whileTap={{ scale: 0.97 }}
                                        onClick={() => navigate(`/product/${product.id}`)}
                                        className="relative rounded-2xl overflow-hidden bg-[#232323] border border-[#484848] cursor-pointer group"
                                    >
                                        {/* Heart */}
                                        <button
                                            className="absolute top-3 right-3 z-10"
                                            onClick={(e) => toggleWishlist(product.id, e)}
                                        >
                                            <Heart
                                                className={cn(
                                                    "w-5 h-5 transition-colors",
                                                    wishlist.has(product.id) ? "text-[#f2546d] fill-[#f2546d]" : "text-white/50"
                                                )}
                                            />
                                        </button>

                                        {/* Image */}
                                        <div className="aspect-[3/4] bg-gradient-to-br from-[#2a2a2a] to-[#1a1a1a] overflow-hidden">
                                            <img
                                                src={product.image}
                                                alt={product.name}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                                            />
                                        </div>

                                        {/* Separator */}
                                        <div className="w-full h-px bg-zinc-700" />

                                        {/* Details */}
                                        <div className="p-3">
                                            {product.brand && (
                                                <p className="text-[10px] font-bold text-[#f2546d] uppercase tracking-wider mb-0.5">
                                                    {product.brand}
                                                </p>
                                            )}
                                            <h3 className="text-sm font-bold text-white truncate mb-1">
                                                {product.name}
                                            </h3>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-bold text-white">₹{product.price}</span>
                                                {product.rating && (
                                                    <span className="text-xs text-zinc-500">⭐ {product.rating}</span>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        ) : (
                            /* Empty state */
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="flex flex-col items-center justify-center py-20"
                            >
                                <div className="w-20 h-20 rounded-full bg-[#232323] flex items-center justify-center mb-4">
                                    <Search className="w-8 h-8 text-zinc-600" />
                                </div>
                                <h3 className="text-lg font-bold text-white mb-2">No results found</h3>
                                <p className="text-sm text-zinc-500 text-center max-w-[260px]">
                                    We couldn't find any products matching "<span className="text-[#f2546d]">{submittedQuery}</span>". Try a different search term.
                                </p>
                            </motion.div>
                        )}
                    </div>
                )}

                {/* ─── Initial state (no query submitted) ─── */}
                {!submittedQuery && !showSuggestions && (
                    <div className="flex flex-col items-center justify-center py-20 px-6">
                        <div className="w-20 h-20 rounded-full bg-[#232323] flex items-center justify-center mb-4">
                            <Search className="w-8 h-8 text-zinc-600" />
                        </div>
                        <h3 className="text-lg font-bold text-white mb-2">Search PopClozet</h3>
                        <p className="text-sm text-zinc-500 text-center">
                            Find dresses, jackets, brands, and more. Start typing to see suggestions!
                        </p>
                    </div>
                )}

                <div className="h-8" />
            </main>

            <BottomNavBar />
        </MobileShell>
    );
};

export default SearchResultsPage;
