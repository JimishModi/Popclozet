/**
 * ⚠️ DO NOT add createClient() here.
 * This file re-exports the single canonical Supabase client from @popclozet/api-client.
 * Having multiple createClient() calls causes auth session conflicts and buffering.
 */
import { supabase as _supabase } from '@popclozet/api-client';
import type { Database } from './types';
import type { SupabaseClient } from '@supabase/supabase-js';

// Re-export the shared singleton — typed with the local Database schema
export const supabase = _supabase as unknown as SupabaseClient<Database>;

