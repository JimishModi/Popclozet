// deno-lint-ignore-file
// @ts-nocheck
// supabase/functions/resend-otp/index.ts

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

function jsonResponse(body: Record<string, unknown>, status: number, log?: ReturnType<typeof makeLogger>) {
    if (log) log.done(status);
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
}

Deno.serve(async (req: Request) => {
    const log = makeLogger('resend-otp');
    log.info('request started');

    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
    }
    if (req.method !== 'POST') {
        return jsonResponse({ error: 'Method not allowed' }, 405, log);
    }

    try {
        const { mobile } = await req.json();
        if (!mobile) {
            return jsonResponse({ error: 'mobile is required' }, 400, log);
        }

        const msg91AuthKey = Deno.env.get('MSG91_AUTH_KEY');
        if (!msg91AuthKey) {
            log.error('MSG91_AUTH_KEY not set');
            return jsonResponse({ error: 'Server configuration error' }, 500, log);
        }

        const rawDigits = mobile.replace(/\D/g, '');
        const digitsWithCountry = rawDigits.startsWith('91') ? rawDigits : `91${rawDigits}`;

        log.info('Retrying OTP', { mobile: digitsWithCountry });

        const msg91Res = await fetch(`https://control.msg91.com/api/v5/otp/retry?authkey=${msg91AuthKey}&mobile=${digitsWithCountry}&retrytype=text`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
        });

        const data = await msg91Res.json();
        log.info('MSG91 response', { response: data });

        if (data.type === 'success') {
            return jsonResponse({
                success: true,
                requestId: data.request_id,
                message: 'OTP resent successfully'
            }, 200, log);
        } else {
            return jsonResponse({
                success: false,
                error: 'Failed to resend OTP',
                details: data.message
            }, 400, log);
        }
    } catch (err: any) {
        log.error('Unexpected error', { error: String(err) });
        return jsonResponse({ error: 'Internal server error', details: String(err) }, 500, log);
    }
});