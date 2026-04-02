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
const ALLOWED_ORIGINS = [
  'https://popclozet.com',
  'https://www.popclozet.com',
  'http://localhost:3000',
  'http://localhost:5173',
];

function getAllowedOrigin(req: Request): string {
  const origin = req.headers.get('Origin') ?? '';
  return ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
}

function corsHeaders(req: Request): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': getAllowedOrigin(req),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

function jsonResponse(body: Record<string, unknown>, status: number, req: Request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, req);
  }

  try {
    // ── Authenticate the caller ────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Missing authorization header' }, 401, req);
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
      return jsonResponse({ error: 'Unauthorized' }, 401, req);
    }

    const { amount, receipt, notes } = await req.json();

    if (!amount || typeof amount !== 'number' || amount < 100) {
      return jsonResponse({ error: 'Invalid amount. Must be in paise (min 100).' }, 400, req);
    }

    if (!receipt) {
      return jsonResponse({ error: 'Missing receipt (order ID)' }, 400, req);
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
      console.error('[create-razorpay-order] Order not found:', receipt);
      return jsonResponse({ error: 'Order not found' }, 404, req);
    }

    // Verify the caller owns this order
    if (order.user_id !== user.id) {
      console.error('[create-razorpay-order] User mismatch:', { caller: user.id, owner: order.user_id });
      return jsonResponse({ error: 'Forbidden' }, 403, req);
    }

    // Verify the order is in a payable state
    if (!['pending', 'pending_payment'].includes(order.status)) {
      return jsonResponse({ error: `Order is in state '${order.status}' and cannot be paid` }, 409, req);
    }

    // Verify the amount matches the order's total (in paise)
    const expectedPaise = Math.round(order.total_amount * 100);
    if (amount !== expectedPaise) {
      console.error('[create-razorpay-order] Amount mismatch:', { sent: amount, expected: expectedPaise });
      return jsonResponse({ error: 'Amount mismatch — does not match order total' }, 400, req);
    }

    // Idempotent: if a Razorpay order was already created, return it
    if (order.razorpay_order_id) {
      const keyId = Deno.env.get('RAZORPAY_KEY_ID')!;
      return jsonResponse({
        id: order.razorpay_order_id,
        amount: expectedPaise,
        currency: 'INR',
        key_id: keyId,
      }, 200, req);
    }

    // ── Create Razorpay order ──────────────────────────────
    const keyId = Deno.env.get('RAZORPAY_KEY_ID');
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');

    if (!keyId || !keySecret) {
      console.error('[create-razorpay-order] Razorpay credentials not configured');
      return jsonResponse({ error: 'Payment service not configured' }, 500, req);
    }

    const credentials = btoa(`${keyId}:${keySecret}`);

    const razorpayRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${credentials}`,
      },
      body: JSON.stringify({
        amount: Math.round(amount),
        currency: 'INR',
        receipt: receipt,
        notes: notes || {},
      }),
    });

    if (!razorpayRes.ok) {
      const errText = await razorpayRes.text();
      console.error('[create-razorpay-order] Razorpay API error:', errText);
      return jsonResponse({ error: 'Failed to create payment order' }, 502, req);
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
      console.error('[create-razorpay-order] Failed to store razorpay_order_id:', updateErr);
      // Non-fatal: payment can still proceed, verification will use Razorpay API fallback
    }

    console.log('[create-razorpay-order] Order created:', rzpOrder.id, 'for user:', user.id);

    return jsonResponse({
      id: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      key_id: keyId,
    }, 200, req);

  } catch (err) {
    console.error('[create-razorpay-order] Unexpected error:', err);
    return jsonResponse({ error: 'Internal server error' }, 500, req);
  }
});