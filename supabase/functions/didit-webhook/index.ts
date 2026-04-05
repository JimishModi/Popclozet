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
    let data: any = {}
    const url = new URL(req.url)

    if (req.method === 'GET') {
      // Didit redirects via GET with query params: ?verificationSessionId=...&status=...
      data = Object.fromEntries(url.searchParams.entries())
      log.info('Webhook GET params', { params: data })
    } else {
      data = await req.json().catch(() => ({}))
      log.info('Webhook POST Payload', { payload: data })
    }

    const status = data?.status
    let userId = data?.vendor_data || data?.user_id

    // If no userId but we have a session ID, fetch it from Didit API
    if (!userId && data?.verificationSessionId) {
      const DIDIT_API_KEY = Deno.env.get("DIDIT_API_KEY")
      if (DIDIT_API_KEY) {
        log.info(`Fetching session ${data.verificationSessionId} from Didit to get vendor_data`)
        const sessionRes = await fetch(`https://verification.didit.me/v3/session/${data.verificationSessionId}/`, {
          headers: { 'x-api-key': DIDIT_API_KEY },
        })
        if (sessionRes.ok) {
          const sessionData = await sessionRes.json()
          userId = sessionData?.vendor_data
          log.info(`Got vendor_data from session: ${userId}`)
        } else {
          log.error(`Failed to fetch session from Didit`, { status: sessionRes.status })
        }
      }
    }

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

    // Handle MANUAL REVIEW (v3: "In Review")
    if (['Review', 'review', 'pending', 'In Review'].includes(status)) {
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

    // Handle REJECTION (v3: "Declined")
    if (['Rejected', 'rejected', 'failed', 'Declined', 'declined'].includes(status)) {
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
