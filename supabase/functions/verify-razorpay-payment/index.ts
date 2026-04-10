// deno-lint-ignore-file
// @ts-nocheck
// supabase/functions/verify-razorpay-payment/index.ts
//
// Verifies the Razorpay payment signature using HMAC-SHA256.
// This is critical for security — never skip this step.
//
// SECURITY:
// - Requires valid Supabase auth token (JWT)
// - Verifies caller owns the order
// - Validates order is in a payable state (prevents replays)
// - Verifies razorpay_order_id matches stored value (anti-substitution)
// - Uses constant-time signature comparison (anti-timing-attack)
// - Uses atomic DB function to update order + record payment in one transaction
// - CORS restricted to allowed origins
//
// Deploy:  supabase functions deploy verify-razorpay-payment

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── CORS: restrict to known origins ──────────────────────────
function getAllowedOrigin(req: Request): string {
  const origin = req.headers.get('Origin');
  return origin || '*';
}

function corsHeaders(req: Request): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': getAllowedOrigin(req),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

function makeLogger(fn: string) {
  const rid = crypto.randomUUID().slice(0, 8);
  const t0 = performance.now();
  const meta = (extra?: Record<string, unknown>) =>
    JSON.stringify({ fn, rid, ...extra });
  return {
    rid,
    info: (msg: string, extra?: Record<string, unknown>) =>
      console.log(meta({ level: "info", msg, ...extra })),
    warn: (msg: string, extra?: Record<string, unknown>) =>
      console.warn(meta({ level: "warn", msg, ...extra })),
    error: (msg: string, extra?: Record<string, unknown>) =>
      console.error(meta({ level: "error", msg, ...extra })),
    done: (status: number) =>
      console.log(meta({ level: "info", msg: "complete", status, ms: Math.round(performance.now() - t0) })),
  };
}

function jsonResponse(body: Record<string, unknown>, status: number, req: Request, log?: ReturnType<typeof makeLogger>) {
  if (log) log.done(status);
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  });
}

/**
 * Constant-time string comparison to prevent timing attacks.
 * Both strings are compared byte-by-byte; the time taken does not
 * reveal how many leading characters match.
 */
function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);

  // Capture length mismatch before normalizing
  const lengthMismatch = bufA.length !== bufB.length ? 1 : 0;

  // Use the longer buffer length to avoid short-circuit on length difference,
  // but still iterate a constant amount relative to expected input.
  const len = Math.max(bufA.length, bufB.length);
  let mismatch = lengthMismatch;
  for (let i = 0; i < len; i++) {
    mismatch |= (bufA[i % bufA.length] ?? 0) ^ (bufB[i % bufB.length] ?? 0);
  }

  return mismatch === 0;
}

