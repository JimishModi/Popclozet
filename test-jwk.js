import crypto from 'crypto';

function base64urlToUint8Array(base64url) {
  const padding = "=".repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = Buffer.from(base64, 'base64').toString('binary');
  const arr = new Uint8Array(raw.length);
  for(let i=0; i<raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}
function uint8ArrayToBase64url(bytes) {
  return Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function test() {
  const subtle = crypto.webcrypto.subtle;
  const vapidPrivStr = "t4kF5nOEyXglw4ZcHNbGJ8oo6srCA2AlVir0tT3J9CY";
  const vapidPubStr = "BCc53W_cxfa2ShsTvw_x_P33p-xsOmywF05YKs2wNodx-x-v4lOicppO4dF96u7QTrbzxnoY99QjElG7CsDGRc8";
  
  const pubBytes = base64urlToUint8Array(vapidPubStr);
  const x = uint8ArrayToBase64url(pubBytes.slice(1, 33));
  const y = uint8ArrayToBase64url(pubBytes.slice(33, 65));
  
  const jwk = {
    kty: "EC",
    crv: "P-256",
    x: x,
    y: y,
    d: vapidPrivStr,
    ext: true
  };

  try {
    const key = await subtle.importKey("jwk", jwk, {name: "ECDSA", namedCurve: "P-256"}, false, ["sign"]);
    console.log("JWK IMPORT OK!");
    const sig = await subtle.sign({name: "ECDSA", hash: "SHA-256"}, key, new Uint8Array([1,2,3]));
    console.log("JWK SIGN OK!", new Uint8Array(sig).length);
  } catch(e) {
    console.error("FAILED JWK", e);
  }
}
test();
