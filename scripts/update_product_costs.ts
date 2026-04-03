import fs from 'fs';
import csv from 'csv-parser';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

// Ensure these are present in your .env file or passed to the script
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or SERVICE_ROLE_KEY) must be set in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Path to the CSV file
const CSV_FILE_PATH = path.resolve(process.cwd(), 'Product_table.csv');

async function updateProductCosts() {
    console.log(`Looking for CSV file at: ${CSV_FILE_PATH}`);

    if (!fs.existsSync(CSV_FILE_PATH)) {
        console.error(`\n❌ Error: Cannot find ${CSV_FILE_PATH}`);
        console.error(`Please download the Google Sheet as a CSV and save it as "Product_table.csv" in the root of your PopClozet-Apps directory:`);
        console.error(`Path should be exactly: ${CSV_FILE_PATH}\n`);
        process.exit(1);
    }

    const results: any[] = [];
    console.log('Reading CSV...');

    fs.createReadStream(CSV_FILE_PATH)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', async () => {
            console.log(`Parsed ${results.length} rows from CSV. Starting updates...`);
            
            let updatedCount = 0;
            let errorsCount = 0;

            for (const row of results) {
                // Determine column names dynamically since they might vary slightly in the Google Sheet export
                const idKey = Object.keys(row).find(k => k.trim().toLowerCase() === 'id');
                const mrpKey = Object.keys(row).find(k => k.toLowerCase().includes('mrp_price'));
                const costKey = Object.keys(row).find(k => k.toLowerCase().includes('actual_cost'));

                if (!idKey || !mrpKey || !costKey) {
                    console.error('❌ Error: Could not find required columns in CSV (id, mrp_price, actual_cost). Please ensure the headers match the screenshot.');
                    break;
                }

                const productId = row[idKey]?.trim();
                const mrpRaw = row[mrpKey];
                const costRaw = row[costKey];

                if (!productId) continue;

                // Scrub numerical values (remove commas, currency symbols, generic text)
                const scrubValue = (val: string) => {
                    if (!val) return null;
                    const parsed = parseFloat(val.replace(/[^0-9.-]+/g, ''));
                    if (isNaN(parsed)) return null;
                    return parsed;
                };

                const mrp_price = scrubValue(mrpRaw);
                const actual_cost = scrubValue(costRaw);

                if (mrp_price !== null || actual_cost !== null) {
                    try {
                        const { error } = await supabase
                            .from('products')
                            .update({ 
                                ...(mrp_price !== null && { mrp_price }),
                                ...(actual_cost !== null && { actual_cost })
                            })
                            .eq('id', productId);

                        if (error) {
                            console.error(`Failed to update ${productId}:`, error.message);
                            errorsCount++;
                        } else {
                            console.log(`✅ Updated ${productId}: MRP=${mrp_price}, Cost=${actual_cost}`);
                            updatedCount++;
                        }
                    } catch (err: any) {
                        console.error(`Exception updating ${productId}:`, err.message);
                        errorsCount++;
                    }
                }
            }

            console.log('\n--- Final Report ---');
            console.log(`Successfully updated: ${updatedCount} products`);
            if (errorsCount > 0) {
                console.log(`Failures: ${errorsCount}`);
            }
        });
}

updateProductCosts().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
