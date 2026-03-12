import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
    // Try to get the actual order that failed to see what's in it
    const { data: orders } = await supabase
        .from('orders')
        .select('*')
        .limit(3);
        
    console.log("Sample orders:", JSON.stringify(orders, null, 2));
}

check();
