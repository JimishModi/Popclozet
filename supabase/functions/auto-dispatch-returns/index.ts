// deno-lint-ignore-file
// @ts-nocheck
// supabase/functions/auto-dispatch-returns/index.ts
//
// Cron-triggered Edge Function that auto-dispatches pre-scheduled return pickups.
// Runs every 15 minutes. Finds orders with approved return requests where the
// pickup time is within the next 60 minutes, transitions them to 'return_scheduled',
// which triggers the existing broadcast_order_to_riders DB trigger to notify riders.
//
// Deploy:  supabase functions deploy auto-dispatch-returns
//
// Schedule via Supabase Dashboard > Edge Functions > Schedules:
//   Cron: */15 * * * *   (every 15 minutes)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

Deno.serve(async (req: Request) => {
  const log = makeLogger('auto-dispatch-returns');
  log.info('cron started');

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Call the DB function that handles all the logic
    const { data, error } = await supabase.rpc("auto_dispatch_pre_scheduled_returns");

    if (error) {
      log.error("Auto-dispatch RPC error", { error });
      log.done(500);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    log.info("Auto-dispatch result", { data });

    log.done(200);
    return new Response(
      JSON.stringify(data),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err: any) {
    log.error("Auto-dispatch unexpected error", { error: String(err) });
    log.done(500);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
