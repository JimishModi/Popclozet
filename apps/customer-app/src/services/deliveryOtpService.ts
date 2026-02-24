/**
 * Delivery OTP Service
 * 
 * Generates and verifies 4-digit OTP codes for delivery handover.
 * Uses Supabase with localStorage fallback for offline-first.
 */

import { supabase } from '@popclozet/api-client';

// ==========================================
// TYPES
// ==========================================

export interface DeliveryOtp {
    orderId: string;
    otp: string;
    createdAt: string;
    verified: boolean;
    verifiedAt?: string;
}

// ==========================================
// OTP GENERATION
// ==========================================

const OTP_STORAGE_KEY = 'delivery_otps';

function generate4DigitOtp(): string {
    return String(Math.floor(1000 + Math.random() * 9000));
}

function getLocalOtps(): Record<string, DeliveryOtp> {
    try {
        const stored = localStorage.getItem(OTP_STORAGE_KEY);
        return stored ? JSON.parse(stored) : {};
    } catch {
        return {};
    }
}

function saveLocalOtps(otps: Record<string, DeliveryOtp>): void {
    localStorage.setItem(OTP_STORAGE_KEY, JSON.stringify(otps));
}

// ==========================================
// CRUD
// ==========================================

/**
 * Generate a delivery OTP for an order.
 * Stores in Supabase + localStorage for offline access.
 */
export async function generateDeliveryOtp(orderId: string): Promise<string> {
    const otp = generate4DigitOtp();
    const now = new Date().toISOString();

    const otpData: DeliveryOtp = {
        orderId,
        otp,
        createdAt: now,
        verified: false,
    };

    // Save to localStorage immediately (offline-first)
    const otps = getLocalOtps();
    otps[orderId] = otpData;
    saveLocalOtps(otps);

    // Try to save to Supabase
    try {
        if (supabase) {
            await supabase
                .from('delivery_otps')
                .upsert({
                    order_id: orderId,
                    otp_code: otp,
                    created_at: now,
                    verified: false,
                }, { onConflict: 'order_id' });
        }
    } catch (err) {
        console.warn('Could not save OTP to server, saved locally:', err);
    }

    console.log(`🔐 Delivery OTP generated for order ${orderId.slice(0, 8)}: ${otp}`);
    return otp;
}

/**
 * Get the OTP for an order (customer-side, to display on tracking page)
 */
export async function getDeliveryOtp(orderId: string): Promise<string | null> {
    // Check localStorage first (fast, offline)
    const otps = getLocalOtps();
    if (otps[orderId]) {
        return otps[orderId].otp;
    }

    // Fallback to Supabase
    try {
        if (supabase) {
            const { data } = await supabase
                .from('delivery_otps')
                .select('otp_code')
                .eq('order_id', orderId)
                .eq('verified', false)
                .maybeSingle();

            if (data) return data.otp_code;
        }
    } catch {
        // offline
    }

    return null;
}

/**
 * Verify the OTP (rider-side, on delivery completion)
 */
export async function verifyDeliveryOtp(
    orderId: string,
    enteredOtp: string
): Promise<{ success: boolean; error?: string }> {
    // Check localStorage
    const otps = getLocalOtps();
    const stored = otps[orderId];

    if (stored) {
        if (stored.otp === enteredOtp) {
            // Mark as verified locally
            stored.verified = true;
            stored.verifiedAt = new Date().toISOString();
            saveLocalOtps(otps);

            // Update Supabase
            try {
                if (supabase) {
                    await supabase
                        .from('delivery_otps')
                        .update({ verified: true, verified_at: stored.verifiedAt })
                        .eq('order_id', orderId);
                }
            } catch {
                // will sync later
            }

            return { success: true };
        }
        return { success: false, error: 'Incorrect OTP. Please try again.' };
    }

    // Fallback: verify against Supabase directly
    try {
        if (supabase) {
            const { data } = await supabase
                .from('delivery_otps')
                .select('otp_code')
                .eq('order_id', orderId)
                .eq('verified', false)
                .maybeSingle();

            if (data && data.otp_code === enteredOtp) {
                await supabase
                    .from('delivery_otps')
                    .update({ verified: true, verified_at: new Date().toISOString() })
                    .eq('order_id', orderId);
                return { success: true };
            }
        }
    } catch {
        return { success: false, error: 'Cannot verify OTP while offline.' };
    }

    return { success: false, error: 'OTP not found or already used.' };
}
