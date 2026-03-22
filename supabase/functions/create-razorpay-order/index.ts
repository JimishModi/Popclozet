// deno-lint-ignore-file
// @ts-nocheck
// supabase/functions/create-razorpay-order/index.ts
//
// Creates a Razorpay order securely on the server.
// The Key Secret never reaches the browser.
//
// Deploy:  supabase functions deploy create-razorpay-order
// Use supabase secrets set to configure credentials
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
    const { amount, receipt, notes } = await req.json();

    if (!amount || typeof amount !== 'number' || amount < 100) {
      return jsonResponse({ error: 'Invalid amount. Must be in paise (min 100).' }, 400);
    }

    const keyId = Deno.env.get('RAZORPAY_KEY_ID');
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');

    if (!keyId || !keySecret) {
      console.error('[create-razorpay-order] Razorpay credentials not configured');
      return jsonResponse({ error: 'Payment service not configured' }, 500);
    }

    // Create order via Razorpay REST API
    const credentials = btoa(`${keyId}:${keySecret}`);

    const razorpayRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${credentials}`,
      },
      body: JSON.stringify({
        amount: Math.round(amount), // paise
        currency: 'INR',
        receipt: receipt || `receipt_${Date.now()}`,
        notes: notes || {},
      }),
    });

    if (!razorpayRes.ok) {
      const errText = await razorpayRes.text();
      console.error('[create-razorpay-order] Razorpay API error:', errText);
      return jsonResponse({ error: 'Failed to create payment order', details: errText }, 502);
    }

    const rzpOrder = await razorpayRes.json();
    console.log('[create-razorpay-order] Order created:', rzpOrder.id);

    // Return order details + key_id (public) to frontend
    return jsonResponse({
      id: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      key_id: keyId,
    }, 200);

  } catch (err) {
    console.error('[create-razorpay-order] Unexpected error:', err);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
});
