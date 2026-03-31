import crypto from 'crypto';

function base64urlToUint8Array(base64url) {
  const padding = "=".repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = Buffer.from(base64, 'base64').toString('binary');
  const arr = new Uint8Array(raw.length);
  for(let i=0; i<raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

async function test() {
  const subtle = crypto.webcrypto.subtle;
  const vapidPrivUrl = "t4kF5nOEyXglw4ZcHNbGJ8oo6srCA2AlVir0tT3J9CY";
  const vapidPrivBytes = base64urlToUint8Array(vapidPrivUrl);

  const header = new Uint8Array([
    0x30, 0x41, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06,
    0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01,
    0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03,
    0x01, 0x07, 0x04, 0x27, 0x30, 0x25, 0x02, 0x01,
    0x01, 0x04, 0x20
  ]);
  const pkcs8 = new Uint8Array(header.length + vapidPrivBytes.length);
  pkcs8.set(header);
  pkcs8.set(vapidPrivBytes, header.length);

  try {
    console.log("Testing import VAPID PKCS8...");
    await subtle.importKey(
      "pkcs8",
      pkcs8,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign"],
    );
    console.log("VAPID OK");
  } catch(e) {
    console.error("VAPID FAILED:", e);
  }

  const p256dh = "BBb5p1AfvmPz78kX2vZRh5imzaQdrMCZEr8HckmHCzawMNgKJV31vMY0-i9X5rgq_l0aG-RulsFoNW7UtFKeTfk";
  try {
    console.log("Testing import p256dh as ECDH raw...");
    const key = await subtle.importKey(
      "raw",
      base64urlToUint8Array(p256dh),
      { name: "ECDH", namedCurve: "P-256" },
      true,
      [],
    );
    console.log("P256DH OK");
  } catch(e) {
    console.error("P256DH FAILED:", e);
  }
}
test();
