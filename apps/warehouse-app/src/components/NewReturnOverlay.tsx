import React from 'react';
import { motion } from 'framer-motion';
import { RotateCcw, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface NewReturnOverlayProps {
    returnData: {
        id: string;
        order_id: string;
        reason: string;
    };
    onClose: () => void;
    onView: () => void;
}

export function NewReturnOverlay({ returnData, onClose, onView }: NewReturnOverlayProps) {
    const navigate = useNavigate();

    return (
        <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            className="fixed top-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-[999] bg-zinc-900 border border-amber-500/30 rounded-2xl shadow-2xl overflow-hidden"
        >
            <div className="p-4 flex gap-4">
                <div className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center shrink-0 text-black shadow-[0_0_15px_rgba(245,158,11,0.3)]">
                    <RotateCcw size={24} />
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                    <h3 className="text-white font-bold text-sm">Return Requested!</h3>
                    <p className="text-zinc-400 text-xs truncate mt-1">Order #{returnData.order_id.slice(0, 8).toUpperCase()}</p>
                </div>
                <button onClick={onClose} className="self-start text-zinc-500 hover:text-white shrink-0 p-1">
                    <X size={16} />
                </button>
            </div>
            <div className="px-4 pb-4">
                <button
                    onClick={onView}
                    className="w-full bg-amber-500 text-black py-2.5 rounded-xl font-bold text-sm active:bg-amber-600 transition-colors"
                >
                    View Request
                </button>
            </div>
        </motion.div>
    );
}
