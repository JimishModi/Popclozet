import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = 'https://hfcdvcpgpkdgmcakgiuy.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const IMAGE_PATH   = process.env.IMAGE_PATH;
const CATEGORY     = process.env.CATEGORY ?? 'footwear';

if (!SUPABASE_KEY) { console.error('Set SUPABASE_SERVICE_KEY'); process.exit(1); }
if (!IMAGE_PATH || !fs.existsSync(IMAGE_PATH)) { console.error('Set IMAGE_PATH to a valid file'); process.exit(1); }

const sb  = createClient(SUPABASE_URL, SUPABASE_KEY);
const ext = path.extname(IMAGE_PATH).slice(1).toLowerCase();
const buf = fs.readFileSync(IMAGE_PATH);
const storagePath = `collection-page/${CATEGORY}.${ext}`;

console.log(`Uploading ${IMAGE_PATH} → assets/${storagePath} ...`);

const { error: upErr } = await sb.storage
  .from('assets')
  .upload(storagePath, buf, { contentType: `image/${ext}`, upsert: true });

if (upErr) { console.error('Upload failed:', upErr.message); process.exit(1); }

const { data } = sb.storage.from('assets').getPublicUrl(storagePath);
console.log('Public URL:', data.publicUrl);

const { error: dbErr } = await sb
  .from('category_configs')
  .update({ image_url: data.publicUrl })
  .eq('category', CATEGORY);

if (dbErr) console.error('DB update failed:', dbErr.message);
else console.log(`✅ category_configs updated for "${CATEGORY}"`);
