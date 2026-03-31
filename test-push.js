import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testPush() {
  console.log("Invoking send-push-notification...");
  const { data, error } = await supabase.functions.invoke('send-push-notification', {
    body: {
      title: "Test",
      body: "Test Body",
    },
  });

  console.log("Data:", data);
  console.log("Error:", error);
}

testPush();
