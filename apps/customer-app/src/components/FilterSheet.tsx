import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

interface FilterSheetProps {
    isOpen: boolean;
    onClose: () => void;
}

type FilterTab = 'size' | 'price' | 'brand';

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const BRANDS = ['Zara', 'H&M', 'Gucci', 'Prada', 'Nike', 'Adidas'];

export const FilterSheet: React.FC<FilterSheetProps> = ({ isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState<FilterTab>('size');
    const [selectedSizes, setSelectedSizes] = useState<string[]>(['S', 'M']);
    const [priceRange, setPriceRange] = useState({ min: 100, max: 1200 });

    const toggleSize = (size: string) => {
        setSelectedSizes(prev =>
            prev.includes(size) ? prev.filter(s => s !== size) : [...prev, size]
        );
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 z-40"
                        onClick={onClose}
                    />

                    {/* Filter Sheet – compact, fits mobile */}
                    <motion.div
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                        className="fixed bottom-0 left-0 right-0 z-50 max-w-[430px] mx-auto"
                    >
                        <div className="bg-[#2a2a2a] rounded-t-3xl">
                            {/* Tab pills */}
                            <div className="px-5 pt-5 pb-4">
                                <div className="flex items-center gap-3">
                                    {(['size', 'price', 'brand'] as FilterTab[]).map((tab) => (
                                        <button
                                            key={tab}
                                            onClick={() => setActiveTab(tab)}
                                            className={cn(
                                                "px-5 py-2 rounded-full font-semibold text-sm transition-all capitalize",
                                                activeTab === tab
                                                    ? "bg-[#3a3a3a] text-white"
                                                    : "text-zinc-500"
                                            )}
                                        >
                                            {tab}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Content area – compact, no min-height */}
                            <div className="px-5 pb-5">
                                {/* Size tab */}
                                {activeTab === 'size' && (
                                    <div className="grid grid-cols-5 gap-2">
                                        {SIZES.map((size) => {
                                            const isSelected = selectedSizes.includes(size);
                                            return (
                                                <button
                                                    key={size}
                                                    onClick={() => toggleSize(size)}
                                                    className={cn(
                                                        "flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-xl border transition-all",
                                                        isSelected
                                                            ? "bg-white border-white"
                                                            : "bg-transparent border-zinc-600"
                                                    )}
                                                >
                                                    {isSelected && (
                                                        <div className="w-4 h-4 rounded bg-black flex items-center justify-center flex-shrink-0">
                                                            <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                                                <polyline points="20 6 9 17 4 12" />
                                                            </svg>
                                                        </div>
                                                    )}
                                                    <span className={cn(
                                                        "font-bold text-sm",
                                                        isSelected ? "text-black" : "text-white"
                                                    )}>
                                                        {size}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Price tab */}
                                {activeTab === 'price' && (
                                    <div className="space-y-5">
                                        <div className="flex gap-3">
                                            <div className="flex-1">
                                                <input
                                                    type="text"
                                                    value={`Min : ₹ ${priceRange.min}`}
                                                    readOnly
                                                    className="w-full px-3 py-2.5 rounded-xl bg-transparent border border-zinc-600 text-white text-sm font-medium"
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <input
                                                    type="text"
                                                    value={`Max : ₹ ${priceRange.max}`}
                                                    readOnly
                                                    className="w-full px-3 py-2.5 rounded-xl bg-transparent border border-zinc-600 text-white text-sm font-medium"
                                                />
                                            </div>
                                        </div>

                                        {/* Range Slider */}
                                        <div className="relative pt-2 pb-1">
                                            <div className="relative h-0.5 bg-zinc-700 rounded-full">
                                                <div
                                                    className="absolute h-0.5 bg-[#f2546d] rounded-full"
                                                    style={{ left: '10%', right: '20%' }}
                                                />
                                                <div className="absolute -top-2.5 left-[10%] w-6 h-6 bg-zinc-400 rounded-full border-[3px] border-[#f2546d]" />
                                                <div className="absolute -top-2.5 right-[20%] w-6 h-6 bg-zinc-400 rounded-full border-[3px] border-[#f2546d]" />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Brand tab */}
                                {activeTab === 'brand' && (
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-3 gap-2">
                                            {BRANDS.map((brand) => (
                                                <div
                                                    key={brand}
                                                    className="aspect-[3/2] rounded-xl bg-[#1a1a1a] border border-zinc-700/50 flex items-center justify-center"
                                                >
                                                    {/* Brand logo placeholder */}
                                                </div>
                                            ))}
                                        </div>
                                        <button className="w-full text-[#f2546d] font-semibold text-sm text-center py-1">
                                            See all
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
