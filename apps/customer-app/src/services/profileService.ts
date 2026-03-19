/**
 * Profile Service
 *
 * CRUD operations for customer profile data.
 * Reads still go through the `profiles` compatibility view, but writes
 * prefer `customer_profiles` because newer schemas expose `profiles` as a view.
 * Used by SupabaseAuthContext for onboarding and profile management.
 */

import { supabase } from '@popclozet/api-client';

const CUSTOMER_PROFILE_TABLE = 'customer_profiles';
const LEGACY_PROFILE_TABLE = 'profiles';
const CUSTOMER_OPTIONAL_COLUMNS = ['id', 'phone', 'avatar_url', 'onboarding_completed', 'email', 'gender'] as const;
const LEGACY_OPTIONAL_COLUMNS = ['id', 'phone', 'avatar_url', 'onboarding_completed', 'email', 'gender', 'measurements'] as const;

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

type ProfileWriteFields = Partial<{
    full_name: string;
    phone: string;
    email: string;
    avatar_url: string;
    role: string;
    gender: string;
    onboarding_completed: boolean;
    measurements: Record<string, number>;
}>;

function hasText(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
}

function normalizePhone(userId: string, phone?: string | null): string {
    return hasText(phone) ? phone.trim() : `pending-${userId}`;
}

function pruneUndefined<T extends Record<string, unknown>>(payload: T): Partial<T> {
    return Object.fromEntries(
        Object.entries(payload).filter(([, value]) => value !== undefined)
    ) as Partial<T>;
}

function getErrorMessage(error: unknown): string {
    return String((error as { message?: string })?.message ?? '').toLowerCase();
}

function isMissingRelationError(error: unknown, relation: string): boolean {
    const message = getErrorMessage(error);
    return (
        message.includes(`relation "${relation}" does not exist`) ||
        message.includes(`table "${relation}" does not exist`) ||
        message.includes(`could not find the table '${relation}'`) ||
        message.includes(`could not find the table "${relation}"`)
    );
}

function isMissingColumnError(error: unknown, relation: string, column: string): boolean {
    const message = getErrorMessage(error);
    return (
        message.includes(`column "${column}" of relation "${relation}" does not exist`) ||
        message.includes(`could not find the '${column}' column of '${relation}'`) ||
        message.includes(`could not find the "${column}" column of "${relation}"`)
    );
}

async function readProfileByUserId(userId: string): Promise<ProfileRow | null> {
    const { data, error } = await supabase
        .from(LEGACY_PROFILE_TABLE)
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

    if (error) {
        console.error('Error fetching profile:', error);
        return null;
    }

    return data as ProfileRow | null;
}

async function upsertWithOptionalColumnFallback(
    table: string,
    payload: Record<string, unknown>,
    optionalColumns: readonly string[]
): Promise<void> {
    let nextPayload = { ...payload };

    while (true) {
        const { error } = await supabase
            .from(table)
            .upsert(nextPayload, { onConflict: 'user_id' });

        if (!error) return;

        const missingColumn = optionalColumns.find(
            (column) => column in nextPayload && isMissingColumnError(error, table, column)
        );

        if (!missingColumn) throw error;

        delete nextPayload[missingColumn];
    }
}

async function updateWithOptionalColumnFallback(
    table: string,
    userId: string,
    payload: Record<string, unknown>,
    optionalColumns: readonly string[]
): Promise<void> {
    let nextPayload = { ...payload };

    if (Object.keys(nextPayload).length === 0) return;

    while (true) {
        const { error } = await supabase
            .from(table)
            .update(nextPayload)
            .eq('user_id', userId);

        if (!error) return;

        const missingColumn = optionalColumns.find(
            (column) => column in nextPayload && isMissingColumnError(error, table, column)
        );

        if (!missingColumn) throw error;

        delete nextPayload[missingColumn];

        if (Object.keys(nextPayload).length === 0) return;
    }
}

