import React from 'react';
import { motion } from 'framer-motion';
import { Package, X, ArrowRight, ClipboardList, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { OrderWithItems } from '../services/fulfillmentService';

interface NewOrderOverlayProps {
    order: OrderWithItems;
    onClose: () => void;
    onView: () => void;
}

export function NewOrderOverlay({ order, onClose, onView }: NewOrderOverlayProps) {
    const navigate = useNavigate();

    const handleProductClick = (productId: string) => {
        onClose(); // Close overlay first
        navigate(`/product/${productId}`);
    };

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

                <div className="space-y-1 mb-8">
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
                    className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 mb-10 space-y-5 shadow-inner overflow-hidden"
                >
                    {/* Order ID and Amount Header */}
                    <div className="flex justify-between items-center pb-4 border-b border-zinc-800">
                        <div className="text-left">
                            <span className="text-zinc-500 font-bold text-[10px] uppercase tracking-widest block mb-0.5">Order ID</span>
                            <span className="text-white font-mono font-bold text-sm">#{order.id.slice(0, 8).toUpperCase()}</span>
                        </div>
                        <div className="text-right">
                            <span className="text-zinc-500 font-bold text-[10px] uppercase tracking-widest block mb-0.5">Total Amount</span>
                            <span className="text-emerald-400 font-black text-2xl">₹{order.total_amount}</span>
                        </div>
                    </div>

                    {/* Delivery Address Section */}
                    {order.addresses?.full_address && (
                        <div className="text-left pb-4 border-b border-zinc-800">
                            <span className="text-zinc-500 font-bold text-[10px] uppercase tracking-widest block mb-2">Delivery Location</span>
                            <div className="flex items-start gap-2.5">
                                <div className="w-7 h-7 rounded-lg bg-warehouse-500/10 flex items-center justify-center shrink-0">
                                    <MapPin size={14} className="text-warehouse-400" />
                                </div>
                                <p className="text-white text-sm font-medium leading-relaxed line-clamp-2">
                                    {order.addresses.full_address}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Items List Section */}
                    <div className="text-left">
                        <div className="flex justify-between items-center mb-3">
                            <span className="text-zinc-500 font-bold text-[10px] uppercase tracking-widest">Order Summary</span>
                            <span className="text-white text-[10px] font-black bg-zinc-800 px-2 py-0.5 rounded-full">
                                {order.order_items?.length || 0} ITEMS
                            </span>
                        </div>
                        
                        <div className="max-h-40 overflow-y-auto no-scrollbar space-y-2.5">
                            {order.order_items?.map((item) => (
                                <button 
                                    key={item.id} 
                                    onClick={() => item.product_id && handleProductClick(item.product_id)}
                                    className="w-full text-left flex items-center gap-3 bg-white/[0.03] p-2.5 rounded-2xl border border-white/[0.05] hover:bg-white/[0.08] hover:border-warehouse-500/30 transition-all active:scale-[0.98]"
                                >
                                    <div className="w-10 h-10 rounded-xl bg-zinc-800 overflow-hidden shrink-0 border border-white/[0.05]">
                                        {item.products?.images?.[0] ? (
                                            <img 
                                                src={item.products.images[0]} 
                                                className="w-full h-full object-cover" 
                                                alt={item.products?.name}
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <Package size={16} className="text-zinc-600" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-white text-xs font-bold truncate leading-tight uppercase tracking-tight">
                                            {item.products?.name || 'Product'}
                                        </p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-warehouse-400 text-[10px] font-black">SIZE: {item.size || 'UNSPECIFIED'}</span>
                                        </div>
                                    </div>
                                </button>
                            ))}
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
