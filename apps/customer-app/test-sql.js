import { createClient } from '@supabase/supabase-js';

const supabaseUrlFinal = 'http://127.0.0.1:54321';
const supabaseKeyFinal = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhmY2R2Y3BncGtkZ21jYWtnaXV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NTY5ODcsImV4cCI6MjA4NjUzMjk4N30.gOKipZ5_Df-yV9ZQAj7hxn9Cg8OwJuT74UhgvvrhqbY';

const supabase = createClient(supabaseUrlFinal, supabaseKeyFinal, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  console.log("Connecting...");
  const { data, error } = await supabase.from('orders').select('id').limit(1);
  if (error) {
    console.error("Connection failed:", error);
  } else {
    console.log("Connection OK.");
  }
}
main();
