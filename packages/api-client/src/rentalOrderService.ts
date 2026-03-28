/**
 * Rental Order Service
 * 
 * Handles the complete rental workflow:
 * Customer order → Rider delivery → Rental timer → Automatic pickup
 */

// TODO: Uncomment when switching from mock data to real Supabase
// @ts-ignore - used when switching from mock to real Supabase
import { supabase } from './index';
import type { Order, OrderStatus, Address } from '@popclozet/domain-contracts';
import { SERVICE_CONFIG, calculateDistance, isWithinServiceArea } from '@popclozet/mapbox-core';
// @ts-ignore - used when switching from mock to real Supabase
import { config } from './config';

// ==========================================
// TYPES
// ==========================================

export interface RentalOrder extends Order {
    orderType: 'delivery' | 'pickup';
    warehouseLocation: { lat: number; lng: number };
    rentalDurationDays: number;
    rentalStartsAt?: string;
    rentalEndsAt?: string;
    pickupScheduledAt?: string;
}

export interface RiderDeliveryOrder {
    id: string;
    orderId: string;
    orderType: 'delivery' | 'pickup';
    status: OrderStatus;

    // Locations
    pickupLocation: {
        label: string;
        address: string;
        lat: number;
        lng: number;
    };
    dropoffLocation: {
        label: string;
        address: string;
        lat: number;
        lng: number;
    };

    // Customer info (masked for privacy)
    customerName: string;
    customerPhone?: string;

    // Order details
    itemCount: number;
    estimatedDistance: number; // km
    estimatedDuration: number; // minutes
    earnings: number; // Mock earnings

    createdAt: string;
}

// ==========================================
// MOCK DATA - For demo purposes
// ==========================================

const MOCK_DELIVERY_ORDERS: RiderDeliveryOrder[] = [
    {
        id: 'DEL-001',
        orderId: 'ORD-001',
        orderType: 'delivery',
        status: 'packed',
        pickupLocation: {
            label: 'popclozet Warehouse',
            address: 'Powai, Near IIT Main Gate',
            lat: SERVICE_CONFIG.warehouseLocation.lat,
            lng: SERVICE_CONFIG.warehouseLocation.lng,
        },
        dropoffLocation: {
            label: 'Customer Address',
            address: 'H-12, IIT Bombay Campus',
            lat: 19.1362,
            lng: 72.9158,
        },
        customerName: 'Priya S.',
        customerPhone: '98XXXX1234',
        itemCount: 2,
        estimatedDistance: 1.2,
        estimatedDuration: 8,
        earnings: 50,
        createdAt: new Date().toISOString(),
    },
    {
        id: 'DEL-002',
        orderId: 'ORD-002',
        orderType: 'delivery',
        status: 'packed',
        pickupLocation: {
            label: 'popclozet Warehouse',
            address: 'Powai, Near IIT Main Gate',
            lat: SERVICE_CONFIG.warehouseLocation.lat,
            lng: SERVICE_CONFIG.warehouseLocation.lng,
        },
        dropoffLocation: {
            label: 'Customer Address',
            address: 'Hostel 10, IIT Bombay',
            lat: 19.1298,
            lng: 72.9167,
        },
        customerName: 'Rahul M.',
        customerPhone: '91XXXX5678',
        itemCount: 1,
        estimatedDistance: 0.8,
        estimatedDuration: 5,
        earnings: 50,
        createdAt: new Date(Date.now() - 300000).toISOString(),
    },
];

const MOCK_PICKUP_ORDERS: RiderDeliveryOrder[] = [
    {
        id: 'PKP-001',
        orderId: 'ORD-003',
        orderType: 'pickup',
        status: 'return_requested',
        pickupLocation: {
            label: 'Customer Address',
            address: 'C-21, Staff Quarters, IIT Bombay',
            lat: 19.1305,
            lng: 72.9145,
        },
        dropoffLocation: {
            label: 'popclozet Warehouse',
            address: 'Powai, Near IIT Main Gate',
            lat: SERVICE_CONFIG.warehouseLocation.lat,
            lng: SERVICE_CONFIG.warehouseLocation.lng,
        },
        customerName: 'Ananya K.',
        customerPhone: '90XXXX9012',
        itemCount: 3,
        estimatedDistance: 1.5,
        estimatedDuration: 10,
        earnings: 40,
        createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
    },
];

// ==========================================
// SERVICE AREA CHECK
// ==========================================

/**
 * Check if an address is within the service area
 */
