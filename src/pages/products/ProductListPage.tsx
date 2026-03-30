import React, { useState, useEffect } from 'react';
import { supabase } from '@/services/supabase';
import { useToast } from '@/contexts/ToastContext';
import type { Product, SearchFilters } from '@/types';
import { ProductCard } from '@/components/features/products/ProductCard';
import { NLPSearchBar } from '@/components/features/search/NLPSearchBar';
import { SkeletonProductCard } from '@/components/ui/Skeleton';
import { motion } from 'framer-motion';

const containerVariants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.06,
        },
    },
};

const itemVariants = {
    hidden: { opacity: 0, y: 16, scale: 0.97 },
    show: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: {
            type: 'spring',
            stiffness: 300,
            damping: 24,
        },
    },
};

export const ProductListPage: React.FC = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState<SearchFilters>({});
    const { showToast } = useToast();

    useEffect(() => {
        fetchProducts();
    }, [filters]);

    const fetchProducts = async () => {
        setLoading(true);
        try {
            let query = supabase.from('products').select('*').eq('is_available', true);

            if (filters.gender) {
                query = query.in('gender', [filters.gender, 'unisex']);
            }

            if (filters.occasion && filters.occasion.length > 0) {
                query = query.contains('occasion', filters.occasion);
            }

            if (filters.priceRange) {
                query = query
                    .gte('rental_price', filters.priceRange.min)
                    .lte('rental_price', filters.priceRange.max);
            }

            const { data, error } = await query;

            if (error) throw error;
            setProducts(data || []);
        } catch (error) {
            console.error('Error fetching products:', error);
            showToast('Failed to load products', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (query: string) => {
        // This would integrate with NLP backend
        console.log('Search query:', query);
        fetchProducts();
    };

    return (
        <div className="min-h-screen bg-[#0a0a0a] py-6 px-4">
            {/* Search Bar */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="mb-6"
            >
                <NLPSearchBar onSearch={handleSearch} />
            </motion.div>

            {/* Filters */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
                className="mb-6 flex flex-wrap gap-3"
            >
                <select
                    className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:border-[#ff4d6d]/50 focus:outline-none focus:ring-2 focus:ring-[#ff4d6d]/20 transition-all"
                    value={filters.gender || ''}
                    onChange={(e) => setFilters({ ...filters, gender: e.target.value as any })}
                >
                    <option value="" className="bg-zinc-900">All Genders</option>
                    <option value="women" className="bg-zinc-900">Women</option>
                    <option value="men" className="bg-zinc-900">Men</option>
                    <option value="unisex" className="bg-zinc-900">Unisex</option>
                </select>

                <select
                    className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:border-[#ff4d6d]/50 focus:outline-none focus:ring-2 focus:ring-[#ff4d6d]/20 transition-all"
                    onChange={(e) => {
                        const occasion = e.target.value;
                        setFilters({
                            ...filters,
                            occasion: occasion ? [occasion] : undefined,
                        });
                    }}
                >
                    <option value="" className="bg-zinc-900">All Occasions</option>
                    <option value="wedding" className="bg-zinc-900">Wedding</option>
                    <option value="party" className="bg-zinc-900">Party</option>
                    <option value="casual" className="bg-zinc-900">Casual</option>
                    <option value="formal" className="bg-zinc-900">Formal</option>
                    <option value="festive" className="bg-zinc-900">Festive</option>
                </select>
            </motion.div>

            {/* Products Grid */}
            {loading ? (
                <div className="grid grid-cols-2 gap-3">
                    {[...Array(6)].map((_, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: i * 0.05 }}
                        >
                            <SkeletonProductCard />
                        </motion.div>
                    ))}
                </div>
            ) : products.length === 0 ? (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-20"
                >
                    <p className="text-xl text-zinc-400">No products found</p>
                </motion.div>
            ) : (
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="show"
                    className="grid grid-cols-2 gap-3"
                >
                    {products.map((product) => (
                        <motion.div
                            key={product.id}
                            variants={itemVariants}
                        >
                            <ProductCard product={product} />
                        </motion.div>
                    ))}
                </motion.div>
            )}
        </div>
    );
};
