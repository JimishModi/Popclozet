// test-reviews.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hfcdvcpgpkdgmcakgiuy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhmY2R2Y3BncGtkZ21jYWtnaXV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NTY5ODcsImV4cCI6MjA4NjUzMjk4N30.gOKipZ5_Df-yV9ZQAj7hxn9Cg8OwJuT74UhgvvrhqbY';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    const { data, error } = await supabase
        .from('product_reviews')
        .select('id, rating, review_text, created_at, user_id, profiles(full_name)')
        .eq('product_id', 'edafcf8a-26df-453c-b575-a1193636000b')
        .not('review_text', 'is', null)
        .order('created_at', { ascending: false })
        .limit(10);
        
    console.log('Error:', error);
    console.log('Data size:', data ? data.length : null);
}

test();
