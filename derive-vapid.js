const crypto = require('crypto');
const fs = require('fs');

function base64url(buf) {
  return buf.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

const privHex = process.env.VAPID_PRIVATE_KEY_HEX;
if (!privHex) {
  throw new Error('Missing VAPID_PRIVATE_KEY_HEX');
}

const outputPath = process.env.VAPID_PUBLIC_KEY_OUTPUT || 'derived-pub.txt';
const ecdh = crypto.createECDH('prime256v1');
ecdh.setPrivateKey(Buffer.from(privHex, 'hex'));

const pubKeyBytes = ecdh.getPublicKey();
const pubBase64url = base64url(pubKeyBytes);

fs.writeFileSync(outputPath, pubBase64url);
console.log(`Wrote ${outputPath}`);
