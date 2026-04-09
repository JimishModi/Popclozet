const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCategory() {
    const { data, error } = await supabase
        .from('category_configs')
        .select('*')
        .eq('category', 'accessories');
    
    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Category Config for Accessories:', JSON.stringify(data, null, 2));
    }
}

checkCategory();
