/**
 * Product Profile Service
 * Fetches full product info including inventory, physical units, and discounts.
 */

import { supabase } from '@popclozet/api-client';

export interface ProductDiscount {
    id: string;
    discount_type: 'percentage' | 'fixed_amount';
    discount_value: number;
    is_active: boolean;
    expires_at: string | null;
    created_at: string;
}

export interface PhysicalUnitInProfile {
    individual_id: string;
    inventory_id: string;
    status: string;
    available: boolean;
    last_rented: string | null;
    last_washed: string | null;
    times_rented: number;
    times_washed: number;
    mrp_price: number | null;
    actual_cost: number | null;
    created_at: string;
}

export interface InventorySubProfile {
    id: string;
    size: string;
    available_stock: number;
    went_for_wash: number;
    total_stock: number;
    units: PhysicalUnitInProfile[];
}

export interface FullProductProfile {
    id: string;
    name: string;
    brand: string | null;
    description: string | null;
    category: string | null;
    gender: string | null;
    occasion: string[] | null;
    rental_price: number | null;
    rental_price_1d: number | null;
    rental_price_2d: number | null;
    rental_price_3d: number | null;
    buy_price: number | null;
    images: string[] | null;
    is_available: boolean;
    created_at: string;
    inventory: InventorySubProfile[];
    discounts: ProductDiscount[];
}

export interface ProductUpdate {
    name?: string;
    brand?: string;
    description?: string;
    category?: string;
    gender?: string;
    rental_price?: number;
    rental_price_1d?: number;
    rental_price_2d?: number;
    rental_price_3d?: number;
    buy_price?: number;
    images?: string[];
    is_available?: boolean;
}

/**
 * Fetch the full product profile: product info + inventory breakdown + discounts
 */
export async function getFullProductProfile(productId: string): Promise<FullProductProfile | null> {
    // Fetch product
    const { data: product, error: prodErr } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single();

    if (prodErr || !product) return null;

    // Fetch inventory rows
    const { data: inventoryRows, error: invErr } = await supabase
        .from('inventory')
        .select('*')
        .eq('product_id', productId)
        .order('size');

    if (invErr) throw invErr;

    // Fetch all physical units for this product
    const inventoryIds = (inventoryRows || []).map((r: any) => r.id);
    let allUnits: PhysicalUnitInProfile[] = [];

    if (inventoryIds.length > 0) {
        const { data: units, error: unitsErr } = await supabase
            .from('all_products')
            .select('*')
            .in('inventory_id', inventoryIds)
            .order('created_at', { ascending: false });

        if (unitsErr) throw unitsErr;
        allUnits = (units || []) as PhysicalUnitInProfile[];
    }

    // Fetch discounts
    const { data: discounts, error: discErr } = await supabase
        .from('product_discounts')
        .select('*')
        .eq('product_id', productId)
        .order('created_at', { ascending: false });

    if (discErr) throw discErr;

    // Build inventory subprofiles using ground-truth from allUnits
    const inventory: InventorySubProfile[] = (inventoryRows || []).map((row: any) => {
        const unitsForSize = allUnits.filter(u => u.inventory_id === row.id);
        return {
            id: row.id,
            size: row.size,
            available_stock: unitsForSize.filter(u => u.status === 'available').length,
            went_for_wash: 0,  // No washing state in simplified system
            total_stock: unitsForSize.filter(u => u.status !== 'sold').length, // sold units excluded from active stock
            units: unitsForSize as any,
        };
    });

    return {
        id: product.id,
        name: product.name,
        brand: product.brand,
        description: product.description,
        category: product.category,
        gender: product.gender,
        occasion: product.occasion,
        rental_price: product.rental_price,
        rental_price_1d: product.rental_price_1d,
        rental_price_2d: product.rental_price_2d,
        rental_price_3d: product.rental_price_3d,
        buy_price: product.buy_price,
        images: product.images,
        is_available: product.is_available ?? true,
        created_at: product.created_at,
        inventory,
        discounts: (discounts || []) as ProductDiscount[],
    };
}

/**
 * Fetch all products (for the search/list view) with aggregate stock info
 */
export async function getAllProductProfiles(): Promise<{
    id: string;
    name: string;
    brand: string | null;
    category: string | null;
    images: string[] | null;
    rental_price: number | null;
    rental_price_1d: number | null;
    rental_price_2d: number | null;
    rental_price_3d: number | null;
    buy_price: number | null;
    is_available: boolean;
    total_available: number;
    total_wash: number;
    total_stock: number;
}[]> {
    // Fetch products
    const { data: products, error: prodErr } = await supabase
        .from('products')
        .select('id, name, brand, category, images, rental_price, rental_price_1d, rental_price_2d, rental_price_3d, buy_price, is_available')
        .order('name');

    if (prodErr) throw prodErr;
    if (!products) return [];

    // Fetch all item statuses for all products to ensure ground-truth counts
    const { data: allItems, error: itemsErr } = await supabase
        .from('all_products')
        .select(`
            status,
            inventory!inner (
                product_id
            )
        `);

    if (itemsErr) throw itemsErr;

    // Create a map of product_id -> { available, wash, total }
    const stockMap = new Map<string, { available: number, wash: number, total: number }>();
    (allItems || []).forEach((item: any) => {
        const pid = item.inventory.product_id;
        const current = stockMap.get(pid) || { available: 0, wash: 0, total: 0 };
        stockMap.set(pid, {
            available: current.available + (item.status === 'available' ? 1 : 0),
            wash: 0,  // No washing state in simplified system
            total: current.total + (item.status !== 'sold' ? 1 : 0), // exclude sold
        });
    });

    return products.map(p => {
        const stock = stockMap.get(p.id) || { available: 0, wash: 0, total: 0 };
        return {
            ...p,
            total_available: stock.available,
            total_wash: stock.wash,
            total_stock: stock.total
        };
    });
}


