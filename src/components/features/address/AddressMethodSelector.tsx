/**
 * Address Method Selector
 * 
 * Phase 4: Swiggy-style address input method chooser
 * Shows 3 options:
 * 1. Use Current Location (GPS)
 * 2. Pick on Map (center-pin)
 * 3. Enter Manually
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export type AddressMethod = 'current_location' | 'pick_on_map' | 'enter_manually';

interface AddressMethodSelectorProps {
    isOpen: boolean;
    onSelect: (method: AddressMethod) => void;
    onClose: () => void;
}

export const AddressMethodSelector: React.FC<AddressMethodSelectorProps> = ({
    isOpen,
    onSelect,
    onClose,
}) => {
    const methods = [
        {
            id: 'current_location' as AddressMethod,
            icon: '📍',
            title: 'Use Current Location',
            description: 'Automatically detect your location using GPS',
            color: 'from-green-500/20 to-green-600/10',
            borderColor: 'border-green-500/30',
        },
        {
            id: 'pick_on_map' as AddressMethod,
            icon: '🗺️',
            title: 'Pick on Map',
            description: 'Move the map to pinpoint your exact location',
            color: 'from-blue-500/20 to-blue-600/10',
            borderColor: 'border-blue-500/30',
        },
        {
            id: 'enter_manually' as AddressMethod,
            icon: '✍️',
            title: 'Enter Manually',
            description: 'Type your address or search for it',
            color: 'from-purple-500/20 to-purple-600/10',
            borderColor: 'border-purple-500/30',
        },
    ];

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60]"
                    />

                    {/* Bottom Sheet */}
                    <motion.div
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="fixed bottom-0 left-0 right-0 z-[60] bg-[#0f0f0f] rounded-t-3xl border-t border-white/10"
                    >
                        {/* Handle */}
                        <div className="flex justify-center pt-3 pb-2">
                            <div className="w-10 h-1 rounded-full bg-zinc-700" />
                        </div>

                        <div className="px-6 pb-8">
                            <h2 className="text-xl font-bold text-white mb-1">Add New Address</h2>
                            <p className="text-sm text-zinc-400 mb-6">Choose how you'd like to add your address</p>

                            <div className="space-y-3">
                                {methods.map((method, index) => (
                                    <motion.button
                                        key={method.id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.1 }}
                                        onClick={() => {
                                            onSelect(method.id);
                                        }}
                                        className={`w-full p-4 rounded-2xl bg-gradient-to-r ${method.color} border ${method.borderColor} flex items-center gap-4 text-left hover:scale-[1.02] active:scale-[0.98] transition-transform`}
                                    >
                                        <span className="text-3xl">{method.icon}</span>
                                        <div>
                                            <p className="font-semibold text-white">{method.title}</p>
                                            <p className="text-xs text-zinc-400">{method.description}</p>
                                        </div>
                                        <svg className="w-5 h-5 text-zinc-500 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </motion.button>
                                ))}
                            </div>

                            {/* Cancel */}
                            <button
                                onClick={onClose}
                                className="w-full mt-4 py-3 text-zinc-400 text-sm font-medium hover:text-white transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
