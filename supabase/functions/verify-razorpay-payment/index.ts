// deno-lint-ignore-file
// @ts-nocheck
// supabase/functions/verify-razorpay-payment/index.ts
//
// Verifies the Razorpay payment signature using HMAC-SHA256.
// This is critical for security — never skip this step.
// On success, it marks the order as 'paid' in the database.
//
// Deploy:  supabase functions deploy verify-razorpay-payment
// Use supabase secrets set to configure credentials

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      internal_order_id, // Our Supabase order UUID
    } = await req.json();

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !internal_order_id) {
      return jsonResponse({ error: 'Missing required payment fields' }, 400);
    }

    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
    if (!keySecret) {
      console.error('[verify-razorpay-payment] RAZORPAY_KEY_SECRET not set');
      return jsonResponse({ error: 'Payment service not configured' }, 500);
    }

    // ── Verify HMAC-SHA256 signature ──────────────────────────
    // Razorpay's expected signature = HMAC_SHA256(razorpay_order_id + "|" + razorpay_payment_id, key_secret)
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

    if (generatedSignature !== razorpay_signature) {
      console.error('[verify-razorpay-payment] Signature mismatch! Possible tampering.');
      return jsonResponse({ error: 'Payment verification failed. Invalid signature.' }, 400);
    }

    console.log('[verify-razorpay-payment] Signature verified successfully for order:', internal_order_id);

    // ── Update order in Supabase DB ───────────────────────────
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Update order status
    const { error: orderErr } = await adminClient
      .from('orders')
      .update({
        status: 'paid',
        payment_method: 'razorpay',
      })
      .eq('id', internal_order_id);

    if (orderErr) {
      console.error('[verify-razorpay-payment] Failed to update order status:', orderErr);
      return jsonResponse({ error: 'Order update failed', details: orderErr.message }, 500);
    }

    // Record payment details for reconciliation
    const { error: paymentErr } = await adminClient
      .from('payments')
      .upsert({
        order_id: internal_order_id,
        provider: 'razorpay',
        status: 'paid',
        razorpay_order_id,
        razorpay_payment_id,
        amount: 0, // Will be updated from order
      }, { onConflict: 'order_id' });

    if (paymentErr) {
      // Non-fatal: log but don't fail the overall flow
      console.warn('[verify-razorpay-payment] Payment record upsert failed:', paymentErr);
    }

    return jsonResponse({ success: true, payment_id: razorpay_payment_id }, 200);

  } catch (err) {
    console.error('[verify-razorpay-payment] Unexpected error:', err);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
});
