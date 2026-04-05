// src/pages/MapLocationPage.tsx
// Full-screen interactive map for address selection and hub discovery

import { useState, useEffect, useMemo } from 'react';
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
import { ValidatedAddress, getAddressDetail } from '@/services/addressService';
import { fetchPlaceDetails } from '@/services/mapplsService';
import { geocodeAddress } from '@/services/mapServices';
import { geocodeWithMappls } from '@/services/mapplsGeocode';
import { HubWithDistance } from '@/services/hubService';

type ViewMode = 'search' | 'hubs';
const WAREHOUSE = { lat: 19.1306, lng: 72.9155 };

export default function MapLocationPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { user } = useAuth();
    const returnTo = searchParams.get('returnTo') || '/home';

    const [viewMode, setViewMode] = useState<ViewMode>('search');
    // Restore last confirmed address on mount so it survives reload
    const [selectedAddress, setSelectedAddress] = useState<ValidatedAddress | null>(() => {
        try {
            const saved = localStorage.getItem('confirmed_delivery_address');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed && parsed.lat && parsed.lng && parsed.formattedAddress) {
                    console.log('[MapLocation] Restored confirmed address from localStorage:', parsed.formattedAddress);
                    return parsed as ValidatedAddress;
                }
            }
        } catch { /* ignore */ }
        return null;
    });
    const [showHubSheet, setShowHubSheet] = useState(false);
    const [detailedHub, setDetailedHub] = useState<HubWithDistance | null>(null);
    const [resolvingAddress, setResolvingAddress] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const {
        location,
        address,
        isLoading: locationLoading,
        accuracy: locationAccuracy,
        requestLocation,
        setLocation,
        setLocationCoords,
        permissionState
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

    // Stable map center — updates only when selectedAddress or location actually change.
    // This avoids creating new object references on every render that confuse InteractiveMap.
    const mapCenter = useMemo(() => {
        if (selectedAddress && selectedAddress.lat && selectedAddress.lng &&
            (Math.abs(selectedAddress.lat) > 0.01 || Math.abs(selectedAddress.lng) > 0.01)) {
            console.log('[MapLocation] mapCenter from selectedAddress:', selectedAddress.lat, selectedAddress.lng);
            return { lat: selectedAddress.lat, lng: selectedAddress.lng };
        }
        if (location) {
            console.log('[MapLocation] mapCenter from GPS location:', location.lat, location.lng);
            return { lat: location.lat, lng: location.lng };
        }
        console.log('[MapLocation] mapCenter fallback to Mumbai default');
        return { lat: 19.076, lng: 72.8777 };
    }, [selectedAddress?.lat, selectedAddress?.lng, location?.lat, location?.lng]);

    // useGps: when true, the hook's GPS address syncs into selectedAddress automatically.
    // true = user wants GPS location (initial load with no saved addr, or "Use Current Location")
    // false = user picked a specific address from search/map click
    const [useGps, setUseGps] = useState(!selectedAddress);

    // Sync location (GPS or Manual Click) -> selectedAddress.
    // Watches BOTH `address` (reverse-geocoded) and `location` (raw coords).
    useEffect(() => {
        if (address) {
            // If the address coordinates match our current selection, update it.
            // This is crucial for replacing the "Locating address..." placeholder after a map click.
            const isMatch = selectedAddress && 
                Math.abs(selectedAddress.lat - address.lat) < 0.001 && 
                Math.abs(selectedAddress.lng - address.lng) < 0.001;

            const isLocating = selectedAddress?.formattedAddress === "📍 Locating address...";

            if (isMatch || useGps || isLocating) {
                console.log('[MapLocation] Address sync:', address.formattedAddress);
                // Keep the exact user-clicked pin coordinates, just absorb the resolved address components
                setSelectedAddress({
                    ...address,
                    lat: selectedAddress?.lat ?? address.lat,
                    lng: selectedAddress?.lng ?? address.lng
                });
            }
        } else if (location && useGps) {
            // In GPS mode, if address is pending, show raw coords as fallback
            setSelectedAddress({
                lat: location.lat,
                lng: location.lng,
                formattedAddress: `📍 ${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`,
                city: '',
                pincode: '',
            });
        }
    }, [useGps, address, location?.lat, location?.lng]);

    const handleAddressSelect = async (addr: ValidatedAddress) => {
        console.log('[MapLocation] handleAddressSelect called with:', JSON.stringify({ lat: addr.lat, lng: addr.lng, eLoc: addr.eLoc, formattedAddress: addr.formattedAddress }));

        // Check if address already has valid coordinates (non-zero)
        const hasValidCoords = (a: ValidatedAddress) =>
            typeof a.lat === 'number' && typeof a.lng === 'number' &&
            (Math.abs(a.lat) > 0.01 || Math.abs(a.lng) > 0.01) &&
            !isNaN(a.lat) && !isNaN(a.lng);

        // If the address lacks an eLoc but has valid coordinates, use them directly
        // (If it has an eLoc, we ALWAYS resolve it because AutoSuggest coords are imprecise)
        if (hasValidCoords(addr) && !addr.eLoc) {
            console.log('[MapLocation] Address has valid coords and no eLoc, using directly:', addr.lat, addr.lng);
            setUseGps(false); // stop GPS sync — user picked a specific address
            setSelectedAddress(addr);
            setLocationCoords(addr.lat, addr.lng); // update hook coords for hub query only
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
            // Strategy 1: Backend proxy eLoc → coordinates (most reliable — uses server-side REST key)
            if (addr.eLoc && !resolved) {
                try {
                    const detail = await getAddressDetail(addr.eLoc);
                    if (detail && detail.lat && detail.lng &&
                        (Math.abs(detail.lat) > 0.01 || Math.abs(detail.lng) > 0.01)) {
                        resolvedLat = detail.lat;
                        resolvedLng = detail.lng;
                        resolved = true;
                        console.log('[MapLocation] ✓ Strategy 1 — backend eLoc detail:', resolvedLat, resolvedLng);
                    }
                } catch (e) {
                    console.warn('[MapLocation] Strategy 1 failed (backend eLoc detail):', e);
                }
            }

            // Strategy 2: Mappls eLoc → Place Details (via edge function)
            if (addr.eLoc && !resolved) {
                try {
                    const placeDetails = await fetchPlaceDetails(addr.eLoc);
                    if (placeDetails.latitude && placeDetails.longitude) {
                        resolvedLat = placeDetails.latitude;
                        resolvedLng = placeDetails.longitude;
                        resolved = true;
                        console.log('[MapLocation] ✓ Strategy 2 — Mappls client eLoc:', resolvedLat, resolvedLng);
                    }
                } catch (e) {
                    console.warn('[MapLocation] Strategy 2 failed (Mappls client eLoc):', e);
                }
            }

            // Strategy 3: Backend text geocoding (searches again by address text — may hit Nominatim)
            if (!resolved && addr.formattedAddress) {
                try {
                    const geoResult = await geocodeAddress(addr.formattedAddress);
                    if (geoResult.status === 'success' && geoResult.lat && geoResult.lng &&
                        (Math.abs(geoResult.lat) > 0.01 || Math.abs(geoResult.lng) > 0.01)) {
                        resolvedLat = geoResult.lat;
                        resolvedLng = geoResult.lng;
                        resolved = true;
                        console.log('[MapLocation] ✓ Strategy 3 — text geocode:', resolvedLat, resolvedLng);
                    }
                } catch (e) {
                    console.warn('[MapLocation] Strategy 3 failed (text geocode):', e);
                }
            }

            // Strategy 4: Mappls forward geocode (reliable client-side — uses the same token as the map)
            if (!resolved && addr.formattedAddress) {
                try {
                    const mapplsResult = await geocodeWithMappls(addr.formattedAddress);
                    if (mapplsResult && mapplsResult.lat && mapplsResult.lng &&
                        (Math.abs(mapplsResult.lat) > 0.01 || Math.abs(mapplsResult.lng) > 0.01)) {
                        resolvedLat = mapplsResult.lat;
                        resolvedLng = mapplsResult.lng;
                        resolved = true;
                        console.log('[MapLocation] ✓ Strategy 4 — Mappls geocode:', resolvedLat, resolvedLng);
                    }
                } catch (e) {
                    console.warn('[MapLocation] Strategy 4 failed (Mappls geocode):', e);
                }
            }

            // Strategy 5 & 6 (Nominatim) removed: direct frontend calls triggered CORS errors.
            // Support is now fully handled securely and efficiently by Strategy 3 (backend proxy)!

        } finally {
            setResolvingAddress(false);
        }

        if (resolved && resolvedLat && resolvedLng) {
            // Resolution succeeded — update map and address
            const resolvedAddr = { ...addr, lat: resolvedLat, lng: resolvedLng };
            setUseGps(false); // stop GPS sync — user picked a specific address
            setSelectedAddress(resolvedAddr);
            setLocationCoords(resolvedLat, resolvedLng); // update hook coords for hub query only
            console.log('[MapLocation] ✓ Address resolved successfully — marker will move to:', resolvedLat, resolvedLng);
        } else if (hasValidCoords(addr)) {
            // ALL precise strategies failed, BUT the AutoSuggest entry itself had rough coordinates.
            // Rather than NOT moving the map at all, use these rough coordinates.
            console.warn('[MapLocation] ⚠ Precise resolution failed, falling back to rough AutoSuggest coordinates for:', addr.formattedAddress);
            setUseGps(false);
            setSelectedAddress(addr);
            setLocationCoords(addr.lat, addr.lng);
        } else {
            // ALL strategies failed AND we have no fallback coordinates.
            console.error('[MapLocation] ✗ All resolution strategies and fallbacks failed for:', addr.formattedAddress);
            console.error('[MapLocation] Keeping previous marker position to prevent vanishing');

            // Set the address text but preserve the OLD coordinates (marker stays put)
            setSelectedAddress((prev) => {
                if (prev && hasValidCoords(prev)) {
                    // Keep old coords, just update the display text
                    return { ...prev, formattedAddress: addr.formattedAddress, full_address: addr.formattedAddress };
                }
                return addr;
            });
        }

        setViewMode('search');
    };

    const handleMapClick = (pos: { lat: number; lng: number }) => {
        console.log('[MapLocation] Map clicked at:', pos.lat, pos.lng);
        setUseGps(false); // user manually picked a point
        
        // Trigger reverse geocoding in the hook
        setLocation(pos.lat, pos.lng);
        
        // Show temporary placeholder instead of raw numbers
        setSelectedAddress({
            lat: pos.lat,
            lng: pos.lng,
            formattedAddress: "📍 Locating address...",
            city: '',
            pincode: '',
        });
    };

    const handleLocateMe = () => {
        console.log('[MapLocation] Use Current Location clicked, permissionState:', permissionState);
        // Switch to GPS mode — the sync effect will update selectedAddress when GPS arrives
        setUseGps(true);
        localStorage.removeItem('confirmed_delivery_address');

        // Show best available data immediately for instant feedback:
        // 1. If we have a reverse-geocoded GPS address, use it
        // 2. If we only have raw GPS coords, create a basic address from them
        // 3. If nothing, keep the existing selectedAddress (don't clear it — prevents marker vanishing)
        if (address) {
            console.log('[MapLocation] Using existing GPS address:', address.formattedAddress);
            setSelectedAddress(address);
        } else if (location) {
            console.log('[MapLocation] Using existing GPS coords:', location.lat, location.lng);
            setSelectedAddress({
                lat: location.lat,
                lng: location.lng,
                formattedAddress: `📍 ${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`,
                city: '',
                pincode: '',
            });
        } else {
            console.log('[MapLocation] No GPS data yet — keeping current marker while GPS acquires');
            // Do NOT set selectedAddress to null — keeps the existing marker visible
        }

        // Request fresh GPS fix — the sync effect updates selectedAddress when coords/address arrive
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
            // 0. Persist the confirmed address so it survives page reload
            try {
                localStorage.setItem('confirmed_delivery_address', JSON.stringify(selectedAddress));
            } catch { /* ignore */ }

            // 1. Save address locally for "Recent Addresses"
            const { saveAddressLocally } = await import("@/services/addressService");
            saveAddressLocally({ ...selectedAddress, label: 'Delivery Address' });

            setIsSaving(true);
            let deliveryEstimate: '15min' | 'delayed' = '15min';
            let deliveryFee = 40;
            let distanceKm = 0;

            // 2. Calculate road distance via backend proxy (same as CheckoutPage)
            try {
                const { getRoadDistance } = await import("@/services/mapServices");
                const res = await getRoadDistance(WAREHOUSE, {
                    lat: selectedAddress.lat,
                    lng: selectedAddress.lng,
                    eLoc: selectedAddress.eLoc
                });
                if (res.status === 'success') {
                    distanceKm = res.distanceKm;
                    deliveryEstimate = distanceKm > 6 ? 'delayed' : '15min';
                    const { calculateDeliveryFee } = await import("@/services/deliveryService");
                    deliveryFee = calculateDeliveryFee(distanceKm);
                    console.log(`🛣️ Distance: ${distanceKm.toFixed(2)}km -> ${deliveryEstimate}, Fee: ₹${deliveryFee}`);
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
                            eloc: selectedAddress.eLoc || null,
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
                            eloc: selectedAddress.eLoc || null,
                            is_default: true,
                        });
                        if (error) console.error("Error saving address to DB:", error);
                    }

                    // 5. Update profile with the new estimate, distance and fee
                    const { updateProfile } = await import("@/services/profileService");
                    try {
                        await updateProfile({ 
                            delivery_estimate: deliveryEstimate,
                            delivery_distance_km: distanceKm,
                            delivery_fee: deliveryFee
                        });
                        console.log('👤 Profile updated with delivery data:', { deliveryEstimate, distanceKm, deliveryFee });
                    } catch (err) {
                        console.warn('Could not save delivery data to profile:', err);
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

    const isAddressLocating = selectedAddress?.formattedAddress === "📍 Locating address..." || resolvingAddress;
    const canConfirm = selectedAddress && !isAddressLocating && (!hubs.length || selectedHubId);

    return (
        <div className="bg-black text-white min-h-screen md:max-w-2xl md:mx-auto md:border-x md:border-zinc-800 relative">
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
                    center={mapCenter}
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

                {/* GPS Settling Overlay */}
                {locationLoading && !resolvingAddress && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
                        <motion.div 
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex items-center gap-2 bg-zinc-900/90 border border-zinc-700 px-3 py-1.5 rounded-full shadow-lg backdrop-blur-md"
                        >
                            <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                            <div className="flex flex-col">
                                <span className="text-[10px] font-medium text-blue-400 tracking-wide uppercase">Refining GPS Location...</span>
                                {locationAccuracy && (
                                    <span className="text-[8px] text-zinc-500 font-mono">
                                        Accuracy: ±{locationAccuracy.toFixed(1)}m
                                    </span>
                                )}
                            </div>
                        </motion.div>
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
                            <div className="w-5 h-5 border-2 border-[#f2546d] border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <Navigation className="w-5 h-5 text-[#f2546d]" />
                        )}
                    </button>
                )}

            </div>

            {/* Selected address display */}
            {selectedAddress && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`mx-4 mt-4 p-4 rounded-2xl bg-zinc-900 border transition-all duration-300 ${
                        isAddressLocating ? 'border-zinc-700 animate-pulse' : 'border-zinc-800'
                    }`}
                >
                    <p className="text-xs text-zinc-400 mb-1">Delivery Address</p>
                    <div className="flex items-center gap-2">
                        {isAddressLocating && (
                            <div className="w-3 h-3 border-2 border-[#f2546d]/50 border-t-[#f2546d] rounded-full animate-spin" />
                        )}
                        <p className={`text-sm ${isAddressLocating ? 'text-zinc-400 italic' : 'text-white'}`}>
                            {selectedAddress.formattedAddress}
                        </p>
                    </div>
                </motion.div>
            )}

            {/* View mode toggle */}
            {hubs.length > 0 && (
                <div className="flex gap-2 px-4 mt-4">
                    <button
                        onClick={() => setViewMode('search')}
                        className={`flex-1 py-2 rounded-full text-sm font-medium transition-colors ${viewMode === 'search'
                            ? 'bg-[#f2546d] text-white'
                            : 'bg-zinc-800 text-zinc-400'
                            }`}
                    >
                        Location
                    </button>
                    <button
                        onClick={() => setViewMode('hubs')}
                        className={`flex-1 py-2 rounded-full text-sm font-medium transition-colors ${viewMode === 'hubs'
                            ? 'bg-[#f2546d] text-white'
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
