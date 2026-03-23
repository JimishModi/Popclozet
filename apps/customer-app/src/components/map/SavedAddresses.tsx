// src/components/map/SavedAddresses.tsx
// Component to manage and display user's saved addresses

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Home, Briefcase, Star, Trash2, Plus, Check } from 'lucide-react';
import { getLocalAddresses, SavedAddress } from '@/services/addressService';
import { cn } from '@/lib/utils';

interface SavedAddressesProps {
    onSelect: (address: SavedAddress) => void;
    selectedAddressId?: string;
    className?: string;
    showAddButton?: boolean;
    onAddNew?: () => void;
}

const LABEL_ICONS: Record<string, React.ReactNode> = {
    'Home': <Home className="w-4 h-4" />,
    'Work': <Briefcase className="w-4 h-4" />,
    'Other': <MapPin className="w-4 h-4" />,
};

export function SavedAddresses({
    onSelect,
    selectedAddressId,
    className,
    showAddButton = true,
    onAddNew,
}: SavedAddressesProps) {
    const [addresses, setAddresses] = useState<SavedAddress[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadAddresses();
    }, []);

    const loadAddresses = () => {
        setIsLoading(true);
        try {
            const saved = getLocalAddresses();
            setAddresses(saved);
        } catch (error) {
            console.error('Failed to load addresses:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = (e: React.MouseEvent, address: SavedAddress) => {
        e.stopPropagation();

        // Remove from local storage
        const saved = getLocalAddresses();
        const updated = saved.filter(a =>
            !(
                a.lat === address.lat &&
                a.lng === address.lng &&
                (a.formattedAddress || a.full_address) === (address.formattedAddress || address.full_address)
            )
        );
        localStorage.setItem('popclozet_recent_addresses', JSON.stringify(updated));
        setAddresses(updated);
    };

    const getIcon = (label?: string) => {
        return LABEL_ICONS[label || 'Other'] || LABEL_ICONS['Other'];
    };

    if (isLoading) {
        return (
            <div className={cn('p-4', className)}>
                <div className="flex items-center gap-3 animate-pulse">
                    <div className="w-10 h-10 bg-zinc-800 rounded-full" />
                    <div className="flex-1 space-y-2">
                        <div className="h-4 bg-zinc-800 rounded w-24" />
                        <div className="h-3 bg-zinc-800 rounded w-40" />
                    </div>
                </div>
            </div>
        );
    }

    if (addresses.length === 0 && !showAddButton) {
        return (
            <div className={cn('p-4 text-center', className)}>
                <p className="text-sm text-zinc-500">No saved addresses yet</p>
            </div>
        );
    }

    return (
        <div className={cn('', className)}>
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Star className="w-4 h-4 text-[#f2546d]" />
                    Saved Addresses
                </h3>
                {showAddButton && onAddNew && (
                    <button
                        onClick={onAddNew}
                        className="flex items-center gap-1 text-xs text-[#f2546d] hover:underline"
                    >
                        <Plus className="w-3 h-3" />
                        Add New
                    </button>
                )}
            </div>

            <AnimatePresence>
                {addresses.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 border-dashed text-center"
                    >
                        <MapPin className="w-6 h-6 text-zinc-600 mx-auto mb-2" />
                        <p className="text-xs text-zinc-500">No saved addresses</p>
                        {showAddButton && onAddNew && (
                            <button
                                onClick={onAddNew}
                                className="mt-2 text-xs text-[#f2546d] hover:underline"
                            >
                                Add your first address
                            </button>
                        )}
                    </motion.div>
                ) : (
                    <div className="space-y-2">
                        {addresses.map((address, index) => (
                            <motion.button
                                key={`${address.lat}-${address.lng}-${index}`}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, x: -50 }}
                                transition={{ delay: index * 0.05 }}
                                onClick={() => onSelect(address)}
                                className={cn(
                                    'w-full p-3 rounded-xl border text-left transition-all flex items-start gap-3',
                                    selectedAddressId === `${address.lat}-${address.lng}`
                                        ? 'bg-[#f2546d]/10 border-[#f2546d]'
                                        : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'
                                )}
                            >
                                {/* Icon */}
                                <div className={cn(
                                    'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                                    selectedAddressId === `${address.lat}-${address.lng}`
                                        ? 'bg-[#f2546d]/20 text-[#f2546d]'
                                        : 'bg-zinc-800 text-zinc-400'
                                )}>
                                    {getIcon(address.label)}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-medium text-white">{address.label || 'Saved Address'}</p>
                                        {selectedAddressId === `${address.lat}-${address.lng}` && (
                                            <Check className="w-3 h-3 text-[#f2546d]" />
                                        )}
                                    </div>
                                    <p className="text-xs text-zinc-400 line-clamp-2 mt-0.5">
                                        {address.formattedAddress || address.full_address}
                                    </p>
                                </div>

                                {/* Delete button */}
                                <button
                                    onClick={(e) => handleDelete(e, address)}
                                    className="p-2 rounded-full hover:bg-zinc-800 text-zinc-500 hover:text-red-400 flex-shrink-0"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </motion.button>
                        ))}
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default SavedAddresses;
