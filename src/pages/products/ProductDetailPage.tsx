import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/services/supabase';
import { useCart } from '@/contexts/CartContext';
import { useToast } from '@/contexts/ToastContext';
import type { Product } from '@/types';
import { Button } from '@/components/ui/Button';
import { SkeletonProductDetail } from '@/components/ui/Skeleton';
import { formatCurrency } from '@/utils/helpers';
import { HygieneBadge } from '@/components/features/products/HygieneBadge';
import { motion } from 'framer-motion';

const sectionVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
        opacity: 1,
        y: 0,
        transition: {
            delay: i * 0.08,
            type: 'spring',
            stiffness: 300,
            damping: 24,
        },
    }),
};

export const ProductDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [product, setProduct] = useState<Product | null>(null);
    const [selectedSize, setSelectedSize] = useState('');
    const [rentalDays, setRentalDays] = useState(3);
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState(false);
    const { addToCart } = useCart();
    const { showToast } = useToast();
    const navigate = useNavigate();

    useEffect(() => {
        if (id) {
            fetchProduct();
        }
    }, [id]);

    const fetchProduct = async () => {
        try {
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;
            setProduct(data);

            // Set default size
            if (data.sizes_available && data.sizes_available.length > 0) {
                setSelectedSize(data.sizes_available[0].size);
            }
        } catch (error) {
            console.error('Error fetching product:', error);
            showToast('Failed to load product', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleAddToCart = async () => {
        if (!product) return;
        if (!selectedSize) {
            showToast('Please select a size', 'warning');
            return;
        }

        setAdding(true);
        try {
            await addToCart(product, selectedSize, rentalDays);
            navigate('/cart');
        } catch (error) {
            // Error handled in context
        } finally {
            setAdding(false);
        }
    };

    if (loading) {
        return <SkeletonProductDetail />;
    }

    if (!product) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center"
                >
                    <h2 className="text-2xl font-bold text-white mb-4">Product not found</h2>
                    <Button onClick={() => navigate('/products')}>Browse Products</Button>
                </motion.div>
            </div>
        );
    }

    const totalPrice = product.rental_price * rentalDays;

    return (
        <div className="min-h-screen bg-[#0a0a0a] py-6 px-4">
            {/* Image */}
            <motion.div
                custom={0}
                variants={sectionVariants}
                initial="hidden"
                animate="visible"
                className="mb-6"
            >
                <div className="aspect-[3/4] bg-zinc-800 rounded-2xl overflow-hidden">
                    {product.images && product.images[0] ? (
                        <img
                            src={product.images[0]}
                            alt={product.name}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-600">
                            <svg className="w-20 h-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={1}
                                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                />
                            </svg>
                        </div>
                    )}
                </div>
            </motion.div>

            {/* Details */}
            <div className="space-y-5">
                <motion.div custom={1} variants={sectionVariants} initial="hidden" animate="visible">
                    <p className="text-sm text-zinc-500 uppercase tracking-wide mb-1">
                        {product.brand}
                    </p>
                    <h1 className="text-2xl font-bold text-white mb-2">
                        {product.name}
                    </h1>
                    <p className="text-zinc-400 text-sm">{product.description}</p>
                </motion.div>

                {/* Hygiene Info */}
                <motion.div custom={2} variants={sectionVariants} initial="hidden" animate="visible">
                    <HygieneBadge hygieneInfo={product.hygiene_info} />
                </motion.div>

                {/* Fabric Details */}
                <motion.div
                    custom={3}
                    variants={sectionVariants}
                    initial="hidden"
                    animate="visible"
                    className="bg-gradient-to-br from-white/8 to-white/3 backdrop-blur-xl rounded-2xl p-4 border border-white/10"
                >
                    <h3 className="font-semibold text-white mb-3">Fabric Details</h3>
                    <div className="space-y-2 text-sm text-zinc-300">
                        <p><span className="text-zinc-500">Composition:</span> {product.fabric_details?.composition}</p>
                        <p><span className="text-zinc-500">Stretch:</span> {product.fabric_details?.stretch_percentage}%</p>
                        <p><span className="text-zinc-500">Comfort Rating:</span> {product.fabric_details?.comfort_rating}/5</p>
                    </div>
                </motion.div>

                {/* Size Selection */}
                <motion.div custom={4} variants={sectionVariants} initial="hidden" animate="visible">
                    <label className="block text-sm font-medium text-zinc-300 mb-3">
                        Select Size
                    </label>
                    <div className="grid grid-cols-4 gap-3">
                        {product.sizes_available?.map((sizeOption) => (
                            <motion.button
                                key={sizeOption.size}
                                onClick={() => setSelectedSize(sizeOption.size)}
                                disabled={sizeOption.stock_count === 0}
                                whileTap={{ scale: 0.95 }}
                                className={`
                                    px-4 py-3 border-2 rounded-xl font-medium transition-all
                                    ${selectedSize === sizeOption.size
                                        ? 'border-[#ff4d6d] bg-[#ff4d6d]/10 text-[#ff4d6d]'
                                        : 'border-white/10 text-white hover:border-white/30'
                                    }
                                    ${sizeOption.stock_count === 0 ? 'opacity-50 cursor-not-allowed' : ''}
                                `}
                            >
                                {sizeOption.size}
                            </motion.button>
                        ))}
                    </div>
                </motion.div>

                {/* Rental Duration */}
                <motion.div custom={5} variants={sectionVariants} initial="hidden" animate="visible">
                    <label className="block text-sm font-medium text-zinc-300 mb-3">
                        Rental Duration
                    </label>
                    <div className="flex items-center gap-4">
                        <motion.button
                            onClick={() => setRentalDays(Math.max(1, rentalDays - 1))}
                            whileTap={{ scale: 0.9 }}
                            className="w-10 h-10 rounded-xl border-2 border-white/10 text-white hover:border-[#ff4d6d] transition-colors"
                        >
                            -
                        </motion.button>
                        <span className="text-xl font-semibold text-white w-24 text-center">
                            {rentalDays} {rentalDays === 1 ? 'day' : 'days'}
                        </span>
                        <motion.button
                            onClick={() => setRentalDays(rentalDays + 1)}
                            whileTap={{ scale: 0.9 }}
                            className="w-10 h-10 rounded-xl border-2 border-white/10 text-white hover:border-[#ff4d6d] transition-colors"
                        >
                            +
                        </motion.button>
                    </div>
                </motion.div>

                {/* Pricing */}
                <motion.div
                    custom={6}
                    variants={sectionVariants}
                    initial="hidden"
                    animate="visible"
                    className="bg-gradient-to-br from-[#ff4d6d]/20 to-[#ff4d6d]/5 rounded-2xl p-4 border border-[#ff4d6d]/20"
                >
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-zinc-300">Rental Price</span>
                        <span className="text-2xl font-bold text-[#ff4d6d]">
                            {formatCurrency(totalPrice)}
                        </span>
                    </div>
                    <p className="text-sm text-zinc-400">
                        {formatCurrency(product.rental_price)} × {rentalDays} days
                    </p>
                    <p className="text-sm text-zinc-400 mt-1">
                        Refundable Deposit: {formatCurrency(product.deposit_amount)}
                    </p>
                </motion.div>

                {/* Add to Cart */}
                <motion.div custom={7} variants={sectionVariants} initial="hidden" animate="visible">
                    <Button
                        onClick={handleAddToCart}
                        className="w-full"
                        size="lg"
                        loading={adding}
                        disabled={!product.is_available}
                    >
                        {product.is_available ? 'Add to Cart' : 'Currently Unavailable'}
                    </Button>
                </motion.div>
            </div>
        </div>
    );
};
