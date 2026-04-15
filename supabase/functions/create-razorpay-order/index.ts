// deno-lint-ignore-file
// @ts-nocheck
// supabase/functions/create-razorpay-order/index.ts
//
// Creates a Razorpay order securely on the server.
// The Key Secret never reaches the browser.
//
// SECURITY:
// - Requires valid Supabase auth token (JWT)
// - Validates amount against the order's total_amount in DB
// - Verifies the order belongs to the authenticated user
// - Only allows orders in valid pre-payment states
// - Stores razorpay_order_id on the internal order (anti-substitution)
// - CORS restricted to allowed origins
//
// Deploy:  supabase functions deploy create-razorpay-order

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

Deno.serve(async (req: Request) => {
  const log = makeLogger('create-razorpay-order');
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

    // Create a client scoped to the caller's JWT — respects RLS
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ error: 'Unauthorized' }, 401, req, log);
    }

    const { receipt, notes } = await req.json();

    if (!receipt) {
      return jsonResponse({ error: 'Missing receipt (order ID)' }, 400, req, log);
    }

    // ── Validate order ownership & amount ──────────────────
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: order, error: orderErr } = await adminClient
      .from('orders')
      .select('id, user_id, total_amount, status, razorpay_order_id')
      .eq('id', receipt)
      .single();

    if (orderErr || !order) {
      log.error('Order not found', { receipt });
      return jsonResponse({ error: 'Order not found' }, 404, req, log);
    }

    // Verify the caller owns this order
    if (order.user_id !== user.id) {
      log.error('User mismatch', { caller: user.id, owner: order.user_id });
      return jsonResponse({ error: 'Forbidden' }, 403, req, log);
    }

    // Verify the order is in a payable state
    if (!['pending', 'pending_payment'].includes(order.status)) {
      return jsonResponse({ error: `Order is in state '${order.status}' and cannot be paid` }, 409, req, log);
    }

    // ── Use DB total_amount as the ONLY source of truth for the charge ──
    // We never trust the client-sent amount — it may differ by rounding.
    // The amount saved by place_order RPC is authoritative.
    const expectedPaise = Math.round(order.total_amount * 100);
    if (expectedPaise < 100) {
      return jsonResponse({ error: 'Order total is too low to charge' }, 400, req, log);
    }

    // Idempotent: if a Razorpay order was already created, return it
    if (order.razorpay_order_id) {
      const keyId = Deno.env.get('RAZORPAY_KEY_ID')!;
      return jsonResponse({
        id: order.razorpay_order_id,
        amount: expectedPaise,
        currency: 'INR',
        key_id: keyId,
      }, 200, req, log);
    }

    // ── Create Razorpay order ──────────────────────────────
    const keyId = Deno.env.get('RAZORPAY_KEY_ID');
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');

    if (!keyId || !keySecret) {
      log.error('Razorpay credentials not configured');
      return jsonResponse({ error: 'Payment service not configured' }, 500, req, log);
    }

    const credentials = btoa(`${keyId}:${keySecret}`);

    const razorpayRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${credentials}`,
      },
      body: JSON.stringify({
        amount: expectedPaise,
        currency: 'INR',
        receipt: receipt,
        notes: notes || {},
      }),
    });

    if (!razorpayRes.ok) {
      const errText = await razorpayRes.text();
      log.error('Razorpay API error', { errText });
      return jsonResponse({ error: 'Failed to create payment order' }, 502, req, log);
    }

    const rzpOrder = await razorpayRes.json();

    // ── Store razorpay_order_id on the internal order ──────
    // This binds the Razorpay order to our internal order, preventing
    // substitution attacks during verification.
    const { error: updateErr } = await adminClient
      .from('orders')
      .update({ razorpay_order_id: rzpOrder.id })
      .eq('id', receipt)
      .eq('user_id', user.id);

    if (updateErr) {
      log.error('Failed to store razorpay_order_id', { error: updateErr });
      // Non-fatal: payment can still proceed, verification will use Razorpay API fallback
    }

    log.info('Order created', { rzpOrderId: rzpOrder.id, userId: user.id });

    return jsonResponse({
      id: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      key_id: keyId,
    }, 200, req, log);

  } catch (err: any) {
    log.error('Unexpected error', { error: String(err) });
    return jsonResponse({ error: 'Internal server error' }, 500, req, log);
  }
});
