import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    const { data: profiles, error } = await supabase.from('profiles').select('user_id, full_name, role');
    console.log(JSON.stringify(profiles, null, 2));
}

run();
