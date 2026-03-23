/**
 * seed-fake-products.ts
 *
 * Reads Excel dataset, uploads images from numbered product folders
 * to Supabase Storage, and seeds the fake_products table.
 *
 * Image folder structure expected:
 *   IMAGES_DIR/
 *     product 1/   ← all images for Excel row 1
 *     product 2/   ← all images for Excel row 2
 *     ...
 *     product 16/
 *
 * Run:
 *   SUPABASE_URL=https://hfcdvcpgpkdgmcakgiuy.supabase.co \
 *   SUPABASE_SERVICE_KEY=your-service-role-key \
 *   IMAGES_DIR="C:/path/to/your/images/folder" \
 *   npx tsx scripts/seed-fake-products.ts
 */

import XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import * as mime from 'mime-types';
import { createClient } from '@supabase/supabase-js';

// ─── Config ───────────────────────────────────────────────────────────────────

const EXCEL_PATH     = process.env.EXCEL_PATH  ?? path.join(__dirname, 'fake-products.xlsx');
const IMAGES_DIR     = process.env.IMAGES_DIR  ?? path.join(__dirname, 'images');
const STORAGE_BUCKET = 'fake-product-images';

const SUPABASE_URL       = process.env.SUPABASE_URL       ?? '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌  Set SUPABASE_URL and SUPABASE_SERVICE_KEY env vars.');
  process.exit(1);
}

// Service role client — bypasses RLS for storage upload + table insert
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parsePrice(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = parseFloat(String(raw).replace(/[₹,\s]/g, ''));
  return isNaN(n) ? null : n;
}

function parseArray(raw: unknown): string[] {
  if (!raw) return [];
  return String(raw).split(/[,;]/).map(s => s.trim()).filter(Boolean);
}

function normalizeGender(raw: unknown): string {
  const g = String(raw ?? '').toLowerCase().trim();
  if (g.startsWith('women') || g === 'female') return 'women';
  if (g.startsWith('men')   || g === 'male')   return 'men';
  return 'unisex';
}

// ─── Step 1: Ensure storage bucket exists ─────────────────────────────────────

async function ensureBucket() {
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) throw new Error(`Cannot list buckets: ${error.message}`);

  if (!buckets?.some(b => b.name === STORAGE_BUCKET)) {
    const { error: createErr } = await supabase.storage.createBucket(STORAGE_BUCKET, {
      public: true,
      fileSizeLimit: 15 * 1024 * 1024, // 15MB per file
    });
    if (createErr) throw new Error(`Cannot create bucket: ${createErr.message}`);
    console.log(`  ✅ Created bucket: ${STORAGE_BUCKET}`);
  } else {
    console.log(`  ✅ Bucket ready: ${STORAGE_BUCKET}`);
  }
}

// ─── Step 2: Upload all images from a product folder ─────────────────────────
// Returns array of public URLs (one per image file in the folder)

async function uploadProductFolder(productIndex: number): Promise<string[]> {
  const folderName = `product ${productIndex}`;
  const folderPath = path.join(IMAGES_DIR, folderName);

  if (!fs.existsSync(folderPath)) {
    console.warn(`    ⚠️  Folder not found: ${folderName}`);
    return [];
  }

  // Get all image files in the folder (skip hidden files)
  const files = fs.readdirSync(folderPath).filter(f => {
    if (f.startsWith('.')) return false;
    const ext = path.extname(f).toLowerCase();
    return ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif'].includes(ext);
  });

  if (files.length === 0) {
    console.warn(`    ⚠️  No images in folder: ${folderName}`);
    return [];
  }

  const publicUrls: string[] = [];

  for (const file of files) {
    const localFilePath = path.join(folderPath, file);
    const fileBuffer    = fs.readFileSync(localFilePath);
    const contentType   = mime.lookup(file) || 'image/jpeg';

    // Storage path: "product-1/filename.jpg" — sanitized, lowercase
    const storagePath = `product-${productIndex}/${file.replace(/\s+/g, '-').toLowerCase()}`;

    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, fileBuffer, { contentType, upsert: true });

    if (error) {
      console.warn(`    ⚠️  Upload failed [${file}]: ${error.message}`);
      continue;
    }

    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);
    publicUrls.push(data.publicUrl);
  }

  return publicUrls;
}

// ─── Step 3: Read Excel ────────────────────────────────────────────────────────

interface ExcelRow {
  NAME: string;
  BRAND: string;
  DESCRIPTION: string;
  CATEGORY: string;
  GENDER: string;
  OCCASION: string;
  'RENTAL PRICE': string | number;
  'DEPOSIT AMOUNT': string | number;
  'MRP PRICE': string | number;
  'FABRIC DETAILS': string;
  SIZE: string;
  [key: string]: unknown;
}

function readExcel(): ExcelRow[] {
  if (!fs.existsSync(EXCEL_PATH)) {
    throw new Error(`Excel file not found: ${EXCEL_PATH}\nPut it at: scripts/fake-products.xlsx`);
  }
  const workbook = XLSX.readFile(EXCEL_PATH);
  const sheet    = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json<ExcelRow>(sheet);
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🚀  Fake product seeder starting...\n');
  console.log(`  Excel : ${EXCEL_PATH}`);
  console.log(`  Images: ${IMAGES_DIR}`);
  console.log(`  Bucket: ${STORAGE_BUCKET}\n`);

  await ensureBucket();
  console.log();

  const rows = readExcel();
  console.log(`  📄  ${rows.length} products found in Excel\n${'─'.repeat(52)}`);

  const results = { success: 0, failed: 0 };

  for (const [i, row] of rows.entries()) {
    const productNumber = i + 1;
    const name = String(row.NAME ?? '').trim();
    if (!name) continue;

    console.log(`\n[${productNumber}/${rows.length}] ${name}`);

    // Upload all images from "product N" folder
    process.stdout.write(`  📸  Uploading images... `);
    const imageUrls = await uploadProductFolder(productNumber);
    console.log(`${imageUrls.length} uploaded`);

    // Build DB record — map Excel columns → fake_products schema
    const record = {
      name,
      brand:          String(row.BRAND ?? '').trim() || null,
      description:    String(row.DESCRIPTION ?? '').trim() || null,
      rental_price:   parsePrice(row['RENTAL PRICE']),
      deposit_amount: parsePrice(row['DEPOSIT AMOUNT']),
      mrp:            parsePrice(row['MRP PRICE']),
      gender:         normalizeGender(row.GENDER),
      category:       String(row.CATEGORY ?? '').toLowerCase().trim(),
      occasion:       parseArray(row.OCCASION),
      images:         imageUrls,
      fabric_details: row['FABRIC DETAILS']
        ? { description: String(row['FABRIC DETAILS']).trim() }
        : null,
      is_active:      true,
      // last_shown_at defaults to epoch in DB — rotation ready from day 1
    };

    process.stdout.write(`  💾  Inserting into fake_products... `);
    const { error } = await supabase.from('fake_products').insert(record);

    if (error) {
      console.error(`FAILED\n  → ${error.message}`);
      results.failed++;
    } else {
      console.log('✅');
      results.success++;
    }
  }

  console.log(`\n${'═'.repeat(52)}`);
  console.log(`  ✅  Seeded : ${results.success} products`);
  if (results.failed > 0) {
    console.log(`  ❌  Failed : ${results.failed} products`);
  }
  console.log(`  🖼️   Images : stored in Supabase Storage → ${STORAGE_BUCKET}`);
  console.log(`${'═'.repeat(52)}\n`);
}

main().catch(err => {
  console.error('\n❌  Fatal:', err.message);
  process.exit(1);
});
