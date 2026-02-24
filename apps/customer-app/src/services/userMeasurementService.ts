/**
 * User Measurement Service
 * 
 * Stores body measurements for size matching.
 * Uses Supabase with localStorage fallback for offline-first.
 */

import { supabase } from '@popclozet/api-client';

// ==========================================
// TYPES
// ==========================================

export type BodyType = 'petite' | 'slim' | 'regular' | 'athletic' | 'curvy' | 'plus';

export interface UserMeasurements {
    userId: string;
    bust: number;      // cm
    waist: number;     // cm
    hip: number;       // cm
    height: number;    // cm
    weight: number;    // kg
    bodyType: BodyType;
    updatedAt: string;
}

export type FitResult = 'perfect' | 'close' | 'no';

// ==========================================
// SIZE CHART (S/M/L/XL ranges in cm)
// ==========================================

const SIZE_CHART: Record<string, { bust: [number, number]; waist: [number, number]; hip: [number, number] }> = {
    XS: { bust: [76, 81], waist: [58, 63], hip: [83, 88] },
    S: { bust: [81, 86], waist: [63, 68], hip: [88, 93] },
    M: { bust: [86, 91], waist: [68, 73], hip: [93, 98] },
    L: { bust: [91, 97], waist: [73, 79], hip: [98, 104] },
    XL: { bust: [97, 104], waist: [79, 86], hip: [104, 111] },
    XXL: { bust: [104, 112], waist: [86, 94], hip: [111, 119] },
};

const TOLERANCE_CM = 3; // allow ±3cm for "close" fit

// ==========================================
// CRUD
// ==========================================

const STORAGE_KEY = 'user_measurements';

export async function saveUserMeasurements(data: UserMeasurements): Promise<void> {
    // Always save to localStorage as offline cache
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

    try {
        if (supabase) {
            await supabase
                .from('user_measurements')
                .upsert({
                    user_id: data.userId,
                    bust: data.bust,
                    waist: data.waist,
                    hip: data.hip,
                    height: data.height,
                    weight: data.weight,
                    body_type: data.bodyType,
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'user_id' });
        }
    } catch (err) {
        console.warn('Could not save measurements to server, saved locally:', err);
    }
}

export async function getUserMeasurements(userId: string): Promise<UserMeasurements | null> {
    // Try Supabase first
    try {
        if (supabase) {
            const { data } = await supabase
                .from('user_measurements')
                .select('*')
                .eq('user_id', userId)
                .maybeSingle();

            if (data) {
                const measurements: UserMeasurements = {
                    userId: data.user_id,
                    bust: data.bust,
                    waist: data.waist,
                    hip: data.hip,
                    height: data.height,
                    weight: data.weight,
                    bodyType: data.body_type,
                    updatedAt: data.updated_at,
                };
                // Update local cache
                localStorage.setItem(STORAGE_KEY, JSON.stringify(measurements));
                return measurements;
            }
        }
    } catch {
        // Fall through to localStorage
    }

    // Fallback to localStorage
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        try {
            return JSON.parse(stored) as UserMeasurements;
        } catch {
            return null;
        }
    }

    return null;
}

// ==========================================
// FIT MATCHING
// ==========================================

/**
 * Checks if a product's size range fits the user's measurements.
 * Returns 'perfect' if within range, 'close' if within tolerance, 'no' otherwise.
 */
export function doesSizeFit(
    size: string,
    measurements: UserMeasurements
): FitResult {
    const chart = SIZE_CHART[size];
    if (!chart) return 'no';

    const bustFits = checkRange(measurements.bust, chart.bust, TOLERANCE_CM);
    const waistFits = checkRange(measurements.waist, chart.waist, TOLERANCE_CM);
    const hipFits = checkRange(measurements.hip, chart.hip, TOLERANCE_CM);

    if (bustFits === 'perfect' && waistFits === 'perfect' && hipFits === 'perfect') {
        return 'perfect';
    }
    if (bustFits !== 'no' && waistFits !== 'no' && hipFits !== 'no') {
        return 'close';
    }
    return 'no';
}

/**
 * Find the best fitting size for the user
 */
export function findBestSize(measurements: UserMeasurements): { size: string; fit: FitResult } | null {
    const sizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

    // Prefer 'perfect' fit
    for (const size of sizes) {
        if (doesSizeFit(size, measurements) === 'perfect') {
            return { size, fit: 'perfect' };
        }
    }
    // Then 'close' fit
    for (const size of sizes) {
        if (doesSizeFit(size, measurements) === 'close') {
            return { size, fit: 'close' };
        }
    }
    return null;
}

// ==========================================
// HELPERS
// ==========================================

function checkRange(
    value: number,
    [min, max]: [number, number],
    tolerance: number
): FitResult {
    if (value >= min && value <= max) return 'perfect';
    if (value >= min - tolerance && value <= max + tolerance) return 'close';
    return 'no';
}