export function checkServiceArea(address: Address): {
    isServiceable: boolean;
    distance: number;
    maxDistance: number;
} {
    const distance = calculateDistance(SERVICE_CONFIG.center, {
        lat: address.latitude,
        lng: address.longitude,
    });

    return {
        isServiceable: distance <= SERVICE_CONFIG.radiusKm,
        distance: Math.round(distance * 10) / 10,
        maxDistance: SERVICE_CONFIG.radiusKm,
    };
}

/**
 * Re-export for convenience
 */
export { isWithinServiceArea };

// ==========================================
// RIDER ORDER OPERATIONS
// ==========================================

/**
 * Get available delivery orders for a rider
 */
export async function getAvailableDeliveryOrders(): Promise<RiderDeliveryOrder[]> {
    // TODO: Replace with real Supabase query
    // const { data, error } = await supabase
    //     .from('delivery_orders')
    //     .select('*')
    //     .eq('status', 'packed')
    //     .is('rider_id', null)
    //     .order('created_at', { ascending: false });

    return MOCK_DELIVERY_ORDERS;
}

/**
 * Get available pickup orders for a rider
 */
export async function getAvailablePickupOrders(): Promise<RiderDeliveryOrder[]> {
    // TODO: Replace with real Supabase query
    // const { data, error } = await supabase
    //     .from('delivery_orders')
    //     .select('*')
    //     .eq('status', 'return_requested')
    //     .is('rider_id', null)
    //     .order('created_at', { ascending: false });

    return MOCK_PICKUP_ORDERS;
}

/**
 * Get all available orders (delivery + pickup)
 */
export async function getAllAvailableOrders(): Promise<RiderDeliveryOrder[]> {
    const [deliveries, pickups] = await Promise.all([
        getAvailableDeliveryOrders(),
        getAvailablePickupOrders(),
    ]);

    return [...deliveries, ...pickups].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
}

/**
 * Accept an order (delivery or pickup)
 */
export async function acceptOrder(orderId: string, riderId: string): Promise<{
    success: boolean;
    error?: string;
}> {
    // TODO: Replace with real Supabase call
    // const { error } = await supabase
    //     .from('delivery_orders')
    //     .update({ rider_id: riderId, status: 'dispatched' })
    //     .eq('id', orderId);

    console.log(`Rider ${riderId} accepted order ${orderId}`);
    return { success: true };
}

// ==========================================
// RENTAL TIMER OPERATIONS
// ==========================================

/**
 * Calculate rental end date
 */
export function calculateRentalEndDate(
    startDate: Date,
    durationDays: number
): Date {
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + durationDays);
    return endDate;
}

/**
 * Check if rental period has ended
 */
export function isRentalExpired(rentalEndDate: string): boolean {
    return new Date(rentalEndDate) <= new Date();
}

/**
 * Get remaining rental time
 */
export function getRemainingRentalTime(rentalEndDate: string): {
    expired: boolean;
    days: number;
    hours: number;
    minutes: number;
    totalMinutes: number;
} {
    const end = new Date(rentalEndDate);
    const now = new Date();
    const diffMs = end.getTime() - now.getTime();

    if (diffMs <= 0) {
        return { expired: true, days: 0, hours: 0, minutes: 0, totalMinutes: 0 };
    }

    const totalMinutes = Math.floor(diffMs / 60000);
    const days = Math.floor(totalMinutes / (24 * 60));
    const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
    const minutes = totalMinutes % 60;

    return { expired: false, days, hours, minutes, totalMinutes };
}

// ==========================================
// EARNINGS CALCULATION (MOCK)
// ==========================================

export const RIDER_EARNINGS = {
    deliveryFee: 50, // ₹50 per delivery
    pickupFee: 40,   // ₹40 per pickup
    bonusPerKm: 5,   // ₹5 per km beyond 2km
    rushHourBonus: 10, // ₹10 extra during rush hours
};

/**
 * Calculate earnings for an order
 */
export function calculateOrderEarnings(
    orderType: 'delivery' | 'pickup',
    distanceKm: number
): number {
    const baseFee = orderType === 'delivery'
        ? RIDER_EARNINGS.deliveryFee
        : RIDER_EARNINGS.pickupFee;

    const extraKm = Math.max(0, distanceKm - 2);
    const distanceBonus = Math.floor(extraKm * RIDER_EARNINGS.bonusPerKm);

    return baseFee + distanceBonus;
}
