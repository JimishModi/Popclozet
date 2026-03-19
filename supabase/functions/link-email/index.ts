// deno-lint-ignore-file
// @ts-nocheck
// supabase/functions/link-email/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  // ── 1. Authenticate the caller via their JWT ──────────────────────────────
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonResponse({ error: 'Missing Authorization header' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  // Verify the caller's JWT
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return jsonResponse({ error: 'Invalid or expired token' }, 401);

  // ── 2. Parse body ─────────────────────────────────────────────────────────
  const { email } = await req.json();
  if (!email || !email.includes('@')) return jsonResponse({ error: 'Valid email is required' }, 400);

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ── 3. Find any existing user with this email ─────────────────────────────
  // The previous broken flow (signInWithOtp without shouldCreateUser:false) may
  // have already created a ghost user with this email. We need to delete it
  // before we can assign the email to the correct phone-auth user.
  const { data: { users }, error: listErr } = await adminClient.auth.admin.listUsers({ perPage: 1000 });

  if (listErr) {
    console.error('[link-email] listUsers failed:', listErr);
    return jsonResponse({ error: 'Failed to check existing users' }, 500);
  }

  const conflictUser = users?.find(u => u.email === email && u.id !== user.id);

  if (conflictUser) {
    // Check if it's a real account (has a profile) or just a ghost
    const { data: conflictProfile } = await adminClient
      .from('customer_profiles')
      .select('user_id')
      .eq('user_id', conflictUser.id)
      .maybeSingle();

    if (conflictProfile) {
      // Real account with a profile — cannot reassign this email
      console.warn('[link-email] Email belongs to a real account:', conflictUser.id);
      return jsonResponse({ error: 'This email is already linked to another account.' }, 409);
    }

    // Ghost user (no profile) — safe to delete
    console.log('[link-email] Deleting ghost user:', conflictUser.id, 'for email:', email);
    const { error: deleteErr } = await adminClient.auth.admin.deleteUser(conflictUser.id);
    if (deleteErr) {
      console.error('[link-email] Failed to delete ghost user:', deleteErr);
      return jsonResponse({ error: 'Failed to clean up existing account. Please contact support.' }, 500);
    }
    console.log('[link-email] Ghost user deleted successfully');
  }

  // ── 4. Update auth.users with the real email ──────────────────────────────
  const { error: updateError } = await adminClient.auth.admin.updateUserById(user.id, {
    email: email,
    email_confirm: false, // unconfirmed — user must click the magic link
  });

  if (updateError) {
    console.error('[link-email] updateUserById failed:', updateError);
    return jsonResponse({ error: updateError.message }, 400);
  }

  // ── 5. Sync customer_profiles ─────────────────────────────────────────────
  await adminClient
    .from('customer_profiles')
    .update({ email, email_verified: false })
    .eq('user_id', user.id);

  console.log(`[link-email] Successfully linked ${email} to user ${user.id}`);
  return jsonResponse({ success: true });
});