/**
 * Wash Service
 * Handles unit status transitions for the wash cycle.
 */

import { supabase } from '@popclozet/api-client';
import { setUnitStatus } from './productProfileService';

/**
 * Get all units currently in the wash (status: washing)
 */
export async function getWashQueue(): Promise<any[]> {
    const { data, error } = await supabase
        .from('all_products')
        .select(`
            individual_id,
            status,
            inventory:inventory_id (
                id,
                size,
                products (
                    id,
                    name,
                    images
                )
            )
        `)
        .eq('status', 'washing')
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
}

/**
 * Get units available to be sent to wash (e.g. rented units that just came back)
 * For simplification, we allow any 'rented' item to be manually sent to wash from the manual tab.
 */
export async function getWashableUnits(): Promise<any[]> {
    const { data, error } = await supabase
        .from('all_products')
        .select(`
            individual_id,
            status,
            inventory:inventory_id (
                id,
                size,
                products (
                    id,
                    name,
                    images
                )
            )
        `)
        .eq('status', 'rented')
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
}

/**
 * Send a physical unit to wash
 */
export async function sendUnitToWash(individualId: string, actorId: string = 'system') {
    return setUnitStatus(individualId, 'washing', actorId);
}

/**
 * Return a physical unit from wash
 */
export async function returnUnitFromWash(individualId: string, actorId: string = 'system') {
    return setUnitStatus(individualId, 'available', actorId);
}

// Legacy function stubs for compatibility
export async function sendToWash(individualId: string, actorId: string = 'system') {
    return sendUnitToWash(individualId, actorId);
}

export async function returnFromWash(individualId: string, actorId: string = 'system') {
    return returnUnitFromWash(individualId, actorId);
}
