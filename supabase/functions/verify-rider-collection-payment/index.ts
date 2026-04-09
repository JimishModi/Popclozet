// deno-lint-ignore-file
// @ts-nocheck

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function getAllowedOrigin(req: Request): string {
  return req.headers.get('Origin') || '*';
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
    info: (msg: string, extra?: Record<string, unknown>) =>
      console.log(meta({ level: 'info', msg, ...extra })),
    error: (msg: string, extra?: Record<string, unknown>) =>
      console.error(meta({ level: 'error', msg, ...extra })),
    done: (status: number) =>
      console.log(meta({ level: 'info', msg: 'complete', status, ms: Math.round(performance.now() - t0) })),
  };
}

function jsonResponse(body: Record<string, unknown>, status: number, req: Request, log?: ReturnType<typeof makeLogger>) {
  if (log) log.done(status);
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  });
}

function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);
  const len = Math.max(bufA.length, bufB.length);
  let mismatch = bufA.length === bufB.length ? 0 : 1;

  for (let i = 0; i < len; i++) {
    mismatch |= (bufA[i % bufA.length] ?? 0) ^ (bufB[i % bufB.length] ?? 0);
  }

  return mismatch === 0;
}

Deno.serve(async (req: Request) => {
  const log = makeLogger('verify-rider-collection-payment');

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, req, log);
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Missing authorization header' }, 401, req, log);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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
      return jsonResponse({ error: 'Payment service not configured' }, 500, req, log);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: order, error: orderError } = await adminClient
      .from('orders')
      .select('id, rider_id, status, payment_method, razorpay_order_id')
      .eq('id', internal_order_id)
      .single();

    if (orderError || !order) {
      return jsonResponse({ error: 'Order not found' }, 404, req, log);
    }

    if (order.rider_id !== user.id) {
      return jsonResponse({ error: 'Only the assigned rider can verify payment' }, 403, req, log);
    }

    if (order.payment_method !== 'cod') {
      return jsonResponse({ error: 'Only pay-on-delivery orders can be collected here' }, 409, req, log);
    }

    if (order.razorpay_order_id && order.razorpay_order_id !== razorpay_order_id) {
      return jsonResponse({ error: 'Payment order mismatch. Possible tampering.' }, 400, req, log);
    }

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
      .map((value) => value.toString(16).padStart(2, '0'))
      .join('');

    if (!timingSafeEqual(generatedSignature, razorpay_signature)) {
      return jsonResponse({ error: 'Payment verification failed. Invalid signature.' }, 400, req, log);
    }

    const { data: result, error: rpcError } = await adminClient.rpc('verify_pod_payment_and_update', {
      p_order_id: internal_order_id,
      p_razorpay_order_id: razorpay_order_id,
      p_razorpay_payment_id: razorpay_payment_id,
      p_provider: 'razorpay',
      p_actor_id: user.id,
    });

    if (rpcError) {
      return jsonResponse({ error: 'Order update failed', details: rpcError.message }, 500, req, log);
    }

    if (result && !result.success) {
      return jsonResponse({ error: result.message || 'Order update failed' }, 500, req, log);
    }

    return jsonResponse({ success: true, payment_id: razorpay_payment_id }, 200, req, log);
  } catch (error) {
    log.error('Unexpected error', { error: String(error) });
    return jsonResponse({ error: 'Internal server error' }, 500, req, log);
  }
});
