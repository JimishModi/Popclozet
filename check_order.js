const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkOrder() {
  const { data, error } = await supabase
    .from('orders')
    .select('id, delivery_address_snapshot, addresses:delivery_address_id(full_address, latitude, longitude)')
    .eq('id', 'c9ee5b08-3a9d-4e9e-abb2-b25b6a71e84a') // or just ilike '%c9ee5b08%'
    .maybeSingle();

  if (!data) {
     const { data: d2 } = await supabase.from('orders').select('id, delivery_address_snapshot').ilike('id', 'c9ee5b08%');
     console.log('Fuzzy match:', d2);
  } else {
     console.log('Order:', JSON.stringify(data, null, 2));
  }
}

checkOrder();
