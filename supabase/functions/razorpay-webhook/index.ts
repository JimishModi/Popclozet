// deno-lint-ignore-file
// @ts-nocheck
// supabase/functions/razorpay-webhook/index.ts
//
// Server-side Razorpay webhook handler for payment.captured and payment.authorized events.
// This is the critical safety net: if the client goes offline after payment,
// this webhook confirms the order independently.
//
// SECURITY:
// - Verifies webhook signature using HMAC-SHA256 with RAZORPAY_WEBHOOK_SECRET
// - Uses service-role client (no user JWT - Razorpay doesn't send one)
// - Calls the same idempotent verify_payment_and_update RPC used by client verification
// - Always returns 200 to prevent Razorpay from retrying indefinitely
//
// Deploy:  supabase functions deploy razorpay-webhook
// Config:  Set RAZORPAY_WEBHOOK_SECRET via `supabase secrets set`
// Razorpay Dashboard: Subscribe to payment.authorized + payment.captured

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function makeLogger(fn: string) {
  const rid = crypto.randomUUID().slice(0, 8);
  const t0 = performance.now();
  const meta = (extra?: Record<string, unknown>) =>
    JSON.stringify({ fn, rid, ...extra });
  return {
    rid,
    info: (msg: string, extra?: Record<string, unknown>) =>
      console.log(meta({ level: 'info', msg, ...extra })),
    warn: (msg: string, extra?: Record<string, unknown>) =>
      console.warn(meta({ level: 'warn', msg, ...extra })),
    error: (msg: string, extra?: Record<string, unknown>) =>
      console.error(meta({ level: 'error', msg, ...extra })),
    done: (status: number) =>
      console.log(meta({ level: 'info', msg: 'complete', status, ms: Math.round(performance.now() - t0) })),
  };
}

/**
 * Constant-time string comparison to prevent timing attacks on webhook signature.
 */
function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);

  const lengthMismatch = bufA.length !== bufB.length ? 1 : 0;
  const len = Math.max(bufA.length, bufB.length);
  let mismatch = lengthMismatch;
  for (let i = 0; i < len; i++) {
    mismatch |= (bufA[i % bufA.length] ?? 0) ^ (bufB[i % bufB.length] ?? 0);
  }
  return mismatch === 0;
}

