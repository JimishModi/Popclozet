import React from 'react';
import { motion } from 'framer-motion';
import { Package, X, ArrowRight, ClipboardList } from 'lucide-react';
import type { OrderWithItems } from '../services/fulfillmentService';

interface NewOrderOverlayProps {
    order: OrderWithItems;
    onClose: () => void;
    onView: () => void;
}

export function NewOrderOverlay({ order, onClose, onView }: NewOrderOverlayProps) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[999] bg-black/95 backdrop-blur-xl flex items-center justify-center p-6 text-center shadow-2xl"
        >
            <div className="max-w-md w-full animate-in fade-in zoom-in duration-300">
                <motion.div
                    animate={{ 
                        scale: [1, 1.05, 1],
                        rotate: [0, -1, 1, 0]
                    }}
                    transition={{ 
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                    className="w-24 h-24 bg-warehouse-500 rounded-3xl mx-auto mb-8 flex items-center justify-center text-black shadow-[0_0_50px_rgba(234,179,8,0.3)]"
                >
                    <Package size={48} strokeWidth={2.5} />
                </motion.div>

                <div className="space-y-2 mb-10">
                    <motion.h2 
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.1 }}
                        className="text-4xl font-black text-white tracking-tight uppercase"
                    >
                        New Order!
                    </motion.h2>
                    <motion.p 
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="text-warehouse-400 font-bold text-lg tracking-widest uppercase opacity-80"
                    >
                        Incoming Delivery
                    </motion.p>
                </div>

                <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 mb-10 space-y-4 shadow-inner"
                >
                    <div className="flex justify-between items-center pb-4 border-b border-zinc-800">
                        <span className="text-zinc-500 font-bold text-xs uppercase tracking-wider">Order ID</span>
                        <span className="text-white font-mono font-bold">#{order.id.slice(0, 8).toUpperCase()}</span>
                    </div>
                    <div className="flex justify-between items-center pb-4 border-b border-zinc-800">
                        <span className="text-zinc-500 font-bold text-xs uppercase tracking-wider">Amount</span>
                        <span className="text-emerald-400 font-bold text-xl">₹{order.total_amount}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-zinc-500 font-bold text-xs uppercase tracking-wider">Items</span>
                        <div className="flex items-center gap-2">
                            <ClipboardList size={16} className="text-zinc-400" />
                            <span className="text-white font-bold">{order.order_items?.length || 1} Products</span>
                        </div>
                    </div>
                </motion.div>

                <div className="grid grid-cols-1 gap-4">
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={onView}
                        className="w-full bg-warehouse-500 text-black py-5 rounded-2xl font-black text-lg flex items-center justify-center gap-3 shadow-lg shadow-warehouse-500/20 active:bg-warehouse-600 transition-colors"
                    >
                        Process Order <ArrowRight size={20} />
                    </motion.button>
                    <button
                        onClick={onClose}
                        className="w-full bg-transparent text-zinc-500 py-3 rounded-2xl font-bold text-sm hover:text-white transition-colors"
                    >
                        Dismiss for now
                    </button>
                </div>
            </div>

            <button 
                onClick={onClose}
                className="absolute top-10 right-10 p-3 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all shadow-xl active:scale-90"
            >
                <X size={24} />
            </button>
        </motion.div>
    );
}
