/**
 * Delivery OTP Service (Rider-App copy)
 * Verifies OTPs for delivery handover.
 */

import { supabase } from '@popclozet/api-client';

export async function verifyDeliveryOtp(
    orderId: string,
    enteredOtp: string,
    field: 'otp_delivery' | 'otp_return' = 'otp_delivery'
): Promise<{ success: boolean; error?: string }> {
    try {
        const { data, error } = await supabase
            .from('orders')
            .select(field)
            .eq('id', orderId)
            .single();

        if (error || !data) return { success: false, error: 'Cannot verify OTP.' };
        if ((data as any)[field] === enteredOtp) return { success: true };
    } catch {
        return { success: false, error: 'Cannot verify OTP while offline.' };
    }

    return { success: false, error: 'Incorrect OTP. Please try again.' };
}
