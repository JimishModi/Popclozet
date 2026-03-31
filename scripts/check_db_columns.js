import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkColumns() {
    const { data, error } = await supabase.rpc('get_table_columns', { table_name: 'products' });
    if (error) {
        // Fallback: try querying a single row
        console.log('RPC failed, trying SELECT * LIMIT 1');
        const { data: sample, error: err } = await supabase.from('products').select('*').limit(1);
        if (err) console.error('Error:', err.message);
        else console.log('Columns:', Object.keys(sample[0] || {}));
    } else {
        console.log('Columns:', data);
    }
    
    console.log('\nFake Products Columns:');
    const { data: sampleFake, error: errFake } = await supabase.from('fake_products').select('*').limit(1);
    if (errFake) console.error('Error:', errFake.message);
    else console.log('Columns:', Object.keys(sampleFake[0] || {}));
}
checkColumns();
