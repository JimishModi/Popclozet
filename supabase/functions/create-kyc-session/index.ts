// deno-lint-ignore-file
// @ts-nocheck

const DIDIT_API_KEY = Deno.env.get("DIDIT_API_KEY")
const DIDIT_CLIENT_ID = Deno.env.get("DIDIT_CLIENT_ID")
const DIDIT_WORKFLOW_ID = Deno.env.get("DIDIT_WORKFLOW_ID")

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  })
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

Deno.serve(async (req: Request) => {
  const log = makeLogger('create-kyc-session');
  log.info('request started');

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (!DIDIT_API_KEY || !DIDIT_CLIENT_ID || !DIDIT_WORKFLOW_ID) {
    log.error('Missing environment variables')
    log.done(500);
    return jsonResponse({
      error: 'Missing DIDIT_API_KEY, DIDIT_CLIENT_ID, or DIDIT_WORKFLOW_ID',
    }, 500)
  }

  try {
    const body = await req.json().catch(() => ({}))
    const { callbackParams } = body

    const userId = callbackParams?.user_id
    const appOrigin = callbackParams?.app_origin
    const callbackPath = callbackParams?.callback_path
    if (!userId || typeof userId !== 'string') {
      log.error('Missing or invalid user_id in callbackParams', { body })
      log.done(400);
      return jsonResponse({ error: 'Missing or invalid user_id in callbackParams' }, 400)
    }

    // callback = browser redirect URL after verification
    // We point this to our didit-webhook function so it can update the DB before sending the user back to the app
    const callbackUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/didit-webhook`

    log.info(`Creating Didit session for user ${userId} with callback: ${callbackUrl}`)

    // Create verification session using x-api-key auth
    const response = await fetch('https://verification.didit.me/v3/session/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': DIDIT_API_KEY!,
      },
      body: JSON.stringify({
        workflow_id: DIDIT_WORKFLOW_ID,
        callback: callbackUrl,
        vendor_data: userId,
      }),
    })

    let data: any
    const responseText = await response.text()
    try { data = JSON.parse(responseText) } catch { data = { raw: responseText } }

    if (!response.ok) {
      log.error('Didit API error', { status: response.status, data })
      log.done(500);
      return jsonResponse({ error: 'Didit session creation failed', didit_status: response.status, details: data }, 500)
    }

    // Didit returns session URL — map to verification_url for frontend
    const verificationUrl = data.url || data.verification_url || data.session_url
    const diditSessionId = data.session_id || data.id

    // Store session → user mapping in our DB so webhook can look it up locally
    if (diditSessionId) {
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )
      const { error: insertErr } = await supabase
        .from('kyc_sessions')
        .insert({ didit_session_id: diditSessionId, user_id: userId, app_origin: appOrigin, callback_path: callbackPath })
      
      if (insertErr) {
        log.warn('Failed to store kyc_session mapping (non-fatal)', { error: insertErr })
      } else {
        log.info(`Stored kyc_session mapping: ${diditSessionId} → ${userId}`)
      }
    }

    log.info('Didit session created successfully', { session_id: diditSessionId, hasUrl: !!verificationUrl })
    log.done(200);
    return jsonResponse({ ...data, verification_url: verificationUrl }, 200)
  } catch (error: any) {
    log.error('Unexpected error', { error })
    log.done(500);
    return jsonResponse({ error: error?.message || 'Unknown error' }, 500)
  }
})
