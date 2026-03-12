import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MobileShell } from '@/components/layout/MobileShell';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { cn } from '@/lib/utils';

// Mock data
const COLLECTIONS = [
    { id: "wedding", title: "Wedding Ready", gradient: "from-pink-400 to-rose-500" },
    { id: "festive", title: "Festive Favourites", gradient: "from-orange-400 to-amber-500" },
    { id: "party", title: "Party Wear", gradient: "from-purple-400 to-indigo-500" },
    { id: "casual", title: "Casual Chic", gradient: "from-teal-400 to-cyan-500" },
];

const CATEGORIES = [
    { id: "dresses", label: "Dresses", emoji: "👗" },
    { id: "lehengas", label: "Lehengas", emoji: "🥻" },
    { id: "sarees", label: "Sarees", emoji: "🎀" },
    { id: "western", label: "Western", emoji: "👔" },
];

// Icons
const SearchIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
);

const ChevronRightIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 18 15 12 9 6" />
    </svg>
);

const HeartIcon = ({ className, fill }: { className?: string; fill?: boolean }) => (
    <svg className={className} viewBox="0 0 24 24" fill={fill ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
);

const StarIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
);

// Stagger animation variants
const containerVariants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.08,
            delayChildren: 0.1,
        },
    },
};

const fadeUpVariant = {
    hidden: { opacity: 0, y: 16 },
    show: {
        opacity: 1,
        y: 0,
        transition: {
            type: 'spring',
            stiffness: 300,
            damping: 24,
        },
    },
};

const scaleInVariant = {
    hidden: { opacity: 0, scale: 0.9 },
    show: {
        opacity: 1,
        scale: 1,
        transition: {
            type: 'spring',
            stiffness: 300,
            damping: 24,
        },
    },
};

