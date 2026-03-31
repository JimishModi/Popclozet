const crypto = require("crypto");
const fs = require("fs");

try {
  const privHex = process.env.VAPID_PRIVATE_KEY_HEX;
  if (!privHex) {
    throw new Error("Missing VAPID_PRIVATE_KEY_HEX");
  }

  const outputPath = process.env.VAPID_PUBLIC_KEY_OUTPUT || "out_vapid.txt";
  const ecdh = crypto.createECDH("prime256v1");
  ecdh.setPrivateKey(Buffer.from(privHex, "hex"));
  const pub = ecdh.getPublicKey();
  const b64 = pub.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  fs.writeFileSync(outputPath, b64);
  console.log(`Written ${outputPath}`);
} catch (e) {
  fs.writeFileSync("out_vapid.txt", e.toString());
}
