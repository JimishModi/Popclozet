import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function verifyCounts() {
    const { count: prodCount } = await supabase.from('products').select('*', { count: 'exact', head: true });
    const { count: fakeCount } = await supabase.from('fake_products').select('*', { count: 'exact', head: true });
    const { count: invCount } = await supabase.from('inventory').select('*', { count: 'exact', head: true });
    
    console.log('--- Verification Report ---');
    console.log('Products Table Count:', prodCount);
    console.log('Fake Products Table Count:', fakeCount);
    console.log('Inventory Table Count:', invCount);
}
verifyCounts();
