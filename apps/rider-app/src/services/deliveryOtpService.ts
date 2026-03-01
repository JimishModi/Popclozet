/**
 * Delivery OTP Service (Rider-App copy)
 * Verifies OTPs for delivery handover.
 */

import { supabase } from '@popclozet/api-client';

const OTP_STORAGE_KEY = 'delivery_otps';

function getLocalOtps(): Record<string, any> {
    try {
        const stored = localStorage.getItem(OTP_STORAGE_KEY);
        return stored ? JSON.parse(stored) : {};
    } catch {
        return {};
    }
}

function saveLocalOtps(otps: Record<string, any>): void {
    localStorage.setItem(OTP_STORAGE_KEY, JSON.stringify(otps));
}

export async function verifyDeliveryOtp(
    orderId: string,
    enteredOtp: string
): Promise<{ success: boolean; error?: string }> {
    // Check localStorage
    const otps = getLocalOtps();
    const stored = otps[orderId];

    if (stored && stored.otp === enteredOtp) {
        stored.verified = true;
        stored.verifiedAt = new Date().toISOString();
        saveLocalOtps(otps);

        try {
            if (supabase) {
                await supabase
                    .from('delivery_otps')
                    .update({ verified: true, verified_at: stored.verifiedAt })
                    .eq('order_id', orderId);
            }
        } catch { /* will sync later */ }

        return { success: true };
    }

    // Fallback: verify against Supabase
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

    return { success: false, error: 'Incorrect OTP. Please try again.' };
}
