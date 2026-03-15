import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
    const { data: order } = await supabase.from('orders').select('id, status, rider_id').eq('id', 'cab13442-c24c-4c07-9810-3a0bfc41a190').single();
    console.log("Current order state:", JSON.stringify(order, null, 2));
}

check();
