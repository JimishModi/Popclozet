import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing environment variables');
    process.exit(1);
}

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function listBuckets() {
  const { data, error } = await supabase.storage.listBuckets();
  if (error) {
    console.error('Error listing buckets:', error);
  } else {
    console.log('Buckets:', data.map(b => b.name));
  }
}

listBuckets();
