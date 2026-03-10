/**
 * Wash Service
 * Uses two-query approach for inventory + products.
 * Handles both product_id and item_id FK columns.
 */

import { supabase } from '@popclozet/api-client';
import type { InventoryWithProduct, ProductInfo } from './inventoryService';

/**
 * Helper: get the product FK value from an inventory row
 */
function getProductFk(row: any): string | undefined {
    return row.product_id || row.item_id;
}

/**
 * Helper: merge inventory with products by fetching products separately
 */
async function mergeWithProducts(inventory: any[]): Promise<InventoryWithProduct[]> {
    if (inventory.length === 0) return [];

    const productIds = [...new Set(inventory.map((i: any) => getProductFk(i)).filter(Boolean))];
    if (productIds.length === 0) return inventory as InventoryWithProduct[];

    const { data: products } = await supabase
        .from('products')
        .select('id, name, brand, category, images, gender, rental_price')
        .in('id', productIds);

    const productMap = new Map<string, ProductInfo>();
    for (const p of products || []) {
        productMap.set(p.id, p as ProductInfo);
    }

    return inventory.map(inv => ({
        ...inv,
        products: productMap.get(getProductFk(inv) || '') || null,
    })) as InventoryWithProduct[];
}

/**
 * Send an inventory item to wash (throws on error)
 */
export async function sendToWash(inventoryId: string, actorId: string = 'system') {
    const { data: current, error: fetchErr } = await supabase
        .from('inventory')
        .select('available_stock, went_for_wash')
        .eq('id', inventoryId)
        .single();

    if (fetchErr) throw fetchErr;
    if (!current) throw new Error('Inventory row not found');

    const available = current.available_stock ?? 0;
    const wash = current.went_for_wash ?? 0;

    if (available <= 0) throw new Error('No available stock to send for wash');

    // Update stock
    const { data, error } = await supabase
        .from('inventory')
        .update({
            available_stock: available - 1,
            went_for_wash: wash + 1,
        })
        .eq('id', inventoryId)
        .select()
        .single();

    if (error) throw error;

    // Log activity
    await supabase.from('warehouse_activity_log').insert({
        actor_id: actorId === 'system' ? null : actorId,
        action: 'send_to_wash',
        entity_type: 'inventory',
        entity_id: inventoryId,
        details: { from_available: available, to_wash: wash + 1 }
    });

    return data;
}

/**
 * Return an item from wash (throws on error)
 */
export async function returnFromWash(inventoryId: string, actorId: string = 'system') {
    const { data: current, error: fetchErr } = await supabase
        .from('inventory')
        .select('available_stock, went_for_wash')
        .eq('id', inventoryId)
        .single();

    if (fetchErr) throw fetchErr;
    if (!current) throw new Error('Inventory row not found');

    const available = current.available_stock ?? 0;
    const wash = current.went_for_wash ?? 0;

    if (wash <= 0) throw new Error('No items currently in wash');

    // Update stock
    const { data, error } = await supabase
        .from('inventory')
        .update({
            available_stock: available + 1,
            went_for_wash: wash - 1,
        })
        .eq('id', inventoryId)
        .select()
        .single();

    if (error) throw error;

    // Log activity
    await supabase.from('warehouse_activity_log').insert({
        actor_id: actorId === 'system' ? null : actorId,
        action: 'return_from_wash',
        entity_type: 'inventory',
        entity_id: inventoryId,
        details: { from_wash: wash, to_available: available + 1 }
    });

    return data;
}

/**
 * Send a specific physical item to wash by its individual_id.
 * The database trigger (trg_sync_inventory_on_product_status_change) 
 * will automatically update inventory counts.
 */
export async function sendUnitToWash(individualId: string, actorId: string = 'system') {
    const { data, error } = await supabase
        .from('all_products')
        .update({
            status: 'washing',
            last_washed: new Date().toISOString()
        })
        .eq('individual_id', individualId)
        .select()
        .single();

    if (error) throw error;

    // Log activity
    await supabase.from('warehouse_activity_log').insert({
        actor_id: actorId === 'system' ? null : actorId,
        action: 'unit_send_to_wash',
        entity_type: 'individual_item',
        entity_id: null,
        details: { individual_id: individualId, status: 'washing' }
    });

    return data;
}

/**
 * Return a specific physical item from wash by its individual_id.
 */
export async function returnUnitFromWash(individualId: string, actorId: string = 'system') {
    const { data, error } = await supabase
        .from('all_products')
        .update({
            status: 'available'
        })
        .eq('individual_id', individualId)
        .select()
        .single();

    if (error) throw error;

    // Log activity
    await supabase.from('warehouse_activity_log').insert({
        actor_id: actorId === 'system' ? null : actorId,
        action: 'unit_return_from_wash',
        entity_type: 'individual_item',
        entity_id: null,
        details: { individual_id: individualId, status: 'available' }
    });

    return data;
}

/**
 * Get items in wash queue
 */
export async function getWashQueue(): Promise<any[]> {
    const { data, error } = await supabase
        .from('all_products')
        .select(`
            *,
            inventory:inventory_id (
                product_id, size,
                products:product_id (name, brand, category, images)
            )
        `)
        .eq('status', 'washing')
        .order('last_washed', { ascending: false });

    if (error) throw error;
    return data || [];
}

/**
 * Get washable items (for manual list fallback if needed)
 */
export async function getWashableUnits(): Promise<any[]> {
    const { data, error } = await supabase
        .from('all_products')
        .select(`
            *,
            inventory:inventory_id (
                product_id, size,
                products:product_id (name, brand, category, images)
            )
        `)
        .eq('status', 'available')
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
}
