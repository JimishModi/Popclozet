import fs from 'fs';
import csv from 'csv-parser';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_ROLE_KEY must be set in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Path to the CSV file
const CSV_FILE_PATH = path.resolve(process.cwd(), 'supabase/Product_details/Product_details.csv');

async function seedFakeProducts() {
  console.log(`🚀 Starting Seed for Fake Products from: ${CSV_FILE_PATH}`);

  if (!fs.existsSync(CSV_FILE_PATH)) {
    console.error(`❌ Error: Cannot find ${CSV_FILE_PATH}`);
    process.exit(1);
  }

  const rows: any[] = [];
  
  fs.createReadStream(CSV_FILE_PATH)
    .pipe(csv())
    .on('data', (data: any) => rows.push(data))
    .on('end', async () => {
      console.log(`📄 Parsed ${rows.length} rows. Processing...`);
      
      let successCount = 0;
      let errorCount = 0;

      for (const row of rows) {
        try {
          // 1. Identify mapping
          const name = row.name?.trim();
          if (!name || name === '') continue;

          // 2. Scrub Numbers (remove symbols like ₹ and commas)
          const scrub = (val: string) => {
            if (!val) return null;
            const cleaned = val.replace(/[₹,]/g, '').trim();
            const num = parseFloat(cleaned);
            return isNaN(num) ? null : num;
          };

          // 3. Format Occasions (String "Party, Wedding" -> Array ["Party", "Wedding"])
          const occasionStr = row.occasion || '';
          const occasions = occasionStr.split(',').map((s: string) => s.trim()).filter((s: string) => s !== '');

          // 4. Format Fabric Details (Text -> JSONB)
          const fabricRaw = row.fabric_details || row.bric_detai || ''; // Handle potential CSV truncation in headers
          const fabricDetails = fabricRaw ? { material: fabricRaw.trim() } : null;

          // 5. Construct Payload (SKIPPING images as requested)
          const payload = {
            name,
            brand: row.brand?.trim(),
            description: row.description?.trim(),
            category: row.category?.trim() || 'Uncategorized',
            gender: (row.gender?.trim().toLowerCase() || 'unisex') as any,
            occasion: occasions,
            rental_price: scrub(row.rental_price),
            rental_price_1d: scrub(row.rental_price_1d),
            rental_price_2d: scrub(row.rental_price_2d),
            rental_price_3d: scrub(row.rental_price_3d),
            buy_price: scrub(row.buy_price),
            mrp_price: scrub(row.mrp_price),
            actual_cost: scrub(row.actual_cost),
            fabric_details: fabricDetails,
            is_active: row.is_active?.toLowerCase() === 'true',
            last_shown_at: new Date(0).toISOString(), // Epoch for LRU rotation
          };

          const { error } = await supabase
            .from('fake_products')
            .insert(payload);

          if (error) {
            console.error(`❌ Failed to insert "${name}":`, error.message);
            errorCount++;
          } else {
            console.log(`✅ Inserted: ${name}`);
            successCount++;
          }
        } catch (e: any) {
          console.error(`💥 Unexpected error for row:`, e.message);
          errorCount++;
        }
      }

      console.log('\n--- Final Report ---');
      console.log(`Successfully added: ${successCount} fake products`);
      if (errorCount > 0) console.log(`Failures: ${errorCount}`);
    });
}

seedFakeProducts().catch(console.error);
