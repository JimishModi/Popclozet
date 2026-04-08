// deno-lint-ignore-file
// @ts-nocheck
// supabase/functions/send-push-notification/index.ts
//
// Sends Web Push notifications to subscribed users using VAPID.
//
// Deploy:  supabase functions deploy send-push-notification
//
// Required secrets (set via `supabase secrets set`):
//   VAPID_PUBLIC_KEY   — base64url OR 64-char hex VAPID public key
//   VAPID_PRIVATE_KEY  — base64url OR 64-char hex VAPID private key
//   VAPID_SUBJECT      — mailto:you@example.com  (or your app URL)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

// ── Encoding helpers ─────────────────────────────────────────────

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

function hexToUint8Array(hex: string): Uint8Array {
  const clean = hex.replace(/^0x/, "");
  const padded = clean.length % 2 === 0 ? clean : "0" + clean;
  return new Uint8Array(padded.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrays) {
    out.set(a, off);
    off += a.length;
  }
  return out;
}

function lenBuf(n: number, bytes: number): Uint8Array {
  const b = new Uint8Array(bytes);
  for (let i = bytes - 1; i >= 0; i--) {
    b[i] = n & 0xff;
    n >>= 8;
  }
  return b;
}

// ── PKCS8 DER builder for P-256 private key ──────────────────────
//
// Constructs a minimal PrivateKeyInfo (PKCS8) DER for a raw 32-byte
// P-256 private key — no embedded public key field.
// V8/BoringSSL (Deno) computes the public key automatically on import.

function buildPkcs8(privKeyBytes: Uint8Array): Uint8Array {
  if (privKeyBytes.length !== 32) {
    throw new Error(
      `Invalid P-256 private key: expected 32 bytes, got ${privKeyBytes.length}`,
    );
  }
  // Fixed 34-byte header:
  //   30 41 - SEQUENCE (65 bytes)
  //     02 01 00 - INTEGER 0 (version)
  //     30 13 - SEQUENCE (19 bytes, AlgorithmIdentifier)
  //       06 07 2a 86 48 ce 3d 02 01 - OID id-ecPublicKey
  //       06 08 2a 86 48 ce 3d 03 01 07 - OID prime256v1
  //     04 27 - OCTET STRING (39 bytes, privateKey)
  //       30 25 - SEQUENCE (37 bytes, ECPrivateKey)
  //         02 01 01 - INTEGER 1 (version)
  //         04 20 - OCTET STRING (32 bytes)
  //           <32 bytes of key>
  const header = new Uint8Array([
    0x30, 0x41, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48,
    0xce, 0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03,
    0x01, 0x07, 0x04, 0x27, 0x30, 0x25, 0x02, 0x01, 0x01, 0x04, 0x20,
  ]);
  return concat(header, privKeyBytes);
}
// ── Normalize VAPID key pair ──────────────────────────────────────
//
// Accepts hex OR base64url keys, returns:
//   pub      — 65-byte uncompressed public key as base64url
//   privBytes — raw 32-byte private key bytes

async function normalizeVapidKeys(
  pubKeyRaw: string,
  privKeyRaw: string,
  log?: ReturnType<typeof makeLogger>,
): Promise<{ pub: string; privBytes: Uint8Array }> {
  let privKeyBytes: Uint8Array;
  let pubKeyB64: string;

  const isHex64 = /^[0-9a-fA-F]{64}$/.test(privKeyRaw.trim());

  if (isHex64) {
    // ── Hex private key: derive the public key via WebCrypto ──
    privKeyBytes = hexToUint8Array(privKeyRaw.trim());

    const pkcs8 = buildPkcs8(privKeyBytes);

    // Import as ECDSA (extractable=true so we can export JWK)
    const ecdsaKey = await crypto.subtle.importKey(
      "pkcs8",
      pkcs8,
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["sign"],
    );

    // Export JWK to recover x, y coordinates
    const jwk = (await crypto.subtle.exportKey("jwk", ecdsaKey)) as any;
    const xBytes = base64urlToUint8Array(jwk.x);
    const yBytes = base64urlToUint8Array(jwk.y);

    // 65-byte uncompressed public key: 0x04 || x || y
    pubKeyB64 = uint8ArrayToBase64url(
      concat(new Uint8Array([0x04]), xBytes, yBytes),
    );

    if (log) {
      log.info("Hex VAPID keys normalised", {
        pubKey: pubKeyB64.slice(0, 20) + "...",
      });
    } else {
      console.log(
        "[Push] Hex VAPID keys normalised. Derived public key:",
        pubKeyB64.slice(0, 20) + "...",
      );
    }
  } else {
    // ── base64url private key ──
    privKeyBytes = base64urlToUint8Array(privKeyRaw.trim());
    pubKeyB64 = pubKeyRaw.trim();
  }

  return { pub: pubKeyB64, privBytes: privKeyBytes };
}

