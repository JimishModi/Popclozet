/**
 * Push Notification Service
 * Handles Web Push API subscription, permission, and storage
 */

import { supabase } from "@popclozet/api-client";
import { invokeWithUserJwt } from "@/services/supabaseFunctionInvoke";

// VAPID public key from environment
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || "";

// ─── Helpers ────────────────────────────────────────────────────

/**
 * Convert a base64url VAPID key to Uint8Array for Web Push API
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// ─── Push Support Detection ─────────────────────────────────────

/**
 * Check if the browser supports push notifications
 */
export function isPushSupported(): boolean {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/**
 * Get current notification permission state
 */
export function getPermissionState(): NotificationPermission {
  if (!("Notification" in window)) return "denied";
  return Notification.permission;
}

// ─── Permission Request ─────────────────────────────────────────

/**
 * Request notification permission from the user
 * Returns the permission result
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) {
    console.warn("[Push] Notifications not supported in this browser");
    return "denied";
  }

  // Already granted
  if (Notification.permission === "granted") {
    console.log("[Push] Permission already granted");
    return "granted";
  }

  // Already denied — can't re-ask
  if (Notification.permission === "denied") {
    console.warn("[Push] Permission was previously denied by user");
    return "denied";
  }

  // Ask for permission
  console.log("[Push] Requesting notification permission...");
  const result = await Notification.requestPermission();
  console.log(`[Push] Permission result: ${result}`);
  return result;
}

// ─── Push Subscription ──────────────────────────────────────────

/**
 * Get the active service worker registration (with timeout to prevent hanging)
 */
async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;

  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    console.log(`[Push] Current SW registrations count:`, regs.length);
    if (regs.length > 0) {
      console.log(`[Push] SW Status: installing=${!!regs[0].installing}, waiting=${!!regs[0].waiting}, active=${!!regs[0].active}`);
    }

    // Race against a timeout so we never hang indefinitely
    const timeout = new Promise<null>((resolve) =>
      setTimeout(() => {
        console.warn("[Push] Service worker .ready timed out after 15s (not registered or still installing)");
        resolve(null);
      }, 15000)
    );

    const registration = await Promise.race([
      navigator.serviceWorker.ready,
      timeout,
    ]);
    return registration;
  } catch (err) {
    console.error("[Push] Failed to get SW registration:", err);
    return null;
  }
}

/**
 * Get existing push subscription, if any
 */
export async function getExistingSubscription(): Promise<PushSubscription | null> {
  const registration = await getServiceWorkerRegistration();
  if (!registration) return null;

  try {
    const subscription = await registration.pushManager.getSubscription();
    return subscription;
  } catch (err) {
    console.error("[Push] Failed to get existing subscription:", err);
    return null;
  }
}

/**
 * Subscribe the user to push notifications
 * Full flow: permission → SW subscription → save to Supabase
 */
export async function subscribeToPush(): Promise<{
  success: boolean;
  subscription?: PushSubscription;
  error?: string;
}> {
  console.log("[Push] Starting subscription flow...");
  console.log("[Push] User Agent:", navigator.userAgent);
  console.log("[Push] Display mode:", window.matchMedia('(display-mode: standalone)').matches ? 'standalone (PWA)' : 'browser tab');

  // 1. Check support
  if (!isPushSupported()) {
    const missing = [];
    if (!("serviceWorker" in navigator)) missing.push("serviceWorker");
    if (!("PushManager" in window)) missing.push("PushManager");
    if (!("Notification" in window)) missing.push("Notification");
    console.error("[Push] Not supported. Missing:", missing.join(", "));
    return { success: false, error: `Push not supported (missing: ${missing.join(", ")})` };
  }

  // 2. Check VAPID key
  if (!VAPID_PUBLIC_KEY) {
    console.error("[Push] VAPID_PUBLIC_KEY not configured");
    return { success: false, error: "Push notifications not configured" };
  }

  // 3. Request permission
  const permission = await requestNotificationPermission();
  if (permission !== "granted") {
    return { success: false, error: `Notification permission ${permission}` };
  }

  // 4. Get service worker registration
  const registration = await getServiceWorkerRegistration();
  if (!registration) {
    return { success: false, error: "Service worker not registered" };
  }

  try {
    // 5. Check for existing subscription
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      // 6. Create new push subscription
      console.log("[Push] Creating new push subscription...");
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });
      console.log("[Push] Push subscription created successfully");
    } else {
      console.log("[Push] Using existing push subscription");
    }

    // 7. Save to Supabase
    await saveSubscriptionToServer(subscription);

    return { success: true, subscription };
  } catch (err) {
    console.error("[Push] Subscription failed:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to subscribe",
    };
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPush(): Promise<boolean> {
  console.log("[Push] Unsubscribing...");

  try {
    const subscription = await getExistingSubscription();
    if (!subscription) {
      console.log("[Push] No active subscription found");
      return true;
    }

    // Remove from Supabase first
    await removeSubscriptionFromServer(subscription);

    // Unsubscribe from browser
    await subscription.unsubscribe();
    console.log("[Push] Successfully unsubscribed");
    return true;
  } catch (err) {
    console.error("[Push] Unsubscribe failed:", err);
    return false;
  }
}

// ─── Server sync ────────────────────────────────────────────────

/**
 * Save the push subscription to Supabase
 */
async function saveSubscriptionToServer(subscription: PushSubscription): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.warn("[Push] Not authenticated, skipping server save");
    return;
  }

  const json = subscription.toJSON();
  const keys = json.keys as { p256dh: string; auth: string } | undefined;

  if (!json.endpoint || !keys?.p256dh || !keys?.auth) {
    console.error("[Push] Invalid subscription object:", json);
    return;
  }

  console.log("[Push] Saving subscription to server...");

  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        user_id: user.id,
        endpoint: json.endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        user_agent: navigator.userAgent,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id,endpoint",
      }
    );

  if (error) {
    console.error("[Push] Failed to save subscription:", error);
    throw error;
  }

  console.log("[Push] Subscription saved to server ✓");
}

