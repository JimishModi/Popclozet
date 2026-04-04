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
    const MAX_RETRIES = 2;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
          method: "POST",
          headers: {
            "x-internal-call": "true",
            "Authorization": `Bearer ${internalSecret}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ user_id, title, body, url, type: "system_event" })
        });
        if (!res.ok && attempt < MAX_RETRIES) {
          console.warn(`[webhook] Push attempt ${attempt + 1} failed (HTTP ${res.status}) for ${user_id}, retrying...`);
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        console.log(`[webhook] Push sent to ${user_id}: ${title}`);
        return;
      } catch (e) {
        if (attempt < MAX_RETRIES) {
          console.warn(`[webhook] Push attempt ${attempt + 1} error for ${user_id}, retrying...`, e);
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        } else {
          console.error(`[webhook] Push FAILED after ${MAX_RETRIES + 1} attempts for ${user_id}:`, e);
        }
      }
    }
  };

  const shortId = (id: string) => id ? id.slice(0, 6).toUpperCase() : "UNKNOWN";

  // Helper: send "order confirmed" notifications to customer + warehouse
  const notifyOrderConfirmed = async (orderRecord: any, paymentType: string) => {
    const label = paymentType === 'cod' ? '(COD)' : '(Paid)';
    // Customer
    await sendPush(
      orderRecord.user_id,
      "🛍️ Order Confirmed!",
      `Your order ${label} has been confirmed. We're preparing it now.`,
      `/orders`
    );
    // All warehouse staff
    for (const w of (warehouseUsers || [])) {
      await sendPush(
        w.id,
        "📦 New Order Received",
        `Order #${shortId(orderRecord.id)} ${label} — ready to fulfill.`,
        "/warehouse/orders"
      );
    }
    // In-app notification for customer
    await supabase.from("notifications").insert({
      user_id: orderRecord.user_id,
      type: "order_confirmed",
      title: "✅ Order Confirmed",
      message: `Your order ${label} has been confirmed and is being prepared.`,
      order_id: orderRecord.id,
      is_read: false,
    });
    console.log(`[webhook] Notified order confirmed: ${orderRecord.id} ${label}`);
  };

  // ==========================================
  // TABLE: ORDERS
  // ==========================================
  if (table === "orders") {
    // ── INSERT: Only notify for immediately-confirmed orders (COD) ──
    // Online payment orders are created with status='pending_payment'
    // and must NOT trigger notifications until payment is verified.
    if (type === "INSERT") {
      if (record.status === "confirmed") {
        // COD order — confirmed immediately, notify now
        await notifyOrderConfirmed(record, record.payment_method || 'cod');
      } else {
        console.log(`[webhook] INSERT order ${record.id} with status=${record.status} — skipping notification (awaiting payment)`);
      }
    }

    // ── UPDATE Events ──
    if (type === "UPDATE" && old_record) {
      // 1. Payment verified: pending/pending_payment → confirmed
      //    This is the critical path for online payments.
      if (
        (old_record.status === "pending_payment" || old_record.status === "pending") &&
        record.status === "confirmed"
      ) {
        await notifyOrderConfirmed(record, record.payment_method || 'online');
      }

      // 2. Payment failed
      if (
        (old_record.status === "pending_payment" || old_record.status === "pending") &&
        record.status === "payment_failed"
      ) {
        await sendPush(
          record.user_id,
          "❌ Payment Failed",
          "Your payment could not be processed. Please try again or use a different payment method.",
          `/orders`
        );
        await supabase.from("notifications").insert({
          user_id: record.user_id,
          type: "order_update",
          title: "❌ Payment Failed",
          message: "Your payment could not be processed. Please try again.",
          order_id: record.id,
          is_read: false,
        });
      }

      // 3. Status-based in-app notifications for customer
      //    These replace the client-side notifyOrderStatusChange function.
      const statusNotifications: Record<string, { type: string; title: string; message: string }> = {
        packed: { type: "order_update", title: "📦 Order Packed", message: "Your order has been packed and is ready for pickup by a rider." },
        ready_for_pickup: { type: "order_update", title: "🏭 Ready for Pickup", message: "Your package is ready and a rider has been assigned to collect it." },
        dispatched: { type: "order_dispatched", title: "📦 Package Dispatched!", message: "Your package has been dispatched from the warehouse. A rider is on the way!" },
        out_for_delivery: { type: "order_update", title: "🚗 Out for Delivery!", message: "Your package is out for delivery. The rider is heading to your location." },
        delivered: { type: "order_update", title: "🎉 Package Delivered!", message: "Your package has been delivered. Enjoy!" },
        cancelled: { type: "order_update", title: "🚫 Order Cancelled", message: "Your order has been cancelled." },
        // ── Return lifecycle statuses ──
        return_requested: { type: "return_scheduled", title: "📋 Return Request Submitted", message: "Your return request has been submitted. Our warehouse team will review it shortly." },
        return_scheduled: { type: "return_scheduled", title: "✅ Return Approved", message: "Your return has been approved! We're assigning a rider for pickup." },
        return_dispatched: { type: "return_scheduled", title: "🚗 Rider Assigned for Pickup", message: "A rider has been assigned and is heading to pick up your return items." },
        return_picked_up: { type: "return_completed", title: "📦 Items Picked Up", message: "Your return items have been collected by the rider. They're on the way to our warehouse." },
        return_at_warehouse: { type: "return_completed", title: "🏭 Items at Warehouse", message: "Your returned items have arrived at our warehouse and are being inspected." },
        returned: { type: "return_completed", title: "✅ Return Complete", message: "Your return is complete! Your deposit refund has been initiated." },
      };

      if (old_record.status !== record.status && statusNotifications[record.status]) {
        const cfg = statusNotifications[record.status];
        await supabase.from("notifications").insert({
          user_id: record.user_id,
          type: cfg.type,
          title: cfg.title,
          message: cfg.message,
          order_id: record.id,
          is_read: false,
        });
      }

      // 4. Driver Assigned (rider_id changes from null to something)
      if (!old_record.rider_id && record.rider_id) {
        // Customer
        await sendPush(record.user_id, "🚗 Driver Assigned", "A driver has been assigned and is heading out for your order!", `/orders`);
        await supabase.from("notifications").insert({
          user_id: record.user_id,
          type: "order_update",
          title: "🚗 Rider Assigned!",
          message: "A rider has been assigned to pick up your package.",
          order_id: record.id,
          is_read: false,
        });
        // Warehouse
        for (const w of (warehouseUsers || [])) {
          await sendPush(w.id, "🚗 Driver Dispatched", `Driver assigned to Order #${shortId(record.id)}.`, "/warehouse/orders");
        }
        // Driver
        await sendPush(record.rider_id, "🔥 New Delivery Assigned!", `You have been assigned to deliver Order #${shortId(record.id)}. Make haste!`, "/rider/deliveries");
      }

      // 5. Order Delivered — push (in-app handled by statusNotifications above)
      if (old_record.status !== "delivered" && record.status === "delivered") {
        await sendPush(record.user_id, "✅ Order Delivered", "Your order has safely arrived! Enjoy.", `/orders`);
        for (const w of (warehouseUsers || [])) {
          await sendPush(w.id, "✅ Order Delivered", `Order #${shortId(record.id)} completed delivery.`, "/warehouse/orders");
        }
      }

      // 6. Order Cancelled — push (in-app handled by statusNotifications above)
      if (old_record.status !== "cancelled" && record.status === "cancelled") {
        await sendPush(record.user_id, "🚫 Order Cancelled", "Your order has been cancelled.", `/orders`);
      }

      // 7. Dispatched / Out for Delivery — push to customer
      if (old_record.status !== "dispatched" && record.status === "dispatched") {
        await sendPush(record.user_id, "📦 Package Dispatched!", "Your package has been dispatched. A rider is on the way!", `/orders`);
      }
      if (old_record.status !== "out_for_delivery" && record.status === "out_for_delivery") {
        await sendPush(record.user_id, "🚗 Out for Delivery!", "Your package is out for delivery.", `/orders`);
      }

      // ══════════════════════════════════════════
      // RETURN LIFECYCLE — Push + Warehouse Alerts
      // ══════════════════════════════════════════

      // 8. Return Requested — notify warehouse immediately
      if (old_record.status !== "return_requested" && record.status === "return_requested") {
        await sendPush(record.user_id, "📋 Return Request Submitted", "Your return request has been submitted. We'll review it shortly.", `/orders`);
        for (const w of (warehouseUsers || [])) {
          await sendPush(w.id, "🔔 New Return Request", `Return requested for Order #${shortId(record.id)}. Please review and approve.`, "/warehouse/returns");
          await supabase.from("notifications").insert({
            user_id: w.id,
            type: "return_scheduled",
            title: "🔔 New Return Request",
            message: `Customer has requested a return for Order #${shortId(record.id)}. Action required: review and approve.`,
            order_id: record.id,
            is_read: false,
          });
        }
      }

      // 9. Return Scheduled (Approved) — notify customer + warehouse
      if (old_record.status !== "return_scheduled" && record.status === "return_scheduled") {
        await sendPush(record.user_id, "✅ Return Approved", "Your return has been approved! We're finding a rider for pickup.", `/orders`);
        for (const w of (warehouseUsers || [])) {
          await sendPush(w.id, "✅ Return Approved", `Return approved for Order #${shortId(record.id)}. Assigning rider.`, "/warehouse/returns");
        }
      }

      // 10. Return Dispatched (Rider Assigned) — notify customer + rider + warehouse
      if (old_record.status !== "return_dispatched" && record.status === "return_dispatched") {
        await sendPush(record.user_id, "🚗 Rider On The Way", "A rider has been assigned and is heading to collect your return items.", `/orders`);
        if (record.rider_id) {
          await sendPush(record.rider_id, "📦 Return Pickup Assigned", `You've been assigned a return pickup for Order #${shortId(record.id)}.`, "/rider/deliveries");
        }
        for (const w of (warehouseUsers || [])) {
          await sendPush(w.id, "🚗 Return Rider Dispatched", `Rider dispatched for return pickup on Order #${shortId(record.id)}.`, "/warehouse/returns");
          await supabase.from("notifications").insert({
            user_id: w.id,
            type: "return_scheduled",
            title: "🚗 Rider Dispatched for Return",
            message: `Rider is en route to pick up return for Order #${shortId(record.id)}.`,
            order_id: record.id,
            is_read: false,
          });
        }
      }

      // 11. Return Picked Up — notify customer + warehouse
      if (old_record.status !== "return_picked_up" && record.status === "return_picked_up") {
        await sendPush(record.user_id, "📦 Items Picked Up!", "Your return items have been collected. They're on the way to our warehouse.", `/orders`);
        for (const w of (warehouseUsers || [])) {
          await sendPush(w.id, "📦 Return Picked Up", `Items picked up for Order #${shortId(record.id)}. Rider heading to warehouse.`, "/warehouse/returns");
          await supabase.from("notifications").insert({
            user_id: w.id,
            type: "return_completed",
            title: "📦 Return Items Picked Up",
            message: `Rider has collected return items for Order #${shortId(record.id)}. Expect warehouse arrival soon.`,
            order_id: record.id,
            is_read: false,
          });
        }
      }

      // 12. Return At Warehouse — notify customer
      if (old_record.status !== "return_at_warehouse" && record.status === "return_at_warehouse") {
        await sendPush(record.user_id, "🏭 Items at Warehouse", "Your returned items have arrived and are being inspected.", `/orders`);
        for (const w of (warehouseUsers || [])) {
          await supabase.from("notifications").insert({
            user_id: w.id,
            type: "return_completed",
            title: "🏭 Return Arrived at Warehouse",
            message: `Return items for Order #${shortId(record.id)} received. Please inspect and complete the return.`,
            order_id: record.id,
            is_read: false,
          });
        }
      }

      // 13. Returned (Complete + Refund) — notify customer + warehouse
      if (old_record.status !== "returned" && record.status === "returned") {
        await sendPush(record.user_id, "✅ Return Complete!", "Your return is complete and your deposit refund has been initiated.", `/orders`);
        for (const w of (warehouseUsers || [])) {
          await sendPush(w.id, "✅ Return Completed", `Return flow completed for Order #${shortId(record.id)}. Deposit refund initiated.`, "/warehouse/returns");
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
      const { data: order } = await supabase.from("orders").select("user_id").eq("id", record.order_id).single();
      const customerId = order?.user_id;

      // Return request approved
      if (old_record.status !== "approved" && record.status === "approved") {
        if (customerId) {
          await sendPush(customerId, "✅ Return Approved", "Your return request has been approved. A rider will be assigned shortly.", `/orders`);
          await supabase.from("notifications").insert({
            user_id: customerId,
            type: "return_scheduled",
            title: "✅ Return Request Approved",
            message: "Your return has been approved and a rider will be assigned for pickup.",
            order_id: record.order_id,
            is_read: false,
          });
        }
        for (const w of (warehouseUsers || [])) {
          await sendPush(w.id, "✅ Return Approved", `Return approved for Order #${shortId(record.order_id)}.`, "/warehouse/returns");
        }
      }

      // Rider assigned to return (dispatched)
      if (old_record.status !== "dispatched" && record.status === "dispatched") {
        if (customerId) {
          await sendPush(customerId, "🚗 Rider Assigned", "A rider has been assigned to pick up your return items!", `/orders`);
          await supabase.from("notifications").insert({
            user_id: customerId,
            type: "return_scheduled",
            title: "🚗 Rider Assigned for Return Pickup",
            message: "A rider is on the way to collect your return items.",
            order_id: record.order_id,
            is_read: false,
          });
        }
        if (record.rider_id) {
          await sendPush(record.rider_id, "📦 Return Pickup Assigned", `You have a return pickup for Order #${shortId(record.order_id)}.`, "/rider/deliveries");
        }
        for (const w of (warehouseUsers || [])) {
          await sendPush(w.id, "🚗 Return Rider Dispatched", `Rider dispatched for return on Order #${shortId(record.order_id)}.`, "/warehouse/returns");
        }
      }

      // Items picked up from customer
      if (old_record.status !== "picked_up" && record.status === "picked_up") {
        if (customerId) {
          await sendPush(customerId, "📦 Items Collected", "Your return items have been picked up by the rider!", `/orders`);
          await supabase.from("notifications").insert({
            user_id: customerId,
            type: "return_completed",
            title: "📦 Return Items Collected",
            message: "The rider has collected your items and is heading to the warehouse.",
            order_id: record.order_id,
            is_read: false,
          });
        }
        for (const w of (warehouseUsers || [])) {
          await sendPush(w.id, "📦 Return Picked Up", `Rider has collected items for Order #${shortId(record.order_id)}. En route to warehouse.`, "/warehouse/returns");
        }
      }

      // Driver arrived at customer location
      if (old_record.status !== "driver_arrived" && record.status === "driver_arrived") {
        if (customerId) {
          await sendPush(customerId, "📍 Driver Arrived", "Your driver is outside ready to pick up your return item!", `/orders`);
        }
        for (const w of (warehouseUsers || [])) {
          await sendPush(w.id, "📍 Return Driver Arrived", `Driver has reached the pickup location for Order #${shortId(record.order_id)}.`, "/warehouse/returns");
        }
      }

      // Return flow completed
      if (old_record.status !== "completed" && record.status === "completed") {
        if (customerId) {
          await sendPush(customerId, "✅ Return Completed", "Your return is complete! Your deposit refund has been initiated.", `/orders`);
          await supabase.from("notifications").insert({
            user_id: customerId,
            type: "return_completed",
            title: "✅ Return Complete — Refund Initiated",
            message: "Your return has been processed and your deposit refund is on its way.",
            order_id: record.order_id,
            is_read: false,
          });
        }
        for (const w of (warehouseUsers || [])) {
          await sendPush(w.id, "✅ Return Completed", `Return for Order #${shortId(record.order_id)} is completed.`, "/warehouse/returns");
        }
      }
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
