// deno-lint-ignore-file
// @ts-nocheck

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

  try {
    const body = await req.json()

    // Didit sends session_id and status in webhook
    const { session_id, status, vendor_data } = body

    console.log("[Didit Webhook] Received:", { session_id, status, vendor_data })

    // Only process successful verifications
    if (status !== 'Approved' && status !== 'approved' && status !== 'success') {
      console.log("[Didit Webhook] Skipping non-approved status:", status)
      return jsonResponse({ message: 'Skipped' }, 200)
    }

    // vendor_data contains the user_id we passed when creating the session
    // Didit also sends it in the callback URL params
    const userId = vendor_data || body?.user_id || body?.callback_params?.user_id

    if (!userId) {
      console.error("[Didit Webhook] No user_id found in webhook payload")
      return jsonResponse({ error: 'No user_id in payload' }, 400)
    }

    // Update DB using service role key (server-side)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { error } = await supabaseAdmin
      .from('customer_profiles')
      .update({ kyc_verified: true })
      .eq('user_id', userId)

    if (error) {
      console.error("[Didit Webhook] DB update failed:", error)
      return jsonResponse({ error: 'Failed to update verification status' }, 500)
    }

    console.log("[Didit Webhook] Successfully verified user:", userId)
    return jsonResponse({ message: 'Verification recorded' }, 200)

  } catch (error: any) {
    console.error("[Didit Webhook] Error:", error)
    return jsonResponse({ error: error?.message || 'Unknown error' }, 400)
  }
})
