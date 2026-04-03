import { supabase } from '@popclozet/api-client';

export interface WarehouseBadgeCounts {
    orders: number;
    returns: number;
    wash: number;
}

export const EMPTY_WAREHOUSE_BADGE_COUNTS: WarehouseBadgeCounts = {
    orders: 0,
    returns: 0,
    wash: 0,
};

function normalizeBadgeCount(value: unknown): number {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

export function formatWarehouseBadgeCount(count: number): string | null {
    if (count <= 0) return null;
    return count > 9 ? '9+' : String(count);
}

export async function getWarehouseBadgeCounts(): Promise<WarehouseBadgeCounts> {
    const { data, error } = await supabase.rpc('get_warehouse_badge_counts');

    if (error) {
        console.error('getWarehouseBadgeCounts failed:', error.message);
        return EMPTY_WAREHOUSE_BADGE_COUNTS;
    }

    const payload = (data ?? {}) as Partial<Record<keyof WarehouseBadgeCounts, unknown>>;

    return {
        orders: normalizeBadgeCount(payload.orders),
        returns: normalizeBadgeCount(payload.returns),
        wash: normalizeBadgeCount(payload.wash),
    };
}
