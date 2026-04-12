import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { Product } from '@/types';
import { formatCurrency } from '@/utils/helpers';

/** Convert Supabase storage URL to optimized render URL (deterministic) */
function thumbImage(url: string | undefined): string {
    if (!url) return '';
    if (!url.includes('supabase.co/storage')) return url;
    try {
        const parsed = new URL(url);
        parsed.pathname = parsed.pathname.replace('/object/public/', '/render/image/public/');
        parsed.search = '';
        parsed.searchParams.set('width', '400');
        parsed.searchParams.set('quality', '70');
        parsed.searchParams.set('resize', 'contain');
        return parsed.toString();
    } catch {
        return url;
    }
}

interface ProductCardProps {
    product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = React.memo(({ product }) => {
    return (
        <Link to={`/products/${product.id}`}>
            <motion.div
                whileHover={{ y: -4 }}
                className="bg-gradient-to-br from-white/8 to-white/3 backdrop-blur-xl rounded-2xl overflow-hidden cursor-pointer border border-white/10 hover:border-[#ff4d6d]/30 transition-all"
            >
                {/* Image */}
                <div className="relative aspect-[3/4] bg-zinc-800 overflow-hidden">
                    {product.images && product.images[0] ? (
                        <img
                            src={thumbImage(product.images[0])}
                            alt={product.name}
                            className="w-full h-full object-cover"
                            loading="eager"
                            decoding="async"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-600">
                            <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={1.5}
                                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                />
                            </svg>
                        </div>
                    )}

                    {/* Hygiene Badge */}
                    <div className="absolute top-2 right-2">
                        <span className="px-2 py-1 rounded-lg text-xs font-semibold bg-green-500/20 text-green-400 backdrop-blur-sm">
                            {product.hygiene_info?.hygiene_rating || 'A+'}
                        </span>
                    </div>
                </div>

                {/* Info */}
                <div className="p-3">
                    <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">
                        {product.brand}
                    </p>
                    <h3 className="font-semibold text-white text-sm mb-2 line-clamp-2">
                        {product.name}
                    </h3>

                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-base font-bold text-[#ff4d6d]">
                                {formatCurrency(product.rental_price)}
                                <span className="text-xs text-zinc-500 font-normal">/day</span>
                            </p>
                        </div>

                        {product.is_available ? (
                            <span className="text-xs text-green-400 font-medium">Available</span>
                        ) : (
                            <span className="text-xs text-red-400 font-medium">Rented</span>
                        )}
                    </div>
                </div>
            </motion.div>
        </Link>
    );
});
