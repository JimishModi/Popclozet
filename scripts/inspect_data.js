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

const EXCEL_PATH = 'supabase/Product_details/Product table.xlsx';

async function inspectData() {
    try {
        const workbook = XLSX.readFile(EXCEL_PATH);
        console.log('Available Sheets:', workbook.SheetNames);
        
        for (let i = 0; i < workbook.SheetNames.length; i++) {
            const name = workbook.SheetNames[i];
            const sheet = workbook.Sheets[name];
            
            // Header: 1 returns array of arrays
            const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            console.log(`\n--- SHEET ${i}: ${name} ---`);
            console.log('Row 0 (Raw):', JSON.stringify(rawData[0]));
            if (rawData.length > 1) console.log('Row 1 (Raw):', JSON.stringify(rawData[1]));
            if (rawData.length > 2) console.log('Row 2 (Raw):', JSON.stringify(rawData[2]));
            
            // Default header mapping
            const jsonData = XLSX.utils.sheet_to_json(sheet);
            console.log(`JSON Data length: ${jsonData.length}`);
            if (jsonData.length > 0) console.log('First JSON row keys:', JSON.stringify(Object.keys(jsonData[0])));
        }
    } catch (error) {
        console.error('Error:', error.message);
    }
}

inspectData();
