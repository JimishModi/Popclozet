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

    const isSuccessEvent = eventType === 'payment.captured' || eventType === 'payment.authorized';
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
      .select('id, status, razorpay_order_id')
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

    // Razorpay may emit payment.failed for an earlier attempt and then
    // payment.captured for a later retry on the same order. Do not mutate the
    // order or release stock here; explicit cancel/cleanup handles abandonment.
    if (isFailureEvent) {
      if (['pending', 'pending_payment', 'payment_failed'].includes(order.status)) {
        log.info('Ignoring retryable payment.failed event for still-open order', {
          orderId: order.id,
          status: order.status,
          razorpayPaymentId,
        });
        log.done(200);
        return new Response(JSON.stringify({
          status: 'ignored_retryable_failure',
          order_id: order.id,
          payment_id: razorpayPaymentId,
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (['confirmed', 'paid', 'packed', 'ready_for_pickup', 'dispatched', 'delivered', 'completed'].includes(order.status)) {
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

      log.info('Payment failure for order in non-actionable state', {
        orderId: order.id,
        status: order.status,
      });
      log.done(200);
      return new Response(JSON.stringify({ status: 'no_action', order_id: order.id }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (['confirmed', 'paid', 'packed', 'ready_for_pickup', 'dispatched', 'delivered', 'completed'].includes(order.status)) {
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

    if (order.status === 'cancelled') {
      log.warn('Order was cancelled but payment was captured - needs manual refund', {
        orderId: order.id,
        razorpayPaymentId,
      });
      log.done(200);
      return new Response(JSON.stringify({
        status: 'conflict',
        message: 'Order cancelled but payment captured. Manual refund needed.',
        order_id: order.id,
        razorpay_payment_id: razorpayPaymentId,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
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
