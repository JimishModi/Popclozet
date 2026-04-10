// apps/customer-app/src/services/razorpayService.ts
// Calls Supabase Edge Functions for Razorpay payment flow.

import { supabase } from '@popclozet/api-client';
import type { RazorpayPaymentResponse } from '@/lib/razorpay';
import { debugAuthState, invokeWithUserJwt } from '@/services/supabaseFunctionInvoke';

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
  const { data, error } = await invokeWithUserJwt<CreateOrderResult>('create-razorpay-order', {
    body: {
      receipt: params.receipt,
      notes: params.notes,
    },
  });

  if (error) {
    // Extract the actual error body from the edge function response
    let detail = error.message;
    const invokeError = error as any;
    try {
      if (invokeError.context && typeof invokeError.context.json === 'function') {
        const body = await invokeError.context.json();
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

  // Debug snapshot after user returns from the Razorpay modal/app handoff.
  await debugAuthState('verify-razorpay-payment:return-from-razorpay');

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { data, error } = await invokeWithUserJwt<{ success: boolean; payment_id: string }>('verify-razorpay-payment', {
        body: {
          razorpay_order_id: params.razorpay_order_id,
          razorpay_payment_id: params.razorpay_payment_id,
          razorpay_signature: params.razorpay_signature,
          internal_order_id: params.internal_order_id,
        },
      });

      if (error) {
        // Extract the actual error body from the edge function response
        // (Supabase wraps it under error.context.json()).
        let detail = error.message;
        const invokeError = error as any;
        try {
          if (invokeError.context && typeof invokeError.context.json === 'function') {
            const body = await invokeError.context.json();
            detail = body?.error || JSON.stringify(body);
          }
        } catch { /* ignore parse errors */ }
        throw new Error(detail || 'Payment verification failed');
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

      // Don't retry definitive failures:
      //  - signature mismatch = tampering/bad client
      //  - "was not completed" = gateway says payment wasn't captured
      //  - amount/order mismatch = data integrity failure
      const msg = lastError.message || '';
      const isDefinitive =
        msg.includes('signature mismatch') ||
        msg.includes('was not completed') ||
        msg.includes('Payment amount mismatch') ||
        msg.includes('order mismatch') ||
        msg.includes('Could not confirm payment');

      if (isDefinitive) {
        // Clear the pending verification record — this payment is dead
        try { localStorage.removeItem(`rzp_pending_verify:${params.internal_order_id}`); } catch { }
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

export type RecoveryResult = {
  orderId: string;
  status: 'confirmed' | 'pending' | 'cancelled' | 'stale' | 'error';
};

/**
 * Recovers any pending verifications that were interrupted (e.g. tab closed,
 * network drop after Razorpay handler fired but before verification completed).
 *
 * With the Razorpay webhook as server-side safety net, this function only needs
 * to CHECK order status and INFORM the caller — not re-verify.
 *
 * Returns results so the caller (App.tsx) can show appropriate toasts.
 */
export async function recoverPendingVerifications(): Promise<RecoveryResult[]> {
  const PREFIX = 'rzp_pending_verify:';
  const keys: string[] = [];
  const results: RecoveryResult[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(PREFIX)) keys.push(key);
  }

  if (keys.length === 0) return results;

  console.log(`[razorpayService] Found ${keys.length} pending verification(s), checking status...`);

  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) { localStorage.removeItem(key); continue; }

      const pending = JSON.parse(raw);
      const orderId = pending.internal_order_id;

      // Remove records older than 24 hours — Razorpay payments expire
      if (pending.timestamp && Date.now() - pending.timestamp > 24 * 60 * 60 * 1000) {
        console.warn('[razorpayService] Stale pending verification, removing:', orderId);
        localStorage.removeItem(key);
        results.push({ orderId, status: 'stale' });
        continue;
      }

      // Check if the order was confirmed (by webhook or earlier client verification)
      const { data: order } = await supabase
        .from('orders')
        .select('status')
        .eq('id', orderId)
        .single();

      if (order && ['confirmed', 'paid', 'packed', 'ready_for_pickup', 'dispatched', 'delivered', 'completed'].includes(order.status)) {
        console.log('[razorpayService] Order confirmed (likely by webhook), clearing:', orderId);
        localStorage.removeItem(key);
        results.push({ orderId, status: 'confirmed' });
      } else if (order && order.status === 'cancelled') {
        console.warn('[razorpayService] Order was cancelled. If money was deducted, refund needed:', orderId);
        localStorage.removeItem(key);
        results.push({ orderId, status: 'cancelled' });
      } else {
        // Still pending — webhook hasn't fired yet, or payment wasn't captured
        console.warn('[razorpayService] Order still pending verification:', orderId, 'razorpay_payment_id:', pending.razorpay_payment_id);
        results.push({ orderId, status: 'pending' });
        // Keep the record for next check
      }
    } catch (err) {
      console.warn('[razorpayService] Error recovering pending verification for', key, err);
      results.push({ orderId: key.replace(PREFIX, ''), status: 'error' });
    }
  }

  return results;
}

/**
 * Retries any order cancellations that failed due to network issues.
 * Called on app startup alongside recoverPendingVerifications.
 * The server-side cron is the ultimate fallback — this just speeds things up.
 */
export async function recoverPendingCancellations(): Promise<void> {
  const PREFIX = 'pending_cancel:';
  const keys: string[] = [];

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(PREFIX)) keys.push(key);
    }
  } catch (err) {
    console.warn('[razorpayService] Cannot access localStorage to recover verifications', err);
    return;
  }

  if (keys.length === 0) return;

  console.log(`[razorpayService] Found ${keys.length} pending cancellation(s), retrying...`);

  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) { localStorage.removeItem(key); continue; }

      const pending = JSON.parse(raw);

      // Skip records older than 24 hours — cron will have handled these
      if (pending.timestamp && Date.now() - pending.timestamp > 24 * 60 * 60 * 1000) {
        localStorage.removeItem(key);
        continue;
      }

      // Check if order is already cancelled or confirmed
      const { data: order } = await supabase
        .from('orders')
        .select('status')
        .eq('id', pending.orderId)
        .single();

      if (!order || ['cancelled', 'confirmed', 'paid', 'completed'].includes(order.status)) {
        // Already resolved — clear entry
        localStorage.removeItem(key);
        continue;
      }

      // Attempt cancellation via RPC
      const { error } = await supabase.rpc('cancel_order_safe', { p_order_id: pending.orderId });
      if (!error) {
        console.log('[razorpayService] Successfully cancelled order on retry:', pending.orderId);
        localStorage.removeItem(key);
      }
    } catch (err) {
      console.warn('[razorpayService] Cancel retry failed for', key, '— cron will handle it');
    }
  }
}
