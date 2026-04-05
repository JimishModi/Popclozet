// deno-lint-ignore-file
// @ts-nocheck
// supabase/functions/link-email/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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

function jsonResponse(body: Record<string, unknown>, status = 200, log?: ReturnType<typeof makeLogger>) {
  if (log) log.done(status);
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  const log = makeLogger('link-email');
  log.info('request started');

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, log);
  }

  // ── 1. Authenticate the caller via their JWT ──────────────────────────────
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonResponse({ error: 'Missing Authorization header' }, 401, log);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  // Verify the caller's JWT
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) {
    log.error('Invalid or expired token', { error: userError });
    return jsonResponse({ error: 'Invalid or expired token' }, 401, log);
  }

  // ── 2. Parse body ─────────────────────────────────────────────────────────
  const { email } = await req.json();
  if (!email || !email.includes('@')) {
    log.error('Valid email is required');
    return jsonResponse({ error: 'Valid email is required' }, 400, log);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ── 3. Find any existing user with this email ─────────────────────────────
  // The previous broken flow (signInWithOtp without shouldCreateUser:false) may
  // have already created a ghost user with this email. We need to delete it
  // before we can assign the email to the correct phone-auth user.
  const { data: { users }, error: listErr } = await adminClient.auth.admin.listUsers({ perPage: 1000 });

  if (listErr) {
    log.error('listUsers failed', { error: listErr });
    return jsonResponse({ error: 'Failed to check existing users' }, 500, log);
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
      log.warn('Email belongs to a real account', { conflictUserId: conflictUser.id });
      return jsonResponse({ error: 'This email is already linked to another account.' }, 409, log);
    }

    // Ghost user (no profile) — safe to delete
    log.info('Deleting ghost user', { conflictUserId: conflictUser.id, email });
    const { error: deleteErr } = await adminClient.auth.admin.deleteUser(conflictUser.id);
    if (deleteErr) {
      log.error('Failed to delete ghost user', { error: deleteErr });
      return jsonResponse({ error: 'Failed to clean up existing account. Please contact support.' }, 500, log);
    }
    log.info('Ghost user deleted successfully');
  }

  // ── 4. Update auth.users with the real email ──────────────────────────────
  const { error: updateError } = await adminClient.auth.admin.updateUserById(user.id, {
    email: email,
    email_confirm: false, // unconfirmed — user must click the magic link
  });

  if (updateError) {
    log.error('updateUserById failed', { error: updateError });
    return jsonResponse({ error: updateError.message }, 400, log);
  }

  // ── 5. Sync customer_profiles ─────────────────────────────────────────────
  await adminClient
    .from('customer_profiles')
    .update({ email, email_verified: false })
    .eq('user_id', user.id);

  log.info(`Successfully linked ${email} to user ${user.id}`);
  return jsonResponse({ success: true }, 200, log);
});