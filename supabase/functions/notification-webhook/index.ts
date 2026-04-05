// deno-lint-ignore-file
// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.6";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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
      console.log(
        meta({
          level: "info",
          msg: "complete",
          status,
          ms: Math.round(performance.now() - t0),
        }),
      ),
  };
}

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
  log?: ReturnType<typeof makeLogger>,
) {
  if (log) log.done(status);
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  const log = makeLogger("notification-webhook");
  log.info("request started");

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const internalSecret = Deno.env.get("PUSH_INTERNAL_SECRET");

  if (!supabaseUrl || !serviceRoleKey || !internalSecret) {
    log.error("Missing environment variables");
    return jsonResponse({ error: "Configuration error" }, 500, log);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const webhookSecret = req.headers.get("x-webhook-secret");
  if (webhookSecret !== internalSecret) {
    log.error("Unauthorized caller");
    return jsonResponse({ error: "Unauthorized webhook caller" }, 401, log);
  }

  let payload;
  try {
    payload = await req.json();
  } catch (e: any) {
    log.error("Invalid JSON payload", { error: e.message });
    return jsonResponse({ error: "Invalid JSON payload" }, 400, log);
  }

  log.info("Received payload", { type: payload.type, table: payload.table });

  const { type, table, record, old_record } = payload;

  if (!record && type !== "CRON") {
    log.warn("No record found");
    return jsonResponse({ message: "No record found" }, 200, log);
  }

  // FIXED: was "profiles" (which does not exist). Correct table is "warehouse_profiles"
  const { data: warehouseProfiles, error: warehouseErr } = await supabase
    .from("warehouse_profiles")
    .select("id");

  if (warehouseErr) {
    log.error("Failed to fetch warehouse users", {
      error: warehouseErr.message,
    });
  }
  const warehouseUsers = warehouseProfiles || [];
  log.info(`${warehouseUsers.length} warehouse user(s) found`);

  // ── Push helper with retry ──────────────────────────────────────────────────
  const sendPush = async (
    user_id: string,
    title: string,
    body: string,
    url = "/",
  ) => {
    if (!user_id) return;
    const MAX_RETRIES = 2;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const res = await fetch(
          `${supabaseUrl}/functions/v1/send-push-notification`,
          {
            method: "POST",
            headers: {
              "x-internal-call": "true",
              Authorization: `Bearer ${internalSecret}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              user_id,
              title,
              body,
              url,
              type: "system_event",
            }),
          },
        );
        if (!res.ok && attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        log.info(`Push sent to ${user_id}`, { title });
        return;
      } catch (e: any) {
        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        } else {
          log.error(`Push FAILED for ${user_id}`, { error: String(e) });
        }
      }
    }
  };

  const shortId = (id: string) =>
    id ? id.slice(0, 6).toUpperCase() : "UNKNOWN";

  // ── Send push to all warehouse staff ───────────────────────────────────────
  const sendWarehouseAll = async (
    title: string,
    body: string,
    url = "/orders",
  ) => {
    for (const w of warehouseUsers) {
      await sendPush(w.id, title, body, url);
    }
  };

  // ── Notify order confirmed (COD or online) ─────────────────────────────────
  const notifyOrderConfirmed = async (
    orderRecord: any,
    paymentType: string,
  ) => {
    const label = paymentType === "cod" ? "(COD)" : "(Paid)";
    await sendPush(
      orderRecord.user_id,
      "🛍️ Order Confirmed!",
      `Your order ${label} has been confirmed. We're preparing it now.`,
      "/orders",
    );
    // FIXED: was "/warehouse/orders" which doesn't exist in the app router
    await sendWarehouseAll(
      "📦 New Order Received",
      `Order #${shortId(orderRecord.id)} ${label} — ready to fulfill.`,
      "/orders",
    );
    await supabase.from("notifications").insert({
      user_id: orderRecord.user_id,
      type: "order_confirmed",
      title: "✅ Order Confirmed",
      message: `Your order ${label} has been confirmed and is being prepared.`,
      order_id: orderRecord.id,
      is_read: false,
    });
  };

  // ==========================================
  // TABLE: ORDERS
  // ==========================================
  if (table === "orders") {
    // ── INSERT: COD orders arrive already confirmed ──
    if (type === "INSERT") {
      if (record.status === "confirmed") {
        await notifyOrderConfirmed(record, record.payment_method || "cod");
      } else {
        log.info(
          `INSERT order ${record.id} status=${record.status} — skipping (awaiting payment)`,
        );
      }
    }

    // ── UPDATE: comprehensive status handler ──
    if (type === "UPDATE" && old_record) {
      const oldStatus = old_record.status;
      const newStatus = record.status;

      // 1. Online payment confirmed (pending_payment → confirmed)
      if (
        (oldStatus === "pending_payment" || oldStatus === "pending") &&
        newStatus === "confirmed"
      ) {
        await notifyOrderConfirmed(record, record.payment_method || "online");
      }

      // 2. Payment failed
      if (
        (oldStatus === "pending_payment" || oldStatus === "pending") &&
        newStatus === "payment_failed"
      ) {
        await sendPush(
          record.user_id,
          "❌ Payment Failed",
          "Your payment could not be processed. Please try again.",
          "/orders",
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

      // 3. In-app status notifications for customer
      const customerInAppNotifs: Record<
        string,
        { type: string; title: string; message: string }
      > = {
        dispatched: {
          type: "order_dispatched",
          title: "📦 Package Dispatched!",
          message:
            "Your package has been dispatched from the warehouse. A rider is on the way!",
        },
        out_for_delivery: {
          type: "order_update",
          title: "🚗 Out for Delivery!",
          message:
            "Your package is out for delivery. The rider is heading to your location.",
        },
        delivered: {
          type: "order_update",
          title: "🎉 Package Delivered!",
          message: "Your package has been delivered. Enjoy!",
        },
        cancelled: {
          type: "order_update",
          title: "🚫 Order Cancelled",
          message: "Your order has been cancelled.",
        },
        return_requested: {
          type: "return_scheduled",
          title: "📋 Return Submitted",
          message:
            "Your return request has been submitted. We'll review it shortly.",
        },
        return_scheduled: {
          type: "return_scheduled",
          title: "✅ Return Approved",
          message:
            "Your return has been approved! We're assigning a rider for pickup.",
        },
        return_dispatched: {
          type: "return_scheduled",
          title: "🚗 Rider Assigned for Pickup",
          message: "A rider is heading to pick up your return items.",
        },
        return_picked_up: {
          type: "return_completed",
          title: "📦 Items Picked Up",
          message:
            "Your return items have been collected and are heading to our warehouse.",
        },
        returned: {
          type: "return_completed",
          title: "✅ Return Complete",
          message: "Your return is complete! Thank you.",
        },
      };

      if (oldStatus !== newStatus && customerInAppNotifs[newStatus]) {
        const cfg = customerInAppNotifs[newStatus];
        await supabase.from("notifications").insert({
          user_id: record.user_id,
          type: cfg.type,
          title: cfg.title,
          message: cfg.message,
          order_id: record.id,
          is_read: false,
        });
      }

      // 4. Driver assigned for delivery (rider_id set for the first time, non-return)
      if (
        !old_record.rider_id &&
        record.rider_id &&
        !String(newStatus).startsWith("return_")
      ) {
        await sendPush(
          record.user_id,
          "🚗 Driver Assigned",
          "A driver has been assigned and is heading out for your order!",
          "/orders",
        );
        await supabase.from("notifications").insert({
          user_id: record.user_id,
          type: "order_update",
          title: "🚗 Rider Assigned!",
          message: "A rider has been assigned to pick up your package.",
          order_id: record.id,
          is_read: false,
        });
        // FIXED: was "/warehouse/orders"
        await sendWarehouseAll(
          "🚗 Driver Dispatched",
          `Driver assigned to Order #${shortId(record.id)}.`,
          "/orders",
        );
        await sendPush(
          record.rider_id,
          "🔥 New Delivery Assigned!",
          `Assigned to deliver Order #${shortId(record.id)}. Head to the warehouse!`,
          "/deliveries",
        );
      }

      // 5. Order packed — warehouse push (NEW)
      if (oldStatus !== "packed" && newStatus === "packed") {
        await sendWarehouseAll(
          "📦 Order Packed",
          `Order #${shortId(record.id)} is packed and ready for rider pickup.`,
          "/orders",
        );
      }

      // 6. Ready for pickup — warehouse push (NEW)
      if (
        oldStatus !== "ready_for_pickup" &&
        newStatus === "ready_for_pickup"
      ) {
        await sendWarehouseAll(
          "🏭 Ready for Pickup",
          `Order #${shortId(record.id)} is ready — assign a rider.`,
          "/orders",
        );
      }

      // 7. Driver arrived at warehouse — warehouse push (NEW)
      if (
        oldStatus !== "driver_arrived_warehouse" &&
        newStatus === "driver_arrived_warehouse"
      ) {
        await sendWarehouseAll(
          "🏬 Rider at Warehouse",
          `Rider arrived at warehouse for Order #${shortId(record.id)}. Hand over the package.`,
          "/orders",
        );
      }

      // 8. Order picked up from warehouse — warehouse push (NEW)
      if (oldStatus !== "order_picked_up" && newStatus === "order_picked_up") {
        await sendWarehouseAll(
          "📦 Order Picked Up",
          `Rider picked up Order #${shortId(record.id)} from the warehouse.`,
          "/orders",
        );
      }

      // 9. Dispatched — customer push
      if (oldStatus !== "dispatched" && newStatus === "dispatched") {
        await sendPush(
          record.user_id,
          "📦 Package Dispatched!",
          "Your package has been dispatched. A rider is on the way!",
          "/orders",
        );
      }

      // 10. Out for delivery — customer push
      if (
        oldStatus !== "out_for_delivery" &&
        newStatus === "out_for_delivery"
      ) {
        await sendPush(
          record.user_id,
          "🚗 Out for Delivery!",
          "Your package is out for delivery.",
          "/orders",
        );
      }

      // 11. Delivered — customer + warehouse
      if (oldStatus !== "delivered" && newStatus === "delivered") {
        await sendPush(
          record.user_id,
          "✅ Order Delivered",
          "Your order has safely arrived! Enjoy.",
          "/orders",
        );
        await sendWarehouseAll(
          "✅ Order Delivered",
          `Order #${shortId(record.id)} completed delivery.`,
          "/orders",
        );
      }

      // 12. Cancelled — customer push
      if (oldStatus !== "cancelled" && newStatus === "cancelled") {
        await sendPush(
          record.user_id,
          "🚫 Order Cancelled",
          "Your order has been cancelled.",
          "/orders",
        );
      }

      // ══════════════════════════════════════════════
      // RETURN LIFECYCLE ON ORDERS TABLE
      // ══════════════════════════════════════════════

      // 13. Return requested — customer + warehouse
      if (
        oldStatus !== "return_requested" &&
        newStatus === "return_requested"
      ) {
        await sendPush(
          record.user_id,
          "📋 Return Request Submitted",
          "Your return request has been submitted. We'll review it shortly.",
          "/orders",
        );
        await sendWarehouseAll(
          "🔔 New Return Request",
          `Return requested for Order #${shortId(record.id)}. Review and approve.`,
          "/returns",
        );
        for (const w of warehouseUsers) {
          await supabase.from("notifications").insert({
            user_id: w.id,
            type: "return_scheduled",
            title: "🔔 New Return Request",
            message: `Customer requested a return for Order #${shortId(record.id)}. Action required.`,
            order_id: record.id,
            is_read: false,
          });
        }
      }

      // 14. Return approved/scheduled
      if (
        oldStatus !== "return_scheduled" &&
        newStatus === "return_scheduled"
      ) {
        await sendPush(
          record.user_id,
          "✅ Return Approved",
          "Your return has been approved! We're finding a rider for pickup.",
          "/orders",
        );
        await sendWarehouseAll(
          "✅ Return Approved",
          `Return approved for Order #${shortId(record.id)}. Assigning rider.`,
          "/returns",
        );
      }

      // 15. Return rider dispatched
      if (
        oldStatus !== "return_dispatched" &&
        newStatus === "return_dispatched"
      ) {
        await sendPush(
          record.user_id,
          "🚗 Rider On The Way",
          "A rider has been assigned to collect your return items.",
          "/orders",
        );
        if (record.rider_id) {
          await sendPush(
            record.rider_id,
            "📦 Return Pickup Assigned",
            `Assigned a return pickup for Order #${shortId(record.id)}.`,
            "/deliveries",
          );
        }
        await sendWarehouseAll(
          "🏍️ Return Rider Dispatched",
          `Rider dispatched for return pickup on Order #${shortId(record.id)}.`,
          "/returns",
        );
        for (const w of warehouseUsers) {
          await supabase.from("notifications").insert({
            user_id: w.id,
            type: "return_scheduled",
            title: "🏍️ Rider Dispatched for Return",
            message: `Rider is en route to pick up return for Order #${shortId(record.id)}.`,
            order_id: record.id,
            is_read: false,
          });
        }
      }

      // 16. Return picked up from customer
      if (
        oldStatus !== "return_picked_up" &&
        newStatus === "return_picked_up"
      ) {
        await sendPush(
          record.user_id,
          "📦 Items Picked Up!",
          "Your return items have been collected. They're on the way to our warehouse.",
          "/orders",
        );
        await sendWarehouseAll(
          "📦 Return Picked Up",
          `Items picked up for Order #${shortId(record.id)}. Rider heading to warehouse.`,
          "/returns",
        );
        for (const w of warehouseUsers) {
          await supabase.from("notifications").insert({
            user_id: w.id,
            type: "return_completed",
            title: "📦 Return Items Picked Up",
            message: `Rider collected return items for Order #${shortId(record.id)}. Expect warehouse arrival soon.`,
            order_id: record.id,
            is_read: false,
          });
        }
      }

      // 17. Return at warehouse
      if (
        oldStatus !== "return_at_warehouse" &&
        newStatus === "return_at_warehouse"
      ) {
        // Only notify warehouse (customers don't need this update)
        await sendWarehouseAll(
          "🏬 Return Arrived at Warehouse",
          `Return items for Order #${shortId(record.id)} received. Inspect and complete.`,
          "/returns",
        );
        for (const w of warehouseUsers) {
          await supabase.from("notifications").insert({
            user_id: w.id,
            type: "return_completed",
            title: "🏭 Return Arrived at Warehouse",
            message: `Return items for Order #${shortId(record.id)} received. Please inspect and complete.`,
            order_id: record.id,
            is_read: false,
          });
        }
      }

      // 18. Return complete
      if (oldStatus !== "returned" && newStatus === "returned") {
        await sendPush(
          record.user_id,
          "✅ Return Complete!",
          "Your return is complete! Thank you.",
          "/orders",
        );
        await sendWarehouseAll(
          "✅ Return Completed",
          `Return for Order #${shortId(record.id)} completed.`,
          "/returns",
        );
      }
    }
  }

  // ==========================================
  // TABLE: RETURN_REQUESTS
  // ==========================================
  if (table === "return_requests") {
    const getCustomerId = async (orderId: string): Promise<string | null> => {
      const { data: order } = await supabase
        .from("orders")
        .select("user_id")
        .eq("id", orderId)
        .single();
      return order?.user_id || null;
    };

    if (type === "INSERT") {
      const customerId = await getCustomerId(record.order_id);

      if (record.status === "approved" && record.reason === "pre_scheduled") {
        // PRE-SCHEDULED RETURN (created after payment succeeds)
        // Guard: only notify if the parent order is actually confirmed/completed.
        // This prevents false notifications if the return_request is somehow
        // created before payment (e.g. race condition or stale client code).
        const { data: parentOrder } = await supabase
          .from("orders")
          .select("status")
          .eq("id", record.order_id)
          .single();

        if (
          parentOrder?.status === "confirmed" ||
          parentOrder?.status === "completed"
        ) {
          if (customerId) {
            await sendPush(
              customerId,
              "📅 Return Scheduled",
              "Your return pickup has been scheduled along with the order.",
              "/orders",
            );
          }
        } else {
          log.info(
            `Skipping pre-scheduled return notification — parent order ${record.order_id} status=${parentOrder?.status}`,
          );
        }
      } else if (
        record.status === "requested" &&
        record.reason === "immediate"
      ) {
        // INSTANT RETURN REQUEST (from tracking page)
        if (customerId) {
          await sendPush(
            customerId,
            "⚡ Instant Return Requested",
            "Your instant return request is pending approval.",
            "/orders",
          );
          await supabase.from("notifications").insert({
            user_id: customerId,
            type: "return_scheduled",
            title: "⚡ Instant Return Requested",
            message:
              "Your instant return request has been submitted and is pending approval.",
            order_id: record.order_id,
            is_read: false,
          });
        }
        await sendWarehouseAll(
          "⚡ Instant Return Requested",
          `Instant return requested for Order #${shortId(record.order_id)}. Kindly approve it.`,
          "/returns",
        );
      } else {
        // NORMAL RETURN REQUEST
        if (customerId) {
          await sendPush(
            customerId,
            "📅 Return Requested",
            "Your return pickup request has been submitted.",
            "/orders",
          );
        }
        await sendWarehouseAll(
          "🔔 New Return Request",
          `Return requested for Order #${shortId(record.order_id)}.`,
          "/returns",
        );
      }
    }

    if (type === "UPDATE" && old_record) {
      const customerId = await getCustomerId(record.order_id);
      const oldStatus = old_record.status;
      const newStatus = record.status;

      // Return approved by warehouse
      if (oldStatus !== "approved" && newStatus === "approved") {
        if (customerId) {
          await sendPush(
            customerId,
            "✅ Return Approved",
            "Your return request has been approved. A rider will be assigned shortly.",
            "/orders",
          );
          await supabase.from("notifications").insert({
            user_id: customerId,
            type: "return_scheduled",
            title: "✅ Return Request Approved",
            message:
              "Your return has been approved and a rider will be assigned for pickup.",
            order_id: record.order_id,
            is_read: false,
          });
        }
        await sendWarehouseAll(
          "✅ Return Approved",
          `Return approved for Order #${shortId(record.order_id)}.`,
          "/returns",
        );
      }

      // Rider assigned for return pickup
      if (oldStatus !== "dispatched" && newStatus === "dispatched") {
        if (customerId) {
          await sendPush(
            customerId,
            "🚗 Rider Assigned",
            "A rider has been assigned to pick up your return items!",
            "/orders",
          );
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
          await sendPush(
            record.rider_id,
            "📦 Return Pickup Assigned",
            `Assigned a return pickup for Order #${shortId(record.order_id)}.`,
            "/deliveries",
          );
        }
        await sendWarehouseAll(
          "🏍️ Return Rider Dispatched",
          `Rider dispatched for return on Order #${shortId(record.order_id)}.`,
          "/returns",
        );
      }

      // Driver arrived at customer (for return pickup)
      if (oldStatus !== "driver_arrived" && newStatus === "driver_arrived") {
        if (customerId) {
          await sendPush(
            customerId,
            "📍 Driver Arrived",
            "Your driver is outside and ready to collect your return items!",
            "/orders",
          );
        }
        await sendWarehouseAll(
          "📍 Return Driver at Customer",
          `Driver reached pickup location for Order #${shortId(record.order_id)}.`,
          "/returns",
        );
      }

      // Return items collected from customer
      if (oldStatus !== "picked_up" && newStatus === "picked_up") {
        if (customerId) {
          await sendPush(
            customerId,
            "📦 Items Collected",
            "Your return items have been picked up by the rider!",
            "/orders",
          );
          await supabase.from("notifications").insert({
            user_id: customerId,
            type: "return_completed",
            title: "📦 Return Items Collected",
            message:
              "The rider has collected your items and is heading to the warehouse.",
            order_id: record.order_id,
            is_read: false,
          });
        }
        await sendWarehouseAll(
          "📦 Return Picked Up",
          `Rider collected items for Order #${shortId(record.order_id)}. En route to warehouse.`,
          "/returns",
        );
      }

      // Return flow completed
      if (oldStatus !== "completed" && newStatus === "completed") {
        if (customerId) {
          await sendPush(
            customerId,
            "✅ Return Completed",
            "Your return is complete! Thank you.",
            "/orders",
          );
          await supabase.from("notifications").insert({
            user_id: customerId,
            type: "return_completed",
            title: "✅ Return Complete",
            message: "Your return has been processed. Thank you!",
            order_id: record.order_id,
            is_read: false,
          });
        }
        await sendWarehouseAll(
          "✅ Return Completed",
          `Return for Order #${shortId(record.order_id)} is completed.`,
          "/returns",
        );
      }
    }
  }

  // ==========================================
  // CRON: 1-hour return reminder
  // ==========================================
  if (type === "CRON") {
    log.info("Executing CRON 1-hour reminder check...");
    const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const next15Mins = new Date(Date.now() + 75 * 60 * 1000).toISOString();

    const { data: upcomingReturns } = await supabase
      .from("return_requests")
      .select("id, order_id, pickup_slot")
      .gte("pickup_slot", oneHourFromNow)
      .lt("pickup_slot", next15Mins)
      .eq("status", "approved");

    if (upcomingReturns) {
      for (const ret of upcomingReturns) {
        const { data: ord } = await supabase
          .from("orders")
          .select("user_id")
          .eq("id", ret.order_id)
          .single();
        if (ord?.user_id) {
          await sendPush(
            ord.user_id,
            "⏰ Return Reminder",
            "Your return driver will arrive in approximately 1 hour!",
            "/orders",
          );
        }
        await sendWarehouseAll(
          "⏰ Upcoming Return Pickup",
          `1-hour warning: Return pickup for Order #${shortId(ret.order_id)} starting soon.`,
          "/returns",
        );
      }
    }
  }

  return jsonResponse(
    { success: true, processed: `${type} on ${table}` },
    200,
    log,
  );
});
