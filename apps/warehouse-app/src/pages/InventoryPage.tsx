import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, Package, ChevronRight, BarChart3, AlertTriangle, ShoppingBag } from 'lucide-react';
import { clsx } from 'clsx';
import { getAllProductProfiles } from '../services/productProfileService';
import { useRealtimeInventory } from '../hooks/useRealtimeInventory';

export function InventoryPage() {
    const navigate = useNavigate();
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');

    const loadProducts = useCallback(async () => {
        try {
            const data = await getAllProductProfiles();
            setProducts(data);
        } catch (err) {
            console.error('Failed to load products:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadProducts(); }, [loadProducts]);
    useRealtimeInventory({ onChange: loadProducts });

    const categories = Array.from(
        new Set(products.map(p => p.category).filter(Boolean))
    ).sort() as string[];

    const filtered = products.filter(p => {
        const name = p.name?.toLowerCase() || '';
        const brand = p.brand?.toLowerCase() || '';
        const category = p.category?.toLowerCase() || '';
        const q = search.toLowerCase();
        const matchesSearch = name.includes(q) || brand.includes(q) || category.includes(q);
        const matchesCategory = !selectedCategory || p.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    if (loading) {
        return (
            <div className="px-4 py-5 space-y-4">
                <div className="h-8 w-48 bg-surface-card rounded-lg animate-pulse" />
                {[...Array(5)].map((_, i) => <div key={i} className="bg-surface-card rounded-xl h-24 animate-pulse" />)}
            </div>
        );
    }

    return (
        <div className="px-4 py-5 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-bold text-white">Inventory</h1>
                    <p className="text-xs text-zinc-500">{products.length} products</p>
                </div>
                <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] text-emerald-400 font-semibold">LIVE</span>
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search products..."
                    className="input-field pl-9 h-10 text-sm"
                />
            </div>

            {/* Category Filter Pills */}
            {categories.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    <button
                        onClick={() => setSelectedCategory('')}
                        className={clsx(
                            "flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold border transition-colors",
                            !selectedCategory
                                ? "bg-warehouse-500 border-warehouse-500 text-white"
                                : "bg-surface-card border-surface-border text-zinc-400 hover:border-zinc-500"
                        )}
                    >
                        All
                    </button>
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(selectedCategory === cat ? '' : cat)}
                            className={clsx(
                                "flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold border transition-colors capitalize",
                                selectedCategory === cat
                                    ? "bg-warehouse-500 border-warehouse-500 text-white"
                                    : "bg-surface-card border-surface-border text-zinc-400 hover:border-zinc-500"
                            )}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            )}

            {/* Card List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filtered.length === 0 ? (
                    <div className="text-center py-12">
                        <Package size={32} className="mx-auto text-zinc-600 mb-2" />
                        <p className="text-zinc-500 text-sm">{search || selectedCategory ? 'No matches' : 'No products found'}</p>
                    </div>
                ) : (
                    filtered.map((product) => {
                        const hasLowStock = product.total_available <= 2;
                        
                        return (
                            <motion.button
                                key={product.id}
                                layout
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                onClick={() => navigate(`/product/${product.id}`)}
                                className="group flex items-stretch gap-3 bg-surface-card border border-surface-border rounded-xl p-3 text-left hover:border-warehouse-500/30 transition-all active:scale-[0.99]"
                            >
                                {/* Thumbnail */}
                                <div className="w-16 h-20 rounded-lg bg-surface overflow-hidden flex-shrink-0 border border-surface-border">
                                    {product.images && product.images[0] ? (
                                        <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-zinc-700">
                                            <Package size={20} />
                                        </div>
                                    )}
                                </div>

                                {/* Content */}
                                <div className="flex-1 flex flex-col justify-between py-0.5 min-w-0">
                                    <div>
                                        <div className="flex items-center justify-between gap-2">
                                            <h3 className="text-sm font-semibold text-zinc-200 truncate">{product.name}</h3>
                                            <ChevronRight size={14} className="text-zinc-600 group-hover:text-warehouse-400 transition-colors" />
                                        </div>
                                        <p className="text-[10px] text-zinc-500 uppercase tracking-tight">{product.brand || 'No Brand'} • {product.category || 'Uncategorized'}</p>
                                    </div>

                                    {/* Stats */}
                                    <div className="flex items-center gap-3 mt-1">
                                        <div className="flex items-center gap-1.5">
                                            <div className={clsx(
                                                "px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1",
                                                product.total_available === 0 ? "bg-red-500/10 text-red-400 border border-red-500/20" :
                                                hasLowStock ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                                                "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                            )}>
                                                {hasLowStock && <AlertTriangle size={10} />}
                                                {product.total_available} Available
                                            </div>
                                            {product.total_wash > 0 && (
                                                <div className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1">
                                                    <BarChart3 size={10} />
                                                    {product.total_wash} Washing
                                                </div>
                                            )}
                                            {product.total_instantly_bought > 0 && (
                                                <div className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center gap-1">
                                                    <ShoppingBag size={10} />
                                                    {product.total_instantly_bought} Instant Buy
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </motion.button>
                        );
                    })
                )}
            </div>
        </div>
    );
}

