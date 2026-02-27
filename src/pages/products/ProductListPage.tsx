import React, { useState, useEffect } from 'react';
import { supabase } from '@/services/supabase';
import { useToast } from '@/contexts/ToastContext';
import type { Product, SearchFilters } from '@/types';
import { ProductCard } from '@/components/features/products/ProductCard';
import { NLPSearchBar } from '@/components/features/search/NLPSearchBar';
import { Loader } from '@/components/ui/Loader';
import { motion } from 'framer-motion';

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
                query = query.eq('gender', filters.gender);
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
            <div className="mb-6">
                <NLPSearchBar onSearch={handleSearch} />
            </div>

            {/* Filters */}
            <div className="mb-6 flex flex-wrap gap-3">
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
            </div>

            {/* Products Grid */}
            {loading ? (
                <div className="flex justify-center py-20">
                    <Loader size="lg" text="Loading products..." />
                </div>
            ) : products.length === 0 ? (
                <div className="text-center py-20">
                    <p className="text-xl text-zinc-400">No products found</p>
                </div>
            ) : (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="grid grid-cols-2 gap-3"
                >
                    {products.map((product, index) => (
                        <motion.div
                            key={product.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                        >
                            <ProductCard product={product} />
                        </motion.div>
                    ))}
                </motion.div>
            )}
        </div>
    );
};
