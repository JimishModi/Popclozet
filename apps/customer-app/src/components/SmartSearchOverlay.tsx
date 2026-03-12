import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search,
    X,
    TrendingUp,
    Clock,
    ChevronRight,
    Sparkles,
    Shirt,
    ShoppingBag
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface SmartSearchOverlayProps {
    isOpen: boolean;
    onClose: () => void;
    onSearch: (query: string) => void;
}

interface SearchSuggestion {
    id: string;
    type: 'trending' | 'recent' | 'category' | 'product';
    text: string;
    subtext?: string;
    icon?: React.ElementType;
}

const recentSearches = [
    'Summer floral dress',
    'Wedding guest outfit',
    'Denim jacket',
    'Boho chic accessories'
];

const trendingSearches = [
    'Barbiecore',
    'Old Money Aesthetic',
    'Y2K Fashion',
    'Quiet Luxury',
    'Cottagecore'
];

const popularCategories = [
    { name: 'Dresses', icon: Shirt, count: 120 },
    { name: 'Bags', icon: ShoppingBag, count: 45 },
    { name: 'Party Wear', icon: Sparkles, count: 86 },
];

const SmartSearchOverlay: React.FC<SmartSearchOverlayProps> = ({
    isOpen,
    onClose,
    onSearch
}) => {
    const [query, setQuery] = useState('');
    const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);

    // Trap focus when open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (query.trim()) {
            onSearch(query);
            onClose();
        }
    };

    const clearRecent = () => {
        // Implement clear recent logic
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex flex-col items-center">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-background/80 backdrop-blur-xl"
                    />

                    {/* Search Container */}
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="relative w-full max-w-3xl mt-4 px-4 z-10"
                    >
                        {/* Search Bar */}
                        <form onSubmit={handleSearchSubmit} className="relative group">
                            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                                <Search className="h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                            </div>
                            <Input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search for styles, occasions, or moods..."
                                className="w-full h-14 pl-12 pr-12 rounded-2xl border-2 border-primary/10 bg-background shadow-lg focus-visible:ring-0 focus-visible:border-primary/30 text-lg transition-all"
                                autoFocus
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-2 top-2 rounded-xl hover:bg-muted"
                                onClick={onClose}
                            >
                                <X className="h-5 w-5" />
                            </Button>
                        </form>

                        {/* Results Area */}
                        <div className="w-full mt-4 bg-background/50 border border-white/20 rounded-3xl shadow-2xl overflow-hidden backdrop-blur-md">
                            <ScrollArea className="h-[70vh] w-full p-2">
                                <div className="p-4 space-y-8">

                                    {/* Recent Searches */}
                                    {!query && (
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                                                    <Clock className="w-4 h-4" /> Recent Searches
                                                </h3>
                                                <Button variant="ghost" size="sm" onClick={clearRecent} className="text-xs h-auto py-1">
                                                    Clear All
                                                </Button>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {recentSearches.map((term, i) => (
                                                    <motion.button
                                                        key={i}
                                                        initial={{ opacity: 0, scale: 0.9 }}
                                                        animate={{ opacity: 1, scale: 1 }}
                                                        transition={{ delay: i * 0.05 }}
                                                        onClick={() => onSearch(term)}
                                                        className="px-4 py-2 rounded-full bg-muted/50 hover:bg-primary/10 hover:text-primary transition-colors text-sm border border-transparent hover:border-primary/20"
                                                    >
                                                        {term}
                                                    </motion.button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Trending Now */}
                                    {!query && (
                                        <div className="space-y-4">
                                            <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                                                <TrendingUp className="w-4 h-4 text-[#EB76C2]" /> Trending Now
                                            </h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {trendingSearches.map((term, i) => (
                                                    <motion.div
                                                        key={i}
                                                        initial={{ opacity: 0, x: -10 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        transition={{ delay: 0.1 + (i * 0.05) }}
                                                        onClick={() => onSearch(term)}
                                                        className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 cursor-pointer group transition-colors border border-transparent hover:border-border"
                                                    >
                                                        <span className="font-medium group-hover:text-primary transition-colors">
                                                            {term}
                                                        </span>
                                                        <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all transform group-hover:translate-x-1" />
                                                    </motion.div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Popular Categories */}
                                    {!query && (
                                        <div className="space-y-4">
                                            <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                                                <Sparkles className="w-4 h-4 text-amber-500" /> Popular Categories
                                            </h3>
                                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                                                {popularCategories.map((cat, i) => (
                                                    <motion.button
                                                        key={i}
                                                        initial={{ opacity: 0, y: 10 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        transition={{ delay: 0.2 + (i * 0.05) }}
                                                        onClick={() => onSearch(cat.name)}
                                                        className="flex flex-col items-center gap-3 p-4 rounded-2xl bg-muted/30 hover:bg-primary/5 border border-transparent hover:border-primary/20 transition-all text-center group"
                                                    >
                                                        <div className="w-12 h-12 rounded-full bg-background flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                                                            <cat.icon className="w-6 h-6 text-foreground" />
                                                        </div>
                                                        <div>
                                                            <span className="block font-medium text-sm">{cat.name}</span>
                                                            <span className="text-xs text-muted-foreground">{cat.count} items</span>
                                                        </div>
                                                    </motion.button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Search Suggestions (Mock) */}
                                    {query && (
                                        <div className="space-y-2">
                                            <p className="text-sm text-muted-foreground mb-4">
                                                Searching for <span className="text-foreground font-medium">"{query}"</span>
                                            </p>
                                            {/* You would map over actual search results/suggestions here */}
                                            <div className="text-center py-12 text-muted-foreground">
                                                <Search className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                                <p>Start typing to see results...</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>

                            {/* Footer */}
                            <div className="p-4 border-t border-border/50 bg-muted/20 flex justify-between items-center text-xs text-muted-foreground">
                                <div className="flex gap-4">
                                    <span>Press <kbd className="px-1.5 py-0.5 rounded bg-background border border-border font-mono text-[10px]">Enter</kbd> to search</span>
                                    <span><kbd className="px-1.5 py-0.5 rounded bg-background border border-border font-mono text-[10px]">Esc</kbd> to close</span>
                                </div>
                                <div>
                                    AI-Powered Search
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default SmartSearchOverlay;
