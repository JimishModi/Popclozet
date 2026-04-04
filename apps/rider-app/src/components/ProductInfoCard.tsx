/**
 * ProductInfoCard — Read-only product details card for Rider App
 *
 * Displayed after a successful QR scan so the rider can visually verify
 * the product (name, brand, size, image, status) before picking it up.
 * Unlike the warehouse version, this card has NO action buttons —
 * it is purely informational.
 */

import { motion } from 'framer-motion';
import { Package, X } from 'lucide-react';
import { clsx } from 'clsx';
import type { PhysicalUnit } from '../services/physicalUnitService';

interface ProductInfoCardProps {
    item: PhysicalUnit;
    onClose: () => void;
}

export function ProductInfoCard({ item, onClose }: ProductInfoCardProps) {
    const statusColor =
        item.status === 'available'
            ? 'bg-emerald-500 text-black'
            : item.status === 'rented'
            ? 'bg-blue-500 text-white'
            : 'bg-red-500 text-white';

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden w-[90vw] max-w-[400px]"
        >
            {/* Product image */}
            <div className="relative h-48 bg-black">
                {item.inventory?.products?.images?.[0] ? (
                    <img
                        src={item.inventory.products.images[0]}
                        alt=""
                        className="w-full h-full object-contain p-4"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-700">
                        <Package size={48} />
                    </div>
                )}
                <button
                    onClick={onClose}
                    className="absolute top-3 right-3 p-1.5 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
                >
                    <X size={16} />
                </button>
                <div
                    className={clsx(
                        'absolute bottom-3 left-3 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest',
                        statusColor
                    )}
                >
                    {item.status}
                </div>
            </div>

            {/* Product info */}
            <div className="p-5 space-y-4">
                <div>
                    <h3 className="text-white font-bold leading-tight">
                        {item.inventory?.products?.name || 'Unknown Item'}
                    </h3>
                    <p className="text-zinc-500 text-xs mt-0.5">
                        {item.inventory?.products?.brand} • Size: {item.inventory?.size}
                    </p>
                    {item.inventory?.products?.category && (
                        <p className="text-zinc-600 text-[10px] mt-1">
                            Category: {item.inventory.products.category}
                        </p>
                    )}
                    <p className="text-[10px] text-zinc-600 font-mono mt-2">
                        ID: {item.individual_id}
                    </p>
                </div>

                {/* Status info */}
                {item.status === 'available' && (
                    <div className="px-3 py-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-xs font-medium text-center">
                        ✓ Item is available in inventory
                    </div>
                )}
                {item.status === 'rented' && (
                    <div className="px-3 py-2.5 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400 text-xs font-medium text-center">
                        📦 Item is currently rented out
                    </div>
                )}

                <button
                    onClick={onClose}
                    className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-zinc-300 text-sm font-semibold hover:bg-white/10 transition-all active:scale-[0.98]"
                >
                    Close
                </button>
            </div>
        </motion.div>
    );
}
