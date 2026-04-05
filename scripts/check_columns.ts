import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!
);

async function checkColumns() {
  const { data, error } = await supabase.from('products').select('*').limit(1);
  if (error) {
    console.error('Error fetching products:', error);
    return;
  }
  if (data && data.length > 0) {
    console.log('Columns in products:', Object.keys(data[0]));
  } else {
    console.log('No data in products table to check columns.');
  }
}

checkColumns();
