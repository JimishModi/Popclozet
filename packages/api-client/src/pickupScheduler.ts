import { supabase } from './index';
import { config } from './config';

// ==========================================
// TYPES
// ==========================================

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

// ==========================================
// MOCK DATA - For demo purposes
// ==========================================

let mockScheduledPickups: ScheduledPickup[] = [];

// ==========================================
// PICKUP SCHEDULING
// ==========================================

/**
 * Schedule pickup when rental ends
 */
export async function schedulePickup(
    orderId: string,
    customerId: string,
    pickupLocation: { lat: number; lng: number; address: string }
): Promise<{ success: boolean; pickupId?: string; error?: string }> {
    if (config.USE_MOCK_DATA) {
        // Create pickup request
        const pickup: ScheduledPickup = {
            id: `PKP-${Date.now()}`,
            orderId,
            customerId,
            status: 'pending',
            scheduledAt: new Date().toISOString(),
            pickupLocation,
            createdAt: new Date().toISOString(),
        };

        // For demo: store in memory
        mockScheduledPickups.push(pickup);
        console.log(`[PICKUP] Scheduled pickup ${pickup.id} for order ${orderId}`);
        return { success: true, pickupId: pickup.id };
    }

    // Real Supabase integration
    const { data, error } = await supabase
        .from('scheduled_pickups')
        .insert({
            order_id: orderId,
            customer_id: customerId,
            status: 'pending',
            scheduled_at: new Date().toISOString(),
            pickup_location: pickupLocation,
        })
        .select()
        .single();

    if (error) {
        console.error('Failed to schedule pickup:', error);
        return { success: false, error: error.message };
    }

    return { success: true, pickupId: data.id };
}

/**
 * Get pending pickups for rider assignment
 */
export async function getPendingPickups(): Promise<ScheduledPickup[]> {
    // For demo: return mock data
    return mockScheduledPickups.filter(p => p.status === 'pending');

    // TODO: Real Supabase integration
    // const { data, error } = await supabase
    //     .from('scheduled_pickups')
    //     .select('*')
    //     .eq('status', 'pending')
    //     .order('created_at', { ascending: false });
    // return data || [];
}

/**
 * Assign rider to pickup
 */
export async function assignRiderToPickup(
    pickupId: string,
    riderId: string
): Promise<{ success: boolean; error?: string }> {
    // For demo: update mock data
    const pickup = mockScheduledPickups.find(p => p.id === pickupId);
    if (!pickup) {
        return { success: false, error: 'Pickup not found' };
    }

    pickup.riderId = riderId;
    pickup.status = 'assigned';
    console.log(`[PICKUP] Assigned rider ${riderId} to pickup ${pickupId}`);

    // TODO: Real Supabase integration
    // const { error } = await supabase
    //     .from('scheduled_pickups')
    //     .update({ rider_id: riderId, status: 'assigned' })
    //     .eq('id', pickupId);

    return { success: true };
}

/**
 * Complete pickup
 * Called when rider returns item to warehouse
 */
export async function completePickup(
    pickupId: string,
    riderId: string
): Promise<{ success: boolean; error?: string }> {
    const pickup = mockScheduledPickups.find(p => p.id === pickupId);
    if (!pickup) {
        return { success: false, error: 'Pickup not found' };
    }

    if (pickup.riderId !== riderId) {
        return { success: false, error: 'Rider not assigned to this pickup' };
    }

    pickup.status = 'completed';
    console.log(`[PICKUP] Completed pickup ${pickupId} by rider ${riderId}`);

    // TODO: Real Supabase integration
    // const { error } = await supabase
    //     .from('scheduled_pickups')
    //     .update({ status: 'completed' })
    //     .eq('id', pickupId);
    //
    // Also credit rider wallet
    // await creditPickupEarning(riderId, pickup.orderId);

    return { success: true };
}

/**
 * Get rider's assigned pickups
 */
export async function getRiderPickups(riderId: string): Promise<ScheduledPickup[]> {
    return mockScheduledPickups.filter(
        p => p.riderId === riderId && p.status !== 'completed'
    );
}

/**
 * Get customer's scheduled pickups
 */
export async function getCustomerPickups(customerId: string): Promise<ScheduledPickup[]> {
    return mockScheduledPickups.filter(
        p => p.customerId === customerId && p.status !== 'completed'
    );
}
