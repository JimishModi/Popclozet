import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function force() {
  console.log("Fetching all profiles...");
  const { data: profiles, error: selectErr } = await supabase.from('profiles').select('id, user_id, full_name, role');
  
  if (selectErr) {
      console.error("Error fetching profiles:", selectErr);
      return;
  }
  
  console.log("Current profiles in database:");
  console.table(profiles);

  console.log("\nForce updating ALL profiles to have 'rider' role...");
  
  // We have to update them one by one or using a generic filter
  for (const p of profiles) {
      const { error } = await supabase
        .from('profiles')
        .update({ role: 'rider' })
        .eq('id', p.id);
        
      if (error) {
          console.error(`Failed to update ${p.full_name}:`, error);
      }
  }
  
  console.log("\nRe-fetching to verify...");
  const { data: updated } = await supabase.from('profiles').select('id, user_id, full_name, role');
  console.table(updated);
}

force();
