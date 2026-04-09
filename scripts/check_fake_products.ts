import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl!, supabaseKey!);

async function checkFakeProducts() {
  const { data, error } = await supabase
    .from('fake_products')
    .select('id, name, rental_price_1d, rental_price_2d, rental_price_3d, buy_price, mrp, actual_cost')
    .order('created_at', { ascending: true });

  if (error) {
    console.error(error);
  } else {
    console.log(`Total fake products: ${data.length}`);
    data.forEach((p, i) => {
      console.log(`[${i}] "${p.name}" - 1d: ${p.rental_price_1d}, Cost: ${p.actual_cost}`);
    });
  }
}

checkFakeProducts();
