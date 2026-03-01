/**
 * Profile Service
 *
 * CRUD operations for the `profiles` table.
 * Used by SupabaseAuthContext for onboarding and profile management.
 */

import { supabase } from '@popclozet/api-client';

// ==========================================
// TYPES
// ==========================================

export interface ProfileRow {
    id: string;
    user_id: string;
    full_name: string;
    phone: string;
    email?: string;
    avatar_url?: string;
    role: string;
    gender?: string;
    onboarding_completed?: boolean;
    measurements?: Record<string, number>;
    created_at: string;
    updated_at: string;
}

// ==========================================
// READ
// ==========================================

/**
 * Fetch the current user's profile from Supabase.
 * Returns null if no profile exists (new user).
 */
export async function getCurrentProfile(): Promise<ProfileRow | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

    if (error) {
        console.error('Error fetching profile:', error);
        return null;
    }

    return data as ProfileRow | null;
}

// ==========================================
// CREATE
// ==========================================

/**
 * Create a new profile for the current user.
 * Called during onboarding when no profile exists yet.
 */
export async function createProfile(fields: {
    full_name: string;
    phone: string;
    role?: string;
    email?: string;
    gender?: string;
}): Promise<ProfileRow> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No authenticated user');

    const payload = {
        user_id: user.id,
        full_name: fields.full_name,
        phone: fields.phone || user.phone || '',
        email: fields.email || user.email || '',
        role: fields.role || 'customer',
        gender: fields.gender || null,
        onboarding_completed: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
        .from('profiles')
        .insert(payload)
        .select()
        .single();

    if (error) throw new Error(`Profile creation failed: ${error.message}`);
    return data as ProfileRow;
}

// ==========================================
// UPDATE
// ==========================================

/**
 * Update the current user's profile.
 * Accepts partial fields — only the provided keys are written.
 */
export async function updateProfile(updates: Partial<{
    full_name: string;
    phone: string;
    email: string;
    avatar_url: string;
    gender: string;
    role: string;
    onboarding_completed: boolean;
    measurements: Record<string, number>;
}>): Promise<ProfileRow> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No authenticated user');

    const payload: Record<string, any> = {
        ...updates,
        updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('user_id', user.id)
        .select()
        .single();

    if (error) throw new Error(`Profile update failed: ${error.message}`);
    return data as ProfileRow;
}
