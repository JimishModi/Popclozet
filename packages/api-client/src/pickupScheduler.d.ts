export interface ScheduledPickup {
    id: string;
    orderId: string;
    customerId: string;
    riderId?: string;
    status: 'pending' | 'assigned' | 'in_progress' | 'completed';
    scheduledAt: string;
    pickupLocation: {
        lat: number;
        lng: number;
        address: string;
    };
    createdAt: string;
}
/**
 * Schedule pickup when rental ends
 */
export declare function schedulePickup(orderId: string, customerId: string, pickupLocation: {
    lat: number;
    lng: number;
    address: string;
}): Promise<{
    success: boolean;
    pickupId?: string;
    error?: string;
}>;
/**
 * Get pending pickups for rider assignment
 */
export declare function getPendingPickups(): Promise<ScheduledPickup[]>;
/**
 * Assign rider to pickup
 */
export declare function assignRiderToPickup(pickupId: string, riderId: string): Promise<{
    success: boolean;
    error?: string;
}>;
/**
 * Complete pickup
 * Called when rider returns item to warehouse
 */
export declare function completePickup(pickupId: string, riderId: string): Promise<{
    success: boolean;
    error?: string;
}>;
/**
 * Get rider's assigned pickups
 */
export declare function getRiderPickups(riderId: string): Promise<ScheduledPickup[]>;
/**
 * Get customer's scheduled pickups
 */
export declare function getCustomerPickups(customerId: string): Promise<ScheduledPickup[]>;
//# sourceMappingURL=pickupScheduler.d.ts.map