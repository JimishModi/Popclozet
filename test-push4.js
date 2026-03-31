const fs = require('fs');
const https = require('https');

const SUPABASE_URL = process.env.SUPABASE_URL;
const PUSH_INTERNAL_SECRET = process.env.PUSH_INTERNAL_SECRET;
const TEST_USER_ID = process.env.TEST_USER_ID;

if (!SUPABASE_URL || !PUSH_INTERNAL_SECRET || !TEST_USER_ID) {
  throw new Error('Missing SUPABASE_URL, PUSH_INTERNAL_SECRET, or TEST_USER_ID');
}

const { hostname } = new URL(SUPABASE_URL);
const data = JSON.stringify({ user_id: TEST_USER_ID, status: 'confirmed' });

const options = {
  hostname,
  port: 443,
  path: '/functions/v1/send-push-notification',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-internal-call': 'true',
    'Authorization': `Bearer ${PUSH_INTERNAL_SECRET}`,
    'Content-Length': Buffer.byteLength(data),
  },
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (d) => { body += d; });
  res.on('end', () => {
    console.log('--- OUTPUT ---');
    console.log('Status:', res.statusCode);
    console.log('Body:', body);
    fs.writeFileSync('out4.txt', `Status: ${res.statusCode}\nBody: ${body}`);
  });
});

req.on('error', (e) => {
  console.error(e);
  fs.writeFileSync('out4.txt', e.toString());
});
req.write(data);
req.end();
