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
import { saveAddressLocally, ValidatedAddress } from '@/services/addressService';
import { HubWithDistance } from '@/services/hubService';
import { useDriverSimulation } from '@/hooks/useDriverSimulation';
import { toast } from 'sonner';

type ViewMode = 'search' | 'hubs';

export default function MapLocationPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const returnTo = searchParams.get('returnTo') || '/cart';

    const [viewMode, setViewMode] = useState<ViewMode>('search');
    const [selectedAddress, setSelectedAddress] = useState<ValidatedAddress | null>(null);
    const [showHubSheet, setShowHubSheet] = useState(false);
    const [detailedHub, setDetailedHub] = useState<HubWithDistance | null>(null);
    const [isSimulationActive, setIsSimulationActive] = useState(false);
    
    // Clear corrupt localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem('user_location');
        if (saved && (saved.includes('undefined') || saved.includes('null'))) {
            localStorage.removeItem('user_location');
            window.location.reload(); // Force refresh to clear internal hook state
        }
    }, []);

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

    // Simulation Hook - Use selected hub if available, otherwise use first hub
    const simulationOrigin = selectedHub
        ? { lat: selectedHub.lat, lng: selectedHub.lng }
        : hubs.length > 0
            ? { lat: hubs[0].lat, lng: hubs[0].lng }
            : null;

    const { vehicleLocation: simulatedVehicle, routePath, isCalculating } = useDriverSimulation({
        origin: simulationOrigin,
        destination: selectedAddress ? { lat: selectedAddress.lat, lng: selectedAddress.lng } : null,
        isActive: isSimulationActive && !!selectedAddress && !!simulationOrigin
    });

    // Initially sync selected address from current location, but don't yank it back if user manually selected something
    useEffect(() => {
        if (address && !selectedAddress) {
            setSelectedAddress(address);
        }
    }, [address, selectedAddress]);

    const handleAddressSelect = (addr: ValidatedAddress) => {
        setSelectedAddress(addr);
        setViewMode('search');
        
        const hasCoords = addr.lat && addr.lng && Math.abs(addr.lat) > 0.01;
        
        if (hasCoords) {
            // Coords already present — sync map
            setLocationWithAddress(addr.lat, addr.lng, addr);
        } else {
            console.warn("[MapLocationPage] Address has no coords:", addr.formattedAddress);
            toast.error("This address cannot be mapped. Please try another one.");
        }
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
                city: 'Mumbai',
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

    const handleConfirm = () => {
        if (selectedAddress) {
            // Save address locally
            saveAddressLocally(selectedAddress);

            // Save hub selection if any
            if (selectedHub) {
                localStorage.setItem('selected_hub', JSON.stringify({
                    id: selectedHub.id,
                    name: selectedHub.name,
                    distance_km: selectedHub.distance_km,
                    estimated_minutes: selectedHub.estimated_minutes,
                }));
            }

            // Navigate back with the specific address in state for immediate reactivity
            navigate(returnTo, { 
                state: { selectedAddress } 
            });
        }
    };

    const canConfirm = selectedAddress && (!hubs.length || selectedHubId);

    return (
        <MobileShell className="bg-black text-white" hideBottomNav={true}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 sticky top-0 z-50 bg-black/90 backdrop-blur-md">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-all active:scale-95"
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
                    isLoading={false}
                />
            </div>

            {/* Map */}
            <div className="relative h-[450px] mx-4 rounded-2xl overflow-hidden border border-zinc-800">
                <InteractiveMap
                    center={(selectedAddress && selectedAddress.lat && selectedAddress.lng && Math.abs(selectedAddress.lat) > 0.01) ? { lat: selectedAddress.lat, lng: selectedAddress.lng } : (location || { lat: 19.076, lng: 72.8777 })}
                    zoom={selectedAddress || location ? 14 : 11}
                    darkMode={false}
                    userLocation={(selectedAddress && selectedAddress.lat && selectedAddress.lng && Math.abs(selectedAddress.lat) > 0.01) ? { lat: selectedAddress.lat, lng: selectedAddress.lng } : location}
                    hubs={hubs}
                    selectedHubId={selectedHubId || undefined}
                    onMapClick={handleMapClick}
                    onHubClick={handleHubClick}
                    // Simulation Props
                    routePath={routePath}
                    vehicleLocation={simulatedVehicle}
                    trackerMode={isSimulationActive && !!simulatedVehicle}
                />

                {/* GPS Button */}
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

                {/* Simulation Toggle (Demo) */}
                {selectedAddress && (selectedHub || hubs.length > 0) && (
                    <button
                        onClick={() => setIsSimulationActive(!isSimulationActive)}
                        disabled={isCalculating}
                        className={`absolute bottom-4 left-4 px-4 py-2.5 rounded-full text-sm font-bold shadow-lg transition-colors flex items-center gap-2 ${isSimulationActive
                            ? 'bg-[#f2546d] text-white hover:bg-[#ff3d5d]'
                            : 'bg-white text-black hover:bg-gray-100'
                            } ${isCalculating ? 'opacity-50 cursor-not-allowed' : ''}`}
                        style={{ zIndex: 1000 }}
                    >
                        {isCalculating ? (
                            <>
                                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                Calculating...
                            </>
                        ) : isSimulationActive ? (
                            'Stop Route'
                        ) : (
                            '🚗 Simulate Route'
                        )}
                    </button>
                )}

                {/* Route Info Overlay */}
                {isSimulationActive && routePath && selectedAddress && (selectedHub || hubs.length > 0) && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="absolute top-4 left-4 right-4 bg-black/90 backdrop-blur-md rounded-xl p-3 border border-zinc-800"
                        style={{ zIndex: 1000 }}
                    >
                        <div className="flex items-center justify-between text-xs">
                            <div>
                                <p className="text-zinc-400">Tracking Route</p>
                                <p className="text-white font-medium">
                                    {selectedHub?.name || hubs[0]?.name || 'Hub'} → Selected Location
                                </p>
                            </div>
                            {simulatedVehicle && (
                                <div className="text-right">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2 h-2 bg-[#f2546d] rounded-full animate-pulse"></div>
                                        <p className="text-[#f2546d] font-bold">Tracker Mode ON</p>
                                    </div>
                                    <p className="text-zinc-400">Following Vehicle</p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </div>

            {/* Selected address display */}
            {selectedAddress && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mx-4 mt-4 p-4 rounded-2xl bg-zinc-900 border border-zinc-800"
                >
                    <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-zinc-400">Delivery Address</p>
                    </div>
                    <p className="text-sm text-white">{selectedAddress.formattedAddress}</p>
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
                        disabled={!canConfirm}
                        className={`w-full py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2 transition-all shadow-xl ${canConfirm
                            ? 'bg-[#f2546d] text-white shadow-[#f2546d]/20'
                            : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                            }`}
                    >
                        <Check className="w-5 h-5" />
                        Confirm Location
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
        </MobileShell>
    );
}
