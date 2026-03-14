import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import path from 'path';

// Load .env from monorepo root
config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testQuery() {
  console.log('Testing query to "product_stock_summary"...');
  
  const startTime = Date.now();
  
  // Create a timeout promise
  const timeoutProc = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Query timed out after 10s')), 10000)
  );

  try {
    const queryPromise = supabase
      .from('product_stock_summary')
      .select('total_stock, total_available, total_wash')
      .limit(5);

    const { data, error } = await Promise.race([queryPromise, timeoutProc]);
    
    console.log(`Query completed in ${Date.now() - startTime}ms`);
    if (error) {
      console.error('SUPABASE ERROR:', error);
    } else {
      console.log('DATA:', data);
    }
  } catch (err) {
    console.error('NODE ERROR:', err);
  }
}

testQuery();
