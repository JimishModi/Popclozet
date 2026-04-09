/**
 * import_actual_footwear.ts
 *
 * Reads footwear_original.csv, uploads images from local F_1/F_2/... folders
 * to Supabase Storage, and inserts records into the `products` table.
 *
 * CSV columns (footwear_original.csv):
 *   SrNo, name, brand, description, category, gender, occasion,
 *   rental_price, deposit_amount, images (IGNORED - use Drive folders),
 *   fabric_details, sizes_available, hygiene_info,
 *   rental_price_1d, rental_price_2d, rental_price_3d,
 *   buy_price, mrp_price, actual_cost
 *
 * Image folder structure (set IMAGES_DIR to the "Footwear photos" Drive folder):
 *   IMAGES_DIR/
 *     F_1/   ← all images for SrNo F_1
 *     F_2/
 *     ...
 *
 * Usage:
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_KEY=your-service-role-key \
 *   CSV_PATH=supabase/Product_details/footwear_original.csv \
 *   IMAGES_DIR="C:/path/to/Footwear-photos" \
 *   npx tsx scripts/import_actual_footwear.ts
 *
 * Flags:
 *   DRY_RUN=true     → validate + log, no DB/Storage writes
 *   SKIP_IMAGES=true → skip image upload (data-only re-run)
 */

import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import mime from 'mime-types';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// ─── Config ───────────────────────────────────────────────────────────────────

const SUPABASE_URL = (
  process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? ''
).trim();
const SUPABASE_SERVICE_KEY = (
  process.env.SUPABASE_SERVICE_KEY ?? process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ?? ''
).trim();
const CSV_PATH = process.env.CSV_PATH
  ?? path.resolve(process.cwd(), 'supabase/Product_details/footwear_original.csv');
const IMAGES_DIR  = (process.env.IMAGES_DIR  ?? '').trim();
const DRY_RUN     = process.env.DRY_RUN      === 'true';
const SKIP_IMAGES = process.env.SKIP_IMAGES  === 'true';

const STORAGE_BUCKET = 'product-images';
const IMAGE_EXTS     = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif']);

// ─── Validation ───────────────────────────────────────────────────────────────

const configErrors: string[] = [];
if (!SUPABASE_URL)                    configErrors.push('SUPABASE_URL (or VITE_SUPABASE_URL)');
if (!SUPABASE_SERVICE_KEY)            configErrors.push('SUPABASE_SERVICE_KEY (or VITE_SUPABASE_SERVICE_ROLE_KEY)');
if (!IMAGES_DIR && !SKIP_IMAGES)      configErrors.push('IMAGES_DIR (or set SKIP_IMAGES=true to skip)');
if (!fs.existsSync(CSV_PATH))         configErrors.push(`CSV not found: ${CSV_PATH}`);

if (configErrors.length) {
  console.error('\n❌  Missing config:\n' + configErrors.map(e => `   • ${e}`).join('\n'));
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Strip ₹ and commas, return number or null */
function parsePrice(raw: unknown): number | null {
  if (raw == null || String(raw).trim() === '') return null;
  const n = parseFloat(String(raw).replace(/[₹,\s]/g, ''));
  return isNaN(n) ? null : n;
}

/** "Party, Festive; Casual" → ["Party", "Festive", "Casual"] */
function parseOccasion(raw: unknown): string[] {
  if (!raw || String(raw).trim() === '') return [];
  return String(raw).split(/[,;]/).map(s => s.trim()).filter(Boolean);
}

/**
 * Parse sizes — single value or comma-separated.
 * Returns a plain JS array; Supabase will serialize to JSONB.
 * e.g. "38" → ["38"]  |  "38, 40" → ["38", "40"]  |  "" → []
 */
function parseSizes(raw: unknown): string[] {
  if (!raw || String(raw).trim() === '') return [];
  return String(raw).split(/[,;]/).map(s => s.trim()).filter(Boolean);
}

/**
 * fabric_details in footwear_original.csv uses semicolons:
 * "Metallic Faux Leather; Straps: High-grade Rhinestone; Sole: Resin"
 * Store as JSONB: { description, materials[] }
 */
function parseFabricDetails(raw: unknown): Record<string, unknown> {
  if (!raw || String(raw).trim() === '') return {};
  const text  = String(raw).trim();
  // Detect separator: prefer semicolons, fall back to commas
  const sep   = text.includes(';') ? /\s*;\s*/ : /\s*,\s*/;
  const parts = text.split(sep).map(s => s.trim()).filter(Boolean);
  return { description: text, materials: parts };
}

/** hygiene_info is free text → { description } */
function parseHygieneInfo(raw: unknown): Record<string, string> {
  if (!raw || String(raw).trim() === '') return {};
  return { description: String(raw).trim() };
}

function normalizeGender(raw: unknown): 'men' | 'women' | 'unisex' {
  const g = String(raw ?? '').toLowerCase().trim();
  if (g.includes('women') || g === 'female') return 'women';
  if (g.includes('men')   || g === 'male')   return 'men';
  return 'unisex';
}

// ─── Storage ──────────────────────────────────────────────────────────────────

async function ensureBucket(): Promise<void> {
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) throw new Error(`Cannot list buckets: ${error.message}`);
  if (!buckets?.some(b => b.name === STORAGE_BUCKET)) {
    const { error: ce } = await supabase.storage.createBucket(STORAGE_BUCKET, {
      public: true,
      fileSizeLimit: 20 * 1024 * 1024,
    });
    if (ce) throw new Error(`Cannot create bucket: ${ce.message}`);
    console.log(`  ✅ Created bucket: ${STORAGE_BUCKET}`);
  } else {
    console.log(`  ✅ Bucket exists: ${STORAGE_BUCKET}`);
  }
}

