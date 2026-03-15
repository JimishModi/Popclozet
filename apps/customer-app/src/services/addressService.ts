// src/services/addressService.ts
// Standardized address service using Mappls via Backend Proxy

const API_URL = 'http://localhost:3001';

export interface SavedAddress {
  lat: number;
  lng: number;
  formattedAddress: string;
  pincode?: string;
  city?: string;
  eLoc?: string; // MapmyIndia's proprietary eLoc
}

export type ValidatedAddress = SavedAddress;

function mapMapplsPlace(place: any): ValidatedAddress {
    // Determine the best address display string
    const name = place.placeName || place.item_name || '';
    const address = place.placeAddress || place.formatted_address || place.address || '';
    const displayAddress = name && address && !address.startsWith(name) 
        ? `${name}, ${address}` 
        : (address || name);

    const mapped = {
        lat: parseFloat(place.latitude || place.lat || 0),
        lng: parseFloat(place.longitude || place.lng || 0),
        formattedAddress: displayAddress,
        pincode: place.pincode || '',
        city: place.city || '',
        // Handle all common variations of eLoc/eloc key
        eLoc: place.eLoc || place.eloc || place.elt || ''
    };

    console.log("[AddressService] Mapped Mappls result:", mapped);
    return mapped;
}

/**
 * Search for locations using Mappls AutoSuggest
 */
export async function searchLocations(query: string): Promise<ValidatedAddress[]> {
  if (!query || query.length < 3) return [];

  try {
    const response = await fetch(`${API_URL}/api/location/search?query=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error('Search failed');
    
    const data = await response.json();
    const locations = Array.isArray(data) ? data : (data.suggestedLocations || []);
    
    return locations.map(mapMapplsPlace);
  } catch (error) {
    console.error('Error searching locations:', error);
    return [];
  }
}

/**
 * Legacy wrapper for searchLocations to maintain compatibility with older calls if any
 */
export async function searchAddresses(query: string): Promise<ValidatedAddress[]> {
    return searchLocations(query);
}

/**
 * Get coordinates for a specific eLoc
 */
export async function getAddressDetail(eloc: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const response = await fetch(`${API_URL}/api/location/detail/${eloc}`);
    if (!response.ok) return null;
    
    const data = await response.json();
    return {
      lat: data.latitude,
      lng: data.longitude
    };
  } catch (error) {
    console.error('Error getting address detail:', error);
    return null;
  }
}

/**
 * Reverse geocode coordinates
 */
export async function reverseGeocode(lat: number, lng: number): Promise<ValidatedAddress | null> {
  try {
    const response = await fetch(`${API_URL}/api/location/reverse?lat=${lat}&lng=${lng}`);
    if (!response.ok) throw new Error('Reverse geocode failed');
    
    const data = await response.json();
    if (!data) return null;
    
    return mapMapplsPlace(data);
  } catch (error) {
    console.error('Error reverse geocoding:', error);
    return null;
  }
}

/**
 * Recent addresses management
 */
const RECENT_ADDRESSES_KEY = 'popclozet_recent_addresses';

export function saveRecentAddress(address: ValidatedAddress) {
  try {
    const saved = getRecentAddresses();
    // Keep last 10, remove duplicates
    const updated = [
      address,
      ...saved.filter((a) => a.formattedAddress !== address.formattedAddress),
    ].slice(0, 10);
    localStorage.setItem(RECENT_ADDRESSES_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Failed to save recent address', e);
  }
}

/**
 * Legacy wrapper for saveRecentAddress to maintain compatibility
 */
export function saveAddressLocally(address: ValidatedAddress) {
    saveRecentAddress(address);
}

export function getRecentAddresses(): ValidatedAddress[] {
  try {
    const saved = localStorage.getItem(RECENT_ADDRESSES_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

/**
 * Legacy wrapper for getRecentAddresses
 */
export function getLocalAddresses(): ValidatedAddress[] {
    return getRecentAddresses();
}
