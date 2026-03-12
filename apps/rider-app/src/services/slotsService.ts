/**
 * Slots Service
 * 
 * Handles rider slot booking for scheduled deliveries
 */

import { supabase } from '@popclozet/api-client';

// ==========================================
// TYPES
// ==========================================

export interface TimeSlot {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    maxRiders: number;
    bookedCount: number;
    isAvailable: boolean;
    incentiveMultiplier: number; // e.g., 1.5x for peak hours
}

export interface RiderSlot {
    id: string;
    riderId: string;
    slotId: string;
    slot: TimeSlot;
    status: 'booked' | 'active' | 'completed' | 'cancelled';
    bookedAt: string;
}

// ==========================================
// SLOT OPERATIONS
// ==========================================

/**
 * Get available slots for a date
 */
export async function getAvailableSlots(date: string): Promise<TimeSlot[]> {
    const { data, error } = await supabase
        .from('time_slots')
        .select('*, rider_slots(count)')
        .eq('date', date)
        .order('start_time');

    if (error) {
        console.error('Failed to fetch slots:', error);
        return [];
    }

    return (data || []).map((slot: any) => {
        const bookedCount = slot.rider_slots?.[0]?.count || 0;
        return {
            id: slot.id,
            date: slot.date,
            startTime: slot.start_time,
            endTime: slot.end_time,
            maxRiders: slot.max_riders,
            bookedCount,
            isAvailable: bookedCount < slot.max_riders,
            incentiveMultiplier: slot.incentive_multiplier || 1,
        };
    });
}

/**
 * Get slots for a date range
 */
export async function getSlotsForDateRange(
    startDate: string,
    endDate: string
): Promise<TimeSlot[]> {
    const { data, error } = await supabase
        .from('time_slots')
        .select('*, rider_slots(count)')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date')
        .order('start_time');

    if (error) {
        console.error('Failed to fetch slots:', error);
        return [];
    }

    return (data || []).map((slot: any) => {
        const bookedCount = slot.rider_slots?.[0]?.count || 0;
        return {
            id: slot.id,
            date: slot.date,
            startTime: slot.start_time,
            endTime: slot.end_time,
            maxRiders: slot.max_riders,
            bookedCount,
            isAvailable: bookedCount < slot.max_riders,
            incentiveMultiplier: slot.incentive_multiplier || 1,
        };
    });
}

/**
 * Book a slot for the rider
 */
export async function bookSlot(
    riderId: string,
    slotId: string
): Promise<{ success: boolean; error?: string; booking?: RiderSlot }> {
    // Check if slot is available
    const { data: slotData, error: slotError } = await supabase
        .from('time_slots')
        .select('*, rider_slots(count)')
        .eq('id', slotId)
        .single();

    if (slotError || !slotData) {
        return { success: false, error: 'Slot not found' };
    }

    const bookedCount = slotData.rider_slots?.[0]?.count || 0;
    if (bookedCount >= slotData.max_riders) {
        return { success: false, error: 'Slot is fully booked' };
    }

    // Check if rider already has this slot
    const { data: existingBooking } = await supabase
        .from('rider_slots')
        .select('id')
        .eq('rider_id', riderId)
        .eq('slot_id', slotId)
        .single();

    if (existingBooking) {
        return { success: false, error: 'You already booked this slot' };
    }

    // Book the slot
    const { data, error } = await supabase
        .from('rider_slots')
        .insert({
            rider_id: riderId,
            slot_id: slotId,
            status: 'booked',
        })
        .select('*, time_slots(*)')
        .single();

    if (error) {
        console.error('Failed to book slot:', error);
        return { success: false, error: 'Failed to book slot' };
    }

    return {
        success: true,
        booking: {
            id: data.id,
            riderId: data.rider_id,
            slotId: data.slot_id,
            slot: {
                id: data.time_slots.id,
                date: data.time_slots.date,
                startTime: data.time_slots.start_time,
                endTime: data.time_slots.end_time,
                maxRiders: data.time_slots.max_riders,
                bookedCount: bookedCount + 1,
                isAvailable: bookedCount + 1 < data.time_slots.max_riders,
                incentiveMultiplier: data.time_slots.incentive_multiplier || 1,
            },
            status: data.status,
            bookedAt: data.created_at,
        },
    };
}

/**
 * Cancel a booked slot
 */
export async function cancelSlot(
    riderId: string,
    bookingId: string
): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase
        .from('rider_slots')
        .update({ status: 'cancelled' })
        .eq('id', bookingId)
        .eq('rider_id', riderId);

    if (error) {
        console.error('Failed to cancel slot:', error);
        return { success: false, error: 'Failed to cancel slot' };
    }

    return { success: true };
}

/**
 * Get rider's booked slots
 */
export async function getRiderSlots(
    riderId: string,
    status?: RiderSlot['status']
): Promise<RiderSlot[]> {
    let query = supabase
        .from('rider_slots')
        .select('*, time_slots(*)')
        .eq('rider_id', riderId)
        .order('created_at', { ascending: false });

    if (status) {
        query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Failed to fetch rider slots:', error);
        return [];
    }

    return (data || []).map((booking: any) => ({
        id: booking.id,
        riderId: booking.rider_id,
        slotId: booking.slot_id,
        slot: {
            id: booking.time_slots.id,
            date: booking.time_slots.date,
            startTime: booking.time_slots.start_time,
            endTime: booking.time_slots.end_time,
            maxRiders: booking.time_slots.max_riders,
            bookedCount: 0, // Not needed for rider's own slots
            isAvailable: true,
            incentiveMultiplier: booking.time_slots.incentive_multiplier || 1,
        },
        status: booking.status,
        bookedAt: booking.created_at,
    }));
}

/**
 * Get rider's slots for a specific date
 */
export async function getRiderSlotsForDate(
    riderId: string,
    date: string
): Promise<RiderSlot[]> {
    const { data, error } = await supabase
        .from('rider_slots')
        .select('*, time_slots!inner(*)')
        .eq('rider_id', riderId)
        .eq('time_slots.date', date)
        .neq('status', 'cancelled');

    if (error) {
        console.error('Failed to fetch rider slots for date:', error);
        return [];
    }

    return (data || []).map((booking: any) => ({
        id: booking.id,
        riderId: booking.rider_id,
        slotId: booking.slot_id,
        slot: {
            id: booking.time_slots.id,
            date: booking.time_slots.date,
            startTime: booking.time_slots.start_time,
            endTime: booking.time_slots.end_time,
            maxRiders: booking.time_slots.max_riders,
            bookedCount: 0,
            isAvailable: true,
            incentiveMultiplier: booking.time_slots.incentive_multiplier || 1,
        },
        status: booking.status,
        bookedAt: booking.created_at,
    }));
}

/**
 * Get upcoming slots count for dashboard
 */
export async function getUpcomingSlotsCount(riderId: string): Promise<number> {
    const today = new Date().toISOString().split('T')[0];

    const { count, error } = await supabase
        .from('rider_slots')
        .select('*', { count: 'exact', head: true })
        .eq('rider_id', riderId)
        .eq('status', 'booked')
        .gte('time_slots.date', today);

    if (error) {
        console.error('Failed to count upcoming slots:', error);
        return 0;
    }

    return count || 0;
}
