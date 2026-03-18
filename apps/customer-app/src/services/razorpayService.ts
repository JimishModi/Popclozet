// apps/customer-app/src/services/razorpayService.ts
// Calls Supabase Edge Functions for Razorpay payment flow.

import { supabase } from '@popclozet/api-client';
import type { RazorpayPaymentResponse } from '@/lib/razorpay';

interface CreateOrderParams {
  amount: number;          // in PAISE (e.g., ₹500 = 50000)
  receipt: string;         // your internal order ID
  notes?: Record<string, string>;
}

interface CreateOrderResult {
  id: string;              // Razorpay order ID (rzp_order_xxx)
  amount: number;
  currency: string;
  key_id: string;          // Public key — safe to use in frontend
}

/**
 * Step 1: Create a Razorpay order via secure server-side function.
 * Returns the Razorpay order ID and public key for use in the checkout modal.
 */
export async function createRazorpayOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
  const { data, error } = await supabase.functions.invoke('create-razorpay-order', {
    body: {
      amount: params.amount,
      receipt: params.receipt,
      notes: params.notes,
    },
  });

  if (error) {
    console.error('[razorpayService] createRazorpayOrder failed:', error);
    throw new Error(error.message || 'Failed to create payment order');
  }

  if (!data?.id) {
    throw new Error('Invalid response from payment service');
  }

  return data as CreateOrderResult;
}

interface VerifyPaymentParams extends RazorpayPaymentResponse {
  internal_order_id: string; // Our Supabase order UUID
}

/**
 * Step 3: Verify payment signature server-side after user completes payment.
 * This is the critical security step — only call this AFTER the Razorpay modal closes successfully.
 */
export async function verifyRazorpayPayment(params: VerifyPaymentParams): Promise<{ success: boolean; payment_id: string }> {
  const { data, error } = await supabase.functions.invoke('verify-razorpay-payment', {
    body: {
      razorpay_order_id: params.razorpay_order_id,
      razorpay_payment_id: params.razorpay_payment_id,
      razorpay_signature: params.razorpay_signature,
      internal_order_id: params.internal_order_id,
    },
  });

  if (error) {
    console.error('[razorpayService] verifyRazorpayPayment failed:', error);
    throw new Error(error.message || 'Payment verification failed');
  }

  if (!data?.success) {
    throw new Error('Payment signature mismatch. Possible fraud attempt.');
  }

  return data as { success: boolean; payment_id: string };
}
