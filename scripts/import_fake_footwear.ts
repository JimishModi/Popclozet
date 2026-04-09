/**
 * import_fake_footwear.ts
 *
 * Reads fake_footwear.csv, uploads images from local "product N" folders
 * to Supabase Storage, and upserts records into the `fake_products` table.
 *
 * CSV columns (fake_footwear.csv — note: some headers have extra annotation text):
 *   (unnamed/SrNo), id, name, brand, description, category, gender, occasion,
 *   rental_price, images (IGNORED - use Drive folders), fabric_details,
 *   is_available, created_at, updated_at, early_access_until (ignored),
 *   "rental_price_1d (x)", "rental_price_2d(x+50)", "rental_price_3d(x+100)",
 *   "mrp_price (price we will list )", "actual_cost(at what price we bought it)",
 *   "Direct Buy Price (price at which we will sell considering the profit)",
 *   Size (ignored - not in fake_products schema), Comments (ignored), Extra Info (ignored)
 *
 * Image folder structure (set IMAGES_DIR to your fake footwear photos folder):
 *   IMAGES_DIR/
 *     product 1/   ← images for row 1
 *     product 2/
 *     ...
 *
 * Usage:
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_KEY=your-service-role-key \
 *   CSV_PATH=supabase/Product_details/fake_footwear.csv \
 *   IMAGES_DIR="C:/path/to/fake-footwear-photos" \
 *   npx tsx scripts/import_fake_footwear.ts
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
  ?? path.resolve(process.cwd(), 'supabase/Product_details/fake_footwear.csv');
const IMAGES_DIR  = (process.env.IMAGES_DIR  ?? '').trim();
const DRY_RUN     = process.env.DRY_RUN      === 'true';
const SKIP_IMAGES = process.env.SKIP_IMAGES  === 'true';

const STORAGE_BUCKET = 'fake-product-images';
const IMAGE_EXTS     = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif']);

// ─── Validation ───────────────────────────────────────────────────────────────

const configErrors: string[] = [];
if (!SUPABASE_URL)               configErrors.push('SUPABASE_URL (or VITE_SUPABASE_URL)');
if (!SUPABASE_SERVICE_KEY)       configErrors.push('SUPABASE_SERVICE_KEY (or VITE_SUPABASE_SERVICE_ROLE_KEY)');
if (!IMAGES_DIR && !SKIP_IMAGES) configErrors.push('IMAGES_DIR (or set SKIP_IMAGES=true)');
if (!fs.existsSync(CSV_PATH))    configErrors.push(`CSV not found: ${CSV_PATH}`);

if (configErrors.length) {
  console.error('\n❌  Missing config:\n' + configErrors.map(e => `   • ${e}`).join('\n'));
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Strip ₹ and commas, return number or null. Handles "4,500" → 4500 */
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
 * fabric_details in fake_footwear.csv uses commas:
 * "Crystal & Rhinestone Embellished Upper, Suede Base, Cushioned Insole"
 * Store as JSONB: { description, materials[] }
 */
function parseFabricDetails(raw: unknown): Record<string, unknown> {
  if (!raw || String(raw).trim() === '') return {};
  const text  = String(raw).trim();
  const sep   = text.includes(';') ? /\s*;\s*/ : /\s*,\s*/;
  const parts = text.split(sep).map(s => s.trim()).filter(Boolean);
  return { description: text, materials: parts };
}

function normalizeGender(raw: unknown): 'men' | 'women' | 'unisex' {
  const g = String(raw ?? '').toLowerCase().trim();
  if (g.includes('women') || g === 'female') return 'women';
  if (g.includes('men')   || g === 'male')   return 'men';
  return 'unisex';
}

function parseBool(raw: unknown, fallback = true): boolean {
  if (raw == null || String(raw).trim() === '') return fallback;
  return String(raw).trim().toUpperCase() !== 'FALSE';
}

/**
 * Column name matcher — finds the first key in the row that starts with
 * any of the given prefixes (case-insensitive).
 *
 * This handles headers like:
 *   "rental_price_1d (x)"        matched by prefix "rental_price_1d"
 *   "mrp_price (price we will…)" matched by prefix "mrp_price" or "mrp"
 *   "Direct Buy Price (price…)"  matched by prefix "direct buy price" or "buy_price"
 */
