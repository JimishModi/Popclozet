/**
 * Slots Service
 *
 * Handles rider slot booking for scheduled deliveries
 */
export interface TimeSlot {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    maxRiders: number;
    bookedCount: number;
    isAvailable: boolean;
    incentiveMultiplier: number;
}
export interface RiderSlot {
    id: string;
    riderId: string;
    slotId: string;
    slot: TimeSlot;
    status: 'booked' | 'active' | 'completed' | 'cancelled';
    bookedAt: string;
}
/**
 * Get available slots for a date
 */
export declare function getAvailableSlots(date: string): Promise<TimeSlot[]>;
/**
 * Get slots for a date range
 */
export declare function getSlotsForDateRange(startDate: string, endDate: string): Promise<TimeSlot[]>;
/**
 * Book a slot for the rider
 */
export declare function bookSlot(riderId: string, slotId: string): Promise<{
    success: boolean;
    error?: string;
    booking?: RiderSlot;
}>;
/**
 * Cancel a booked slot
 */
export declare function cancelSlot(riderId: string, bookingId: string): Promise<{
    success: boolean;
    error?: string;
}>;
/**
 * Get rider's booked slots
 */
export declare function getRiderSlots(riderId: string, status?: RiderSlot['status']): Promise<RiderSlot[]>;
/**
 * Get rider's slots for a specific date
 */
export declare function getRiderSlotsForDate(riderId: string, date: string): Promise<RiderSlot[]>;
/**
 * Get upcoming slots count for dashboard
 */
export declare function getUpcomingSlotsCount(riderId: string): Promise<number>;