export const HomePage: React.FC = () => {
    const [activeGender, setActiveGender] = useState<"women" | "men">("women");
    const [activeCategory, setActiveCategory] = useState("dresses");

    return (
        <MobileShell className="bg-black text-white">
            <MobileHeader />

            {/* Main Content */}
            <motion.main
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="flex-1 overflow-y-auto pb-24"
            >

                {/* Hero Section */}
                <motion.div variants={fadeUpVariant} className="relative px-4 pt-6 pb-8 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-b from-[#ff4d6d]/10 to-transparent pointer-events-none" />

                    {/* Gender Selector - Rectangle Glass Panel */}
                    <div className="relative h-14 bg-white/5 rounded-2xl p-1.5 mb-6 backdrop-blur-md border border-white/10 mx-auto max-w-xs shadow-inner overflow-hidden">
                        {/* Background Labels */}
                        <div className="absolute inset-0 flex items-center justify-between px-10 z-0">
                            <span className="text-xs font-bold text-zinc-600 tracking-wider">WOMEN</span>
                            <span className="text-xs font-bold text-zinc-600 tracking-wider">MEN</span>
                        </div>

                        {/* Active Sliding Panel */}
                        <motion.div
                            className="absolute top-1.5 bottom-1.5 left-1.5 w-[calc(50%-6px)] bg-[#ff4d6d] rounded-xl shadow-lg shadow-[#ff4d6d]/30 flex items-center justify-center z-10"
                            initial={false}
                            animate={{
                                x: activeGender === 'women' ? '0%' : 'calc(100% + 6px)'
                            }}
                            transition={{
                                type: "spring",
                                stiffness: 400,
                                damping: 30
                            }}
                        >
                            <span className="text-xs font-bold text-white tracking-widest uppercase">
                                {activeGender === 'women' ? 'Women' : 'Men'}
                            </span>
                        </motion.div>

                        {/* Invisible Click areas */}
                        <div className="absolute inset-0 flex z-20">
                            <div className="flex-1 cursor-pointer" onClick={() => setActiveGender('women')} />
                            <div className="flex-1 cursor-pointer" onClick={() => setActiveGender('men')} />
                        </div>
                    </div>

                    {/* Hero Title with Gradient */}
                    <div className="text-center space-y-2 mb-6 relative z-10">
                        <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-[#ff4d6d] to-pink-400 tracking-tight leading-tight">
                            New Outfit<br />Everyday!
                        </h2>
                        <p className="text-sm font-medium text-zinc-400 tracking-wide uppercase">
                            Delivered in 60 Minutes
                        </p>
                    </div>

                    {/* Search Bar - Glassmorphism */}
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                            <SearchIcon className="h-5 w-5 text-zinc-400 group-focus-within:text-[#ff4d6d] transition-colors" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search for outfits, brands..."
                            className="w-full bg-white/5 border border-white/10 text-white text-sm rounded-2xl py-3.5 pl-10 pr-4 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#ff4d6d]/50 focus:border-[#ff4d6d]/50 transition-all backdrop-blur-sm"
                        />
                    </div>
                </motion.div>

                {/* Category Chips */}
                <motion.div variants={fadeUpVariant} className="px-4 pb-4">
                    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                        {CATEGORIES.map((cat) => (
                            <motion.button
                                key={cat.id}
                                onClick={() => setActiveCategory(cat.id)}
                                whileTap={{ scale: 0.95 }}
                                className={cn(
                                    "flex-shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-medium transition-all",
                                    activeCategory === cat.id
                                        ? "bg-[#ff4d6d] text-white shadow-lg shadow-[#ff4d6d]/30"
                                        : "bg-white/5 text-zinc-400 border border-white/10 hover:border-[#ff4d6d]/30 hover:text-white"
                                )}
                            >
                                <span>{cat.emoji}</span>
                                <span>{cat.label}</span>
                            </motion.button>
                        ))}
                    </div>
                </motion.div>

                {/* Featured Collections */}
                <motion.div variants={fadeUpVariant} className="px-4 pb-6">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-lg font-bold text-white">Featured Collections</h2>
                        <Link to="/products" className="text-xs font-medium text-[#ff4d6d] flex items-center gap-1">
                            View All <ChevronRightIcon className="w-3 h-3" />
                        </Link>
                    </div>
                    <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
                        {COLLECTIONS.map((collection, index) => (
                            <motion.div
                                key={collection.id}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.3 + index * 0.06, type: 'spring', stiffness: 300, damping: 24 }}
                                whileHover={{ scale: 1.03 }}
                                whileTap={{ scale: 0.97 }}
                                className={cn(
                                    "flex-shrink-0 w-28 h-36 rounded-2xl relative overflow-hidden cursor-pointer",
                                    "bg-gradient-to-br",
                                    collection.gradient,
                                    "shadow-lg"
                                )}
                            >
                                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                                <div className="absolute bottom-3 left-3 right-2 text-white">
                                    <p className="text-xs font-semibold leading-tight">{collection.title}</p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </motion.div>

                {/* Trending Now */}
                <motion.div variants={fadeUpVariant} className="px-4 pb-6">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-lg font-bold text-white">Trending Now</h2>
                        <Link to="/products" className="text-xs font-medium text-[#ff4d6d] flex items-center gap-1">
                            View All <ChevronRightIcon className="w-3 h-3" />
                        </Link>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        {/* Product Card 1 */}
                        {[
                            { name: 'Maxi Dress', price: '₹999/day', rating: '4.8', gradient: 'from-pink-500/30 to-purple-500/30', filled: true },
                            { name: 'Designer Lehenga', price: '₹2499/day', rating: '4.9', gradient: 'from-rose-500/30 to-orange-500/30', filled: false },
                            { name: 'Party Gown', price: '₹1499/day', rating: '4.7', gradient: 'from-indigo-500/30 to-blue-500/30', filled: false },
                            { name: 'Silk Saree', price: '₹1799/day', rating: '4.9', gradient: 'from-emerald-500/30 to-teal-500/30', filled: false },
                        ].map((product, index) => (
                            <Link to="/products" key={product.name}>
                                <motion.div
                                    variants={scaleInVariant}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.97 }}
                                    className="rounded-2xl overflow-hidden bg-white/5 border border-white/10 backdrop-blur-sm"
                                >
                                    <div className="relative">
                                        <div className={`aspect-[3/4] bg-gradient-to-br ${product.gradient}`} />
                                        <motion.button
                                            whileTap={{ scale: 0.85 }}
                                            className="absolute top-2 right-2 w-8 h-8 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/10"
                                        >
                                            <HeartIcon className={`w-4 h-4 ${product.filled ? 'text-[#ff4d6d]' : 'text-zinc-400'}`} fill={product.filled} />
                                        </motion.button>
                                        <div className="absolute bottom-2 left-2">
                                            <span className="inline-block px-2 py-1 bg-green-500/90 text-white text-[10px] font-semibold rounded-md">
                                                Available
                                            </span>
                                        </div>
                                    </div>
                                    <div className="p-3">
                                        <h3 className="font-semibold text-sm text-white mb-1 truncate">{product.name}</h3>
                                        <div className="flex items-center justify-between">
                                            <p className="text-[#ff4d6d] font-bold text-sm">{product.price}</p>
                                            <div className="flex items-center gap-0.5">
                                                <StarIcon className="w-3.5 h-3.5 text-yellow-400" />
                                                <span className="text-xs text-zinc-400 font-medium">{product.rating}</span>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            </Link>
                        ))}
                    </div>
                </motion.div>
            </motion.main>

            <BottomNavigation />
        </MobileShell>
    );
};
