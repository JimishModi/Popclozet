import React from 'react';
import { motion } from 'framer-motion';
import { Package, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { OrderWithItems } from '../services/fulfillmentService';

interface NewOrderOverlayProps {
    order: OrderWithItems;
    onClose: () => void;
    onView: () => void;
}

export function NewOrderOverlay({ order, onClose, onView }: NewOrderOverlayProps) {
    const navigate = useNavigate();

    return (
        <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            className="fixed top-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-[999] bg-zinc-900 border border-warehouse-500/30 rounded-2xl shadow-2xl overflow-hidden"
        >
            <div className="p-4 flex gap-4">
                <div className="w-12 h-12 bg-warehouse-500 rounded-xl flex items-center justify-center shrink-0 text-black shadow-[0_0_15px_rgba(234,179,8,0.3)]">
                    <Package size={24} />
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                    <h3 className="text-white font-bold text-sm">New Order!</h3>
                    <p className="text-zinc-400 text-xs truncate mt-1">#{order.id.slice(0, 8).toUpperCase()} • {order.order_items?.length || 0} items</p>
                </div>
                <button onClick={onClose} className="self-start text-zinc-500 hover:text-white shrink-0 p-1">
                    <X size={16} />
                </button>
            </div>
            <div className="px-4 pb-4">
                <button
                    onClick={onView}
                    className="w-full bg-warehouse-500 text-black py-2.5 rounded-xl font-bold text-sm active:bg-warehouse-600 transition-colors"
                >
                    View Order
                </button>
            </div>
        </motion.div>
    );
}
