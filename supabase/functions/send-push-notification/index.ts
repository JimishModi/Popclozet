// deno-lint-ignore-file
// @ts-nocheck
// supabase/functions/send-push-notification/index.ts
//
// Sends Web Push notifications to subscribed users using VAPID.
//
// Deploy:  supabase functions deploy send-push-notification
//
// Required secrets (set via `supabase secrets set`):
//   VAPID_PUBLIC_KEY   — base64url VAPID public key
//   VAPID_PRIVATE_KEY  — base64url VAPID private key
//   VAPID_SUBJECT      — mailto:you@example.com  (or your app URL)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

// ── VAPID helpers ────────────────────────────────────────────────

function base64urlToUint8Array(base64url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function uint8ArrayToBase64url(arr: Uint8Array): string {
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function importVapidPrivateKey(base64urlKey: string): Promise<CryptoKey> {
  const raw = base64urlToUint8Array(base64urlKey);
  return crypto.subtle.importKey(
    "raw",
    raw,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey", "deriveBits"]
  );
}

async function importVapidPrivateKeyForSigning(base64urlKey: string): Promise<CryptoKey> {
  // Import as ECDSA for JWT signing
  const raw = base64urlToUint8Array(base64urlKey);
  // First import as ECDH raw to get the JWK, then re-import as ECDSA
  const ecdhKey = await crypto.subtle.importKey(
    "raw",
    raw,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey", "deriveBits"]
  );
  const jwk = await crypto.subtle.exportKey("jwk", ecdhKey);
  // Re-import as ECDSA private key
  return crypto.subtle.importKey(
    "jwk",
    { ...jwk, key_ops: ["sign"] },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
}

async function buildVapidAuthHeader(
  endpoint: string,
  vapidPublicKey: string,
  vapidPrivateKeyB64: string,
  subject: string
): Promise<string> {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;

  const now = Math.floor(Date.now() / 1000);
  const exp = now + 12 * 3600; // 12 hours

  const header = { typ: "JWT", alg: "ES256" };
  const payload = { aud: audience, exp, sub: subject };

  const encodedHeader = uint8ArrayToBase64url(
    new TextEncoder().encode(JSON.stringify(header))
  );
  const encodedPayload = uint8ArrayToBase64url(
    new TextEncoder().encode(JSON.stringify(payload))
  );

  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signingKey = await importVapidPrivateKeyForSigning(vapidPrivateKeyB64);

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    signingKey,
    new TextEncoder().encode(signingInput)
  );

  const encodedSignature = uint8ArrayToBase64url(new Uint8Array(signature));
  const jwt = `${signingInput}.${encodedSignature}`;

  return `vapid t=${jwt},k=${vapidPublicKey}`;
}

// ── Send one push subscription ───────────────────────────────────

async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string
): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    const authHeader = await buildVapidAuthHeader(
      subscription.endpoint,
      vapidPublicKey,
      vapidPrivateKey,
      vapidSubject
    );

    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aes128gcm",
        TTL: "86400",
      },
      body: new TextEncoder().encode(payload),
    });

    if (!response.ok && response.status !== 201) {
      const text = await response.text().catch(() => "");
      return { ok: false, status: response.status, error: text };
    }

    return { ok: true, status: response.status };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// ── Main handler ─────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  // ── Read VAPID secrets ──
  const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
  const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
  const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:support@popclozet.com";

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.error("[Push] VAPID secrets not configured");
    return jsonResponse({ error: "Push notifications not configured on server" }, 500);
  }

  const PUSH_INTERNAL_SECRET = Deno.env.get("PUSH_INTERNAL_SECRET");

  // ── Auth ──
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Missing Authorization header" }, 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const token = authHeader.replace("Bearer ", "");
  const isInternalCall = req.headers.get("x-internal-call") === "true" &&
    PUSH_INTERNAL_SECRET &&
    token === PUSH_INTERNAL_SECRET;

  let targetUserId: string;

  // ── Parse body (needed for both paths) ──
  let body: {
    test?: boolean;
    user_id?: string;
    title?: string;
    body?: string;
    type?: string;
    order_id?: string;
    url?: string;
    status?: string;
  };

  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  if (isInternalCall) {
    // Called from DB trigger — trust user_id from body
    if (!body.user_id) {
      return jsonResponse({ error: "Missing user_id for internal call" }, 400);
    }
    targetUserId = body.user_id;
    console.log(`[Push] Internal call for user ${targetUserId}, status: ${body.status}`);
  } else {
    // Called from browser — verify JWT
    const { data: { user: callerUser }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !callerUser) {
      console.error("[Push] JWT verification failed:", authError?.message);
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    targetUserId = body.user_id || callerUser.id;
  }

  // ── Build title/body from status if internal call ──
  const STATUS_MESSAGES: Record<string, { title: string; body: string; type: string }> = {
    confirmed:        { title: "✅ Order Confirmed!", body: "Your order has been confirmed and is being prepared.", type: "order_update" },
    ready_for_pickup: { title: "🚗 Driver Assigned!", body: "A driver has been assigned and is heading to pick up your order.", type: "order_update" },
    out_for_delivery: { title: "🛵 Out for Delivery!", body: "Your order is out for delivery and heading your way.", type: "order_update" },
    return_scheduled: { title: "📅 Return Pickup Scheduled", body: "Your return pickup has been scheduled.", type: "order_update" },
  };

  let title: string;
  let notifBody: string;
  let type: string;
  let url: string;

  if (body.status && STATUS_MESSAGES[body.status]) {
    const cfg = STATUS_MESSAGES[body.status];
    title = cfg.title;
    notifBody = cfg.body;
    type = cfg.type;
    url = "/orders";
  } else {
    title = body.title || "";
    notifBody = body.body || "";
    type = body.type || "general";
    url = body.url || "/notifications";
  }

  if (!title || !notifBody) {
    return jsonResponse({ error: "Missing required fields: title, body" }, 400);
  }

  const order_id = body.order_id;

  // ── Fetch subscriptions for target user ──
  const { data: subscriptions, error: fetchError } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", targetUserId);

  if (fetchError) {
    console.error("[Push] Failed to fetch subscriptions:", fetchError);
    return jsonResponse({ error: "Failed to fetch subscriptions" }, 500);
  }

  if (!subscriptions || subscriptions.length === 0) {
    console.log(`[Push] No subscriptions for user ${targetUserId}`);
    return jsonResponse({ sent: 0, message: "No active subscriptions for this user" });
  }

  // ── Build notification payload ──
  const notificationPayload = JSON.stringify({
    title,
    body: notifBody,
    icon: "/icons/icon-192x192.png",
    badge: "/icons/badge-72x72.png",
    tag: type,
    data: {
      url,
      type,
      order_id: order_id || null,
    },
  });

  // ── Send to all subscriptions ──
  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      sendWebPush(sub, notificationPayload, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT)
    )
  );

  let sent = 0;
  const staleEndpoints: string[] = [];

  results.forEach((result, i) => {
    if (result.status === "fulfilled") {
      const r = result.value;
      if (r.ok) {
        sent++;
      } else {
        console.warn(`[Push] Failed for endpoint index ${i}: ${r.status} ${r.error}`);
        // 410 Gone = subscription expired, clean it up
        if (r.status === 410) {
          staleEndpoints.push(subscriptions[i].endpoint);
        }
      }
    } else {
      console.error(`[Push] Promise rejected for index ${i}:`, result.reason);
    }
  });

  // ── Clean up expired subscriptions ──
  if (staleEndpoints.length > 0) {
    console.log(`[Push] Removing ${staleEndpoints.length} stale subscription(s)...`);
    await supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", targetUserId)
      .in("endpoint", staleEndpoints);
  }

  console.log(`[Push] Sent ${sent}/${subscriptions.length} notifications to user ${targetUserId}`);

  return jsonResponse({
    sent,
    total: subscriptions.length,
    stale_removed: staleEndpoints.length,
  });
});
