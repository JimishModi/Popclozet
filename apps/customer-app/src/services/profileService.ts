/**
 * Profile Service
 *
 * CRUD operations for the `customer_profiles` table.
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
    email_verified?: boolean;
    avatar_url?: string;
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
 * Fetch a user's profile from customer_profiles.
 * Returns null if no profile exists (new user).
 */
export async function getCurrentProfile(userId?: string): Promise<ProfileRow | null> {
    let uid = userId;
    if (!uid) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;
        uid = user.id;
    }

    const { data, error } = await supabase
        .from('customer_profiles')
        .select('*')
        .eq('user_id', uid)
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
 * Create a new customer profile.
 * Called during onboarding when no profile exists yet.
 */
export async function createProfile(fields: {
    full_name: string;
    phone: string;
    email?: string;
    gender?: string;
    email_verified?: boolean;
    onboarding_completed?: boolean;
}): Promise<ProfileRow> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No authenticated user');

    const payload = {
        user_id: user.id,
        full_name: fields.full_name,
        phone: fields.phone || user.phone || '',
        email: fields.email || '',
        email_verified: fields.email_verified ?? false,
        gender: fields.gender || null,
        onboarding_completed: fields.onboarding_completed ?? true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
        .from('customer_profiles')
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
 * Update the current user's customer profile.
 * Accepts partial fields — only the provided keys are written.
 */
export async function updateProfile(updates: Partial<{
    full_name: string;
    phone: string;
    email: string;
    email_verified: boolean;
    avatar_url: string;
    gender: string;
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
        .from('customer_profiles')
        .update(payload)
        .eq('user_id', user.id)
        .select()
        .single();

    if (error) throw new Error(`Profile update failed: ${error.message}`);
    return data as ProfileRow;
}
