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
  const requestId = crypto.randomUUID().slice(0, 8)
  console.log(`[${requestId}] didit-webhook received request`)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const data = await req.json().catch(() => ({}))
    console.log(`[${requestId}] Webhook Payload:`, JSON.stringify(data, null, 2))

    const status = data?.status
    const userId = data?.vendor_data || data?.user_id

    if (!userId) {
      console.warn(`[${requestId}] Webhook missing user identification (vendor_data/user_id)`)
      return jsonResponse({ error: 'Missing user identification' }, 200) // Always 200 to Didit to prevent retries of invalid data
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Handle SUCCESS
    if (['Approved', 'approved', 'success'].includes(status)) {
      console.log(`[${requestId}] User ${userId} verified successfully. Updating DB...`)
      
      const { error } = await supabase
        .from('customer_profiles')
        .update({ kyc_verified: true })
        .eq('user_id', userId)

      if (error) {
        console.error(`[${requestId}] DB Update failed for user ${userId}:`, error)
        return jsonResponse({ error: 'Database update failed' }, 500)
      }

      console.log(`[${requestId}] User ${userId} marked as kyc_verified=true`)
      return jsonResponse({ success: true, user_id: userId }, 200)
    }

    // Handle MANUAL REVIEW
    if (status === 'Review' || status === 'review' || status === 'pending') {
      const decision = data?.decision?.decision
      console.log(`[${requestId}] User ${userId} status: ${status}, Decision: ${decision}`)

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
          console.error(`[${requestId}] Failed to record manual review for ${userId}:`, insertError)
        } else {
          console.log(`[${requestId}] Manual review recorded for ${userId}`)
        }
      }
      
      return jsonResponse({ status, user_id: userId }, 200)
    }

    // Handle REJECTION
    if (['Rejected', 'rejected', 'failed'].includes(status)) {
      console.warn(`[${requestId}] User ${userId} verification REJECTED:`, status)
      // Optionally reset verification status if it was previously true
      await supabase
        .from('customer_profiles')
        .update({ kyc_verified: false })
        .eq('user_id', userId)
        
      if (reviewError) {
        console.error("[Didit Webhook] Failed to insert manual review record:", reviewError);
      }
      
      return jsonResponse({ message: 'Manual review recorded' }, 200)
    }

    console.log(`[${requestId}] Unhandled webhook status: ${status}`)
    return jsonResponse({ message: 'Unhandled status', status }, 200)

  } catch (error: any) {
    console.error(`[${requestId}] Webhook handler error:`, error)
    return jsonResponse({ error: error?.message || 'Unknown error' }, 500)
  }
})
