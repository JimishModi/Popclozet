/**
 * Analytics Service
 * Uses two-query approach for inventory + products.
 * Handles both product_id and item_id FK columns on inventory table.
 * Handles both status and lifecycle_state on orders table.
 */

import { supabase } from '@popclozet/api-client';

export interface StockSummary {
    total_stock: number;
    available_stock: number;
    went_for_wash: number;
    in_rental: number;
    total_products: number;
}

// Helper function removed because we now use the product_stock_summary view

export async function getStockSummary(): Promise<StockSummary> {
    try {
        const { data, error } = await supabase
            .from('product_stock_summary')
            .select('total_stock, total_available, total_wash');

        if (error) {
            console.warn('getStockSummary:', error.message);
            return { total_stock: 0, available_stock: 0, went_for_wash: 0, in_rental: 0, total_products: 0 };
        }

        const rows = data || [];
        const total_stock = rows.reduce((sum, r) => sum + (r.total_stock ?? 0), 0);
        const available_stock = rows.reduce((sum, r) => sum + (r.total_available ?? 0), 0);
        const went_for_wash = rows.reduce((sum, r) => sum + (r.total_wash ?? 0), 0);

        return {
            total_stock,
            available_stock,
            went_for_wash,
            in_rental: Math.max(0, total_stock - available_stock - went_for_wash),
            total_products: rows.length,
        };
    } catch {
        return { total_stock: 0, available_stock: 0, went_for_wash: 0, in_rental: 0, total_products: 0 };
    }
}

export interface CategoryStock {
    category: string;
    total: number;
    available: number;
}

export async function getStockByCategory(): Promise<CategoryStock[]> {
    try {
        const { data, error } = await supabase
            .from('product_stock_summary')
            .select('category, total_stock, total_available');

        if (error || !data || data.length === 0) return [];

        const categoryMap = new Map<string, { total: number; available: number }>();
        
        for (const row of data) {
            const cat = row.category || 'Uncategorized';
            const entry = categoryMap.get(cat) || { total: 0, available: 0 };
            entry.total += row.total_stock ?? 0;
            entry.available += row.total_available ?? 0;
            categoryMap.set(cat, entry);
        }

        return Array.from(categoryMap.entries()).map(([category, { total, available }]) => ({
            category,
            total,
            available,
        }));
    } catch {
        return [];
    }
}

export async function getOrderCounts() {
    try {
        // Try status first, then lifecycle_state
        const { data, error } = await supabase
            .from('orders')
            .select('status, lifecycle_state');

        if (error) {
            console.warn('getOrderCounts:', error.message);
            return {};
        }

        const counts: Record<string, number> = {};
        for (const row of data || []) {
            // Use status if available, fall back to lifecycle_state
            const state = row.status || row.lifecycle_state || 'unknown';
            counts[state] = (counts[state] || 0) + 1;
        }
        return counts;
    } catch {
        return {};
    }
}

export async function getDeliveryStats() {
    try {
        const { data, error } = await supabase
            .from('orders')
            .select('rider_id, status, lifecycle_state')
            .not('rider_id', 'is', null);

        if (error) {
            console.warn('getDeliveryStats:', error.message);
            return [];
        }

        const riderMap = new Map<string, { total: number; completed: number }>();
        for (const row of data || []) {
            const rider = row.rider_id!;
            const entry = riderMap.get(rider) || { total: 0, completed: 0 };
            entry.total += 1;
            const state = row.status || row.lifecycle_state;
            if (state === 'completed') entry.completed += 1;
            riderMap.set(rider, entry);
        }

        return Array.from(riderMap.entries()).map(([riderId, stats]) => ({
            riderId,
            ...stats,
        }));
    } catch {
        return [];
    }
}
