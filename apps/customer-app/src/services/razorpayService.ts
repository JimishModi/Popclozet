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
  // Ensure we have a fresh session token before calling the edge function
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session) {
    // Try refreshing the session
    const { error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) {
      console.error('[razorpayService] Session refresh failed:', refreshError);
      throw new Error('Authentication expired. Please log in again.');
    }
  }

  const { data, error } = await supabase.functions.invoke('create-razorpay-order', {
    body: {
      receipt: params.receipt,
      notes: params.notes,
    },
  });

  if (error) {
    // Extract the actual error body from the edge function response
    let detail = error.message;
    try {
      if (error.context && typeof error.context.json === 'function') {
        const body = await error.context.json();
        detail = body?.error || JSON.stringify(body);
      }
    } catch { /* ignore parse errors */ }
    console.error('[razorpayService] createRazorpayOrder failed:', detail, error);
    throw new Error(detail || 'Failed to create payment order');
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

/**
 * Recovers any pending verifications that were interrupted (e.g. tab closed,
 * network drop after Razorpay handler fired but before verification completed).
 *
 * Call this once on app startup (e.g. in a top-level useEffect).
 * For each pending record, it re-attempts verification. If it succeeds or
 * gets a definitive "already processed" response, it clears the record.
 */
export async function recoverPendingVerifications(): Promise<void> {
  const PREFIX = 'rzp_pending_verify:';
  const keys: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(PREFIX)) keys.push(key);
  }

  if (keys.length === 0) return;

  console.log(`[razorpayService] Found ${keys.length} pending verification(s), attempting recovery...`);

  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) { localStorage.removeItem(key); continue; }

      const pending = JSON.parse(raw);

      // Skip records older than 24 hours — Razorpay payments expire
      if (pending.timestamp && Date.now() - pending.timestamp > 24 * 60 * 60 * 1000) {
        console.warn('[razorpayService] Stale pending verification, removing:', pending.internal_order_id);
        localStorage.removeItem(key);
        continue;
      }

      // Signature is not stored in localStorage (intentionally — it's sensitive).
      // We can't re-verify without it. But we can check if the order was already
      // verified by querying the order status.
      const { data: order } = await supabase
        .from('orders')
        .select('status')
        .eq('id', pending.internal_order_id)
        .single();

      if (order && ['confirmed', 'paid', 'packed', 'ready_for_pickup', 'dispatched', 'delivered', 'completed'].includes(order.status)) {
        console.log('[razorpayService] Order already confirmed, clearing pending record:', pending.internal_order_id);
        localStorage.removeItem(key);
      } else {
        console.warn(
          '[razorpayService] Order not yet confirmed. Payment may need manual reconciliation:',
          pending.internal_order_id,
          'razorpay_payment_id:', pending.razorpay_payment_id,
        );
        // Keep the record so support can find it
      }
    } catch (err) {
      console.warn('[razorpayService] Error recovering pending verification for', key, err);
    }
  }
}
