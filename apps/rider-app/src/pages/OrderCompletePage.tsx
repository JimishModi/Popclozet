/**
 * Order Complete Page
 * 
 * Success screen after delivery completion
 */

import { useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle2, IndianRupee, Clock, MapPin, Star } from 'lucide-react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';

export function OrderCompletePage() {
    const navigate = useNavigate();
    const location = useLocation();
    const order = location.state?.order;

    const deliveryStats = {
        earnings: order?.earnings || 56,
        tip: 10,
        bonus: 5,
        total: (order?.earnings || 56) + 10 + 5,
        distance: order?.distance || '2.5 km',
        time: '18 mins',
    };

    return (
        <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
            {/* Success animation area */}
            <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
                {/* Animated checkmark */}
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200, damping: 15 }}
                    className="relative mb-8"
                >
                    {/* Pulse rings */}
                    <motion.div
                        animate={{ scale: [1, 1.5], opacity: [0.4, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="absolute inset-0 w-24 h-24 rounded-full bg-green-500"
                    />
                    <motion.div
                        animate={{ scale: [1, 1.8], opacity: [0.3, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
                        className="absolute inset-0 w-24 h-24 rounded-full bg-green-500"
                    />

                    {/* Icon */}
                    <div className="relative w-24 h-24 rounded-full bg-green-500 flex items-center justify-center">
                        <CheckCircle2 size={48} className="text-white" />
                    </div>
                </motion.div>

                {/* Success text */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="text-center mb-8"
                >
                    <h1 className="text-2xl font-bold text-white mb-2">
                        Delivery Complete! 🎉
                    </h1>
                    <p className="text-zinc-400">
                        Great job! You've successfully delivered the order.
                    </p>
                </motion.div>

                {/* Earnings card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="w-full max-w-sm"
                >
                    <div className="rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden">
                        {/* Total earnings */}
                        <div className="p-6 text-center bg-gradient-to-b from-green-500/10 to-transparent">
                            <p className="text-sm text-zinc-400 mb-1">You Earned</p>
                            <div className="flex items-center justify-center gap-1">
                                <IndianRupee className="text-green-500" size={28} />
                                <span className="text-4xl font-bold text-white">{deliveryStats.total}</span>
                            </div>
                        </div>

                        {/* Breakdown */}
                        <div className="px-6 pb-6 space-y-3">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-zinc-400">Delivery fee</span>
                                <span className="text-white">₹{deliveryStats.earnings}</span>
                            </div>
                            {deliveryStats.tip > 0 && (
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-zinc-400">Customer tip</span>
                                    <span className="text-green-500">+₹{deliveryStats.tip}</span>
                                </div>
                            )}
                            {deliveryStats.bonus > 0 && (
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-zinc-400">Bonus</span>
                                    <span className="text-amber-500">+₹{deliveryStats.bonus}</span>
                                </div>
                            )}

                            <div className="border-t border-zinc-800 my-3" />

                            {/* Delivery stats */}
                            <div className="flex items-center justify-around text-sm">
                                <div className="flex items-center gap-1.5 text-zinc-400">
                                    <MapPin size={14} />
                                    <span>{deliveryStats.distance}</span>
                                </div>
                                <div className="w-px h-4 bg-zinc-800" />
                                <div className="flex items-center gap-1.5 text-zinc-400">
                                    <Clock size={14} />
                                    <span>{deliveryStats.time}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Rating prompt */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="mt-6 text-center"
                >
                    <p className="text-sm text-zinc-500 mb-2">Rate your experience</p>
                    <div className="flex items-center justify-center gap-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                            <button
                                key={star}
                                className="p-1 hover:scale-110 transition-transform"
                            >
                                <Star
                                    size={28}
                                    className={clsx(
                                        star <= 4 ? "fill-amber-500 text-amber-500" : "text-zinc-600"
                                    )}
                                />
                            </button>
                        ))}
                    </div>
                </motion.div>
            </div>

            {/* Footer */}
            <footer className="px-6 py-6 space-y-3">
                <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    onClick={() => navigate('/')}
                    className={clsx(
                        "w-full h-12 rounded-xl font-semibold",
                        "bg-gradient-to-r from-blue-500 to-blue-600",
                        "text-white shadow-lg shadow-blue-500/25"
                    )}
                >
                    Find Next Order
                </motion.button>

                <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    onClick={() => navigate('/earnings')}
                    className={clsx(
                        "w-full h-12 rounded-xl font-semibold",
                        "bg-zinc-800 text-white",
                        "hover:bg-zinc-700 transition-colors"
                    )}
                >
                    View Earnings Summary
                </motion.button>
            </footer>
        </div>
    );
}

export default OrderCompletePage;
