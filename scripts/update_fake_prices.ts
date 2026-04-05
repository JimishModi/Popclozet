import fs from 'fs';
import csv from 'csv-parser';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_ROLE_KEY must be set in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const CSV_FILE_PATH = path.resolve(process.cwd(), 'supabase/Product_details/Product_details.csv');

// ── Exact CSV header names (from inspect_csv output) ──
const COL = {
  name:           'name',
  rental_price:   'rental_price',
  rental_price_1d: 'rental_price_1d (x)',
  rental_price_2d: 'rental_price_2d(x+50)',
  rental_price_3d: 'rental_price_3d(x+100)',
  mrp_price:      'mrp_price (price we will list )',
  actual_cost:    'actual_cost(at what price we bought it)',
  buy_price:      'Direct Buy Price (price at which we will sell considering the profit)',
};

// ── Scrub currency: removes ?, ₹, commas, spaces ──
function scrub(val: string | undefined | null): number | null {
  if (!val) return null;
  const cleaned = val.replace(/[?₹,\s]/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

async function updateFakeProductPrices() {
  console.log(`🚀 Updating fake_products prices from: ${CSV_FILE_PATH}\n`);

  if (!fs.existsSync(CSV_FILE_PATH)) {
    console.error(`❌ File not found: ${CSV_FILE_PATH}`);
    process.exit(1);
  }

  const rows: any[] = [];

  fs.createReadStream(CSV_FILE_PATH)
    .pipe(csv())
    .on('data', (data: any) => rows.push(data))
    .on('end', async () => {
      console.log(`📄 Parsed ${rows.length} rows.\n`);

      let updated = 0;
      let skipped = 0;
      let errors = 0;

      for (const row of rows) {
        const name = row[COL.name]?.trim();
        if (!name) { skipped++; continue; }

        const rental_price   = scrub(row[COL.rental_price]);
        const rental_price_1d = scrub(row[COL.rental_price_1d]);
        const rental_price_2d = scrub(row[COL.rental_price_2d]);
        const rental_price_3d = scrub(row[COL.rental_price_3d]);
        const mrp_price       = scrub(row[COL.mrp_price]);
        const actual_cost     = scrub(row[COL.actual_cost]);
        const buy_price       = scrub(row[COL.buy_price]);

        // Build update payload — only include non-null values
        const payload: Record<string, number> = {};
        if (rental_price !== null)    payload.rental_price = rental_price;
        if (rental_price_1d !== null) payload.rental_price_1d = rental_price_1d;
        if (rental_price_2d !== null) payload.rental_price_2d = rental_price_2d;
        if (rental_price_3d !== null) payload.rental_price_3d = rental_price_3d;
        if (mrp_price !== null)       payload.mrp_price = mrp_price;
        if (actual_cost !== null)     payload.actual_cost = actual_cost;
        if (buy_price !== null)       payload.buy_price = buy_price;

        if (Object.keys(payload).length === 0) {
          console.log(`⏭️  Skipping "${name}" — no price data`);
          skipped++;
          continue;
        }

        try {
          const { error, count } = await supabase
            .from('fake_products')
            .update(payload)
            .ilike('name', name);

          if (error) {
            console.error(`❌ "${name}": ${error.message}`);
            errors++;
          } else {
            console.log(`✅ "${name}" → rental=${rental_price}, 1d=${rental_price_1d}, 2d=${rental_price_2d}, 3d=${rental_price_3d}, mrp=${mrp_price}, cost=${actual_cost}, buy=${buy_price}`);
            updated++;
          }
        } catch (e: any) {
          console.error(`💥 "${name}": ${e.message}`);
          errors++;
        }
      }

      console.log('\n─── Final Report ───');
      console.log(`✅ Updated: ${updated}`);
      console.log(`⏭️  Skipped: ${skipped}`);
      if (errors > 0) console.log(`❌ Errors:  ${errors}`);
    });
}

updateFakeProductPrices().catch(console.error);
