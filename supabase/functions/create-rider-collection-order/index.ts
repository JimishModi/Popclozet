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

Deno.serve(async (req: Request) => {
  const log = makeLogger('create-rider-collection-order');

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

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { receipt, notes } = await req.json();
    if (!receipt) {
      return jsonResponse({ error: 'Missing receipt (order ID)' }, 400, req, log);
    }

    const { data: order, error: orderError } = await adminClient
      .from('orders')
      .select('id, user_id, rider_id, total_amount, status, payment_method, razorpay_order_id')
      .eq('id', receipt)
      .single();

    if (orderError || !order) {
      return jsonResponse({ error: 'Order not found' }, 404, req, log);
    }

    if (order.rider_id !== user.id) {
      return jsonResponse({ error: 'Only the assigned rider can collect payment' }, 403, req, log);
    }

    if (order.payment_method !== 'cod') {
      return jsonResponse({ error: 'Only pay-on-delivery orders can be collected here' }, 409, req, log);
    }

    if (!['order_picked_up', 'dispatched', 'out_for_delivery', 'delivered'].includes(order.status)) {
      return jsonResponse({ error: `Order is in state '${order.status}' and cannot be paid here` }, 409, req, log);
    }

    const { data: existingPayment } = await adminClient
      .from('payments')
      .select('status')
      .eq('order_id', receipt)
      .eq('status', 'completed')
      .maybeSingle();

    if (existingPayment?.status === 'completed') {
      return jsonResponse({ error: 'Order payment already completed' }, 409, req, log);
    }

    const expectedPaise = Math.round(Number(order.total_amount || 0) * 100);
    if (expectedPaise < 100) {
      return jsonResponse({ error: 'Order total is too low to charge' }, 400, req, log);
    }

    const keyId = Deno.env.get('RAZORPAY_KEY_ID');
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
    if (!keyId || !keySecret) {
      return jsonResponse({ error: 'Payment service not configured' }, 500, req, log);
    }

    if (order.razorpay_order_id) {
      return jsonResponse({
        id: order.razorpay_order_id,
        amount: expectedPaise,
        currency: 'INR',
        key_id: keyId,
      }, 200, req, log);
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
        receipt,
        notes: {
          ...(notes || {}),
          supabase_order_id: receipt,
          payment_context: 'rider_collection',
          collected_by_rider_id: user.id,
        },
      }),
    });

    if (!razorpayRes.ok) {
      const errText = await razorpayRes.text();
      log.error('Razorpay API error', { errText });
      return jsonResponse({ error: 'Failed to create payment order' }, 502, req, log);
    }

    const rzpOrder = await razorpayRes.json();

    await adminClient
      .from('orders')
      .update({ razorpay_order_id: rzpOrder.id })
      .eq('id', receipt);

    return jsonResponse({
      id: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      key_id: keyId,
    }, 200, req, log);
  } catch (error) {
    log.error('Unexpected error', { error: String(error) });
    return jsonResponse({ error: 'Internal server error' }, 500, req, log);
  }
});
