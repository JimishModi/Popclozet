/**
 * Physical Unit Lookup Service (Read-Only for Rider App)
 *
 * Mirrors the warehouse app's service but only exposes the
 * read path needed for QR-scanned product verification.
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
    mrp?: number | null;
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

const normalizePhysicalUnit = (unit: any): PhysicalUnit => ({
    ...unit,
    mrp: unit.mrp ?? null,
});

/**
 * Look up an individual item by its QR code / serial ID.
 */
export async function getUnitByCode(individualId: string): Promise<PhysicalUnit | null> {
    const { data, error } = await supabase
        .from('all_products')
        .select(`
            individual_id,
            inventory_id,
            available,
            status,
            last_rented,
            last_washed,
            times_rented,
            times_washed,
            mrp,
            actual_cost,
            created_at,
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
    return data ? normalizePhysicalUnit(data) : null;
}
