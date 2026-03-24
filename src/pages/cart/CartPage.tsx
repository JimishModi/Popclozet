import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '@/contexts/CartContext';
import { Button } from '@/components/ui/Button';
import { SkeletonCartItem } from '@/components/ui/Skeleton';
import { formatCurrency } from '@/utils/helpers';
import { getMinutesRemaining } from '@/utils/date';
import { motion, AnimatePresence } from 'framer-motion';

const itemVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: (i: number) => ({
        opacity: 1,
        y: 0,
        transition: {
            delay: i * 0.06,
            type: 'spring',
            stiffness: 300,
            damping: 24,
        },
    }),
    exit: { opacity: 0, x: -80, transition: { duration: 0.25 } },
};

export const CartPage: React.FC = () => {
    const { items, loading, removeFromCart, getCartTotal } = useCart();
    const navigate = useNavigate();
    const [timers, setTimers] = useState<Record<string, number>>({});

    useEffect(() => {
        const interval = setInterval(() => {
            const newTimers: Record<string, number> = {};
            items.forEach((item) => {
                const minutes = getMinutesRemaining(item.reservation_expires_at);
                newTimers[item.id] = Math.max(0, minutes);
            });
            setTimers(newTimers);
        }, 1000);

        return () => clearInterval(interval);
    }, [items]);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] py-6 px-4">
                <div className="h-7 w-40 bg-white/5 rounded-lg mb-6 skeleton-shimmer relative overflow-hidden">
                    <div className="absolute inset-0 skeleton-shimmer" />
                </div>
                <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: i * 0.08 }}
                        >
                            <SkeletonCartItem />
                        </motion.div>
                    ))}
                </div>
            </div>
        );
    }

    if (items.length === 0) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                    className="text-center"
                >
                    <svg
                        className="mx-auto h-20 w-20 text-zinc-600 mb-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                        />
                    </svg>
                    <h2 className="text-2xl font-bold text-white mb-2">Your cart is empty</h2>
                    <p className="text-zinc-400 mb-6">Add some items to get started</p>
                    <Button onClick={() => navigate('/products')}>Browse Products</Button>
                </motion.div>
            </div>
        );
    }

    const total = getCartTotal();

    return (
        <div className="min-h-screen bg-[#0a0a0a] py-6 px-4">
            <motion.h1
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-2xl font-bold text-white mb-6"
            >
                Shopping Cart
            </motion.h1>

            <div className="space-y-4 mb-6">
                {/* Cart Items */}
                <AnimatePresence>
                    {items.map((item, index) => {
                        const minutesLeft = timers[item.id] || 0;
                        const isExpiring = minutesLeft < 5;

                        return (
                            <motion.div
                                key={item.id}
                                custom={index}
                                variants={itemVariants}
                                initial="hidden"
                                animate="visible"
                                exit="exit"
                                layout
                                className="bg-gradient-to-br from-white/8 to-white/3 backdrop-blur-xl rounded-2xl p-4 border border-white/10"
                            >
                                <div className="flex gap-4">
                                    {/* Image */}
                                    <div className="w-20 h-28 bg-zinc-800 rounded-xl overflow-hidden flex-shrink-0">
                                        {item.product.images?.[0] ? (
                                            <img
                                                src={item.product.images[0]}
                                                alt={item.product.name}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-zinc-600">
                                                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={2}
                                                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                                    />
                                                </svg>
                                            </div>
                                        )}
                                    </div>

                                    {/* Details */}
                                    <div className="flex-1">
                                        <h3 className="font-semibold text-white mb-1">
                                            {item.product.name}
                                        </h3>
                                        <p className="text-sm text-zinc-400 mb-2">
                                            Size: {item.size} • {item.rental_duration_days} days
                                        </p>
                                        <p className="text-lg font-bold text-[#ff4d6d]">
                                            {formatCurrency(item.product.rental_price * item.rental_duration_days)}
                                        </p>

                                        {/* Reservation Timer */}
                                        <div className="mt-2">
                                            <p className={`text-xs font-medium ${isExpiring ? 'text-red-400' : 'text-zinc-500'}`}>
                                                Reserved for: {Math.floor(minutesLeft)}m {Math.floor((minutesLeft % 1) * 60)}s
                                            </p>
                                            {isExpiring && (
                                                <motion.p
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    className="text-xs text-red-400 mt-0.5"
                                                >
                                                    Reservation expiring soon!
                                                </motion.p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Remove Button */}
                                    <motion.button
                                        onClick={() => removeFromCart(item.id)}
                                        whileTap={{ scale: 0.85 }}
                                        className="text-zinc-500 hover:text-red-400 transition-colors"
                                    >
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M6 18L18 6M6 6l12 12"
                                            />
                                        </svg>
                                    </motion.button>
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>

            {/* Summary */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur-xl border-t border-white/10 p-5 z-50"
            >
                <div className="max-w-md mx-auto">
                    <div className="flex justify-between items-center mb-4">
                        <div className="text-zinc-400 text-sm">Total Amount</div>
                        <div className="text-white text-xl font-bold">{formatCurrency(total)}</div>
                    </div>
                    <Button
                        onClick={() => navigate('/checkout')}
                        className="w-full"
                        size="lg"
                    >
                        Proceed to Checkout
                    </Button>
                </div>
            </motion.div>
        </div>
    );
};
