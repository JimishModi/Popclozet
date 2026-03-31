import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkSchema() {
    const { data, error } = await supabase.from('inventory').select('*').limit(1);
    console.log('Sample Row:', data);
    
    // Check table info through pg_attribute if possible, or just raw query
    const { data: cols, error: err } = await supabase.rpc('query_api', { 
        query: "SELECT column_name FROM information_schema.columns WHERE table_name = 'inventory'" 
    });
    // Note: 'query_api' might not exist. Let's try regular select from a known view
    const { data: cols2, error: err2 } = await supabase.from('inventory').select().limit(0);
    console.log('Error 2:', err2);
}
checkSchema();
