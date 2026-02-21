import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://rmhetvmgjqxfmcidxvrz.supabase.co";
const SUPABASE_KEY = "sb_publishable_07TnsACnZ96coI2pkYdpAg_6czNptvh";

const hasValidEnv = Boolean(SUPABASE_URL && SUPABASE_KEY);

// Only create the client if env vars are present so the app doesn't crash when backend is offline.
export const supabase: SupabaseClient | null = hasValidEnv
  ? createClient(SUPABASE_URL as string, SUPABASE_KEY as string)
  : null;

export const isSupabaseConfigured = hasValidEnv;
