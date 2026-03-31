import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing Supabase configuration in .env');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const EXCEL_PATH = 'supabase/Product_details/Product table.xlsx';
const PHOTOS_DIR = 'supabase/Product_details/Photos';

// Utility: Upload image to Supabase Storage
async function uploadImage(localPath, bucket, remotePath) {
    if (!fs.existsSync(localPath)) {
        console.warn(`File not found: ${localPath}`);
        return null;
    }
    const fileBuffer = fs.readFileSync(localPath);
    const { data, error } = await supabase.storage.from(bucket).upload(remotePath, fileBuffer, {
        upsert: true,
        contentType: 'image/png'
    });
    if (error) {
        console.error(`Error uploading ${localPath}:`, error.message);
        return null;
    }
    const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(remotePath);
    return publicData.publicUrl;
}

// Utility: Clean price string to number
function parsePrice(val) {
    if (val === undefined || val === null) return 0;
    const clean = String(val).replace(/[^0-9.]/g, '');
    return parseFloat(clean) || 0;
}

const PLACEHOLDER_IMAGE = 'https://placehold.co/600x800/1a1a1a/ffffff?text=PopClozet+Accessory';

async function processUpdate() {
    try {
        console.log('Starting database update process...');
        const workbook = XLSX.readFile(EXCEL_PATH);
        const sheetNames = workbook.SheetNames;
        console.log('Available Sheets:', sheetNames);
        
        // 1. Process Accessories (Sheet index 0)
        console.log(`\n--- Processing Sheet 0: ${sheetNames[0]} ---`);
        const accessoriesData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetNames[0]]);
        console.log(`Found ${accessoriesData.length} rows`);
        
        for (const row of accessoriesData) {
            const name = row['name'];
            if (!name) continue;

            const productData = {
                name: String(name).trim(),
                brand: row['brand'] || 'PopClozet', 
                description: row['description'] || `${name}`,
                category: 'Accessories', // Aggregated category
                gender: row['gender'] || 'unisex',
                occasion: row['occasion'] ? String(row['occasion']).split(',').map(o => o.trim()) : [],
                rental_price: parsePrice(row['rental_price']),
                rental_price_1d: parsePrice(row['rental_price_1d']),
                rental_price_2d: parsePrice(row['rental_price_2d']),
                rental_price_3d: parsePrice(row['rental_price_3d']),
                buy_price: parsePrice(row['buy_price']),
                deposit_amount: parsePrice(row['deposit_amount']),
                images: [PLACEHOLDER_IMAGE], // Placeholder since no photos yet
                fabric_details: row['fabric_details'] ? { material: row['fabric_details'] } : { material: 'standard' },
                is_available: true
            };

            const { data: prodData, error } = await supabase
                .from('products')
                .upsert(productData, { onConflict: 'name,brand' })
                .select()
                .single();

            if (error) {
                console.error(`Error upserting accessory ${name}:`, error.message);
                continue;
            }

            console.log(`Upserted accessory: ${name}`);

            // Inventory for Accessories (Default to 'One Size')
            const { error: invError } = await supabase
                .from('inventory')
                .upsert({
                    product_id: prodData.id,
                    size: 'One Size',
                    available_stock: 1,
                    went_for_wash: 0
                }, { onConflict: 'product_id,size' });
            
            if (invError) console.error(`Error updating inventory for accessory ${name}:`, invError.message);
        }

        // 2. Process Jackets (Sheet index 1)
        console.log(`\n--- Processing Sheet 1: ${sheetNames[1]} ---`);
        const jacketsData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetNames[1]]);
        console.log(`Found ${jacketsData.length} rows`);

        for (const row of jacketsData) {
            const name = row['name'];
            if (!name) continue;

            const srNo = row['SrNo'];
            const frontPhotoPath = path.join(PHOTOS_DIR, `j${srNo}front.png`);
            const backPhotoPath = path.join(PHOTOS_DIR, `j${srNo}back.png`);

            const images = [];
            const frontUrl = await uploadImage(frontPhotoPath, 'product-images', `jackets/j${srNo}_front.png`);
            const backUrl = await uploadImage(backPhotoPath, 'product-images', `jackets/j${srNo}_back.png`);
            if (frontUrl) images.push(frontUrl);
            if (backUrl) images.push(backUrl);

            const productData = {
                name: String(name).trim(),
                brand: row['brand'] || 'PopClozet',
                description: row['description'] || `${name} jacket`,
                category: 'Jackets',
                gender: row['gender'] || 'unisex',
                occasion: row['occasion'] ? String(row['occasion']).split(',').map(o => o.trim()) : ['Casual', 'Party'],
                rental_price: parsePrice(row['rental_price']),
                rental_price_1d: parsePrice(row['rental_price_1d']),
                rental_price_2d: parsePrice(row['rental_price_2d']),
                rental_price_3d: parsePrice(row['rental_price_3d']),
                buy_price: parsePrice(row['buy_price']),
                deposit_amount: parsePrice(row['deposit_amount']),
                images: images.length > 0 ? images : [PLACEHOLDER_IMAGE],
                fabric_details: row['fabric_details'] ? { material: row['fabric_details'] } : { material: 'standard' },
                is_available: true
            };

            const { data: prodData, error: prodError } = await supabase
                .from('products')
                .upsert(productData, { onConflict: 'name,brand' })
                .select()
                .single();

            if (prodError) {
                console.error(`Error upserting jacket ${name}:`, prodError.message);
                continue;
            }

            console.log(`Upserted jacket: ${name}`);

            // Inventory Mapping (Sizes from 'size' or 'Size' column)
            const sizeStr = row['size'] || row['Size'] || 'S, M, L, XL';
            const sizes = String(sizeStr).split(',').map(s => s.trim());
            for (const size of sizes) {
                const { error: invError } = await supabase
                    .from('inventory')
                    .upsert({
                        product_id: prodData.id,
                        size: size,
                        available_stock: 1,
                        went_for_wash: 0
                    }, { onConflict: 'product_id,size' });
                if (invError) console.error(`Error updating inventory for ${name} [${size}]:`, invError.message);
            }
        }

        // 3. Process Fake Products (Sheet index 2)
        console.log(`\n--- Processing Sheet 2: ${sheetNames[2]} ---`);
        const fakeProductsData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetNames[2]]);
        console.log(`Found ${fakeProductsData.length} rows`);

        for (const row of fakeProductsData) {
            const name = row['name'] || row['Product name'];
            if (!name) continue;

            const srNo = row['SrNo'];
            const productFolderPath = path.join(PHOTOS_DIR, `product ${srNo}`);
            const images = [];

            if (fs.existsSync(productFolderPath)) {
                const files = fs.readdirSync(productFolderPath);
                for (const file of files) {
                    if (file.match(/\.(png|jpg|jpeg)$/i)) {
                        const url = await uploadImage(path.join(productFolderPath, file), 'fake-product-images', `product_${srNo}/${file}`);
                        if (url) images.push(url);
                    }
                }
            }

            const fakeProductData = {
                name: String(name).trim(),
                brand: row['brand'] || 'PopClozet',
                description: row['description'] || `${name} (Simulated)`,
                category: row['category'] || 'Assorted',
                gender: row['gender'] || 'unisex',
                occasion: row['occasion'] ? String(row['occasion']).split(',').map(o => o.trim()) : ['Casual'],
                rental_price: parsePrice(row['rental_price']),
                rental_price_1d: parsePrice(row['rental_price_1d']),
                rental_price_2d: parsePrice(row['rental_price_2d']),
                rental_price_3d: parsePrice(row['rental_price_3d']),
                buy_price: parsePrice(row['buy_price']),
                deposit_amount: parsePrice(row['deposit_amount']),
                mrp: parsePrice(row['mrp']),
                images: images.length > 0 ? images : [PLACEHOLDER_IMAGE],
                fabric_details: row['fabric_details'] ? { material: row['fabric_details'] } : { material: 'standard' },
                is_active: true,
                is_available: true
            };

            // Manual upsert for fake_products
            const { data: existing } = await supabase
                .from('fake_products')
                .select('id')
                .eq('name', fakeProductData.name)
                .maybeSingle();

            if (existing) {
                const { error: updateError } = await supabase
                    .from('fake_products')
                    .update(fakeProductData)
                    .eq('id', existing.id);
                if (updateError) console.error(`Error updating fake product ${name}:`, updateError.message);
                else console.log(`Updated fake product: ${name}`);
            } else {
                const { error: insertError } = await supabase
                    .from('fake_products')
                    .insert(fakeProductData);
                if (insertError) console.error(`Error inserting fake product ${name}:`, insertError.message);
                else console.log(`Inserted fake product: ${name}`);
            }
        }

        console.log('\n✅ Database update complete!');

    } catch (error) {
        console.error('Fatal execution error:', error.message);
    }
}

processUpdate();
