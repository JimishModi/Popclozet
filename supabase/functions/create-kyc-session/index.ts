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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (!DIDIT_API_KEY || !DIDIT_CLIENT_ID || !DIDIT_WORKFLOW_ID) {
    return jsonResponse({
      error: 'Missing DIDIT_API_KEY, DIDIT_CLIENT_ID, or DIDIT_WORKFLOW_ID',
    }, 500)
  }

  try {
    const { callbackParams } = await req.json()

    const origin =
      req.headers.get('origin') ||
      Deno.env.get('PUBLIC_APP_ORIGIN') ||
      'http://localhost:5500'
    const callbackUrl = `${origin}/checkout?kyc_callback=success&user_id=${callbackParams?.user_id}`

    console.log("Creating Didit session with callback:", callbackUrl)

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
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error("Didit API error:", data)
      return jsonResponse({ error: data }, 400)
    }

    return jsonResponse(data, 200)
  } catch (error: any) {
    return jsonResponse({ error: error?.message || 'Unknown error' }, 400)
  }
})