/**
 * Add more stock units to an existing inventory row
 */
export async function addStockToInventory(
    inventoryId: string,
    productId: string,
    size: string,
    qty: number,
    mrpPrice?: number,
    actualCost?: number,
    actorId: string = 'system'
): Promise<string[]> {
    const createdIds: string[] = [];

    for (let i = 0; i < qty; i++) {
        const individualId = `PC-${productId.split('-')[0].toUpperCase()}-${size}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
        const { error } = await supabase
            .from('all_products')
            .insert({
                individual_id: individualId,
                inventory_id: inventoryId,
                status: 'available',
                available: true,
                mrp_price: mrpPrice ?? null,
                actual_cost: actualCost ?? null,
            });

        if (error) throw error;
        createdIds.push(individualId);
    }

    // Log activity
    await supabase.from('warehouse_activity_log').insert({
        actor_id: actorId === 'system' ? null : actorId,
        action: 'add_stock',
        entity_type: 'inventory',
        entity_id: inventoryId,
        details: { size, qty, mrp_price: mrpPrice, actual_cost: actualCost },
    });

    return createdIds;
}

/**
 * Add a brand new size row + units for an existing product
 */
export async function addNewSizeToProduct(
    productId: string,
    size: string,
    qty: number,
    mrpPrice?: number,
    actualCost?: number,
    actorId: string = 'system'
): Promise<{ inventoryId: string; unitIds: string[] }> {
    // Create inventory row
    const { data: inv, error: invErr } = await supabase
        .from('inventory')
        .insert({
            product_id: productId,
            size,
        })
        .select('id')
        .single();

    if (invErr) throw invErr;

    const unitIds = await addStockToInventory(inv.id, productId, size, qty, mrpPrice, actualCost, actorId);

    return { inventoryId: inv.id, unitIds };
}

/**
 * Upsert a discount on a product
 */
export async function saveProductDiscount(
    productId: string,
    discountType: 'percentage' | 'fixed_amount',
    discountValue: number,
    expiresAt?: string | null
): Promise<void> {
    const { error } = await supabase
        .from('product_discounts')
        .insert({
            product_id: productId,
            discount_type: discountType,
            discount_value: discountValue,
            is_active: true,
            expires_at: expiresAt ?? null,
        });

    if (error) throw error;
}

/**
 * Toggle a discount active/inactive
 */
export async function toggleDiscount(discountId: string, isActive: boolean): Promise<void> {
    const { error } = await supabase
        .from('product_discounts')
        .update({ is_active: isActive })
        .eq('id', discountId);

    if (error) throw error;
}

/**
 * Update core product profile
 */
export async function updateProductProfile(productId: string, update: ProductUpdate): Promise<void> {
    const { error } = await supabase
        .from('products')
        .update(update)
        .eq('id', productId);

    if (error) throw error;
}

/**
 * Transition a physical unit to a new status (e.g. from available to archived)
 */
export async function setUnitStatus(
    individualId: string,
    newStatus: 'available' | 'rented' | 'sold',
    actorId: string = 'system'
): Promise<void> {
    const { error } = await supabase
        .from('all_products')
        .update({
            status: newStatus,
            available: newStatus === 'available',
        })
        .eq('individual_id', individualId);

    if (error) throw error;

    // Log the change
    await supabase.from('warehouse_activity_log').insert({
        actor_id: actorId === 'system' ? null : actorId,
        action: 'set_unit_status',
        entity_type: 'individual_unit',
        entity_id: null,
        details: { individual_id: individualId, new_status: newStatus },
    });
}

/**
 * Mark a physical unit as sold (permanently remove from active stock)
 */
export async function archivePhysicalUnit(individualId: string, actorId: string = 'system'): Promise<void> {
    return setUnitStatus(individualId, 'sold', actorId);
}

/**
 * Mark a physical unit as sold (e.g. damaged beyond use, lost, or permanently removed)
 */
export async function markUnitAsSold(individualId: string, actorId: string = 'system'): Promise<void> {
    return setUnitStatus(individualId, 'sold', actorId);
}

// flagUnitAsDamaged removed — use markUnitAsSold() to permanently remove a unit from stock.
