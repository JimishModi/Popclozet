// apps/customer-app/src/services/razorpayService.ts
// Calls Supabase Edge Functions for Razorpay payment flow.

import { supabase } from '@popclozet/api-client';
import type { RazorpayPaymentResponse } from '@/lib/razorpay';

interface CreateOrderParams {
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
 * Amount is resolved server-side from the order's total_amount (never sent by client).
 * Returns the Razorpay order ID and public key for use in the checkout modal.
 */
export async function createRazorpayOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
  const { data, error } = await supabase.functions.invoke('create-razorpay-order', {
    body: {
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
 *
 * Retries up to 3 times on network failures because money has already been deducted
 * at this point — we MUST NOT lose the verification due to a transient error.
 */
export async function verifyRazorpayPayment(params: VerifyPaymentParams): Promise<{ success: boolean; payment_id: string }> {
  const MAX_RETRIES = 3;

  // Persist payment response to localStorage so support can reconcile even if all retries fail
  try {
    localStorage.setItem(`rzp_pending_verify:${params.internal_order_id}`, JSON.stringify({
      razorpay_order_id: params.razorpay_order_id,
      razorpay_payment_id: params.razorpay_payment_id,
      internal_order_id: params.internal_order_id,
      timestamp: Date.now(),
    }));
  } catch { /* best-effort */ }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { data, error } = await supabase.functions.invoke('verify-razorpay-payment', {
        body: {
          razorpay_order_id: params.razorpay_order_id,
          razorpay_payment_id: params.razorpay_payment_id,
          razorpay_signature: params.razorpay_signature,
          internal_order_id: params.internal_order_id,
        },
      });

      if (error) {
        // Network/server errors — retry
        throw new Error(error.message || 'Payment verification failed');
      }

      if (!data?.success) {
        // Signature mismatch is a definitive failure — don't retry
        throw new Error('Payment signature mismatch. Possible fraud attempt.');
      }

      // Success — clear pending verification record
      try { localStorage.removeItem(`rzp_pending_verify:${params.internal_order_id}`); } catch { }

      return data as { success: boolean; payment_id: string };
    } catch (err: any) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Don't retry signature mismatches — that's a real failure
      if (lastError.message.includes('signature mismatch')) {
        throw lastError;
      }

      if (attempt < MAX_RETRIES) {
        console.warn(`[razorpayService] Verification retry ${attempt + 1}/${MAX_RETRIES}...`);
        await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
      }
    }
  }

  throw new Error(
    'Payment was processed but verification failed after multiple attempts. ' +
    'Your payment is safe — please contact support with your order ID.'
  );
}
