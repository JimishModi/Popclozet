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

    const isBrowserRedirect = req.method === 'GET'
    const APP_ORIGIN = Deno.env.get('PUBLIC_APP_ORIGIN') || 'https://popclozet.in'

    // Helper: for browser GET redirects, send user to the customer app instead of returning JSON
    function browserRedirectOrJson(body: unknown, httpStatus: number, kycResult: string = 'success', customOrigin?: string, customPath?: string) {
      if (isBrowserRedirect) {
        const origin = customOrigin || Deno.env.get('PUBLIC_APP_ORIGIN') || 'https://popclozet.in'
        const path = customPath || '/profile'
        const redirectUrl = `${origin}/#${path}?kyc_callback=${kycResult}`
        log.info(`Redirecting browser to ${redirectUrl}`)
        return new Response(null, {
          status: 302,
          headers: { ...corsHeaders, 'Location': redirectUrl },
        })
      }
      return jsonResponse(body, httpStatus)
    }

    if (isBrowserRedirect) {
      // Didit redirects browser via GET with query params: ?verificationSessionId=...&status=...
      data = Object.fromEntries(url.searchParams.entries())
      log.info('Webhook GET (browser redirect) params', { params: data })
    } else {
      data = await req.json().catch(() => ({}))
      log.info('Webhook POST Payload', { payload: data })
    }

    const status = data?.status
    let userId = data?.vendor_data || data?.user_id
    let appOriginFromDb = null
    let callbackPathFromDb = null

    // PRIMARY: Look up user_id from our DB (most reliable — no external API dependency)
    if (!userId && data?.verificationSessionId) {
      const supabaseLookup = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )
      const { data: sessionRow } = await supabaseLookup
        .from('kyc_sessions')
        .select('user_id, app_origin, callback_path')
        .eq('didit_session_id', data.verificationSessionId)
        .maybeSingle()
      
      if (sessionRow) {
        userId = sessionRow.user_id
        appOriginFromDb = sessionRow.app_origin
        callbackPathFromDb = sessionRow.callback_path
        log.info(`Found session in kyc_sessions: user_id=${userId}, app_origin=${appOriginFromDb}, callback_path=${callbackPathFromDb}`)
      } else {
        log.warn(`Session ${data.verificationSessionId} not found in kyc_sessions table`)
      }
    }

    // FALLBACK: Try Didit API if DB lookup failed
    if (!userId && data?.verificationSessionId) {
      const DIDIT_API_KEY = Deno.env.get("DIDIT_API_KEY")
      if (DIDIT_API_KEY) {
        log.info(`Fetching session ${data.verificationSessionId} from Didit API (fallback)`)
        const sessionRes = await fetch(`https://verification.didit.me/v3/session/${data.verificationSessionId}/`, {
          headers: { 'x-api-key': DIDIT_API_KEY },
        })
        if (sessionRes.ok) {
          const sessionData = await sessionRes.json()
          userId = sessionData?.vendor_data
          log.info(`Got vendor_data from Didit API: ${userId}`)
        } else {
          log.error(`Didit API failed`, { status: sessionRes.status, body: await sessionRes.text().catch(() => '') })
        }
      } else {
        log.error('DIDIT_API_KEY not set — cannot fetch vendor_data from Didit API')
      }
    }

    if (!userId) {
      log.warn('Could not resolve user_id from DB or Didit API')
      log.done(200);
      // If browser redirect, still send user to app (they can refresh KYC from profile)
      return browserRedirectOrJson({ error: 'Missing user identification' }, 200, 'pending')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Handle SUCCESS
    if (['Approved', 'approved', 'success'].includes(status)) {
      log.info(`User ${userId} verified successfully. Updating DB...`)
      
      // 1. Update Profile
      const { error: profileError } = await supabase
        .from('customer_profiles')
        .update({ kyc_verified: true })
        .eq('user_id', userId)

      if (profileError) {
        log.error(`Profile update failed for user ${userId}`, { error: profileError })
      }

      // 2. Update Session Record
      if (data?.verificationSessionId) {
        await supabase
          .from('kyc_sessions')
          .update({ status: 'Approved', updated_at: new Date().toISOString() })
          .eq('didit_session_id', data.verificationSessionId)
      }

      log.info(`User ${userId} marked as kyc_verified=true`)
      log.done(200);
      return browserRedirectOrJson({ success: true, user_id: userId }, 200, 'success', appOriginFromDb, callbackPathFromDb)
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
      return browserRedirectOrJson({ status, user_id: userId }, 200, 'pending', appOriginFromDb, callbackPathFromDb)
    }

    // Handle REJECTION (v3: "Declined")
    if (['Rejected', 'rejected', 'failed', 'Declined', 'declined'].includes(status)) {
      log.warn(`User ${userId} verification REJECTED: ${status}`)
      
      // 1. Reset verification status
      const { error: updateError } = await supabase
        .from('customer_profiles')
        .update({ kyc_verified: false })
        .eq('user_id', userId)
        
      if (updateError) {
        log.error("Failed to reset verification status:", { error: updateError });
      }

      // 2. Update Session Record
      if (data?.verificationSessionId) {
        await supabase
          .from('kyc_sessions')
          .update({ status: 'Rejected', updated_at: new Date().toISOString() })
          .eq('didit_session_id', data.verificationSessionId)
      }
      
      log.done(200);
      return browserRedirectOrJson({ message: 'Rejection processed' }, 200, 'rejected', appOriginFromDb, callbackPathFromDb)
    }

    log.info(`Unhandled webhook status: ${status}`)
    log.done(200);
    return browserRedirectOrJson({ message: 'Unhandled status', status }, 200, 'pending', appOriginFromDb, callbackPathFromDb)

  } catch (error: any) {
    log.error(`Webhook handler error`, { error })
    log.done(500);
    return jsonResponse({ error: error?.message || 'Unknown error' }, 500)
  }
})