/**
 * Remove a push subscription from the server
 */
async function removeSubscriptionFromServer(subscription: PushSubscription): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const json = subscription.toJSON();

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", json.endpoint || "");

  if (error) {
    console.error("[Push] Failed to remove subscription from server:", error);
  } else {
    console.log("[Push] Subscription removed from server ✓");
  }
}

// ─── Send test notification (via Edge Function) ─────────────────

/**
 * Send a test push notification to the current user
 */
export async function sendTestPush(): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.warn("[Push] Not authenticated");
      return false;
    }

    const response = await invokeWithUserJwt("send-push-notification", {
      body: {
        test: true,
        title: "🎉 Push Notifications Enabled!",
        body: "You'll now receive order updates, delivery alerts & return reminders.",
        type: "general",
        url: "/notifications",
      },
    });

    if (response.error) {
      console.error("[Push] Test notification failed:", response.error);
      return false;
    }

    console.log("[Push] Test notification sent ✓", response.data);
    return true;
  } catch (err) {
    console.error("[Push] Test notification error:", err);
    return false;
  }
}

// ─── Trigger push for order status changes ──────────────────────

/** Status changes that should trigger a push notification */
const PUSH_WORTHY_STATUSES: Record<string, { title: string; body: string }> = {
  confirmed: {
    title: "✅ Order Confirmed!",
    body: "Your order has been confirmed and is being prepared.",
  },
  ready_for_pickup: {
    title: "🚗 Driver Assigned!",
    body: "A driver has been assigned and is heading to pick up your order.",
  },
  out_for_delivery: {
    title: "🛵 Out for Delivery!",
    body: "Your order is out for delivery and heading your way.",
  },
  // ── Return lifecycle statuses ──
  return_requested: {
    title: "📋 Return Request Submitted",
    body: "Your return request has been submitted for review.",
  },
  return_scheduled: {
    title: "✅ Return Approved",
    body: "Your return has been approved. A rider will be assigned shortly.",
  },
  return_dispatched: {
    title: "🚗 Rider On The Way",
    body: "A rider has been assigned and is heading to collect your return items.",
  },
  return_picked_up: {
    title: "📦 Items Picked Up",
    body: "Your return items have been collected and are heading to the warehouse.",
  },
  return_at_warehouse: {
    title: "🏭 Items at Warehouse",
    body: "Your returned items have arrived at the warehouse for inspection.",
  },
  returned: {
    title: "✅ Return Complete",
    body: "Your return is complete! Your deposit refund has been initiated.",
  },
};

/**
 * Trigger push notification for an order status change.
 * Only sends for key statuses (not every minor update).
 * Called from notificationService after inserting the in-app notification.
 */
export async function triggerPushForOrderStatus(
  userId: string,
  orderId: string,
  status: string
): Promise<void> {
  const config = PUSH_WORTHY_STATUSES[status];
  if (!config) {
    // Not a push-worthy status
    return;
  }

  try {
    const { error } = await invokeWithUserJwt("send-push-notification", {
      body: {
        user_id: userId,
        title: config.title,
        body: config.body,
        type: "order_update",
        order_id: orderId,
        url: "/orders",
      },
    });

    if (error) {
      console.error("[Push] Failed to send push for order status:", error);
    } else {
      console.log(`[Push] Push sent for order ${orderId} status ${status}`);
    }
  } catch (err) {
    console.error("[Push] Error sending push for order status:", err);
  }
}
