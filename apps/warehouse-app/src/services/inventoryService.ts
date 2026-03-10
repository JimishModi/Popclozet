/**
 * Inventory Service
 * Queries `inventory` table, then separately fetches product details from `products`.
 * Handles both `product_id` and `item_id` FK columns on the inventory table.
 */

import { supabase } from '@popclozet/api-client';

export interface InventoryRow {
    id: string;
    product_id?: string;
    item_id?: string;
    size: string | null;
    total_stock: number | null;
    available_stock: number | null;
    went_for_wash?: number | null;
    is_active: boolean | null;
    created_at: string | null;
}

export interface ProductInfo {
    id: string;
    name: string;
    brand: string | null;
    category: string | null;
    images: string[] | null;
    gender: string | null;
    rental_price: number | null;
}

export interface InventoryWithProduct extends InventoryRow {
    products?: ProductInfo | null;
}

/**
 * Helper: get the product FK value from an inventory row.
 * The inventory table may use `product_id` or `item_id` as the FK column.
 */
function getProductFk(row: any): string | undefined {
    return row.product_id || row.item_id;
}

/**
 * Helper: get all product FK values from inventory rows.
 */
function getProductIds(rows: any[]): string[] {
    return [...new Set(rows.map(r => getProductFk(r)).filter(Boolean))] as string[];
}

/**
 * Helper: build product lookup map from product IDs.
 */
async function fetchProductMap(productIds: string[]): Promise<Map<string, ProductInfo>> {
    const productMap = new Map<string, ProductInfo>();
    if (productIds.length === 0) return productMap;

    const { data: products } = await supabase
        .from('products')
        .select('id, name, brand, category, images, gender, rental_price')
        .in('id', productIds);

    for (const p of products || []) {
        productMap.set(p.id, p as ProductInfo);
    }
    return productMap;
}

/**
 * Fetch all inventory rows and merge product info
 */
export async function getAllInventory(): Promise<InventoryWithProduct[]> {
    try {
        const { data: inventory, error } = await supabase
            .from('inventory')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.warn('getAllInventory:', error.message);
            return [];
        }
        if (!inventory || inventory.length === 0) return [];

        const productIds = getProductIds(inventory);
        const productMap = await fetchProductMap(productIds);

        // Merge
        return inventory.map(inv => ({
            ...inv,
            products: productMap.get(getProductFk(inv) || '') || null,
        })) as InventoryWithProduct[];
    } catch {
        return [];
    }
}

/**
 * Fetch inventory for a specific product
 */
export async function getInventoryByItemId(itemId: string): Promise<InventoryWithProduct[]> {
    try {
        // Try product_id first, then item_id
        let invRes = await supabase.from('inventory').select('*').eq('product_id', itemId).order('size');
        if (invRes.error || !invRes.data || invRes.data.length === 0) {
            invRes = await supabase.from('inventory').select('*').eq('item_id', itemId).order('size');
        }

        const prodRes = await supabase
            .from('products')
            .select('id, name, brand, category, images, gender, rental_price')
            .eq('id', itemId)
            .single();

        if (invRes.error) {
            console.warn('getInventoryByItemId:', invRes.error.message);
            return [];
        }

        const product = prodRes.data as ProductInfo | null;
        return (invRes.data || []).map(inv => ({ ...inv, products: product })) as InventoryWithProduct[];
    } catch {
        return [];
    }
}

/**
 * Update stock counts (throws on error for UI feedback)
 */
export async function updateStock(
    inventoryId: string,
    updates: { total_stock?: number; available_stock?: number; went_for_wash?: number; is_active?: boolean },
    actorId: string = 'system'
) {
    const { data, error } = await supabase
        .from('inventory')
        .update(updates)
        .eq('id', inventoryId)
        .select()
        .single();

    if (error) throw error;

    // Log activity
    await supabase.from('warehouse_activity_log').insert({
        actor_id: actorId === 'system' ? null : actorId,
        action: 'update_stock',
        entity_type: 'inventory',
        entity_id: inventoryId,
        details: updates
    });

    return data;
}

/**
 * Low stock alerts
 */
export async function getLowStockItems(threshold: number = 2): Promise<InventoryWithProduct[]> {
    try {
        const { data: inventory, error } = await supabase
            .from('inventory')
            .select('*')
            .lte('available_stock', threshold)
            .gt('total_stock', 0)
            .order('available_stock', { ascending: true });

        if (error) {
            console.warn('getLowStockItems:', error.message);
            return [];
        }
        if (!inventory || inventory.length === 0) return [];

        const productIds = getProductIds(inventory);
        const productMap = await fetchProductMap(productIds);

        return inventory.map(inv => ({
            ...inv,
            products: productMap.get(getProductFk(inv) || '') || null,
        })) as InventoryWithProduct[];
    } catch {
        return [];
    }
}

/**
 * Create inventory row (throws on error)
 */
export async function createInventoryRow(
    itemId: string,
    size: string,
    totalStock: number = 1,
    actorId: string = 'system'
) {
    const { data, error } = await supabase
        .from('inventory')
        .insert({
            product_id: itemId,
            size,
            available_stock: totalStock,
            went_for_wash: 0,
        })
        .select()
        .single();

    if (error) throw error;

    // Log activity
    if (data) {
        await supabase.from('warehouse_activity_log').insert({
            actor_id: actorId === 'system' ? null : actorId,
            action: 'create_inventory',
            entity_type: 'inventory',
            entity_id: data.id,
            details: { product_id: itemId, size, totalStock }
        });
    }

    return data;
}