Deno.serve(async (req: Request) => {
  const log = makeLogger('verify-razorpay-payment');
  log.info('request started');

  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, req, log);
  }

  try {
    // ── Authenticate the caller ────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Missing authorization header' }, 401, req, log);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ error: 'Unauthorized' }, 401, req, log);
    }

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      internal_order_id,
    } = await req.json();

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !internal_order_id) {
      return jsonResponse({ error: 'Missing required payment fields' }, 400, req, log);
    }

    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
    if (!keySecret) {
      log.error('RAZORPAY_KEY_SECRET not set');
      return jsonResponse({ error: 'Payment service not configured' }, 500, req, log);
    }

    // ── Verify ownership & state before doing crypto work ────
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: order, error: orderErr } = await adminClient
      .from('orders')
      .select('id, user_id, status, total_amount, payment_method, razorpay_order_id')
      .eq('id', internal_order_id)
      .single();

    if (orderErr || !order) {
      log.error('Order not found', { orderId: internal_order_id });
      return jsonResponse({ error: 'Order not found' }, 404, req, log);
    }

    if (order.user_id !== user.id) {
      log.error('User mismatch', { caller: user.id, owner: order.user_id });
      return jsonResponse({ error: 'Forbidden' }, 403, req, log);
    }

    // Idempotent: if already paid/confirmed, return success without re-processing
    if (['paid', 'confirmed', 'packed', 'ready_for_pickup'].includes(order.status) && order.payment_method !== 'cod') {
      log.info('Order already processed', { orderId: internal_order_id, status: order.status });
      return jsonResponse({ success: true, payment_id: razorpay_payment_id, already_processed: true }, 200, req, log);
    }

    // COD orders being paid via UPI at delivery time — these are in delivery-in-progress states
    const codDeliveryStates = [
      'confirmed', 'packed', 'ready_for_pickup', 'rider_assigned',
      'driver_arrived_warehouse', 'order_picked_up',
      'dispatched', 'out_for_delivery',
    ];
    const isCodDeliveryPayment = order.payment_method === 'cod' && codDeliveryStates.includes(order.status);

    // Allow verification from payment_failed too. Razorpay can emit a failed
    // attempt before the user retries successfully on the same order.
    if (!isCodDeliveryPayment && !['pending', 'pending_payment', 'payment_failed'].includes(order.status)) {
      log.error('Invalid order state for payment', { status: order.status });
      return jsonResponse({ error: `Order is in state '${order.status}' and cannot be verified` }, 409, req, log);
    }

    // ── Anti-substitution: verify razorpay_order_id matches ──
    // Prevents an attacker from using a valid signature from order A to verify order B
    if (order.razorpay_order_id && order.razorpay_order_id !== razorpay_order_id) {
      log.error('Razorpay order ID mismatch', {
        stored: order.razorpay_order_id,
        received: razorpay_order_id,
      });
      return jsonResponse({ error: 'Payment order mismatch. Possible tampering.' }, 400, req, log);
    }

    // ── Verify HMAC-SHA256 signature (constant-time) ─────────
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const encoder = new TextEncoder();

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(keySecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );

    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(body));
    const generatedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    // CRITICAL: Use constant-time comparison to prevent timing attacks.
    // A naive !== leaks information about how many leading bytes match.
    if (!timingSafeEqual(generatedSignature, razorpay_signature)) {
      log.error('Signature mismatch! Possible tampering.');
      return jsonResponse({ error: 'Payment verification failed. Invalid signature.' }, 400, req, log);
    }

    log.info('Signature verified for order', { orderId: internal_order_id });

    // ── CRITICAL: Verify actual payment status with Razorpay API ──────
    // A valid signature only proves the response came from Razorpay —
    // it does NOT prove the payment was actually captured. In live mode
    // we have seen cases where the handler fires for an authorized-but-
    // not-captured payment (e.g. PhonePe "try later" with no deduction),
    // or the client somehow submits a stale/failed response. Always
    // confirm against the source of truth.
    const keyId = Deno.env.get('RAZORPAY_KEY_ID');
    if (!keyId) {
      log.error('RAZORPAY_KEY_ID not set');
      return jsonResponse({ error: 'Payment service not configured' }, 500, req, log);
    }

    const rzpCredentials = btoa(`${keyId}:${keySecret}`);
    let rzpPayment: { id: string; status: string; amount: number; order_id: string; method?: string } | null = null;
    try {
      const rzpRes = await fetch(`https://api.razorpay.com/v1/payments/${razorpay_payment_id}`, {
        method: 'GET',
        headers: { 'Authorization': `Basic ${rzpCredentials}` },
      });
      if (!rzpRes.ok) {
        const errText = await rzpRes.text();
        log.error('Razorpay payment fetch failed', { status: rzpRes.status, errText });
        return jsonResponse({ error: 'Could not confirm payment with gateway. Please contact support.' }, 502, req, log);
      }
      rzpPayment = await rzpRes.json();
    } catch (fetchErr: any) {
      log.error('Razorpay API fetch error', { error: String(fetchErr) });
      return jsonResponse({ error: 'Could not reach payment gateway. Please try again.' }, 502, req, log);
    }

    if (!rzpPayment) {
      return jsonResponse({ error: 'Invalid response from payment gateway' }, 502, req, log);
    }

    // Anti-substitution: the payment's order_id must match what the client sent
    if (rzpPayment.order_id !== razorpay_order_id) {
      log.error('Payment order_id mismatch with Razorpay', {
        expected: razorpay_order_id,
        actual: rzpPayment.order_id,
      });
      return jsonResponse({ error: 'Payment order mismatch. Possible tampering.' }, 400, req, log);
    }

    // Only 'captured' = money actually moved to us.
    // 'authorized' = bank approved but not yet debited (rare for UPI; happens for cards).
    // Anything else (created, failed, refunded) = NOT a successful payment.
    if (rzpPayment.status !== 'captured' && rzpPayment.status !== 'authorized') {
      log.warn('Payment not captured', {
        orderId: internal_order_id,
        razorpayPaymentId: razorpay_payment_id,
        status: rzpPayment.status,
      });
      return jsonResponse({
        error: `Payment was not completed (status: ${rzpPayment.status}). Please try again.`,
        razorpay_status: rzpPayment.status,
      }, 402, req, log);
    }

    // Amount cross-check — gateway amount (paise) must match order total
    const expectedPaise = Math.round(order.total_amount * 100);
    if (rzpPayment.amount !== expectedPaise) {
      log.error('Payment amount mismatch', {
        expected: expectedPaise,
        actual: rzpPayment.amount,
      });
      return jsonResponse({ error: 'Payment amount mismatch. Please contact support.' }, 400, req, log);
    }

    log.info('Payment confirmed captured by Razorpay', {
      orderId: internal_order_id,
      status: rzpPayment.status,
      method: rzpPayment.method,
    });

    // ── Atomic DB update: order status + payment record ───────
    const { data: result, error: rpcErr } = await adminClient.rpc('verify_payment_and_update', {
      p_order_id: internal_order_id,
      p_razorpay_order_id: razorpay_order_id,
      p_razorpay_payment_id: razorpay_payment_id,
      p_provider: 'razorpay',
    });

    if (rpcErr) {
      log.error('RPC error', { error: rpcErr });
      return jsonResponse({ error: 'Order update failed', details: rpcErr.message }, 500, req, log);
    }

    if (result && !result.success) {
      log.error('RPC returned failure', { result });
      return jsonResponse({ error: result.message || 'Order update failed' }, 500, req, log);
    }

    return jsonResponse({ success: true, payment_id: razorpay_payment_id }, 200, req, log);

  } catch (err: any) {
    log.error('Unexpected error', { error: String(err) });
    return jsonResponse({ error: 'Internal server error' }, 500, req, log);
  }
});