function findCol(row: Record<string, string>, ...prefixes: string[]): string | undefined {
  const keys = Object.keys(row);
  for (const prefix of prefixes) {
    const p   = prefix.toLowerCase();
    const key = keys.find(k => k.toLowerCase().startsWith(p) || k.toLowerCase() === p);
    if (key !== undefined) return row[key];
  }
  return undefined;
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
 * Fake footwear folders are named F_1, F_2, etc. — matching the SrNo column.
 */
async function uploadImages(srno: string): Promise<string[]> {
  const folderPath = path.join(IMAGES_DIR, srno);

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
  console.log('\n🚀  Fake Footwear Importer');
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
    // Unnamed first column (key "") holds the SrNo: F_1, F_2, etc.
    const srno = (row[''] ?? row.SrNo ?? row['Sr No'] ?? `F_${i + 1}`).trim();
    const name = (row.name ?? row.Name ?? '').trim();

    if (!name) {
      stats.skipped++;
      continue;
    }

    // The existing UUID from the sheet — upsert on this to prevent duplicates
    const existingId = (row.id ?? '').trim() || undefined;

    console.log(`\n[${String(i + 1).padStart(2, '0')}] ${name}  (${srno})`);
    if (existingId) console.log(`     id: ${existingId}`);

    // Upload images — CSV "images" column has fake filenames, intentionally ignored
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

    // ── Column mapping ─────────────────────────────────────────────────────
    // findCol() matches by prefix so annotated headers like
    // "rental_price_1d (x)" are found by searching for "rental_price_1d"
    const record: Record<string, unknown> = {
      ...(existingId ? { id: existingId } : {}),
      name,
      brand:       (row.brand ?? row.Brand ?? '').trim() || 'Unlisted',
      description: (row.description ?? '').trim()        || null,
      category:    (row.category ?? row.Category ?? '').trim() || 'Footwear',
      gender:      normalizeGender(row.gender),
      occasion,
      rental_price:    parsePrice(row.rental_price ?? row['Rental Price']),
      deposit_amount:  parsePrice(row.deposit_amount ?? row['Deposit Amount']),
      // Map annotated headers → DB columns
      rental_price_1d: parsePrice(findCol(row, 'rental_price_1d', 'rental_price_1')),
      rental_price_2d: parsePrice(findCol(row, 'rental_price_2d', 'rental_price_2')),
      rental_price_3d: parsePrice(findCol(row, 'rental_price_3d', 'rental_price_3')),
      mrp_price:       parsePrice(findCol(row, 'mrp_price', 'mrp')),
      buy_price:       parsePrice(findCol(row, 'direct buy price', 'buy_price')),
      actual_cost:     parsePrice(findCol(row, 'actual_cost')),
      fabric_details:  parseFabricDetails(row.fabric_details ?? row['Fabric Details']),
      images:          imageUrls,
      is_active:       true,
      is_available:    parseBool(row.is_available ?? row['Is Available'], true),
      // Rotation: epoch → appears first in LRU rotation
      last_shown_at:   new Date(0).toISOString(),
      show_count:      0,
      // Deliberately NOT passing created_at / updated_at — let DB set them
    };

    if (DRY_RUN) {
      console.log('  [DRY RUN]', JSON.stringify(record, null, 4));
      stats.success++;
      continue;
    }

    process.stdout.write(`  💾  Upserting... `);

    // Upsert on id if we have one (idempotent re-runs), otherwise plain insert
    const { error } = existingId
      ? await supabase.from('fake_products').upsert(record, { onConflict: 'id' })
      : await supabase.from('fake_products').insert(record);

    if (error) {
      console.error(`FAILED\n     → ${error.message}`);
      stats.failed++;
    } else {
      console.log('✅');
      stats.success++;
    }
  }

  console.log(`\n${'═'.repeat(56)}`);
  console.log(`  ✅  Upserted : ${stats.success}`);
  if (stats.failed  > 0) console.log(`  ❌  Failed   : ${stats.failed}`);
  if (stats.skipped > 0) console.log(`  ⏭️   Skipped  : ${stats.skipped}`);
  console.log(`  🗄️   Table    : fake_products`);
  console.log(`  🖼️   Bucket   : ${STORAGE_BUCKET}`);
  console.log(`${'═'.repeat(56)}\n`);
}

main().catch(err => {
  console.error('\n❌  Fatal:', err.message);
  process.exit(1);
});
