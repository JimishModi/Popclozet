/**
 * Rider Order Service
 *
 * Connects riders to customer orders and provides location updates.
 * Used by rider-app; customer-app subscribes to these updates.
 */
import type { OrderStatus } from '@popclozet/domain-contracts';
export interface RiderOrder {
    id: string;
    orderId: string;
    customerId: string;
    customerName?: string;
    customerPhone?: string;
    orderType: 'delivery' | 'pickup' | 'return';
    status: OrderStatus;
    pickupAddress: {
        fullAddress: string;
        lat: number;
        lng: number;
    };
    deliveryAddress: {
        fullAddress: string;
        lat: number;
        lng: number;
    };
    items: Array<{
        name: string;
        qty: number;
    }>;
    totalAmount: number;
    deliveryFee: number;
    etaMinutes?: number;
    distanceKm?: number;
    routePolyline?: string;
    assignedAt: string;
    createdAt: string;
}
export interface RiderLocation {
    riderId: string;
    lat: number;
    lng: number;
    heading?: number;
    speed?: number;
    updatedAt: string;
}
/**
 * Get all assigned orders for a rider
 */
export declare function getRiderOrders(riderId: string): Promise<RiderOrder[]>;
/**
 * Get a single order by ID for the rider
 */
export declare function getRiderOrderById(orderId: string): Promise<RiderOrder | null>;
/**
 * Update order status as rider
 */
export declare function updateOrderAsRider(orderId: string, newStatus: OrderStatus, riderId: string): Promise<import("@popclozet/domain-contracts").TransitionResult>;
/**
 * Mark order as picked up from hub
 */
export declare function markAsPickedUp(orderId: string, riderId: string): Promise<import("@popclozet/domain-contracts").TransitionResult>;
/**
 * Mark order as delivered to customer
 */
export declare function markAsDelivered(orderId: string, riderId: string): Promise<import("@popclozet/domain-contracts").TransitionResult>;
/**
 * Update rider's current location
 * Called frequently from rider app (every 5-10 seconds during active delivery)
 */
export declare function updateRiderLocation(riderId: string, lat: number, lng: number, heading?: number, speed?: number): Promise<boolean>;
/**
 * Get current location of a rider
 */
export declare function getRiderLocation(riderId: string): Promise<RiderLocation | null>;
/**
 * Subscribe to new order assignments for a rider
 */
export declare function subscribeToRiderOrderAssignments(riderId: string, callback: (orderId: string) => void): () => Promise<"error" | "ok" | "timed out">;
/**
 * Subscribe to order status updates (for rider UI)
 */
export declare function subscribeToOrderUpdates(orderId: string, callback: (status: OrderStatus) => void): () => Promise<"error" | "ok" | "timed out">;