/**
 * srno comes directly from the CSV SrNo column — it IS already "F_1", "F_2", etc.
 * So we join IMAGES_DIR + srno  (e.g. "C:/photos/F_1"), NOT "F_" + srno.
 */
async function uploadImages(srno: string): Promise<string[]> {
  const folderPath = path.join(IMAGES_DIR, srno); // e.g. .../Footwear-photos/F_1

  if (!fs.existsSync(folderPath)) {
    console.warn(`    ⚠️  Folder not found: ${srno}`);
    return [];
  }

  const files = fs.readdirSync(folderPath).filter(
    f => !f.startsWith('.') && IMAGE_EXTS.has(path.extname(f).toLowerCase()),
  );

  if (files.length === 0) {
    console.warn(`    ⚠️  No images in: ${srno}`);
    return [];
  }

  const urls: string[] = [];

  for (const file of files) {
    // Storage path: footwear/F_1/image.jpg
    const storagePath = `footwear/${srno}/${file.replace(/\s+/g, '-').toLowerCase()}`;

    if (DRY_RUN) {
      urls.push(`[DRY] ${storagePath}`);
      continue;
    }

    const buf         = fs.readFileSync(path.join(folderPath, file));
    const contentType = mime.lookup(file) || 'image/jpeg';

    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, buf, { contentType, upsert: true });

    if (error) {
      console.warn(`    ⚠️  Upload failed [${file}]: ${error.message}`);
      continue;
    }

    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);
    urls.push(data.publicUrl);
  }

  return urls;
}

// ─── CSV reader ───────────────────────────────────────────────────────────────

async function readCsv(): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    const rows: Record<string, string>[] = [];
    fs.createReadStream(CSV_PATH)
      .pipe(csv())
      .on('data', row => rows.push(row))
      .on('end',  () => resolve(rows))
      .on('error', reject);
  });
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🚀  Actual Footwear Importer');
  console.log(`${'─'.repeat(56)}`);
  console.log(`  CSV        : ${CSV_PATH}`);
  console.log(`  Images dir : ${IMAGES_DIR || '(skipped)'}`);
  console.log(`  Bucket     : ${STORAGE_BUCKET}`);
  console.log(`  Dry run    : ${DRY_RUN}`);
  console.log(`  Skip imgs  : ${SKIP_IMAGES}`);
  console.log(`${'─'.repeat(56)}\n`);

  if (!DRY_RUN && !SKIP_IMAGES) await ensureBucket();

  const rows = await readCsv();
  if (rows.length === 0) {
    console.warn('⚠️  No rows found. Check your CSV path and headers.');
    return;
  }

  console.log(`📄  ${rows.length} rows found`);
  console.log(`  Headers: ${Object.keys(rows[0]).join(' | ')}\n`);

  const stats = { success: 0, failed: 0, skipped: 0 };

  for (const [i, row] of rows.entries()) {
    const srno = (row.SrNo ?? row['Sr No'] ?? row.srno ?? `F_${i + 1}`).trim();
    const name = (row.name ?? row.Name ?? '').trim();

    if (!name) {
      stats.skipped++;
      continue;
    }

    console.log(`\n[${String(i + 1).padStart(2, '0')}] ${name}  (${srno})`);

    // Upload images — CSV "images" column is intentionally ignored
    let imageUrls: string[] = [];
    if (!SKIP_IMAGES) {
      process.stdout.write(`  📸  Images... `);
      imageUrls = await uploadImages(srno);
      console.log(`${imageUrls.length} uploaded`);
    }

    const occasion = parseOccasion(row.occasion ?? row.Occasion);
    if (occasion.length === 0) {
      console.warn(`    ⚠️  No occasions found — defaulting to ["Casual"]`);
      occasion.push('Casual');
    }

    const record = {
      name,
      brand:           (row.brand ?? row.Brand ?? '').trim()       || 'Unlisted',
      description:     (row.description ?? '').trim()              || null,
      category:        (row.category ?? row.Category ?? '').trim() || 'Footwear',
      gender:          normalizeGender(row.gender),
      occasion,
      // deposit_amount is empty in this CSV — default to 0
      rental_price:    parsePrice(row.rental_price)   ?? 0,
      deposit_amount:  parsePrice(row.deposit_amount) ?? 0,
      images:          imageUrls,
      fabric_details:  parseFabricDetails(row.fabric_details),
      rental_price_1d: parsePrice(row.rental_price_1d),
      rental_price_2d: parsePrice(row.rental_price_2d),
      rental_price_3d: parsePrice(row.rental_price_3d),
      buy_price:       parsePrice(row.buy_price),
      mrp_price:       parsePrice(row.mrp_price),
      actual_cost:     parsePrice(row.actual_cost),
      is_available:    true,
    };

    if (DRY_RUN) {
      console.log('  [DRY RUN]', JSON.stringify(record, null, 4));
      stats.success++;
      continue;
    }

    process.stdout.write(`  💾  Inserting... `);
    const { error } = await supabase.from('products').insert(record);

    if (error) {
      console.error(`FAILED\n     → ${error.message}`);
      stats.failed++;
    } else {
      console.log('✅');
      stats.success++;
    }
  }

  console.log(`\n${'═'.repeat(56)}`);
  console.log(`  ✅  Inserted : ${stats.success}`);
  if (stats.failed  > 0) console.log(`  ❌  Failed   : ${stats.failed}`);
  if (stats.skipped > 0) console.log(`  ⏭️   Skipped  : ${stats.skipped}`);
  console.log(`  🗄️   Table    : products`);
  console.log(`  🖼️   Bucket   : ${STORAGE_BUCKET}`);
  console.log(`${'═'.repeat(56)}\n`);
}

main().catch(err => {
  console.error('\n❌  Fatal:', err.message);
  process.exit(1);
});
