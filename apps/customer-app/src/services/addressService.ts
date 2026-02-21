// src/services/addressService.ts
// Enhanced address service with reverse geocoding and Supabase integration

import { supabase } from '@popclozet/api-client';

export type ValidatedAddress = {
  lat: number;
  lng: number;
  formattedAddress: string;
  city?: string;
  postalCode?: string;
  country?: string;
};

export interface SavedAddress {
  id: string;
  user_id: string;
  label: string;
  full_address: string;
  city: string | null;
  postal_code: string | null;
  country: string;
  lat: number;
  lng: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

const NOMINATIM_USER_AGENT = 'PopClozet/1.0 (startup use)';

// Forward geocoding: address string -> coordinates
export async function validateAddress(input: string): Promise<ValidatedAddress> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=1&q=${encodeURIComponent(
    input
  )}`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': NOMINATIM_USER_AGENT,
    },
  });

  if (!res.ok) {
    throw new Error('Address lookup failed');
  }

  const data = await res.json();

  if (!data || data.length === 0) {
    throw new Error('Address not found');
  }

  const place = data[0];

  return {
    lat: Number(place.lat),
    lng: Number(place.lon),
    formattedAddress: place.display_name,
    city: place.address?.city || place.address?.town || place.address?.suburb,
    postalCode: place.address?.postcode,
    country: place.address?.country,
  };
}

// Reverse geocoding: coordinates -> address
export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<ValidatedAddress> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': NOMINATIM_USER_AGENT,
    },
  });

  if (!res.ok) {
    throw new Error('Reverse geocoding failed');
  }

  const data = await res.json();

  if (!data || data.error) {
    throw new Error('Location not found');
  }

  return {
    lat,
    lng,
    formattedAddress: data.display_name,
    city: data.address?.city || data.address?.town || data.address?.suburb,
    postalCode: data.address?.postcode,
    country: data.address?.country,
  };
}

// Address autocomplete (returns multiple suggestions)
export async function searchAddresses(query: string, limit: number = 5): Promise<ValidatedAddress[]> {
  if (!query || query.length < 3) return [];

  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=${limit}&addressdetails=1&countrycodes=in&q=${encodeURIComponent(
    query
  )}`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': NOMINATIM_USER_AGENT,
      },
    });

    if (!res.ok) return [];

    const data = await res.json();

    return data.map((place: any) => ({
      lat: Number(place.lat),
      lng: Number(place.lon),
      formattedAddress: place.display_name,
      city: place.address?.city || place.address?.town || place.address?.suburb,
      postalCode: place.address?.postcode,
      country: place.address?.country,
    }));
  } catch {
    return [];
  }
}

// Save address to Supabase
export async function saveAddress(
  userId: string,
  address: ValidatedAddress,
  label: string = 'Home',
  isDefault: boolean = false
): Promise<SavedAddress | null> {
  if (!supabase) {
    console.warn('Supabase not configured');
    return null;
  }

  // If setting as default, unset other defaults first
  if (isDefault) {
    await supabase
      .from('user_addresses')
      .update({ is_default: false })
      .eq('user_id', userId)
      .eq('is_default', true);
  }

  const { data, error } = await supabase
    .from('user_addresses')
    .insert({
      user_id: userId,
      label,
      full_address: address.formattedAddress,
      city: address.city || null,
      postal_code: address.postalCode || null,
      country: address.country || 'India',
      lat: address.lat,
      lng: address.lng,
      is_default: isDefault,
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to save address:', error);
    return null;
  }

  return data;
}

// Get user's saved addresses
export async function getUserAddresses(userId: string): Promise<SavedAddress[]> {
  if (!supabase) {
    return getLocalAddresses();
  }

  const { data, error } = await supabase
    .from('user_addresses')
    .select('*')
    .eq('user_id', userId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch addresses:', error);
    return getLocalAddresses();
  }

  return data || [];
}

// Get default address
export async function getDefaultAddress(userId: string): Promise<SavedAddress | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('user_addresses')
    .select('*')
    .eq('user_id', userId)
    .eq('is_default', true)
    .single();

  if (error) return null;
  return data;
}

// Update address
export async function updateAddress(
  addressId: string,
  updates: Partial<Pick<SavedAddress, 'label' | 'is_default'>>
): Promise<boolean> {
  if (!supabase) return false;

  const { error } = await supabase
    .from('user_addresses')
    .update(updates)
    .eq('id', addressId);

  return !error;
}

// Delete address
export async function deleteAddress(addressId: string): Promise<boolean> {
  if (!supabase) return false;

  const { error } = await supabase
    .from('user_addresses')
    .delete()
    .eq('id', addressId);

  return !error;
}

// Local storage fallback for addresses
const LOCAL_ADDRESSES_KEY = 'popclozet_addresses';

export function saveAddressLocally(address: ValidatedAddress, label: string = 'Home') {
  try {
    const addresses = getLocalAddresses();
    const newAddress: SavedAddress = {
      id: `local-${Date.now()}`,
      user_id: 'local',
      label,
      full_address: address.formattedAddress,
      city: address.city || null,
      postal_code: address.postalCode || null,
      country: address.country || 'India',
      lat: address.lat,
      lng: address.lng,
      is_default: addresses.length === 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    localStorage.setItem(LOCAL_ADDRESSES_KEY, JSON.stringify([newAddress, ...addresses]));
    return newAddress;
  } catch {
    return null;
  }
}

export function getLocalAddresses(): SavedAddress[] {
  try {
    const raw = localStorage.getItem(LOCAL_ADDRESSES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function clearLocalAddresses() {
  localStorage.removeItem(LOCAL_ADDRESSES_KEY);
}

