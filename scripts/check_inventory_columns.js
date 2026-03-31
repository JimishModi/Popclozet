import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkInventory() {
    console.log('Inventory Columns:');
    const { data: sample, error } = await supabase.from('inventory').select('*').limit(1);
    if (error) console.error('Error:', error.message);
    else console.log('Columns:', Object.keys(sample[0] || {}));
}
checkInventory();
