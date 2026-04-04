// src/services/addressService.ts
// Standardized address service using Mappls via Supabase Edge Function
import { supabase } from '@popclozet/api-client';
import { MapplsSuggestion, MapplsGeocodingError, fetchPlaceDetails } from './mapplsService';
import { callLocationFn } from '@/utils/env';

export interface SavedAddress {
  id?: string;
  lat: number;
  lng: number;
  formattedAddress: string;
  full_address?: string;
  label?: string;
  pincode?: string;
  city?: string;
  eLoc?: string; // MapmyIndia's proprietary eLoc
}

export type ValidatedAddress = SavedAddress;

function mapMapplsPlace(place: any): ValidatedAddress {
  console.log('RAW Mappls place:', JSON.stringify(place));

  const lat = parseFloat(place.latitude || place.lat || place.placeLat || place.y || 0);
  const lng = parseFloat(place.longitude || place.lng || place.lon || place.placeLng || place.x || 0);
  const eLoc = place.eLoc || place.placeId || '';

  // Determine the best address display string
  const name = place.placeName || place.item_name || '';
  const address = place.placeAddress || place.formatted_address || place.address || '';
  const displayAddress = name && address && !address.startsWith(name)
    ? `${name}, ${address}`
    : (address || name);

  const mapped = {
    lat,
    lng,
    formattedAddress: displayAddress,
    full_address: displayAddress,
    label: place.label || place.address_type || 'Other',
    pincode: place.pincode || '',
    city: place.city || '',
    // Handle all common variations of eLoc/eloc key
    eLoc: place.eLoc || place.eloc || place.elt || place.placeId || ''
  };

  console.log("[AddressService] Mapped Mappls result:", mapped);
  return mapped;
}

/**
 * Search for locations using Mappls AutoSuggest
 * Passes user's current location for proximity-biased results
 */
export async function searchLocations(query: string): Promise<ValidatedAddress[]> {
  if (!query || query.length < 3) return [];

  try {
    // Include user's current location for proximity-biased search results
    const searchBody: Record<string, unknown> = { action: 'search', query };
    try {
      const savedLocation = localStorage.getItem('user_location');
      if (savedLocation) {
        const loc = JSON.parse(savedLocation);
        if (loc.lat && loc.lng) {
          searchBody.lat = loc.lat;
          searchBody.lng = loc.lng;
        }
      }
    } catch { /* ignore */ }

    const data = await callLocationFn(searchBody);
    if (!data) throw new Error('Search failed');
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

export async function validateAddress(query: string): Promise<ValidatedAddress> {
  const results = await searchLocations(query);
  if (!results.length) {
    throw new Error('Address not found');
  }

  return results[0];
}

/**
 * Get coordinates for a specific eLoc
 */
export async function getAddressDetail(eloc: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const data = await callLocationFn({ action: 'detail', eloc });
    if (!data) return null;
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
    const data = await callLocationFn({ action: 'reverse', lat, lng });
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

export function deleteRecentAddress(formattedAddress: string) {
  try {
    const saved = getRecentAddresses();
    const updated = saved.filter((a) => a.formattedAddress !== formattedAddress);
    localStorage.setItem(RECENT_ADDRESSES_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Failed to delete recent address', e);
  }
}

/**
 * Legacy wrapper for getRecentAddresses
 */
export function getLocalAddresses(): ValidatedAddress[] {
  return getRecentAddresses();
}

export interface SaveAddressParams {
  userId: string;
  label: string;
  suggestion: MapplsSuggestion;
  isDefault?: boolean;
}

export interface Address {
  id: string;
  userId: string;
  label: string;
  fullAddress: string;
  latitude: number;
  longitude: number;
  geohash: string;
  isDefault: boolean;
  eloc: string | null;
  googleMapsUrl: string | null;
}

export async function saveAddress(params: SaveAddressParams): Promise<{ data: Address | null; error: string | null }> {
  let placeDetails;
  try {
    placeDetails = await fetchPlaceDetails(params.suggestion.eLoc);
  } catch (err: any) {
    if (err instanceof MapplsGeocodingError) {
      return { data: null, error: err.message };
    }
    return { data: null, error: 'Failed to resolve address coordinates. Please try again.' };
  }

  // Computing geohash inline since the existing logic inline concatenates it:
  const computedGeohash = `${placeDetails.latitude.toFixed(2)}_${placeDetails.longitude.toFixed(2)}`;

  const insertObj = {
    user_id: params.userId,
    label: params.label,
    full_address: placeDetails.placeAddress,
    latitude: placeDetails.latitude,
    longitude: placeDetails.longitude,
    geohash: computedGeohash,
    is_default: params.isDefault ?? false,
    eloc: params.suggestion.eLoc
  };

  const { data, error } = await supabase.from('addresses').insert(insertObj).select().single();

  if (error) {
    return { data: null, error: error.message };
  }

  if (data) {
    const mappedAddress: Address = {
      id: data.id,
      userId: data.user_id,
      label: data.label,
      fullAddress: data.full_address,
      latitude: data.latitude,
      longitude: data.longitude,
      geohash: data.geohash,
      isDefault: data.is_default,
      eloc: data.eloc,
      googleMapsUrl: data.google_maps_url
    };
    return { data: mappedAddress, error: null };
  }

  return { data: null, error: 'Unknown error occurred during save' };
}
