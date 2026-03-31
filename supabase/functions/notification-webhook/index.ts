import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.6";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const internalSecret = Deno.env.get("PUSH_INTERNAL_SECRET");

  if (!supabaseUrl || !serviceRoleKey || !internalSecret) {
    console.error("Missing environment variables");
    return jsonResponse({ error: "Configuration error" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  
  // Security: Database Webhooks don't send Authorization headers natively, 
  // they can send URL parameters or custom headers if configured. 
  // We will verify a secret header we configure in pg_net.
  const webhookSecret = req.headers.get("x-webhook-secret");
  if (webhookSecret !== internalSecret) {
    return jsonResponse({ error: "Unauthorized webhook caller" }, 401);
  }

  const payload = await req.json();
  console.log("Webhook Received:", payload.type, payload.table);

  const { type, table, record, old_record } = payload;
  
  if (!record) {
    return jsonResponse({ message: "No record found" });
  }

  // 1. Fetch all Warehouse Staff
  // We fetch them once, we will reuse them.
  const { data: warehouseUsers } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "warehouse");

  const sendPush = async (user_id: string, title: string, body: string, url: string = "/") => {
    if (!user_id) return;
    try {
      await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
        method: "POST",
        headers: {
          "x-internal-call": "true",
          "Authorization": `Bearer ${internalSecret}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ user_id, title, body, url, type: "system_event" })
      });
      console.log(`Sent to ${user_id}: ${title}`);
    } catch (e) {
      console.error(`Failed pushing to ${user_id}:`, e);
    }
  };

  const shortId = (id: string) => id ? id.slice(0, 6).toUpperCase() : "UNKNOWN";

  // ==========================================
  // TABLE: ORDERS
  // ==========================================
  if (table === "orders") {
    // 1. Order Placed (INSERT)
    if (type === "INSERT") {
      // Customer
      await sendPush(record.user_id, "🛍️ Order Placed!", "Your order has been successfully placed. We're processing it now.", `/orders`);
      // Warehouse
      for (const w of (warehouseUsers || [])) {
        await sendPush(w.id, "📦 New Order Received", `Order #${shortId(record.id)} was perfectly placed.`, "/warehouse/orders");
      }
    }

    // UPDATE Events
    if (type === "UPDATE" && old_record) {
      // 2. Driver Assigned (rider_id changes from null to something)
      if (!old_record.rider_id && record.rider_id) {
        // Customer
        await sendPush(record.user_id, "🚗 Driver Assigned", "A driver has been assigned and is heading out for your order!", `/orders`);
        // Warehouse
        for (const w of (warehouseUsers || [])) {
          await sendPush(w.id, "🚗 Driver Dispatched", `Driver assigned to Order #${shortId(record.id)}.`, "/warehouse/orders");
        }
        // Driver
        await sendPush(record.rider_id, "🔥 New Delivery Assigned!", `You have been assigned to deliver Order #${shortId(record.id)}. Make haste!`, "/rider/deliveries");
      }

      // 3. Order Delivered
      if (old_record.status !== "delivered" && record.status === "delivered") {
        // Customer
        await sendPush(record.user_id, "✅ Order Delivered", "Your order has safely arrived! Enjoy.", `/orders`);
        // Warehouse
        for (const w of (warehouseUsers || [])) {
          await sendPush(w.id, "✅ Order Delivered", `Order #${shortId(record.id)} completed delivery.`, "/warehouse/orders");
        }
      }
    }
  }

  // ==========================================
  // TABLE: RETURN_REQUESTS
  // ==========================================
  if (table === "return_requests") {
    // 4. Return Scheduled (INSERT)
    if (type === "INSERT") {
      // We look up the customer ID via the order_id!
      const { data: order } = await supabase.from("orders").select("user_id").eq("id", record.order_id).single();
      const customerId = order?.user_id;

      if (customerId) {
        // Customer
        await sendPush(customerId, "📅 Return Scheduled", "Your return pickup has accurately been scheduled.", `/returns`);
      }
      
      // Warehouse
      for (const w of (warehouseUsers || [])) {
        await sendPush(w.id, "📅 Return Scheduled", `New return requested for Order #${shortId(record.order_id)}.`, "/warehouse/returns");
      }
    }

    // UPDATE Events
    if (type === "UPDATE" && old_record) {
      // Look up customer ID via order_id just in case
      const { data: order } = await supabase.from("orders").select("user_id").eq("id", record.order_id).single();
      const customerId = order?.user_id;

      // 6. Driver Arrived for Return
      // Assuming status becomes "driver_arrived"
      if (old_record.status !== "driver_arrived" && record.status === "driver_arrived") {
        if (customerId) {
          await sendPush(customerId, "📍 Driver Arrived", "Your driver is outside ready to pick up your return item!", `/returns`);
        }
        for (const w of (warehouseUsers || [])) {
          await sendPush(w.id, "📍 Return Driver Arrived", `Driver has reached the pickup location for Order #${shortId(record.order_id)}.`, "/warehouse/returns");
        }
      }

      // 7. Return Given (Completed)
      if (old_record.status !== "completed" && record.status === "completed") {
        if (customerId) {
          await sendPush(customerId, "♻️ Return Completed", "Your return was successfully handed over and completed.", `/returns`);
        }
        for (const w of (warehouseUsers || [])) {
          await sendPush(w.id, "♻️ Return Completed", `Return for Order #${shortId(record.order_id)} is completed.`, "/warehouse/returns");
        }
      }
      
      // 8. CRON REMINDER: 1-hour before return 
      // The webhook can also handle generic cron pings if type === 'CRON'
    }
  }

  // ==========================================
  // TYPE: CRON_REMINDER
  // ==========================================
  // Handled specifically if payload.type === "CRON", we will manually query the DB
  if (type === "CRON") {
     console.log("Executing CRON 1-hour reminder interval check...");
     // 5. 1-hour before return reminder
     // We query all return_requests whose pickup_slot is within 1 hour and haven't been notified
     const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000).toISOString();
     const next15Mins = new Date(Date.now() + 75 * 60 * 1000).toISOString(); // Window matching

     const { data: upcomingReturns } = await supabase
       .from('return_requests')
       .select('id, order_id, pickup_slot')
       .gte('pickup_slot', oneHourFromNow)
       .lt('pickup_slot', next15Mins)
       .eq('status', 'approved'); // Only pending/approved returns
     
     if (upcomingReturns) {
       for (const ret of upcomingReturns) {
         const { data: ord } = await supabase.from("orders").select("user_id").eq("id", ret.order_id).single();
         if (ord?.user_id) {
            await sendPush(ord.user_id, "⏰ Return Reminder", "Your return driver will arrive in approximately 1 hour!", "/returns");
         }
         for (const w of (warehouseUsers || [])) {
            await sendPush(w.id, "⏰ Upcoming Return", `1-Hour Warning: Route start for Return on Order #${shortId(ret.order_id)}!`, "/warehouse/returns");
         }
         // Note: to prevent duplicate crons, we should optimally update a boolean `notified_1hr` to true in the database.
       }
     }
  }

  return jsonResponse({ success: true, processed: type });
});
