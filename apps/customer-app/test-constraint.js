import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
    // Attempting to deliberately fail an update and catch it to see if it provides more hints
    const { data: order } = await supabase.from('orders').select('id, status, rider_id').limit(1).single();

    if (!order) return;

    // Trying permutations of updating an order to assigned with a rider
    const { error: err1 } = await supabase
        .from('orders')
        .update({ status: 'assigned', rider_id: '7d007401-81b6-4fe0-bc87-6ec7c070abfa' })
        .eq('id', order.id);
        
    console.log("Error 1 (assign with rider):", err1?.message);
}

check();
