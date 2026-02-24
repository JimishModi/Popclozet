/**
 * Rider Assignment Service
 * 
 * Weighted scoring algorithm for optimal rider-to-order assignment.
 * Reference implementation — in production, port to a Supabase Edge Function.
 * 
 * Score = w1·(1/proximity) + w2·headingAlignment + w3·loadCapacityMatch + w4·batchingBonus
 */

import { supabase } from '@popclozet/api-client';

// ==========================================
// TYPES
// ==========================================

export interface RiderCandidate {
    id: string;
    lat: number;
    lng: number;
    heading?: number;
    speed?: number;
    status: 'online' | 'offline' | 'busy';
    maxVolumeLiters: number;
    canCarryHanging: boolean;
    currentOrderCount: number;
}

export interface AssignmentTarget {
    orderId: string;
    hubLat: number;
    hubLng: number;
    destLat: number;
    destLng: number;
    requiresHanging: boolean;
    estimatedVolumeLiters: number;
}

export interface AssignmentResult {
    riderId: string;
    score: number;
    distanceKm: number;
    reason: string;
}

// ==========================================
// SCORING WEIGHTS
// ==========================================

const WEIGHTS = {
    proximity: 0.4,       // 40% — closeness to the hub
    heading: 0.2,         // 20% — rider heading toward hub  
    loadCapacity: 0.2,    // 20% — can carry the order
    batching: 0.2,        // 20% — return route overlap bonus
};

// ==========================================
// DISTANCE / HEADING HELPERS
// ==========================================

function toRad(v: number): number {
    return (v * Math.PI) / 180;
}

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function bearingTo(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const dLng = toRad(lng2 - lng1);
    const y = Math.sin(dLng) * Math.cos(toRad(lat2));
    const x =
        Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
        Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
    return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/**
 * Heading alignment: 1.0 = perfectly aligned, 0.0 = opposite direction
 */
function headingAlignment(riderHeading: number, idealHeading: number): number {
    const diff = Math.abs(riderHeading - idealHeading);
    const normalized = diff > 180 ? 360 - diff : diff;
    return 1 - normalized / 180; // 0..1
}

// ==========================================
// SCORING
// ==========================================

/**
 * Compute the assignment score for a single rider-order pair.
 */
export function computeAssignmentScore(
    rider: RiderCandidate,
    target: AssignmentTarget
): { score: number; distKm: number; breakdown: Record<string, number> } {
    const dist = distanceKm(rider.lat, rider.lng, target.hubLat, target.hubLng);

    // 1) Proximity score: inverse of distance, capped at 20km
    const maxDist = 20;
    const proximityScore = Math.max(0, 1 - dist / maxDist);

    // 2) Heading alignment score
    let headingScore = 0.5; // neutral if no heading data
    if (rider.heading !== undefined) {
        const idealBearing = bearingTo(rider.lat, rider.lng, target.hubLat, target.hubLng);
        headingScore = headingAlignment(rider.heading, idealBearing);
    }

    // 3) Load capacity score
    let loadScore = 1; // perfect by default
    if (target.requiresHanging && !rider.canCarryHanging) {
        loadScore = 0; // can't carry hanging items
    }
    if (target.estimatedVolumeLiters > rider.maxVolumeLiters) {
        loadScore = Math.max(0, loadScore * (rider.maxVolumeLiters / target.estimatedVolumeLiters));
    }

    // 4) Batching bonus: rider with fewer current orders gets a bonus
    const batchingScore = rider.currentOrderCount === 0
        ? 1.0
        : rider.currentOrderCount === 1
            ? 0.7
            : 0.3;

    // Weighted total
    const score =
        WEIGHTS.proximity * proximityScore +
        WEIGHTS.heading * headingScore +
        WEIGHTS.loadCapacity * loadScore +
        WEIGHTS.batching * batchingScore;

    return {
        score,
        distKm: dist,
        breakdown: {
            proximity: proximityScore,
            heading: headingScore,
            load: loadScore,
            batching: batchingScore,
        },
    };
}

// ==========================================
// ASSIGNMENT
// ==========================================

/**
 * Find the best rider for an order from all online riders.
 */
export async function findBestRider(target: AssignmentTarget): Promise<AssignmentResult | null> {
    if (!supabase) return null;

    // Fetch all online riders with their last known locations
    const { data: riders, error } = await supabase
        .from('rider_locations')
        .select('rider_id, lat, lng, heading, speed')
        .order('updated_at', { ascending: false });

    if (error || !riders || riders.length === 0) {
        console.warn('No riders available for assignment');
        return null;
    }

    // Get rider profiles for capacity info
    const riderIds = riders.map((r: any) => r.rider_id);
    const { data: profiles } = await supabase
        .from('riders')
        .select('id, status, max_volume_liters, can_carry_hanging')
        .in('id', riderIds)
        .eq('status', 'online');

    const profileMap = new Map(
        (profiles || []).map((p: any) => [p.id, p])
    );

    // Get current order counts
    const { data: orderCounts } = await supabase
        .from('orders')
        .select('rider_id')
        .in('rider_id', riderIds)
        .in('lifecycle_state', ['confirmed', 'out_for_delivery']);

    const countMap = new Map<string, number>();
    (orderCounts || []).forEach((o: any) => {
        countMap.set(o.rider_id, (countMap.get(o.rider_id) || 0) + 1);
    });

    // Score each rider
    let bestResult: AssignmentResult | null = null;

    for (const rider of riders) {
        const profile = profileMap.get(rider.rider_id);
        if (!profile) continue; // skip riders without profile or offline

        const candidate: RiderCandidate = {
            id: rider.rider_id,
            lat: rider.lat,
            lng: rider.lng,
            heading: rider.heading,
            speed: rider.speed,
            status: profile.status || 'online',
            maxVolumeLiters: profile.max_volume_liters || 50,
            canCarryHanging: profile.can_carry_hanging ?? true,
            currentOrderCount: countMap.get(rider.rider_id) || 0,
        };

        const { score, distKm, breakdown } = computeAssignmentScore(candidate, target);

        if (!bestResult || score > bestResult.score) {
            bestResult = {
                riderId: rider.rider_id,
                score,
                distanceKm: distKm,
                reason: `Proximity: ${(breakdown.proximity * 100).toFixed(0)}%, Heading: ${(breakdown.heading * 100).toFixed(0)}%, Load: ${(breakdown.load * 100).toFixed(0)}%, Batch: ${(breakdown.batching * 100).toFixed(0)}%`,
            };
        }
    }

    return bestResult;
}

/**
 * Assign a rider to an order (updates the orders table).
 */
export async function assignRider(orderId: string, riderId: string): Promise<boolean> {
    if (!supabase) return false;

    const { error } = await supabase
        .from('orders')
        .update({
            rider_id: riderId,
            lifecycle_state: 'confirmed',
        })
        .eq('id', orderId);

    if (error) {
        console.error('Failed to assign rider:', error);
        return false;
    }

    console.log(`🏍️ Rider ${riderId.slice(0, 8)} assigned to order ${orderId.slice(0, 8)}`);
    return true;
}
