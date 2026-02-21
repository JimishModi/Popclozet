// src/components/map/HubDetailsSheet.tsx
// Bottom sheet for displaying hub details (Swiggy/Zomato style)

import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, MapPin, Truck, Check } from 'lucide-react';
import { HubWithDistance } from '@/services/hubService';

interface HubDetailsSheetProps {
    hub: HubWithDistance | null;
    isOpen: boolean;
    onClose: () => void;
    onSelect?: (hub: HubWithDistance) => void;
    isSelected?: boolean;
}

export function HubDetailsSheet({
    hub,
    isOpen,
    onClose,
    onSelect,
    isSelected = false,
}: HubDetailsSheetProps) {
    if (!hub) return null;

    const getCurrentHours = () => {
        const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
        const today = days[new Date().getDay()];
        const hours = hub.operating_hours?.[today];
        if (!hours) return 'Closed today';
        return `${hours.open} - ${hours.close}`;
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
                        className="fixed inset-0 bg-black/60 z-50"
                        onClick={onClose}
                    />

                    {/* Sheet */}
                    <motion.div
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-900 rounded-t-3xl max-h-[70vh] overflow-hidden"
                    >
                        {/* Handle */}
                        <div className="flex justify-center pt-3 pb-2">
                            <div className="w-12 h-1 bg-zinc-700 rounded-full" />
                        </div>

                        {/* Close button */}
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 p-2 rounded-full bg-zinc-800 hover:bg-zinc-700"
                        >
                            <X className="w-5 h-5 text-zinc-400" />
                        </button>

                        {/* Content */}
                        <div className="px-6 pb-8 pt-2">
                            {/* Hub info */}
                            <div className="mb-6">
                                <div className="flex items-start justify-between mb-2">
                                    <div>
                                        <h2 className="text-xl font-bold text-white">{hub.name}</h2>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span
                                                className={`px-2 py-0.5 rounded-full text-xs font-medium ${hub.is_open
                                                        ? 'bg-green-500/20 text-green-400'
                                                        : 'bg-red-500/20 text-red-400'
                                                    }`}
                                            >
                                                {hub.is_open ? 'Open Now' : 'Closed'}
                                            </span>
                                            <span
                                                className={`px-2 py-0.5 rounded-full text-xs font-medium ${hub.availability_status === 'available'
                                                        ? 'bg-blue-500/20 text-blue-400'
                                                        : hub.availability_status === 'busy'
                                                            ? 'bg-yellow-500/20 text-yellow-400'
                                                            : 'bg-zinc-500/20 text-zinc-400'
                                                    }`}
                                            >
                                                {hub.availability_status === 'available'
                                                    ? 'Ready'
                                                    : hub.availability_status === 'busy'
                                                        ? 'Busy'
                                                        : 'Offline'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Details grid */}
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                {/* Distance */}
                                <div className="p-4 rounded-2xl bg-zinc-800/50 border border-zinc-700/50">
                                    <div className="flex items-center gap-2 mb-1">
                                        <MapPin className="w-4 h-4 text-[#ff4d6d]" />
                                        <span className="text-xs text-zinc-400">Distance</span>
                                    </div>
                                    <p className="text-lg font-bold text-white">{hub.distance_km} km</p>
                                </div>

                                {/* ETA */}
                                <div className="p-4 rounded-2xl bg-zinc-800/50 border border-zinc-700/50">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Truck className="w-4 h-4 text-[#ff4d6d]" />
                                        <span className="text-xs text-zinc-400">Delivery</span>
                                    </div>
                                    <p className="text-lg font-bold text-white">{hub.estimated_minutes} mins</p>
                                </div>

                                {/* Hours */}
                                <div className="p-4 rounded-2xl bg-zinc-800/50 border border-zinc-700/50 col-span-2">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Clock className="w-4 h-4 text-[#ff4d6d]" />
                                        <span className="text-xs text-zinc-400">Today's Hours</span>
                                    </div>
                                    <p className="text-lg font-bold text-white">{getCurrentHours()}</p>
                                </div>
                            </div>

                            {/* Address */}
                            <div className="mb-6 p-4 rounded-2xl bg-zinc-800/30 border border-zinc-700/30">
                                <p className="text-sm text-zinc-300">{hub.address}</p>
                                <p className="text-xs text-zinc-500 mt-1">{hub.city}</p>
                            </div>

                            {/* Select button */}
                            {onSelect && (
                                <button
                                    onClick={() => onSelect(hub)}
                                    disabled={!hub.is_open || hub.availability_status === 'offline'}
                                    className={`w-full py-4 rounded-full font-bold text-base flex items-center justify-center gap-2 transition-all ${isSelected
                                            ? 'bg-green-500 text-white'
                                            : !hub.is_open || hub.availability_status === 'offline'
                                                ? 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
                                                : 'bg-[#ff4d6d] text-white hover:bg-[#ff3d5d]'
                                        }`}
                                >
                                    {isSelected ? (
                                        <>
                                            <Check className="w-5 h-5" />
                                            Selected
                                        </>
                                    ) : !hub.is_open ? (
                                        'Currently Closed'
                                    ) : hub.availability_status === 'offline' ? (
                                        'Temporarily Unavailable'
                                    ) : (
                                        'Select This Hub'
                                    )}
                                </button>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

export default HubDetailsSheet;
