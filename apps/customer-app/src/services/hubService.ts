// src/services/hubService.ts
// Rental hub discovery and management

import { supabase } from '@popclozet/api-client';
import { calculateRoute } from './mapService';

export interface RentalHub {
    id: string;
    name: string;
    address: string;
    city: string;
    lat: number;
    lng: number;
    operating_hours: Record<string, { open: string; close: string }>;
    is_active: boolean;
    availability_status: 'available' | 'busy' | 'offline';
    delivery_radius_km: number;
    avg_delivery_minutes: number;
    created_at: string;
    updated_at: string;
}

export interface HubWithDistance extends RentalHub {
    distance_km: number;
    estimated_minutes: number;
    is_open: boolean;
}

// Haversine formula for distance calculation
function calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
): number {
    const R = 6371; // Earth's radius in km
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function toRad(deg: number): number {
    return (deg * Math.PI) / 180;
}

// Check if hub is currently open
function isHubOpen(operatingHours: Record<string, { open: string; close: string }>): boolean {
    const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const now = new Date();
    const dayKey = days[now.getDay()];
    const hours = operatingHours[dayKey];

    if (!hours) return false;

    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    return currentTime >= hours.open && currentTime <= hours.close;
}

// Fetch all active hubs
export async function getAllHubs(): Promise<RentalHub[]> {
    if (!supabase) {
        console.warn('Supabase not configured');
        return getMockHubs();
    }

    const { data, error } = await supabase
        .from('rental_hubs')
        .select('*')
        .eq('is_active', true)
        .order('name');

    if (error) {
        console.error('Failed to fetch hubs:', error);
        return getMockHubs();
    }

    return data || [];
}

// Find hubs within radius of user location
export async function findNearbyHubs(
    userLat: number,
    userLng: number,
    maxRadiusKm: number = 50
): Promise<HubWithDistance[]> {
    const allHubs = await getAllHubs();

    const hubsWithDistance = allHubs
        .map((hub) => {
            const distance_km = calculateDistance(userLat, userLng, hub.lat, hub.lng);
            const is_open = isHubOpen(hub.operating_hours || {});

            // Estimate delivery time based on distance
            const base_minutes = hub.avg_delivery_minutes || 45;
            const distance_factor = Math.max(1, distance_km / 10); // Extra 10 mins per 10km
            const estimated_minutes = Math.round(base_minutes * distance_factor);

            return {
                ...hub,
                distance_km: Math.round(distance_km * 10) / 10,
                estimated_minutes,
                is_open,
            };
        })
        .filter((hub) => hub.distance_km <= maxRadiusKm)
        .sort((a, b) => {
            // Sort by: open first, then by distance
            if (a.is_open !== b.is_open) return a.is_open ? -1 : 1;
            return a.distance_km - b.distance_km;
        });

    return hubsWithDistance;
}

// Get the best hub for user's location
export async function getBestHub(
    userLat: number,
    userLng: number
): Promise<HubWithDistance | null> {
    const nearbyHubs = await findNearbyHubs(userLat, userLng, 50);

    if (nearbyHubs.length === 0) return null;

    // Prefer available hubs, then open hubs, then closest
    const available = nearbyHubs.filter((h) => h.availability_status === 'available');
    if (available.length > 0) {
        return available.find((h) => h.is_open) || available[0];
    }

    return nearbyHubs[0];
}

// Get hub by ID
export async function getHubById(hubId: string): Promise<RentalHub | null> {
    if (!supabase) {
        const mockHubs = getMockHubs();
        return mockHubs.find((h) => h.id === hubId) || null;
    }

    const { data, error } = await supabase
        .from('rental_hubs')
        .select('*')
        .eq('id', hubId)
        .single();

    if (error) {
        console.error('Failed to fetch hub:', error);
        return null;
    }

    return data;
}

// Calculate delivery route from hub to user
export async function getHubToUserRoute(
    hub: RentalHub,
    userLat: number,
    userLng: number
) {
    return calculateRoute(
        { lat: hub.lat, lng: hub.lng },
        { lat: userLat, lng: userLng }
    );
}

// Mock hubs for development/offline use
function getMockHubs(): RentalHub[] {
    return [
        {
            id: 'mock-1',
            name: 'PopClozet Mumbai Central',
            address: 'Kamala Mills Compound, Lower Parel, Mumbai 400013',
            city: 'Mumbai',
            lat: 19.0048,
            lng: 72.8268,
            operating_hours: {
                mon: { open: '10:00', close: '22:00' },
                tue: { open: '10:00', close: '22:00' },
                wed: { open: '10:00', close: '22:00' },
                thu: { open: '10:00', close: '22:00' },
                fri: { open: '10:00', close: '22:00' },
                sat: { open: '10:00', close: '22:00' },
                sun: { open: '11:00', close: '20:00' },
            },
            is_active: true,
            availability_status: 'available',
            delivery_radius_km: 50,
            avg_delivery_minutes: 45,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        },
        {
            id: 'mock-2',
            name: 'PopClozet Bandra',
            address: 'Turner Road, Bandra West, Mumbai 400050',
            city: 'Mumbai',
            lat: 19.0596,
            lng: 72.8295,
            operating_hours: {
                mon: { open: '10:00', close: '21:00' },
                tue: { open: '10:00', close: '21:00' },
                wed: { open: '10:00', close: '21:00' },
                thu: { open: '10:00', close: '21:00' },
                fri: { open: '10:00', close: '21:00' },
                sat: { open: '10:00', close: '21:00' },
                sun: { open: '11:00', close: '19:00' },
            },
            is_active: true,
            availability_status: 'available',
            delivery_radius_km: 50,
            avg_delivery_minutes: 50,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        },
        {
            id: 'mock-3',
            name: 'PopClozet Andheri',
            address: 'Lokhandwala Complex, Andheri West, Mumbai 400053',
            city: 'Mumbai',
            lat: 19.1384,
            lng: 72.8296,
            operating_hours: {
                mon: { open: '10:00', close: '21:00' },
                tue: { open: '10:00', close: '21:00' },
                wed: { open: '10:00', close: '21:00' },
                thu: { open: '10:00', close: '21:00' },
                fri: { open: '10:00', close: '21:00' },
                sat: { open: '10:00', close: '21:00' },
                sun: { open: '11:00', close: '19:00' },
            },
            is_active: true,
            availability_status: 'busy',
            delivery_radius_km: 50,
            avg_delivery_minutes: 55,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        },
    ];
}

// Cache for offline use
const HUB_CACHE_KEY = 'popclozet_hubs_cache';

export function cacheHubs(hubs: RentalHub[]) {
    try {
        localStorage.setItem(HUB_CACHE_KEY, JSON.stringify({
            hubs,
            timestamp: Date.now(),
        }));
    } catch (e) {
        console.warn('Failed to cache hubs:', e);
    }
}

export function getCachedHubs(): RentalHub[] | null {
    try {
        const cached = localStorage.getItem(HUB_CACHE_KEY);
        if (!cached) return null;

        const { hubs, timestamp } = JSON.parse(cached);
        // Cache valid for 1 hour
        if (Date.now() - timestamp > 3600000) return null;

        return hubs;
    } catch {
        return null;
    }
}
