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

Deno.serve(async (req: Request) => {
  const requestId = crypto.randomUUID().slice(0, 8)
  console.log(`[${requestId}] create-kyc-session request started`)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (!DIDIT_API_KEY || !DIDIT_CLIENT_ID || !DIDIT_WORKFLOW_ID) {
    console.error(`[${requestId}] Missing environment variables`)
    return jsonResponse({
      error: 'Missing DIDIT_API_KEY, DIDIT_CLIENT_ID, or DIDIT_WORKFLOW_ID',
    }, 500)
  }

  try {
    const body = await req.json().catch(() => ({}))
    const { callbackParams } = body

    const userId = callbackParams?.user_id
    if (!userId || typeof userId !== 'string') {
      console.error(`[${requestId}] Missing or invalid user_id in callbackParams`, body)
      return jsonResponse({ error: 'Missing or invalid user_id in callbackParams' }, 400)
    }

    const callbackPath = callbackParams?.callback_path || '/checkout'

    const origin =
      req.headers.get('origin') ||
      Deno.env.get('PUBLIC_APP_ORIGIN') ||
      'https://popclozet.vercel.app' // Fallback to production origin
      
    // Didit API strictly rejects callback URLs containing '#' fragments.
    const callbackUrl = `${origin}${callbackPath}?kyc_callback=success&user_id=${encodeURIComponent(userId)}`

    console.log(`[${requestId}] Creating Didit session for user ${userId} with callback: ${callbackUrl}`)

    const response = await fetch('https://verification.didit.me/v3/session/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DIDIT_API_KEY}`,
      },
      body: JSON.stringify({
        client_id: DIDIT_CLIENT_ID,
        workflow_id: DIDIT_WORKFLOW_ID,
        callback: callbackUrl,
        vendor_data: userId,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error(`[${requestId}] Didit API error:`, data)
      return jsonResponse({ error: data }, response.status || 400)
    }

    console.log(`[${requestId}] Didit session created successfully:`, data.session_id)
    return jsonResponse(data, 200)
  } catch (error: any) {
    console.error(`[${requestId}] Unexpected error:`, error)
    return jsonResponse({ error: error?.message || 'Unknown error' }, 500)
  }
})
