import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
// We need the service role key to bypass RLS and read any user's subscriptions
// Or we can just use the anon key if RLS allows reading (probably not)
// Wait, we can fetch via the REST API if we simulate the user login, but we don't have their password.
// But we have the VITE_SUPABASE_ANON_KEY.
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, ANON_KEY);

async function checkSubs(userId) {
    console.log(`Checking subscriptions for: ${userId}`);
    
    // Auth as service role requires service role key, but let's try reading anyway.
    // Actually, RLS blocks us reading without being the user.
    // Let's just output the service role key necessity.
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.warn("⚠️ Warning: No SUPABASE_SERVICE_ROLE_KEY found, RLS might block this read.");
    }
    
    // We will use the REST API manually if we wanted to
    const client = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || ANON_KEY);
    
    const { data, error } = await client
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', userId);
        
    if (error) {
        console.error("❌ Error fetching subscriptions:", error);
    } else {
        console.log(`✅ Found ${data.length} subscriptions`);
        data.forEach((sub, i) => {
            console.log(`\n--- Subscription ${i} ---`);
            console.log(`Endpoint:`, sub.endpoint);
            console.log(`p256dh:`, sub.p256dh);
            console.log(`auth:`, sub.auth);
        });
    }
}

const targetUserId = process.argv[2];
if (targetUserId) checkSubs(targetUserId);