// ── VAPID JWT ─────────────────────────────────────────────────────

async function buildVapidAuthHeader(
  endpoint: string,
  vapidPublicKeyB64: string,
  vapidPrivKeyBytes: Uint8Array,
  subject: string,
): Promise<string> {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;

  const now = Math.floor(Date.now() / 1000);
  const exp = now + 12 * 3600; // 12 hours

  const header = { typ: "JWT", alg: "ES256" };
  const payload = { aud: audience, exp, sub: subject };

  const encodedHeader = uint8ArrayToBase64url(
    new TextEncoder().encode(JSON.stringify(header)),
  );
  const encodedPayload = uint8ArrayToBase64url(
    new TextEncoder().encode(JSON.stringify(payload)),
  );

  const signingInput = `${encodedHeader}.${encodedPayload}`;

  // Import private key via PKCS8 for ECDSA signing
  const pubBytes = base64urlToUint8Array(vapidPublicKeyB64);
  const x = uint8ArrayToBase64url(pubBytes.slice(1, 33));
  const y = uint8ArrayToBase64url(pubBytes.slice(33, 65));
  const d = uint8ArrayToBase64url(vapidPrivKeyBytes);

  const jwk = {
    kty: "EC",
    crv: "P-256",
    x,
    y,
    d,
    ext: true,
  };

  const signingKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    signingKey,
    new TextEncoder().encode(signingInput),
  );

  const encodedSignature = uint8ArrayToBase64url(new Uint8Array(signature));
  const jwt = `${signingInput}.${encodedSignature}`;

  return `vapid t=${jwt},k=${vapidPublicKeyB64}`;
}

// ── RFC 8291 AES-128-GCM Web Push Encryption ────────────────────
//
// Implements the full encryption spec required by browsers:
//   1. ECDH shared secret  (ephemeral server key + subscriber p256dh)
//   2. HKDF key derivation (auth secret → PRK → CEK + Nonce)
//   3. AES-128-GCM encrypt with a 16-byte padding record

async function hkdfExpand(
  prk: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    prk,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const t = new Uint8Array(0);
  let okm = new Uint8Array(0);
  let tPrev = t;
  for (let i = 1; okm.length < length; i++) {
    const input = new Uint8Array(tPrev.length + info.length + 1);
    input.set(tPrev);
    input.set(info, tPrev.length);
    input[tPrev.length + info.length] = i;
    const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, input));
    tPrev = sig;
    const merged = new Uint8Array(okm.length + sig.length);
    merged.set(okm);
    merged.set(sig, okm.length);
    okm = merged;
  }
  return okm.slice(0, length);
}

async function hkdf(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array> {
  const saltKey = await crypto.subtle.importKey(
    "raw",
    salt,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const prk = new Uint8Array(await crypto.subtle.sign("HMAC", saltKey, ikm));
  return hkdfExpand(prk, info, length);
}

async function encryptWebPushPayload(
  p256dh: string,
  auth: string,
  plaintext: string,
): Promise<{ encrypted: Uint8Array }> {
  const enc = new TextEncoder();

  // 1. Import subscriber public key
  const receiverPub = await crypto.subtle.importKey(
    "raw",
    base64urlToUint8Array(p256dh),
    { name: "ECDH", namedCurve: "P-256" },
    true,
    [],
  );

  // 2. Generate ephemeral server key pair
  const serverKP = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  );
  const serverPubRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", serverKP.publicKey),
  );

  // 3. ECDH shared secret
  const sharedBits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: receiverPub },
    serverKP.privateKey,
    256,
  );
  const sharedSecret = new Uint8Array(sharedBits);

  const authBytes = base64urlToUint8Array(auth);
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // 4. Derive pseudo-random key (RFC 8291 §3.3)
  const prkInfoLabel = enc.encode("WebPush: info\0");
  const receiverPubRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", receiverPub),
  );
  const prkInfo = concat(prkInfoLabel, receiverPubRaw, serverPubRaw);
  const prk = await hkdf(authBytes, sharedSecret, prkInfo, 32);

  // 5. CEK (16 bytes) and Nonce (12 bytes)
  const cekInfo = enc.encode("Content-Encoding: aes128gcm\0");
  const nonceInfo = enc.encode("Content-Encoding: nonce\0");
  const cek = await hkdf(salt, prk, cekInfo, 16);
  const nonce = await hkdf(salt, prk, nonceInfo, 12);

  // 6. Encrypt: plaintext + \x02 (single-record padding delimiter)
  const plaintextBytes = enc.encode(plaintext);
  const padded = concat(plaintextBytes, new Uint8Array([2]));

  const aesKey = await crypto.subtle.importKey(
    "raw",
    cek,
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, padded),
  );

  // 7. Build RFC 8291 header: salt(16) + rs(4) + idlen(1) + serverPubKey(65) + ciphertext
  const rs = lenBuf(4096, 4);
  const idlen = new Uint8Array([65]);
  const encrypted = concat(salt, rs, idlen, serverPubRaw, ciphertext);

  return { encrypted };
}

