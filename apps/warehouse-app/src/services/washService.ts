/**
 * Wash Service — DEPRECATED
 * Washing state has been removed from the simplified 3-status system:
 * all_products.status is now only: 'available' | 'rented' | 'sold'
 *
 * This file is kept as a stub to avoid import errors.
 * Use setUnitStatus() in productProfileService.ts to change unit status.
 */

export async function sendToWash(_inventoryId: string, _actorId?: string) {
    throw new Error('Wash cycle removed. Use setUnitStatus() to mark items as available/rented/sold.');
}

export async function returnFromWash(_inventoryId: string, _actorId?: string) {
    throw new Error('Wash cycle removed. Use setUnitStatus() to mark items as available.');
}

export async function sendUnitToWash(_individualId: string, _actorId?: string) {
    throw new Error('Wash cycle removed. Use setUnitStatus() to mark items as available/rented/sold.');
}

export async function returnUnitFromWash(_individualId: string, _actorId?: string) {
    throw new Error('Wash cycle removed. Use setUnitStatus() to mark items as available.');
}

export async function getWashQueue(): Promise<any[]> {
    return [];
}

export async function getWashableUnits(): Promise<any[]> {
    return [];
}
