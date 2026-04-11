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
    const isInstant = returnData.reason === 'immediate';

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[999] flex items-center justify-center"
        >
            {/* Fullscreen pulsing backdrop */}
            <motion.div
                className="absolute inset-0 bg-black/80"
                animate={{ backgroundColor: ['rgba(0,0,0,0.8)', 'rgba(245,158,11,0.15)', 'rgba(0,0,0,0.8)'] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                onClick={onClose}
            />

            {/* Card */}
            <motion.div
                initial={{ scale: 0.8, y: 40 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.8, y: 40 }}
                transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                className="relative w-[90%] max-w-md bg-zinc-900 border-2 border-amber-500 rounded-3xl shadow-[0_0_60px_rgba(245,158,11,0.3)] overflow-hidden"
            >
                {/* Glowing top bar */}
                <div className="h-1.5 bg-gradient-to-r from-amber-500 via-orange-400 to-amber-500" />

                <div className="p-6">
                    {/* Close button */}
                    <button onClick={onClose} className="absolute top-4 right-4 text-zinc-500 hover:text-white p-1">
                        <X size={20} />
                    </button>

                    {/* Icon + Title */}
                    <div className="flex flex-col items-center text-center mb-6">
                        <motion.div
                            animate={{ scale: [1, 1.15, 1] }}
                            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                            className="w-20 h-20 bg-amber-500 rounded-2xl flex items-center justify-center text-black shadow-[0_0_30px_rgba(245,158,11,0.5)] mb-4"
                        >
                            <RotateCcw size={36} />
                        </motion.div>
                        <h3 className="text-white font-black text-2xl tracking-tight">
                            {isInstant ? 'INSTANT RETURN!' : 'RETURN REQUEST!'}
                        </h3>
                        <p className="text-zinc-400 text-sm mt-2">
                            Order #{returnData.order_id.slice(0, 8).toUpperCase()}
                        </p>
                        {isInstant && (
                            <span className="mt-2 px-3 py-1 rounded-full bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-bold uppercase tracking-wider">
                                Urgent — Review Now
                            </span>
                        )}
                    </div>

                    {/* CTA */}
                    <motion.button
                        onClick={onView}
                        animate={{ boxShadow: ['0 0 0px rgba(245,158,11,0.4)', '0 0 25px rgba(245,158,11,0.6)', '0 0 0px rgba(245,158,11,0.4)'] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="w-full bg-amber-500 text-black py-4 rounded-2xl font-black text-lg uppercase tracking-wider active:bg-amber-600 transition-colors"
                    >
                        View Request
                    </motion.button>
                </div>
            </motion.div>
        </motion.div>
    );
}