Deno.serve(async (req: Request) => {
  const log = makeLogger('razorpay-webhook');
  log.info('webhook received');

  // Only accept POST
  if (req.method !== 'POST') {
    log.done(405);
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Read raw body for signature verification
    const rawBody = await req.text();

    // Verify webhook signature
    const webhookSecret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET');
    if (!webhookSecret) {
      log.error('RAZORPAY_WEBHOOK_SECRET not set');
      return new Response(JSON.stringify({ error: 'Webhook not configured' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const receivedSignature = req.headers.get('X-Razorpay-Signature');
    if (!receivedSignature) {
      log.error('Missing X-Razorpay-Signature header');
      return new Response(JSON.stringify({ error: 'Missing signature' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const encoder = new TextEncoder();
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(webhookSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );

    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(rawBody));
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    if (!timingSafeEqual(expectedSignature, receivedSignature)) {
      log.error('Webhook signature mismatch - rejecting');
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    log.info('Webhook signature verified');

    const event = JSON.parse(rawBody);
    const eventType = event.event;

    // CRITICAL: only payment.captured means money actually moved.
    // payment.authorized can happen for payments that are later auto-voided
    // (e.g. PhonePe UPI intent that the user never completes) — we must NOT
    // confirm the order on authorized alone. When the payment eventually
    // auto-captures (or fails), Razorpay will fire captured/failed and we
    // handle it then.
    const isSuccessEvent = eventType === 'payment.captured';
    const isFailureEvent = eventType === 'payment.failed';

    if (!isSuccessEvent && !isFailureEvent) {
      log.info('Ignoring event type', { eventType });
      log.done(200);
      return new Response(JSON.stringify({ status: 'ignored', event: eventType }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const payment = event.payload?.payment?.entity;
    if (!payment) {
      log.error('Missing payment entity in webhook payload');
      log.done(200);
      return new Response(JSON.stringify({ error: 'Missing payment entity' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const razorpayOrderId = payment.order_id;
    const razorpayPaymentId = payment.id;

    if (!razorpayOrderId || !razorpayPaymentId) {
      log.error('Missing order_id or payment id in payment entity', {
        order_id: razorpayOrderId,
        payment_id: razorpayPaymentId,
      });
      log.done(200);
      return new Response(JSON.stringify({ error: 'Missing payment identifiers' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    log.info('Processing webhook', {
      eventType,
      razorpayOrderId,
      razorpayPaymentId,
    });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: order, error: orderErr } = await adminClient
      .from('orders')
      .select('id, status, payment_method, cod_payment_collected, razorpay_order_id')
      .eq('razorpay_order_id', razorpayOrderId)
      .single();

    if (orderErr || !order) {
      log.error('Order not found for razorpay_order_id', {
        razorpayOrderId,
        error: orderErr?.message,
      });
      log.done(200);
      return new Response(JSON.stringify({ error: 'Order not found' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Handle payment.failed events.
    // Razorpay may emit payment.failed for an earlier attempt before a later retry
    // succeeds. We mark the order as payment_failed but do NOT release stock yet —
    // the user may retry within the same Razorpay order. Stock is released by:
    //   1. Client-side immediate cancel (PaymentProcessingPage onFailure)
    //   2. pg_cron cleanup after 10 minutes
    //   3. A subsequent payment.captured webhook overrides payment_failed
    if (isFailureEvent) {
      const isAlreadyProcessed =
        (order.payment_method !== 'cod' && ['confirmed', 'paid', 'packed', 'ready_for_pickup', 'dispatched', 'delivered', 'completed'].includes(order.status)) ||
        (order.payment_method === 'cod' && order.cod_payment_collected === true);

      if (isAlreadyProcessed) {
        log.info('Payment failure event for already-confirmed order - ignoring', {
          orderId: order.id,
          status: order.status,
        });
        log.done(200);
        return new Response(JSON.stringify({ status: 'ignored_stale_failure', order_id: order.id }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (order.status === 'cancelled') {
        log.info('Payment failure for already-cancelled order - no action', {
          orderId: order.id,
        });
        log.done(200);
        return new Response(JSON.stringify({ status: 'already_cancelled', order_id: order.id }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Mark as payment_failed so the UI can show appropriate feedback.
      // Stock stays reserved — user may retry, or cron/client will cancel.
      if (['pending', 'pending_payment'].includes(order.status)) {
        const { error: updateErr } = await adminClient
          .from('orders')
          .update({ status: 'payment_failed', updated_at: new Date().toISOString() })
          .eq('id', order.id);

        if (updateErr) {
          log.error('Failed to mark order as payment_failed', {
            orderId: order.id,
            error: updateErr.message,
          });
        } else {
          log.info('Order marked as payment_failed', { orderId: order.id });
        }
      }

      log.done(200);
      return new Response(JSON.stringify({
        status: 'marked_payment_failed',
        order_id: order.id,
        payment_id: razorpayPaymentId,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const isAlreadyProcessed =
      (order.payment_method !== 'cod' && ['confirmed', 'paid', 'packed', 'ready_for_pickup', 'dispatched', 'delivered', 'completed'].includes(order.status)) ||
      (order.payment_method === 'cod' && order.cod_payment_collected === true);

    if (isAlreadyProcessed) {
      log.info('Order already confirmed - webhook is a no-op', {
        orderId: order.id,
        status: order.status,
      });
      log.done(200);
      return new Response(JSON.stringify({ status: 'already_processed', order_id: order.id }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // CRITICAL FIX: If the order was cancelled (by ondismiss racing the
    // UPI app return) but the payment WAS captured, re-confirm the order.
    // verify_payment_and_update now accepts 'cancelled' state and will
    // transition it to 'confirmed'. This is the most common failure mode
    // on mobile UPI payments.
    if (order.status === 'cancelled') {
      log.warn('Order was cancelled but payment was captured — attempting to re-confirm', {
        orderId: order.id,
        razorpayPaymentId,
      });
      // Fall through to the verify_payment_and_update call below
    }

    if (order.status === 'payment_failed') {
      log.info('Payment succeeded after prior failure - confirming order', {
        orderId: order.id,
      });
    }

    const { data: result, error: rpcErr } = await adminClient.rpc('verify_payment_and_update', {
      p_order_id: order.id,
      p_razorpay_order_id: razorpayOrderId,
      p_razorpay_payment_id: razorpayPaymentId,
      p_provider: 'razorpay',
    });

    if (rpcErr) {
      log.error('RPC verify_payment_and_update failed', {
        orderId: order.id,
        error: rpcErr.message,
      });
      log.done(200);
      return new Response(JSON.stringify({ error: 'Order update failed', details: rpcErr.message }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (result && !result.success) {
      log.warn('RPC returned failure', { orderId: order.id, result });
      log.done(200);
      return new Response(JSON.stringify({ error: result.message || 'Order update failed' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    log.info('Order confirmed via webhook', {
      orderId: order.id,
      razorpayPaymentId,
      newStatus: result?.new_status,
    });

    log.done(200);
    return new Response(JSON.stringify({
      status: 'confirmed',
      order_id: order.id,
      payment_id: razorpayPaymentId,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    log.error('Unexpected error', { error: String(err) });
    log.done(200);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
