/**
 * ⚠️ DO NOT add createClient() here.
 * Re-exports the single canonical Supabase client from @popclozet/api-client.
 * Multiple createClient() calls = split auth sessions + buffering.
 */
import { supabase, getCurrentUser } from '@popclozet/api-client';

export { supabase, getCurrentUser };

// Helper function to check if user is customer
export const isCustomerRole = async () => {
    const user = await getCurrentUser();
    if (!user) return false;

    const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    if (error) throw error;
    return data?.role === 'customer';
};

