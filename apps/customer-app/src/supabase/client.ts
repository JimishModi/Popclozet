/**
 * Use the shared supabase client from the monorepo package.
 * This avoids hardcoded demo credentials and ensures apps use the same config.
 */
import { supabase as sharedSupabase } from '@popclozet/api-client';

export const supabase = sharedSupabase;
export const isSupabaseConfigured = Boolean(sharedSupabase);
