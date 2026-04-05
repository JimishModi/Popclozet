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
    if (!userId || typeof userId !== 'string') {
      log.error('Missing or invalid user_id in callbackParams', { body })
      log.done(400);
      return jsonResponse({ error: 'Missing or invalid user_id in callbackParams' }, 400)
    }

    const callbackPath = callbackParams?.callback_path || '/checkout'

    const origin =
      req.headers.get('origin') ||
      Deno.env.get('PUBLIC_APP_ORIGIN') ||
      'https://popclozet.vercel.app' // Fallback to production origin

    // Didit API strictly rejects callback URLs containing '#' fragments.
    const callbackUrl = `${origin}${callbackPath}?kyc_callback=success&user_id=${encodeURIComponent(userId)}`

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
    log.info('Didit session created successfully', { session_id: data.session_id, hasUrl: !!verificationUrl })
    log.done(200);
    return jsonResponse({ ...data, verification_url: verificationUrl }, 200)
  } catch (error: any) {
    log.error('Unexpected error', { error })
    log.done(500);
    return jsonResponse({ error: error?.message || 'Unknown error' }, 500)
  }
})
