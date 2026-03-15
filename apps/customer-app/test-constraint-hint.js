import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    // Try doing a deliberate bad update and reading the error hint
    const { error } = await supabase.from('orders').update({status: 'INVALID_TEST'}).eq('id', '4d1645dd-6f27-4b71-b519-91ee0bcf0037');
    console.log("Error object details:", JSON.stringify(error, null, 2));
}

run();
