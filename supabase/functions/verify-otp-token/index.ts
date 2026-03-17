// deno-lint-ignore-file
// @ts-nocheck
// supabase/functions/verify-otp-token/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: Record<string, unknown>, status: number) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
}

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
    }
    if (req.method !== 'POST') {
        return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    try {
        // ── 1. Parse body ────────────────────────────────────────────────────
        const { accessToken, mobile } = await req.json();
        if (!accessToken || !mobile) {
            return jsonResponse({ error: 'accessToken and mobile are required' }, 400);
        }

        // ── 2. Verify MSG91 token ────────────────────────────────────────────
        const msg91AuthKey = Deno.env.get('MSG91_AUTH_KEY');
        if (!msg91AuthKey) {
            console.error('[verify-otp-token] MSG91_AUTH_KEY not set');
            return jsonResponse({ error: 'Server configuration error' }, 500);
        }

        const msg91Res = await fetch('https://control.msg91.com/api/v5/widget/verifyAccessToken', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ authkey: msg91AuthKey, 'access-token': accessToken }),
        });

        const msg91Data = await msg91Res.json();
        console.log('[verify-otp-token] MSG91 response:', JSON.stringify(msg91Data));

        if (msg91Data.type !== 'success') {
            return jsonResponse({ error: 'OTP verification failed', details: msg91Data.message }, 401);
        }

        // ── 3. Supabase admin client ─────────────────────────────────────────
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const adminClient = createClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        // ── 4. Normalise phone — generate all possible formats ───────────────
        const rawDigits = mobile.replace(/\D/g, '');
        const digitsWithCountry = rawDigits.startsWith('91') ? rawDigits : `91${rawDigits}`;
        const phoneE164 = `+${digitsWithCountry}`;   // +917999284151
        const phoneRaw = digitsWithCountry;          // 917999284151

        console.log(`[verify-otp-token] Looking up phone: ${phoneE164} or ${phoneRaw}`);

        // ── 5. Look up ONLY in customer_profiles — both phone formats ─────────
        console.log('[verify-otp-token] CP 1: Looking up in customer_profiles');
        let userId: string | undefined;

        const { data: profileRows } = await adminClient
            .from('customer_profiles')
            .select('user_id')
            .or(`phone.eq.${phoneE164},phone.eq.${phoneRaw}`)
            .limit(1);

        if (profileRows && profileRows.length > 0) {
            userId = profileRows[0].user_id;
            console.log('[verify-otp-token] Found existing user in customer_profiles:', userId);
        }        // ── 5.5 Look up in auth.users via admin API if not found in profiles ──
        if (!userId) {
            console.log('[verify-otp-token] CP 2: Looking up in auth.users via Admin API');
            
            // We list users to find matching phone. Safe for small to medium scale.
            const { data: { users }, error: listErr } = await adminClient.auth.admin.listUsers();
            
            if (listErr) {
                console.warn('[verify-otp-token] listUsers warning:', JSON.stringify(listErr));
            } else {
                const existingUser = users?.find(u => 
                    u.phone === phoneE164 || u.phone === phoneRaw
                );
                
                if (existingUser) {
                    userId = existingUser.id;
                    console.log('[verify-otp-token] Found existing user in auth.users:', userId);
                }
            }
        }

        // ── 6. Create new user if not found ──────────────────────────────────
        if (!userId) {
            console.log('[verify-otp-token] CP 3: Creating new user');
            console.log('[verify-otp-token] New user — creating auth.users entry for:', phoneE164);

            const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
                phone: phoneE164,
                phone_confirm: true,
            });

            if (createErr || !newUser?.user) {
                console.error('[verify-otp-token] createUser failed:', JSON.stringify(createErr));
                return jsonResponse({
                    error: 'Failed to create user account',
                    details: createErr?.message
                }, 500);
            }

            userId = newUser.user.id;
            console.log('[verify-otp-token] Created new user:', userId);
        } else {
            // Confirm phone for existing user
            console.log('[verify-otp-token] CP 4: Updating existing user phone_confirm');
            await adminClient.auth.admin.updateUserById(userId, {
                phone: phoneE164,
                phone_confirm: true,
            });
            console.log('[verify-otp-token] Confirmed phone for existing user:', userId);
        }

        // ── 7. Generate session via magic link ───────────────────────────────
        console.log('[verify-otp-token] CP 5: Generating magic link session');

        // Check if user already has a "real" email
        const { data: { user: currentUser }, error: getErr } = await adminClient.auth.admin.getUserById(userId);
        const hasRealEmail = currentUser?.email && !currentUser.email.endsWith('@phone.popclozet.internal');
        
        const loginEmail = hasRealEmail ? currentUser.email : `${digitsWithCountry}@phone.popclozet.internal`;

        if (!hasRealEmail) {
            console.log('[verify-otp-token] CP 6: Updating user with temp email:', loginEmail);
            const { error: updateEmailErr } = await adminClient.auth.admin.updateUserById(userId, {
                email: loginEmail,
                email_confirm: true,
            });
            if (updateEmailErr) {
                console.error('[verify-otp-token] updateEmailErr failed:', JSON.stringify(updateEmailErr));
            }
        } else {
            console.log('[verify-otp-token] CP 6: Using existing real email:', loginEmail);
        }

        console.log('[verify-otp-token] CP 7: Calling generateLink for:', loginEmail);
        const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
            type: 'magiclink',
            email: loginEmail,
        });

        if (linkErr || !linkData) {
            console.error('[verify-otp-token] generateLink failed:', JSON.stringify(linkErr));
            return jsonResponse({
                success: true, userId, phone: phoneE164,
                message: 'Phone verified but session generation failed.',
            }, 200);
        }

        console.log('[verify-otp-token] CP 8: Calling verifyOtp');
        const { data: sessionData, error: verifyErr } = await adminClient.auth.verifyOtp({
            token_hash: linkData.properties?.hashed_token,
            type: 'magiclink',
        });

        if (verifyErr || !sessionData?.session) {
            console.error('[verify-otp-token] verifyOtp failed:', JSON.stringify(verifyErr));
            return jsonResponse({
                success: true, userId, phone: phoneE164,
                message: 'Phone verified but session creation failed.',
            }, 200);
        }

        // ── 8. Return session ────────────────────────────────────────────────
        console.log('[verify-otp-token] CP 9: Success');
        return jsonResponse({
            success: true,
            session: {
                access_token: sessionData.session.access_token,
                refresh_token: sessionData.session.refresh_token,
                expires_in: sessionData.session.expires_in,
                token_type: sessionData.session.token_type,
            },
            user: {
                id: sessionData.session.user.id,
                phone: sessionData.session.user.phone,
            },
        }, 200);

    } catch (err) {
        console.error('[verify-otp-token] CP X: Unexpected error:', err);
        return jsonResponse({ error: 'Internal server error', details: String(err) }, 500);
    }
});