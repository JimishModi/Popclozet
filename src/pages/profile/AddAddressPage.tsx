/**
 * Add Address Page
 * 
 * Phase 4: Complete Swiggy-style address UX orchestration
 * 
 * UX Flow:
 * 1. User clicks Add Address → Method selector shows
 * 2. User chooses method:
 *    - Current Location → GPS capture → Map confirm → Details form
 *    - Pick on Map → Map picker → Details form
 *    - Enter Manually → Details form directly
 * 3. User fills details and saves
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { supabase } from '@/services/supabase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { MobileShell } from '@/components/layout/MobileShell';
import { motion, AnimatePresence } from 'framer-motion';
import { encode as encodeGeohash } from 'ngeohash';
import { debounce } from '@/utils/helpers';

// Phase 4 Components
import { AddressMethodSelector, AddressMethod } from '@/components/features/address/AddressMethodSelector';
import { MapPickerView } from '@/components/features/address/MapPickerView';
import { CurrentLocationView } from '@/components/features/address/CurrentLocationView';

// UX State Machine
type AddressUXState =
    | 'method_select'    // Choosing how to add address
    | 'current_location' // GPS capture flow
    | 'pick_on_map'      // Map picker flow
    | 'enter_manually'   // Manual entry form
    | 'details_form';    // Address details after location confirmed

// Mumbai Bounds for Geocoding (minX, minY, maxX, maxY)
const MUMBAI_BBOX = '72.7753,18.8907,73.0297,19.2717';

export const AddAddressPage: React.FC = () => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const navigate = useNavigate();

    // UX State
    const [uxState, setUxState] = useState<AddressUXState>('method_select');
    const [showMethodSelector, setShowMethodSelector] = useState(true);

    // Form State
    const [label, setLabel] = useState('');
    const [fullAddress, setFullAddress] = useState('');
    const [flatDetails, setFlatDetails] = useState(''); // Flat/Building/Landmark
    const [latitude, setLatitude] = useState<number>(0);
    const [longitude, setLongitude] = useState<number>(0);
    const [saving, setSaving] = useState(false);

    // Search State (for manual entry)
    const [searchQuery, setSearchQuery] = useState('');
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    // Debounced Search Function
    const performSearch = useCallback(
        debounce(async (query: string) => {
            if (!query || query.length < 3) {
                setSuggestions([]);
                return;
            }

            const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
            if (!mapboxToken) return;

            try {
                let url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${mapboxToken}&country=in&types=address,poi&bbox=${MUMBAI_BBOX}`;

                if (latitude && longitude) {
                    url += `&proximity=${longitude},${latitude}`;
                }

                const res = await fetch(url);
                const data = await res.json();

                if (data.features) {
                    setSuggestions(data.features);
                    setShowSuggestions(true);
                }
            } catch (error) {
                console.error('Autocomplete error:', error);
            }
        }, 300),
        [latitude, longitude]
    );

    useEffect(() => {
        if (uxState === 'enter_manually') {
            performSearch(searchQuery);
        }
    }, [searchQuery, uxState, performSearch]);

    // Handle method selection
    const handleMethodSelect = (method: AddressMethod) => {
        setShowMethodSelector(false);

        switch (method) {
            case 'current_location':
                setUxState('current_location');
                break;
            case 'pick_on_map':
                setUxState('pick_on_map');
                break;
            case 'enter_manually':
                setUxState('enter_manually');
                break;
        }
    };

    // Handle location confirmation from map/GPS
    const handleLocationConfirm = (coords: [number, number], address: string) => {
        setLongitude(coords[0]);
        setLatitude(coords[1]);
        setFullAddress(address);
        setUxState('details_form');
    };

    // Handle back from any state
    const handleBack = () => {
        if (uxState === 'details_form') {
            // Go back to method selection
            setUxState('method_select');
            setShowMethodSelector(true);
            // Clear captured data
            setLatitude(0);
            setLongitude(0);
            setFullAddress('');
        } else if (uxState === 'method_select') {
            navigate('/profile');
        } else {
            setUxState('method_select');
            setShowMethodSelector(true);
        }
    };

    // Handle suggestion selection
    const handleSelectSuggestion = (feature: any) => {
        const [lng, lat] = feature.center;
        setLatitude(lat);
        setLongitude(lng);
        setFullAddress(feature.place_name);
        setSearchQuery('');
        setShowSuggestions(false);
        setUxState('details_form');
        showToast('Address selected', 'success');
    };

    // Save address
    const handleSaveAddress = async () => {
        if (!label || !fullAddress) {
            showToast('Please fill all required fields', 'warning');
            return;
        }

        if (latitude === 0 && longitude === 0) {
            showToast('Invalid location. Please try again.', 'warning');
            return;
        }

        setSaving(true);

        try {
            const geohash = encodeGeohash(latitude, longitude, 9);
            const finalAddress = flatDetails
                ? `${flatDetails}, ${fullAddress}`
                : fullAddress;

            const { error } = await supabase.from('addresses').insert({
                user_id: user!.id,
                label,
                full_address: finalAddress,
                latitude,
                longitude,
                geohash,
                is_default: false,
            });

            if (error) throw error;
            showToast('Address added successfully!', 'success');
            navigate('/profile');
        } catch (error: any) {
            console.error('Error saving address:', error);
            showToast(error.message || 'Failed to save address', 'error');
        } finally {
            setSaving(false);
        }
    };

    // Render full-screen views for map-based methods
    if (uxState === 'current_location') {
        return (
            <CurrentLocationView
                onConfirm={handleLocationConfirm}
                onBack={handleBack}
                onPermissionDenied={() => setUxState('enter_manually')}
            />
        );
    }

    if (uxState === 'pick_on_map') {
        return (
            <MapPickerView
                onConfirm={handleLocationConfirm}
                onBack={handleBack}
            />
        );
    }

    // Main form view (method_select, enter_manually, details_form)
    return (
        <MobileShell hideBottomNav className="bg-black">
            <div className="flex-1 p-6">
                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                    <button onClick={handleBack} className="text-zinc-400 hover:text-white">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <h1 className="text-2xl font-bold text-white">
                        {uxState === 'details_form' ? 'Complete Address' : 'Add Address'}
                    </h1>
                </div>

                {/* Manual Entry View */}
                {uxState === 'enter_manually' && (
                    <div className="space-y-6">
                        {/* Search Section */}
                        <div className="relative z-20">
                            <label className="block text-sm font-medium text-zinc-400 mb-2">
                                Search for your address
                            </label>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onFocus={() => {
                                    if (suggestions.length > 0) setShowSuggestions(true);
                                }}
                                placeholder="Type area, building, or landmark..."
                                autoFocus
                                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-zinc-500 focus:border-[#ff4d6d]/50 focus:outline-none focus:ring-2 focus:ring-[#ff4d6d]/20 transition-all"
                            />

                            {/* Suggestions Dropdown */}
                            <AnimatePresence>
                                {showSuggestions && suggestions.length > 0 && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="absolute left-0 right-0 mt-2 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto z-50"
                                    >
                                        {suggestions.map((item) => (
                                            <button
                                                key={item.id}
                                                onClick={() => handleSelectSuggestion(item)}
                                                className="w-full text-left px-4 py-3 hover:bg-white/5 border-b border-white/5 last:border-0 transition-colors"
                                            >
                                                <p className="text-white text-sm font-medium truncate">{item.text}</p>
                                                <p className="text-xs text-zinc-500 truncate">{item.place_name}</p>
                                            </button>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Alternative methods */}
                        <div className="pt-4 border-t border-white/10">
                            <p className="text-sm text-zinc-500 text-center mb-4">Or try another method</p>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => setUxState('current_location')}
                                    className="p-4 rounded-xl bg-white/5 border border-white/10 text-center hover:bg-white/10 transition-colors"
                                >
                                    <span className="text-2xl block mb-1">📍</span>
                                    <span className="text-xs text-zinc-400">Use GPS</span>
                                </button>
                                <button
                                    onClick={() => setUxState('pick_on_map')}
                                    className="p-4 rounded-xl bg-white/5 border border-white/10 text-center hover:bg-white/10 transition-colors"
                                >
                                    <span className="text-2xl block mb-1">🗺️</span>
                                    <span className="text-xs text-zinc-400">Pick on Map</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Details Form View */}
                {uxState === 'details_form' && (
                    <div className="space-y-6">
                        {/* Location Preview */}
                        <div className="p-4 bg-gradient-to-r from-green-500/10 to-green-600/5 rounded-xl border border-green-500/20">
                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                                    <span className="text-lg">✓</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs text-green-400 uppercase tracking-wide mb-1">Location Set</p>
                                    <p className="text-white text-sm line-clamp-2">{fullAddress}</p>
                                </div>
                                <button
                                    onClick={() => {
                                        setUxState('method_select');
                                        setShowMethodSelector(true);
                                    }}
                                    className="text-xs text-[#ff4d6d] font-medium"
                                >
                                    Change
                                </button>
                            </div>
                        </div>

                        {/* Address Details Form */}
                        <div className="bg-gradient-to-br from-white/8 to-white/3 backdrop-blur-xl rounded-2xl p-5 border border-white/10 space-y-4">
                            <Input
                                label="Save As"
                                value={label}
                                onChange={(e) => setLabel(e.target.value)}
                                placeholder="Home, Office, etc."
                                className="bg-black/20"
                            />

                            <Input
                                label="Flat / Building / Landmark"
                                value={flatDetails}
                                onChange={(e) => setFlatDetails(e.target.value)}
                                placeholder="Flat 42, Tower B, Near Metro Station"
                                className="bg-black/20"
                            />

                            <div>
                                <label className="block text-sm font-medium text-zinc-400 mb-2">
                                    Full Address
                                </label>
                                <textarea
                                    value={fullAddress}
                                    onChange={(e) => setFullAddress(e.target.value)}
                                    className="w-full min-h-[80px] px-4 py-3 rounded-xl bg-black/20 border border-white/10 text-white placeholder:text-zinc-500 focus:border-[#ff4d6d]/50 focus:outline-none focus:ring-2 focus:ring-[#ff4d6d]/20 transition-all text-sm"
                                />
                            </div>
                        </div>

                        <Button
                            onClick={handleSaveAddress}
                            className="w-full"
                            size="lg"
                            loading={saving}
                            disabled={!label || !fullAddress}
                        >
                            Save Address
                        </Button>
                    </div>
                )}
            </div>

            {/* Method Selector Bottom Sheet */}
            <AddressMethodSelector
                isOpen={showMethodSelector && uxState === 'method_select'}
                onSelect={handleMethodSelect}
                onClose={() => navigate('/profile')}
            />
        </MobileShell>
    );
};
