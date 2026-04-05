// deno-lint-ignore-file
// @ts-nocheck

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  })
}

Deno.serve(async (req: Request) => {
  const log = makeLogger('didit-webhook');
  log.info('received request');

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const data = await req.json().catch(() => ({}))
    log.info('Webhook Payload', { payload: data })

    const status = data?.status
    const userId = data?.vendor_data || data?.user_id

    if (!userId) {
      log.warn('Webhook missing user identification (vendor_data/user_id)')
      log.done(200);
      return jsonResponse({ error: 'Missing user identification' }, 200) // Always 200 to Didit to prevent retries of invalid data
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Handle SUCCESS
    if (['Approved', 'approved', 'success'].includes(status)) {
      log.info(`User ${userId} verified successfully. Updating DB...`)
      
      const { error } = await supabase
        .from('customer_profiles')
        .update({ kyc_verified: true })
        .eq('user_id', userId)

      if (error) {
        log.error(`DB Update failed for user ${userId}`, { error })
        log.done(500);
        return jsonResponse({ error: 'Database update failed' }, 500)
      }

      log.info(`User ${userId} marked as kyc_verified=true`)
      log.done(200);
      return jsonResponse({ success: true, user_id: userId }, 200)
    }

    // Handle MANUAL REVIEW
    if (status === 'Review' || status === 'review' || status === 'pending') {
      const decision = data?.decision?.decision
      log.info(`User ${userId} status: ${status}, Decision: ${decision}`)

      if (decision === 'Manual') {
        const { error: insertError } = await supabase
          .from('manual_kyc_reviews')
          .insert({
            user_id: userId,
            status: status,
            manual_status: decision,
            vendor_data: data
          })

        if (insertError) {
          log.error(`Failed to record manual review for ${userId}`, { error: insertError })
        } else {
          log.info(`Manual review recorded for ${userId}`)
        }
      }
      
      log.done(200);
      return jsonResponse({ status, user_id: userId }, 200)
    }

    // Handle REJECTION
    if (['Rejected', 'rejected', 'failed'].includes(status)) {
      log.warn(`User ${userId} verification REJECTED: ${status}`)
      // Optionally reset verification status if it was previously true
      const { error: updateError } = await supabase
        .from('customer_profiles')
        .update({ kyc_verified: false })
        .eq('user_id', userId)
        
      if (updateError) {
        log.error("Failed to reset verification status:", { error: updateError });
      }
      
      log.done(200);
      return jsonResponse({ message: 'Rejection processed' }, 200)
    }

    log.info(`Unhandled webhook status: ${status}`)
    log.done(200);
    return jsonResponse({ message: 'Unhandled status', status }, 200)

  } catch (error: any) {
    log.error(`Webhook handler error`, { error })
    log.done(500);
    return jsonResponse({ error: error?.message || 'Unknown error' }, 500)
  }
})
