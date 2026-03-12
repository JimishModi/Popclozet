/**
 * Product Unit Service (Individual Items)
 * Manages individual garment tracking via the all_products table.
 */

import { supabase } from '@popclozet/api-client';

export interface PhysicalUnit {
    individual_id: string;
    inventory_id: string;
    available: boolean;
    status: string;
    last_rented?: string;
    last_washed?: string;
    times_rented: number;
    times_washed: number;
    mrp_price?: number;
    actual_cost?: number;
    created_at: string;
    inventory?: {
        product_id: string;
        size: string;
        products?: {
            name: string;
            brand: string | null;
            category: string | null;
            images: string[] | null;
        };
    };
}

/**
 * Get all individual items, optionally filtered by inventory_id
 */
export async function getPhysicalUnits(inventoryId?: string): Promise<PhysicalUnit[]> {
    let query = supabase
        .from('all_products')
        .select(`
            *,
            inventory:inventory_id (
                product_id, size,
                products:product_id (
                    name, brand, category, images
                )
            )
        `)
        .order('created_at', { ascending: false });

    if (inventoryId) {
        query = query.eq('inventory_id', inventoryId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as any[];
}

/**
 * Look up an individual item by its ID (barcode/serial)
 */
export async function getUnitByCode(individualId: string): Promise<PhysicalUnit | null> {
    const { data, error } = await supabase
        .from('all_products')
        .select(`
            *,
            inventory:inventory_id (
                product_id, size,
                products:product_id (
                    name, brand, category, images
                )
            )
        `)
        .eq('individual_id', individualId)
        .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data as any;
}

/**
 * Update an individual item's status
 */
export async function updateUnitStatus(
    individualId: string,
    updates: { status?: string; available?: boolean }
) {
    const { data, error } = await supabase
        .from('all_products')
        .update(updates)
        .eq('individual_id', individualId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Create a new individual item record
 */
export async function createPhysicalUnit(
    inventoryId: string,
    individualId: string,
    mrpPrice?: number,
    actualCost?: number
) {
    const { data, error } = await supabase
        .from('all_products')
        .insert({
            individual_id: individualId,
            inventory_id: inventoryId,
            status: 'available',
            available: true,
            mrp_price: mrpPrice,
            actual_cost: actualCost,
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Get all warehouses
 */
export async function getWarehouses() {
    const { data, error } = await supabase
        .from('warehouses')
        .select('*')
        .eq('is_active', true)
        .order('name');

    if (error) throw error;
    return data || [];
}
