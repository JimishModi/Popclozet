/**
 * Address Search View
 * 
 * Replaces the map-based MapPickerView with a search-first approach using Mappls proxy.
 */

import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { searchAddress } from '@popclozet/map-core';
import { Loader } from '@/components/ui/Loader';
import { Button } from '@/components/ui/Button';

interface MapPickerViewProps {
    initialCenter?: [number, number]; // [lng, lat]
    onConfirm: (coordinates: [number, number], address: string) => void;
    onBack: () => void;
}

export const MapPickerView: React.FC<MapPickerViewProps> = ({
    initialCenter,
    onConfirm,
    onBack,
}) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedAddress, setSelectedAddress] = useState<any>(null);

    const handleSearch = useCallback(async (text: string) => {
        setQuery(text);
        if (text.length < 3) {
            setResults([]);
            return;
        }

        setIsSearching(true);
        try {
            const data = await searchAddress(
                text, 
                initialCenter?.[1], 
                initialCenter?.[0]
            );
            setResults(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Search failed', err);
            setResults([]);
        } finally {
            setIsSearching(false);
        }
    }, [initialCenter]);

    const handleSelect = (place: any) => {
        setSelectedAddress(place);
        setQuery(place.placeAddress || place.placeName || '');
        setResults([]);
    };

    const handleConfirm = () => {
        if (selectedAddress) {
            onConfirm(
                [selectedAddress.longitude, selectedAddress.latitude],
                selectedAddress.placeAddress || selectedAddress.placeName || ''
            );
        }
    };

    return (
        <div className="fixed inset-0 bg-[#0f0f0f] z-50 flex flex-col">
            {/* Header */}
            <div className="bg-[#1a1a1a] p-4 border-b border-white/10 flex items-center gap-3">
                <button
                    onClick={onBack}
                    className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <div>
                    <h1 className="text-lg font-bold text-white">Search Location</h1>
                </div>
            </div>

            {/* Search Input */}
            <div className="p-4">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => handleSearch(e.target.value)}
                    placeholder="Search for an address..."
                    className="w-full bg-[#1a1a1a] text-white p-4 rounded-xl border border-white/10 focus:outline-none focus:border-white/30"
                />
            </div>

            {/* Results List */}
            <div className="flex-1 overflow-y-auto p-4">
                {isSearching ? (
                    <div className="flex justify-center p-8">
                        <Loader size="md" />
                    </div>
                ) : results.length > 0 ? (
                    <ul className="space-y-2">
                        {results.map((place, idx) => (
                            <li 
                                key={idx}
                                onClick={() => handleSelect(place)}
                                className={`p-4 rounded-xl cursor-pointer transition-colors ${
                                    selectedAddress?.eLoc === place.eLoc || selectedAddress?.placeName === place.placeName
                                        ? 'bg-[#2a2a2a] border border-white/20'
                                        : 'bg-[#1a1a1a] hover:bg-[#222]'
                                }`}
                            >
                                <p className="text-white font-medium">{place.placeName}</p>
                                <p className="text-zinc-400 text-sm mt-1">{place.placeAddress}</p>
                            </li>
                        ))}
                    </ul>
                ) : query.length >= 3 ? (
                    <p className="text-zinc-500 text-center mt-8">No locations found.</p>
                ) : (
                    <p className="text-zinc-500 text-center mt-8">Type to search for your address</p>
                )}
            </div>

            {/* Bottom Panel */}
            {selectedAddress && (
                <motion.div
                    initial={{ y: 100 }}
                    animate={{ y: 0 }}
                    className="bg-[#1a1a1a] rounded-t-3xl border-t border-white/10 p-6"
                >
                    <div className="mb-4">
                        <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Selected Location</p>
                        <p className="text-white font-medium line-clamp-2">
                            {selectedAddress.placeAddress || selectedAddress.placeName}
                        </p>
                    </div>

                    <Button
                        onClick={handleConfirm}
                        className="w-full"
                        size="lg"
                    >
                        Confirm Location
                    </Button>
                </motion.div>
            )}
        </div>
    );
};