// ── Send one push subscription ───────────────────────────────────

async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  vapidPublicKey: string,
  vapidPrivKeyBytes: Uint8Array,
  vapidSubject: string,
  log?: ReturnType<typeof makeLogger>,
): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    let authHeader;
    try {
      authHeader = await buildVapidAuthHeader(
        subscription.endpoint,
        vapidPublicKey,
        vapidPrivKeyBytes,
        vapidSubject,
      );
    } catch (e) {
      throw new Error(
        "buildVapidAuthHeader failed! Maybe VAPID_PRIVATE_KEY is bad? Error: " +
          e.message,
      );
    }

    let encryptedObj;
    try {
      encryptedObj = await encryptWebPushPayload(
        subscription.p256dh,
        subscription.auth,
        payload,
      );
    } catch (e) {
      throw new Error(
        "encryptWebPushPayload failed! Maybe p256dh is bad? Error: " +
          e.message,
      );
    }
    const { encrypted } = encryptedObj;

    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aes128gcm",
        TTL: "86400",
        "Content-Length": String(encrypted.length),
      },
      body: encrypted,
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
  const log = makeLogger("send-push-notification");
  log.info("request started");

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    log.error("Method not allowed", { method: req.method });
    return jsonResponse({ error: "Method not allowed" }, 405, log);
  }

  // ── Read VAPID secrets ──
  const VAPID_PUBLIC_KEY_ENV = Deno.env.get("VAPID_PUBLIC_KEY");
  const VAPID_PRIVATE_KEY_ENV = Deno.env.get("VAPID_PRIVATE_KEY");
  const VAPID_SUBJECT =
    Deno.env.get("VAPID_SUBJECT") || "mailto:support@popclozet.in";

  if (!VAPID_PUBLIC_KEY_ENV || !VAPID_PRIVATE_KEY_ENV) {
    log.error("VAPID secrets not configured");
    return jsonResponse(
      { error: "Push notifications not configured on server" },
      500,
      log,
    );
  }

  // ── Normalise keys (handles hex OR base64url format) ──
  let vapidPub: string;
  let vapidPrivBytes: Uint8Array;
  try {
    const normalised = await normalizeVapidKeys(
      VAPID_PUBLIC_KEY_ENV,
      VAPID_PRIVATE_KEY_ENV,
      log,
    );
    vapidPub = normalised.pub;
    vapidPrivBytes = normalised.privBytes;
  } catch (err: any) {
    log.error("Failed to normalise VAPID keys", { error: String(err) });
    return jsonResponse({ error: "Invalid VAPID key configuration" }, 500, log);
  }

  const PUSH_INTERNAL_SECRET = Deno.env.get("PUSH_INTERNAL_SECRET");

  // ── Auth ──
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    log.error("Missing Authorization header");
    return jsonResponse({ error: "Missing Authorization header" }, 401, log);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    log.error("Supabase credentials not configured");
    return jsonResponse({ error: "Server configuration error" }, 500, log);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const token = authHeader.replace("Bearer ", "");
  const isInternalCall =
    req.headers.get("x-internal-call") === "true" &&
    PUSH_INTERNAL_SECRET &&
    token === PUSH_INTERNAL_SECRET;

  let targetUserId: string;

  let body: {
    test?: boolean;
    user_id?: string;
    title?: string;
    body?: string;
    type?: string;
    tag?: string;
    order_id?: string;
    url?: string;
    status?: string;
  };

  try {
    body = await req.json();
  } catch {
    log.error("Invalid JSON body");
    return jsonResponse({ error: "Invalid JSON body" }, 400, log);
  }

  if (isInternalCall) {
    if (!body.user_id) {
      log.error("Missing user_id for internal call");
      return jsonResponse(
        { error: "Missing user_id for internal call" },
        400,
        log,
      );
    }
    targetUserId = body.user_id;
    log.info(`Internal call`, { targetUserId, status: body.status });
  } else {
    const {
      data: { user: callerUser },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !callerUser) {
      log.error("JWT verification failed", { error: authError?.message });
      return jsonResponse({ error: "Unauthorized" }, 401, log);
    }
    targetUserId = body.user_id || callerUser.id;
  }

  // ── Build title/body from status if internal call ──
  const STATUS_MESSAGES: Record<
    string,
    { title: string; body: string; type: string }
  > = {
    confirmed: {
      title: "✅ Order Confirmed!",
      body: "Your order has been confirmed and is being prepared.",
      type: "order_update",
    },
    ready_for_pickup: {
      title: "🚗 Driver Assigned!",
      body: "A driver has been assigned and is heading to pick up your order.",
      type: "order_update",
    },
    out_for_delivery: {
      title: "🛵 Out for Delivery!",
      body: "Your order is out for delivery and heading your way.",
      type: "order_update",
    },
    return_scheduled: {
      title: "📅 Return Pickup Scheduled",
      body: "Your return pickup has been scheduled.",
      type: "order_update",
    },
  };

  let title: string;
  let notifBody: string;
  let type: string;
  let tag: string;
  let url: string;

  if (body.status && STATUS_MESSAGES[body.status]) {
    const cfg = STATUS_MESSAGES[body.status];
    title = cfg.title;
    notifBody = cfg.body;
    type = cfg.type;
    tag = body.tag || cfg.type;
    url = "/orders";
  } else {
    title = body.title || "";
    notifBody = body.body || "";
    type = body.type || "general";
    tag = body.tag || type;
    url = body.url || "/notifications";
  }

  if (!title || !notifBody) {
    log.warn("Missing required fields", { title, notifBody });
    return jsonResponse(
      { error: "Missing required fields: title, body" },
      400,
      log,
    );
  }

  const order_id = body.order_id;

  // ── Fetch subscriptions for target user ──
  const { data: subscriptions, error: fetchError } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", targetUserId);

  if (fetchError) {
    log.error("Failed to fetch subscriptions", { error: String(fetchError) });
    return jsonResponse({ error: "Failed to fetch subscriptions" }, 500, log);
  }

  if (!subscriptions || subscriptions.length === 0) {
    log.info(`No subscriptions for user`, { targetUserId });
    return jsonResponse(
      { sent: 0, message: "No active subscriptions for this user" },
      200,
      log,
    );
  }

  // ── Build notification payload ──
  const notificationPayload = JSON.stringify({
    title,
    body: notifBody,
    icon: "/icons/icon-192x192.png",
    badge: "/icons/badge-72x72.png",
    tag,
    data: {
      url,
      type,
      order_id: order_id || null,
    },
  });

  // ── Send to all subscriptions ──
  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      sendWebPush(
        sub,
        notificationPayload,
        vapidPub,
        vapidPrivBytes,
        VAPID_SUBJECT,
        log,
      ),
    ),
  );

  let sent = 0;
  const staleEndpoints: string[] = [];

  results.forEach((result, i) => {
    if (result.status === "fulfilled") {
      const r = result.value;
      if (r.ok) {
        sent++;
      } else {
        log.warn(`Failed for endpoint`, {
          index: i,
          reqStatus: r.status,
          reqError: r.error,
        });
        if (r.status === 410) {
          staleEndpoints.push(subscriptions[i].endpoint);
        }
      }
    } else {
      log.error(`Promise rejected for index ${i}`, {
        reason: String(result.reason),
      });
    }
  });

  // ── Clean up expired subscriptions ──
  if (staleEndpoints.length > 0) {
    log.info(`Removing stale subscription(s)`, {
      count: staleEndpoints.length,
    });
    await supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", targetUserId)
      .in("endpoint", staleEndpoints);
  }

  log.info(`Sent notifications`, {
    sent,
    total: subscriptions.length,
    targetUserId,
  });

  return jsonResponse(
    {
      sent,
      total: subscriptions.length,
      stale_removed: staleEndpoints.length,
    },
    200,
    log,
  );
});
