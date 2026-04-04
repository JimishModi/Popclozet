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
const ALLOWED_ORIGINS = [
  'https://popclozet.com',
  'https://www.popclozet.com',
  'https://popclozet.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
];

function getAllowedOrigin(req: Request): string {
  const origin = req.headers.get('Origin') ?? '';
  return ALLOWED_ORIGINS.includes(origin) ? origin : 'null';
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

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ error: 'Unauthorized' }, 401, req);
    }

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      internal_order_id,
    } = await req.json();

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !internal_order_id) {
      return jsonResponse({ error: 'Missing required payment fields' }, 400, req);
    }

    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
    if (!keySecret) {
      console.error('[verify-razorpay-payment] RAZORPAY_KEY_SECRET not set');
      return jsonResponse({ error: 'Payment service not configured' }, 500, req);
    }

    // ── Verify ownership & state before doing crypto work ────
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: order, error: orderErr } = await adminClient
      .from('orders')
      .select('id, user_id, status, total_amount, razorpay_order_id')
      .eq('id', internal_order_id)
      .single();

    if (orderErr || !order) {
      console.error('[verify-razorpay-payment] Order not found:', internal_order_id);
      return jsonResponse({ error: 'Order not found' }, 404, req);
    }

    if (order.user_id !== user.id) {
      console.error('[verify-razorpay-payment] User mismatch:', { caller: user.id, owner: order.user_id });
      return jsonResponse({ error: 'Forbidden' }, 403, req);
    }

    // Idempotent: if already paid/confirmed, return success without re-processing
    if (['paid', 'confirmed', 'packed', 'ready_for_pickup'].includes(order.status)) {
      console.log('[verify-razorpay-payment] Order already processed:', internal_order_id, order.status);
      return jsonResponse({ success: true, payment_id: razorpay_payment_id, already_processed: true }, 200, req);
    }

    // Only allow verification from valid pre-payment states
    if (!['pending', 'pending_payment'].includes(order.status)) {
      console.error('[verify-razorpay-payment] Invalid order state for payment:', order.status);
      return jsonResponse({ error: `Order is in state '${order.status}' and cannot be verified` }, 409, req);
    }

    // ── Anti-substitution: verify razorpay_order_id matches ──
    // Prevents an attacker from using a valid signature from order A to verify order B
    if (order.razorpay_order_id && order.razorpay_order_id !== razorpay_order_id) {
      console.error('[verify-razorpay-payment] Razorpay order ID mismatch:', {
        stored: order.razorpay_order_id,
        received: razorpay_order_id,
      });
      return jsonResponse({ error: 'Payment order mismatch. Possible tampering.' }, 400, req);
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
      console.error('[verify-razorpay-payment] Signature mismatch! Possible tampering.');
      return jsonResponse({ error: 'Payment verification failed. Invalid signature.' }, 400, req);
    }

    console.log('[verify-razorpay-payment] Signature verified for order:', internal_order_id);

    // ── Atomic DB update: order status + payment record ───────
    const { data: result, error: rpcErr } = await adminClient.rpc('verify_payment_and_update', {
      p_order_id: internal_order_id,
      p_razorpay_order_id: razorpay_order_id,
      p_razorpay_payment_id: razorpay_payment_id,
      p_provider: 'razorpay',
    });

    if (rpcErr) {
      console.error('[verify-razorpay-payment] RPC error:', rpcErr);
      return jsonResponse({ error: 'Order update failed', details: rpcErr.message }, 500, req);
    }

    if (result && !result.success) {
      console.error('[verify-razorpay-payment] RPC returned failure:', result);
      return jsonResponse({ error: result.message || 'Order update failed' }, 500, req);
    }

    return jsonResponse({ success: true, payment_id: razorpay_payment_id }, 200, req);

  } catch (err) {
    console.error('[verify-razorpay-payment] Unexpected error:', err);
    return jsonResponse({ error: 'Internal server error' }, 500, req);
  }
});
