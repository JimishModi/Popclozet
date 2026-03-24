// src/pages/MapLocationPage.tsx
// Full-screen interactive map for address selection and hub discovery

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, Check, Navigation } from 'lucide-react';
import { MobileShell } from '@/components/layout/MobileShell';
import { InteractiveMap } from '@/components/map/InteractiveMap';
import { AddressSearchInput } from '@/components/map/AddressSearchInput';
import { NearbyHubs } from '@/components/map/NearbyHubs';
import { HubDetailsSheet } from '@/components/map/HubDetailsSheet';
import { useMapLocation } from '@/hooks/useMapLocation';
import { useNearbyHubs } from '@/hooks/useNearbyHubs';
import { useAuth } from '@/hooks/useAuth';
import { locationStorage } from '@/lib/locationStorage';
import { supabase } from '@popclozet/api-client';
import { saveAddressLocally, ValidatedAddress, getAddressDetail } from '@/services/addressService';
import { fetchPlaceDetails } from '@/services/mapplsService';
import { geocodeAddress } from '@/services/mapServices';
import { HubWithDistance } from '@/services/hubService';

type ViewMode = 'search' | 'hubs';
const WAREHOUSE = { lat: 19.1306, lng: 72.9155 };

export default function MapLocationPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { user } = useAuth();
    const returnTo = searchParams.get('returnTo') || '/home';

    const [viewMode, setViewMode] = useState<ViewMode>('search');
    const [selectedAddress, setSelectedAddress] = useState<ValidatedAddress | null>(null);
    const [showHubSheet, setShowHubSheet] = useState(false);
    const [detailedHub, setDetailedHub] = useState<HubWithDistance | null>(null);
    const [resolvingAddress, setResolvingAddress] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const {
        location,
        address,
        isLoading: locationLoading,
        requestLocation,
        setLocation,
        setLocationWithAddress,
        permissionState,
    } = useMapLocation();

    const {
        hubs,
        selectedHub,
        selectedHubId,
        selectHub,
        isLoading: hubsLoading,
    } = useNearbyHubs({
        lat: location?.lat,
        lng: location?.lng,
        enabled: !!location,
    });

    // Initially sync selected address from current location, but don't yank it back if user manually selected something
    useEffect(() => {
        if (address && !selectedAddress) {
            setSelectedAddress(address);
        }
    }, [address, selectedAddress]);

    const handleAddressSelect = async (addr: ValidatedAddress) => {
        // Check if address already has valid coordinates (non-zero)
        const hasValidCoords = (a: ValidatedAddress) =>
            typeof a.lat === 'number' && typeof a.lng === 'number' &&
            (Math.abs(a.lat) > 0.01 || Math.abs(a.lng) > 0.01) &&
            !isNaN(a.lat) && !isNaN(a.lng);

        // If the address already has valid coordinates, use them directly
        if (hasValidCoords(addr)) {
            console.log('[MapLocation] Address has valid coords, using directly:', addr.lat, addr.lng);
            setSelectedAddress(addr);
            setLocationWithAddress(addr.lat, addr.lng, addr);
            setViewMode('search');
            return;
        }

        // Mappls AutoSuggest returns eLoc but NO coordinates (lat/lng = 0).
        // We resolve via multiple fallback strategies.
        setResolvingAddress(true);
        console.log('[MapLocation] Resolving coordinates for:', { eLoc: addr.eLoc, address: addr.formattedAddress });

        let resolvedLat = 0;
        let resolvedLng = 0;
        let resolved = false;

        try {
            // Strategy 1: Mappls eLoc → Place Details (most accurate — uses place ID)
            if (addr.eLoc && !resolved) {
                try {
                    const placeDetails = await fetchPlaceDetails(addr.eLoc);
                    if (placeDetails.latitude && placeDetails.longitude) {
                        resolvedLat = placeDetails.latitude;
                        resolvedLng = placeDetails.longitude;
                        resolved = true;
                        console.log('[MapLocation] ✓ Strategy 1 — Mappls eLoc:', resolvedLat, resolvedLng);
                    }
                } catch (e) {
                    console.warn('[MapLocation] Strategy 1 failed (Mappls eLoc):', e);
                }
            }

            // Strategy 2: MapMyIndia text geocoding (accurate for Indian addresses)
            if (!resolved && addr.formattedAddress) {
                try {
                    const geoResult = await geocodeAddress(addr.formattedAddress);
                    if (geoResult.status === 'success' && geoResult.lat && geoResult.lng) {
                        resolvedLat = geoResult.lat;
                        resolvedLng = geoResult.lng;
                        resolved = true;
                        console.log('[MapLocation] ✓ Strategy 2 — MapMyIndia geocode:', resolvedLat, resolvedLng);
                    }
                } catch (e) {
                    console.warn('[MapLocation] Strategy 2 failed (MapMyIndia geocode):', e);
                }
            }

            // Strategy 3: Backend proxy (if running)
            if (addr.eLoc && !resolved) {
                try {
                    const detail = await getAddressDetail(addr.eLoc);
                    if (detail && detail.lat && detail.lng) {
                        resolvedLat = detail.lat;
                        resolvedLng = detail.lng;
                        resolved = true;
                        console.log('[MapLocation] ✓ Strategy 3 — backend proxy:', resolvedLat, resolvedLng);
                    }
                } catch (e) {
                    console.warn('[MapLocation] Strategy 3 failed (backend proxy):', e);
                }
            }

        } finally {
            setResolvingAddress(false);
        }

        if (resolved && resolvedLat && resolvedLng) {
            // Resolution succeeded — update map and address
            const resolvedAddr = { ...addr, lat: resolvedLat, lng: resolvedLng };
            setSelectedAddress(resolvedAddr);
            setLocationWithAddress(resolvedLat, resolvedLng, resolvedAddr);
            console.log('[MapLocation] ✓ Address resolved successfully — marker will move to:', resolvedLat, resolvedLng);
        } else {
            // ALL strategies failed — do NOT overwrite selectedAddress with zero coords.
            // Keep the old selectedAddress (and thus the old marker position).
            // Just update the display text so the user sees what they selected.
            console.error('[MapLocation] ✗ All resolution strategies failed for:', addr.formattedAddress);
            console.error('[MapLocation] Keeping previous marker position to prevent vanishing');

            // Set the address text but preserve the OLD coordinates (marker stays put)
            setSelectedAddress((prev) => {
                if (prev && hasValidCoords(prev)) {
                    // Keep old coords, just update the display text
                    return { ...prev, formattedAddress: addr.formattedAddress, full_address: addr.formattedAddress };
                }
                // If there was no previous valid address, use what we have (will fall back to GPS in InteractiveMap)
                return addr;
            });
        }

        setViewMode('search');
    };

    const handleMapClick = (pos: { lat: number; lng: number }) => {
        setLocation(pos.lat, pos.lng);
        // Create a basic address object from clicked position
        // This will trigger the address to be displayed and route simulation to work
        if (!selectedAddress || selectedAddress.lat !== pos.lat || selectedAddress.lng !== pos.lng) {
            // Reverse geocode or create a basic address
            const clickedAddress: ValidatedAddress = {
                lat: pos.lat,
                lng: pos.lng,
                formattedAddress: `${pos.lat.toFixed(6)}, ${pos.lng.toFixed(6)}`,
                city: '',
                pincode: '',
            };
            setSelectedAddress(clickedAddress);
        }
    };

    const handleLocateMe = () => {
        requestLocation();
    };

    const handleHubClick = (hub: HubWithDistance) => {
        setDetailedHub(hub);
        setShowHubSheet(true);
    };

    const handleHubSelect = (hub: HubWithDistance) => {
        selectHub(hub.id);
        setShowHubSheet(false);
    };

    const handleConfirm = async () => {
        if (selectedAddress) {
            // 1. Save address locally for "Recent Addresses"
            const { saveAddressLocally } = await import("@/services/addressService");
            saveAddressLocally({ ...selectedAddress, label: 'Delivery Address' });

            setIsSaving(true);
            let deliveryEstimate: '15min' | 'delayed' = '15min';

            // 2. Calculate road distance via backend proxy (same as CheckoutPage)
            try {
                const { getRoadDistance } = await import("@/services/mapServices");
                const res = await getRoadDistance(WAREHOUSE, {
                    lat: selectedAddress.lat,
                    lng: selectedAddress.lng,
                    eLoc: selectedAddress.eLoc
                });
                if (res.status === 'success') {
                    deliveryEstimate = res.distanceKm > 6 ? 'delayed' : '15min';
                    console.log(`🛣️ Distance: ${res.distanceKm.toFixed(2)}km -> ${deliveryEstimate}`);
                } else {
                    console.warn('Distance API returned error:', res.error);
                }
            } catch (err) {
                console.warn('Distance calculation failed:', err);
            }



            // 3. Sync with locationStorage for Home page display
            locationStorage.set({
                source: "gps",
                lat: selectedAddress.lat,
                lng: selectedAddress.lng,
                city: selectedAddress.city || selectedAddress.formattedAddress.split(',')[0].trim(),
                locality: selectedAddress.label || 'Home',
                delivery_estimate: deliveryEstimate
            });

            // 4. Save to Supabase if logged in
            if (user) {
                try {
                    // Reset all defaults first
                    await supabase
                        .from('addresses')
                        .update({ is_default: false })
                        .eq('user_id', user.id);

                    // Check if this address already exists for this user
                    const { data: existing } = await supabase
                        .from('addresses')
                        .select('id')
                        .eq('user_id', user.id)
                        .eq('full_address', selectedAddress.formattedAddress)
                        .maybeSingle();

                    if (existing) {
                        // Update existing address
                        await supabase.from('addresses').update({
                            latitude: selectedAddress.lat,
                            longitude: selectedAddress.lng,
                            geohash: `${selectedAddress.lat.toFixed(2)}_${selectedAddress.lng.toFixed(2)}`,
                            is_default: true,
                        }).eq('id', existing.id);
                    } else {
                        // Insert new address
                        const { error } = await supabase.from('addresses').insert({
                            user_id: user.id,
                            label: selectedAddress.label || 'Home',
                            full_address: selectedAddress.formattedAddress,
                            latitude: selectedAddress.lat,
                            longitude: selectedAddress.lng,
                            geohash: `${selectedAddress.lat.toFixed(2)}_${selectedAddress.lng.toFixed(2)}`,
                            is_default: true,
                        });
                        if (error) console.error("Error saving address to DB:", error);
                    }

                    // 5. Update profile with the new estimate (for both new and existing addresses)
                    const { updateProfile } = await import("@/services/profileService");
                    try {
                        await updateProfile({ delivery_estimate: deliveryEstimate });
                        console.log('👤 Profile updated with estimate:', deliveryEstimate);
                    } catch (err) {
                        console.warn('Could not save delivery_estimate to profile:', err);
                    }
                } catch (e) {
                    console.error("Error saving address:", e);
                }
            }

            setIsSaving(false);

            // Save hub selection if any
            if (selectedHub) {
                localStorage.setItem('selected_hub', JSON.stringify({
                    id: selectedHub.id,
                    name: selectedHub.name,
                    distance_km: selectedHub.distance_km,
                    estimated_minutes: selectedHub.estimated_minutes,
                }));
            }

            // Navigate back
            navigate(returnTo);
        }
    };

    const canConfirm = selectedAddress && (!hubs.length || selectedHubId);

    return (
        <div className="bg-black text-white min-h-screen">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 sticky top-0 z-50 bg-black/90 backdrop-blur-md">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 -ml-2 rounded-full hover:bg-white/10"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <h1 className="text-lg font-semibold">Select Location</h1>
                </div>
            </div>

            {/* Search bar - needs high z-index for dropdown to show above map */}
            <div className="px-4 py-2 relative z-[1200]">
                <AddressSearchInput
                    value={selectedAddress?.formattedAddress}
                    onAddressSelect={handleAddressSelect}
                    onLocateMe={handleLocateMe}
                    placeholder="Search for delivery address..."
                    isLoading={resolvingAddress}
                />
            </div>

            {/* Use Current Location button */}
            <div className="px-4 py-2">
                <button
                    onClick={handleLocateMe}
                    disabled={locationLoading}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800/80 transition-colors"
                >
                    <div className="p-2 rounded-full bg-[#ff4d6d]/15">
                        {locationLoading ? (
                            <div className="w-5 h-5 border-2 border-[#ff4d6d] border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <Navigation className="w-5 h-5 text-[#ff4d6d]" />
                        )}
                    </div>
                    <div className="text-left">
                        <p className="text-sm font-medium text-white">Use Current Location</p>
                        <p className="text-[11px] text-zinc-500">Get your GPS location automatically</p>
                    </div>
                </button>
            </div>

            {/* Map */}
            <div className="relative h-[450px] mx-4 rounded-2xl overflow-hidden border border-zinc-800">
                <InteractiveMap
                    center={
                        // Only use selectedAddress as center if it has valid coordinates
                        selectedAddress && selectedAddress.lat && selectedAddress.lng
                            ? { lat: selectedAddress.lat, lng: selectedAddress.lng }
                            : (location || { lat: 19.076, lng: 72.8777 })
                    }
                    zoom={selectedAddress || location ? 14 : 11}
                    darkMode={true}
                    userLocation={
                        // Only pass selectedAddress coordinates if they're valid (non-zero).
                        // Otherwise fall back to GPS location so the marker doesn't vanish.
                        selectedAddress && selectedAddress.lat && selectedAddress.lng
                            ? { lat: selectedAddress.lat, lng: selectedAddress.lng }
                            : location
                    }
                    hubs={hubs}
                    selectedHubId={selectedHubId || undefined}
                    onMapClick={handleMapClick}
                    onHubClick={handleHubClick}
                />

                {/* Resolving address overlay */}
                {resolvingAddress && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px] z-10">
                        <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-700 px-4 py-2.5 rounded-full shadow-xl">
                            <div className="w-4 h-4 border-2 border-[#ff4d6d] border-t-transparent rounded-full animate-spin" />
                            <span className="text-sm text-white">Locating address...</span>
                        </div>
                    </div>
                )}

                {/* GPS Button on map */}
                {permissionState !== 'unavailable' && (
                    <button
                        onClick={handleLocateMe}
                        disabled={locationLoading}
                        className="absolute bottom-4 right-4 p-3 rounded-full bg-zinc-900/90 border border-zinc-800 shadow-lg"
                    >
                        {locationLoading ? (
                            <div className="w-5 h-5 border-2 border-[#ff4d6d] border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <Navigation className="w-5 h-5 text-[#ff4d6d]" />
                        )}
                    </button>
                )}

            </div>

            {/* Selected address display */}
            {selectedAddress && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mx-4 mt-4 p-4 rounded-2xl bg-zinc-900 border border-zinc-800"
                >
                    <p className="text-xs text-zinc-400 mb-1">Delivery Address</p>
                    <p className="text-sm text-white">{selectedAddress.formattedAddress}</p>
                </motion.div>
            )}

            {/* View mode toggle */}
            {hubs.length > 0 && (
                <div className="flex gap-2 px-4 mt-4">
                    <button
                        onClick={() => setViewMode('search')}
                        className={`flex-1 py-2 rounded-full text-sm font-medium transition-colors ${viewMode === 'search'
                            ? 'bg-[#ff4d6d] text-white'
                            : 'bg-zinc-800 text-zinc-400'
                            }`}
                    >
                        Location
                    </button>
                    <button
                        onClick={() => setViewMode('hubs')}
                        className={`flex-1 py-2 rounded-full text-sm font-medium transition-colors ${viewMode === 'hubs'
                            ? 'bg-[#ff4d6d] text-white'
                            : 'bg-zinc-800 text-zinc-400'
                            }`}
                    >
                        Nearby Hubs ({hubs.length})
                    </button>
                </div>
            )}

            {/* Nearby hubs list */}
            {viewMode === 'hubs' && (
                <div className="px-4 mt-4 pb-32">
                    <NearbyHubs
                        hubs={hubs}
                        selectedHubId={selectedHubId || undefined}
                        onHubSelect={(hub) => {
                            setDetailedHub(hub);
                            setShowHubSheet(true);
                        }}
                        isLoading={hubsLoading}
                    />
                </div>
            )}

            {/* Confirm button */}
            <div className="fixed bottom-0 left-0 right-0 z-40 p-4 bg-black/80 backdrop-blur-sm border-t border-zinc-800">
                <div className="max-w-[430px] mx-auto w-full">
                    <button
                        onClick={handleConfirm}
                        disabled={!canConfirm || isSaving}
                        className={`w-full py-3.5 md:py-4 rounded-xl font-bold text-sm md:text-base flex items-center justify-center gap-2 transition-all shadow-xl ${canConfirm && !isSaving
                            ? 'bg-[#ff4d6d] text-white shadow-[#ff4d6d]/20'
                            : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                            }`}
                    >
                        {isSaving ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : <Check className="w-4 h-4 md:w-5 md:h-5" />}
                        {isSaving ? "SAVING..." : "Confirm Location"}
                    </button>
                </div>
            </div>

            {/* Hub details sheet */}
            <HubDetailsSheet
                hub={detailedHub}
                isOpen={showHubSheet}
                onClose={() => setShowHubSheet(false)}
                onSelect={handleHubSelect}
                isSelected={detailedHub?.id === selectedHubId}
            />
        </div>
    );
}
