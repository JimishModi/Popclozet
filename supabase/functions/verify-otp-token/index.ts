// deno-lint-ignore-file
// @ts-nocheck
// supabase/functions/verify-otp-token/index.ts
//
// Verifies MSG91 OTP access token server-side, then finds or creates
// a Supabase user and returns a session.
//
// Deploy:  supabase functions deploy verify-otp-token
// Secrets: supabase secrets set MSG91_AUTH_KEY=<your-auth-key>

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
    // CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (req.method !== 'POST') {
        return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    try {
        // ── 1. Parse request body ──────────────────────────────
        const { accessToken, mobile } = await req.json();

        if (!accessToken || !mobile) {
            return jsonResponse({ error: 'accessToken and mobile are required' }, 400);
        }

        // ── 2. Verify token with MSG91 ─────────────────────────
        const msg91AuthKey = Deno.env.get('MSG91_AUTH_KEY');
        if (!msg91AuthKey) {
            console.error('[verify-otp-token] MSG91_AUTH_KEY secret is not set');
            return jsonResponse({ error: 'Server configuration error' }, 500);
        }

        const msg91Res = await fetch(
            'https://control.msg91.com/api/v5/widget/verifyAccessToken',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    authkey: msg91AuthKey,
                    'access-token': accessToken,
                }),
            },
        );

        const msg91Data = await msg91Res.json();
        console.log('[verify-otp-token] MSG91 response:', JSON.stringify(msg91Data));

        if (msg91Data.type !== 'success') {
            return jsonResponse(
                { error: 'OTP verification failed', details: msg91Data.message },
                401,
            );
        }

        // ── 3. Supabase Admin client ───────────────────────────
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

        const adminClient = createClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        // Normalise to E.164 (+91XXXXXXXXXX)
        const rawDigits = mobile.replace(/\D/g, '');
        const phone = rawDigits.startsWith('91') ? `+${rawDigits}` : `+91${rawDigits}`;

        // ── 4. Find or create user ─────────────────────────────
        let userId: string | undefined;

        // Search for existing user by phone
        try {
            const { data: allUsers } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
            const found = allUsers?.users?.find((u: { phone?: string }) => u.phone === phone);
            userId = found?.id;
        } catch (err) {
            console.warn('[verify-otp-token] listUsers failed:', err);
        }

        if (!userId) {
            // Create new user
            const { data: newUser, error: createErr } =
                await adminClient.auth.admin.createUser({
                    phone,
                    phone_confirm: true,
                });

            if (createErr || !newUser?.user) {
                console.error('[verify-otp-token] createUser failed:', createErr);
                return jsonResponse({ error: 'Failed to create user account' }, 500);
            }

            userId = newUser.user.id;
            console.log('[verify-otp-token] Created new user:', userId);
        } else {
            // Ensure phone is confirmed for existing user
            await adminClient.auth.admin.updateUserById(userId, {
                phone,
                phone_confirm: true,
            });
            console.log('[verify-otp-token] Found existing user:', userId);
        }

        // ── 5. Generate session via magic link ─────────────────
        const tempEmail = `${rawDigits}@phone.popclozet.internal`;

        await adminClient.auth.admin.updateUserById(userId, {
            email: tempEmail,
            email_confirm: true,
        });

        const { data: linkData, error: linkErr } =
            await adminClient.auth.admin.generateLink({
                type: 'magiclink',
                email: tempEmail,
            });

        if (linkErr || !linkData) {
            console.error('[verify-otp-token] generateLink failed:', linkErr);
            return jsonResponse({
                success: true,
                userId,
                phone,
                message: 'Phone verified but session generation failed — use userId for manual auth.',
            }, 200);
        }

        const { data: sessionData, error: verifyErr } =
            await adminClient.auth.verifyOtp({
                token_hash: linkData.properties?.hashed_token,
                type: 'magiclink',
            });

        if (verifyErr || !sessionData?.session) {
            console.error('[verify-otp-token] verifyOtp failed:', verifyErr);
            return jsonResponse({
                success: true,
                userId,
                phone,
                message: 'Phone verified but session creation failed — use userId for manual auth.',
            }, 200);
        }

        // ── 6. Return session to frontend ──────────────────────
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
        console.error('[verify-otp-token] Unexpected error:', err);
        return jsonResponse({ error: 'Internal server error' }, 500);
    }
});