async function writeProfileInsert(
    userId: string,
    payload: Record<string, unknown>
): Promise<void> {
    const customerPayload = pruneUndefined({
        id: userId,
        user_id: userId,
        full_name: payload.full_name,
        phone: payload.phone,
        avatar_url: payload.avatar_url,
        onboarding_completed: payload.onboarding_completed,
        email: payload.email,
        gender: payload.gender,
    });

    try {
        await upsertWithOptionalColumnFallback(
            CUSTOMER_PROFILE_TABLE,
            customerPayload as Record<string, unknown>,
            CUSTOMER_OPTIONAL_COLUMNS
        );
        return;
    } catch (error) {
        if (!isMissingRelationError(error, CUSTOMER_PROFILE_TABLE)) {
            throw error;
        }
    }

    const legacyPayload = pruneUndefined({
        id: userId,
        user_id: userId,
        full_name: payload.full_name,
        phone: payload.phone,
        avatar_url: payload.avatar_url,
        onboarding_completed: payload.onboarding_completed,
        email: payload.email,
        gender: payload.gender,
        role: payload.role ?? 'customer',
        measurements: payload.measurements,
    });

    await upsertWithOptionalColumnFallback(
        LEGACY_PROFILE_TABLE,
        legacyPayload as Record<string, unknown>,
        LEGACY_OPTIONAL_COLUMNS
    );
}

async function writeProfileUpdate(
    userId: string,
    payload: Record<string, unknown>
): Promise<void> {
    const customerPayload = pruneUndefined({
        full_name: payload.full_name,
        phone: payload.phone,
        avatar_url: payload.avatar_url,
        onboarding_completed: payload.onboarding_completed,
        email: payload.email,
        gender: payload.gender,
    });

    try {
        await updateWithOptionalColumnFallback(
            CUSTOMER_PROFILE_TABLE,
            userId,
            customerPayload as Record<string, unknown>,
            CUSTOMER_OPTIONAL_COLUMNS
        );
        return;
    } catch (error) {
        if (!isMissingRelationError(error, CUSTOMER_PROFILE_TABLE)) {
            throw error;
        }
    }

    const legacyPayload = pruneUndefined({
        full_name: payload.full_name,
        phone: payload.phone,
        avatar_url: payload.avatar_url,
        onboarding_completed: payload.onboarding_completed,
        email: payload.email,
        gender: payload.gender,
        role: payload.role,
        measurements: payload.measurements,
    });

    await updateWithOptionalColumnFallback(
        LEGACY_PROFILE_TABLE,
        userId,
        legacyPayload as Record<string, unknown>,
        LEGACY_OPTIONAL_COLUMNS
    );
}

// ==========================================
// READ
// ==========================================

/**
 * Fetch the current user's profile from Supabase.
 * Returns null if no profile exists (new user).
 */
export async function getCurrentProfile(userId?: string): Promise<ProfileRow | null> {
    let resolvedUserId = userId;

    if (!resolvedUserId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;
        resolvedUserId = user.id;
    }

    return readProfileByUserId(resolvedUserId);
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

    const payload = pruneUndefined({
        full_name: fields.full_name.trim(),
        phone: normalizePhone(user.id, fields.phone || user.phone || ''),
        email: hasText(fields.email) ? fields.email.trim() : (user.email ?? undefined),
        role: 'customer',
        gender: fields.gender || undefined,
        onboarding_completed: true,
    });

    try {
        await writeProfileInsert(user.id, payload as Record<string, unknown>);
    } catch (error) {
        throw new Error(`Profile creation failed: ${(error as { message?: string })?.message ?? 'Unknown error'}`);
    }

    const profile = await readProfileByUserId(user.id);
    if (profile) return profile;

    return {
        id: user.id,
        user_id: user.id,
        full_name: payload.full_name as string,
        phone: payload.phone as string,
        email: payload.email as string | undefined,
        gender: payload.gender as string | undefined,
        onboarding_completed: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    };
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

    const payload = pruneUndefined({
        ...(hasText(updates.full_name) ? { full_name: updates.full_name.trim() } : {}),
        ...(typeof updates.phone === 'string' ? { phone: normalizePhone(user.id, updates.phone) } : {}),
        ...(typeof updates.email === 'string' ? { email: updates.email.trim() } : {}),
        ...(typeof updates.avatar_url === 'string' ? { avatar_url: updates.avatar_url } : {}),
        ...(typeof updates.gender === 'string' ? { gender: updates.gender } : {}),
        ...(typeof updates.onboarding_completed === 'boolean' ? { onboarding_completed: updates.onboarding_completed } : {}),
        ...(updates.measurements ? { measurements: updates.measurements } : {}),
    });

    try {
        await writeProfileUpdate(user.id, payload as Record<string, unknown>);
    } catch (error) {
        throw new Error(`Profile update failed: ${(error as { message?: string })?.message ?? 'Unknown error'}`);
    }

    const profile = await readProfileByUserId(user.id);
    if (!profile) throw new Error('Profile update failed: profile could not be reloaded');

    return profile;
}
