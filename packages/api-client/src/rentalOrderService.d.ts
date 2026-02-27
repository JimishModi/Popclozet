/**
 * Rental Order Service
 *
 * Handles the complete rental workflow:
 * Customer order → Rider delivery → Rental timer → Automatic pickup
 */
import type { Order, OrderStatus, Address } from '@popclozet/domain-contracts';
import { isWithinServiceArea } from '@popclozet/mapbox-core';
export interface RentalOrder extends Order {
    orderType: 'delivery' | 'pickup';
    warehouseLocation: {
        lat: number;
        lng: number;
    };
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
    customerName: string;
    customerPhone?: string;
    itemCount: number;
    estimatedDistance: number;
    estimatedDuration: number;
    earnings: number;
    createdAt: string;
}
/**
 * Check if an address is within the service area
 */
export declare function checkServiceArea(address: Address): {
    isServiceable: boolean;
    distance: number;
    maxDistance: number;
};
/**
 * Re-export for convenience
 */
export { isWithinServiceArea };
/**
 * Get available delivery orders for a rider
 */
export declare function getAvailableDeliveryOrders(): Promise<RiderDeliveryOrder[]>;
/**
 * Get available pickup orders for a rider
 */
export declare function getAvailablePickupOrders(): Promise<RiderDeliveryOrder[]>;
/**
 * Get all available orders (delivery + pickup)
 */
export declare function getAllAvailableOrders(): Promise<RiderDeliveryOrder[]>;
/**
 * Accept an order (delivery or pickup)
 */
export declare function acceptOrder(orderId: string, riderId: string): Promise<{
    success: boolean;
    error?: string;
}>;
/**
 * Calculate rental end date
 */
export declare function calculateRentalEndDate(startDate: Date, durationDays: number): Date;
/**
 * Check if rental period has ended
 */
export declare function isRentalExpired(rentalEndDate: string): boolean;
/**
 * Get remaining rental time
 */
export declare function getRemainingRentalTime(rentalEndDate: string): {
    expired: boolean;
    days: number;
    hours: number;
    minutes: number;
    totalMinutes: number;
};
export declare const RIDER_EARNINGS: {
    deliveryFee: number;
    pickupFee: number;
    bonusPerKm: number;
    rushHourBonus: number;
};
/**
 * Calculate earnings for an order
 */
export declare function calculateOrderEarnings(orderType: 'delivery' | 'pickup', distanceKm: number): number;
//# sourceMappingURL=rentalOrderService.d.ts.map