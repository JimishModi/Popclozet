import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
    const statusesToTest = ['assigned', 'accepted', 'claimed', 'out_for_delivery', 'active', 'processing', 'in_transit'];
    
    // Pick any order ID to test against (which we know exists)
    const orderId = '4d1645dd-6f27-4b71-b519-91ee0bcf0037'; 
    
    console.log(`Testing status enum values for order ${orderId}...`);
    
    for (const st of statusesToTest) {
        const { error } = await supabase
            .from('orders')
            .update({ status: st })
            .eq('id', orderId);
            
        if (error) {
            console.log(`❌ Status '${st}' failed: ${error.message}`);
        } else {
            console.log(`✅ Status '${st}' SUCCEEDED!`);
            // We found a valid status to use in claim_order
            break; 
        }
    }
}

check();
