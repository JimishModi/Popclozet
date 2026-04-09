// src/utils/checkoutHelpers.ts
// Helper functions for checkout flow with delivery integration

import { ValidatedAddress } from '@/services/addressService';

export interface SelectedHub {
    id: string;
    name: string;
    distance_km: number;
    estimated_minutes: number;
}

export interface DeliveryInfo {
    location: { lat: number; lng: number; allowed: boolean } | null;
    hub: SelectedHub | null;
    addresses: ValidatedAddress[];
    selectedAddress: ValidatedAddress | null;
}

/**
 * Get all delivery-related information from localStorage
 */
export function getSelectedDeliveryInfo(): DeliveryInfo {
    let location = null, hub = null, addresses = null;
    try {
        location = localStorage.getItem('user_location');
        hub = localStorage.getItem('selected_hub');
        addresses = localStorage.getItem('popclozet_addresses');
    } catch {}

    // Get the most recent address (first in array)
    let selectedAddress: ValidatedAddress | null = null;
    if (addresses) {
        try {
            const parsedAddresses = JSON.parse(addresses);
            if (Array.isArray(parsedAddresses) && parsedAddresses.length > 0) {
                selectedAddress = parsedAddresses[0];
            }
        } catch {
            // Invalid data
        }
    }

    return {
        location: location ? JSON.parse(location) : null,
        hub: hub ? JSON.parse(hub) : null,
        addresses: addresses ? JSON.parse(addresses) : [],
        selectedAddress,
    };
}

/**
 * Check if delivery information is complete for checkout
 */
export function hasDeliveryInfoComplete(): boolean {
    const { location, hub } = getSelectedDeliveryInfo();
    return !!(location && hub);
}

/**
 * Get formatted delivery address string
 */
export function getFormattedDeliveryAddress(): string | null {
    const { selectedAddress } = getSelectedDeliveryInfo();
    if (!selectedAddress) return null;
    return selectedAddress.formattedAddress;
}

/**
 * Get delivery summary for display
 */
export function getDeliverySummary(): {
    hasAddress: boolean;
    hasHub: boolean;
    addressText: string;
    hubText: string;
    isComplete: boolean;
} {
    const { selectedAddress, hub } = getSelectedDeliveryInfo();

    return {
        hasAddress: !!selectedAddress,
        hasHub: !!hub,
        addressText: selectedAddress?.formattedAddress || 'Not selected',
        hubText: hub ? `${hub.name} (${hub.distance_km} km)` : 'Not selected',
        isComplete: !!(selectedAddress && hub),
    };
}

/**
 * Clear all delivery information
 */
export function clearDeliveryInfo(): void {
    try {
        localStorage.removeItem('user_location');
        localStorage.removeItem('selected_hub');
        localStorage.removeItem('popclozet_addresses');
    } catch {}
}
