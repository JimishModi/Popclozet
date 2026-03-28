/**
 * MFA (Multi-Factor Authentication) Service
 * 
 * Handles TOTP enrollment, verification, and management
 * using Supabase Auth MFA.
 * 
 * Prerequisites:
 *   - Enable MFA in Supabase Dashboard → Auth → MFA
 *   - Install: npm install otpauth qrcode
 */

import { supabase } from '@popclozet/api-client';

export interface MFAFactor {
    id: string;
    type: 'totp';
    friendlyName: string;
    createdAt: string;
}

export interface MFAEnrollResult {
    factorId: string;
    qrCode: string;    // data:image/svg+xml URI for QR code
    secret: string;     // Manual entry key
    uri: string;        // otpauth:// URI
}

/**
 * Enroll a new TOTP factor for the current user.
 * Returns a QR code that the user scans with Google Authenticator / Authy.
 */
export async function enrollMFA(friendlyName = 'popclozet App'): Promise<MFAEnrollResult> {
    const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName,
    });

    if (error) throw new Error(`MFA enrollment failed: ${error.message}`);

    return {
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
        uri: data.totp.uri,
    };
}

/**
 * Verify a TOTP code to complete MFA enrollment or login challenge.
 */
export async function verifyMFA(factorId: string, code: string): Promise<boolean> {
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
    });

    if (challengeError) throw new Error(`MFA challenge failed: ${challengeError.message}`);

    const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code,
    });

    if (verifyError) throw new Error(`MFA verification failed: ${verifyError.message}`);

    return true;
}

/**
 * List all enrolled MFA factors for the current user.
 */
export async function listMFAFactors(): Promise<MFAFactor[]> {
    const { data, error } = await supabase.auth.mfa.listFactors();

    if (error) throw new Error(`Failed to list MFA factors: ${error.message}`);

    return data.totp.map((f) => ({
        id: f.id,
        type: 'totp' as const,
        friendlyName: f.friendly_name || 'Authenticator',
        createdAt: f.created_at,
    }));
}

/**
 * Unenroll (remove) an MFA factor.
 */
export async function unenrollMFA(factorId: string): Promise<void> {
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) throw new Error(`Failed to remove MFA: ${error.message}`);
}

/**
 * Check if the current user has MFA enabled.
 */
export async function isMFAEnabled(): Promise<boolean> {
    const factors = await listMFAFactors();
    return factors.length > 0;
}

/**
 * Get the current MFA assurance level.
 * - 'aal1' = password only
 * - 'aal2' = password + MFA verified
 */
export async function getMFAAssuranceLevel(): Promise<'aal1' | 'aal2'> {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error) throw new Error(`Failed to get MFA level: ${error.message}`);
    return data.currentLevel || 'aal1';
}

/**
 * Check if MFA verification is required for the current session.
 * Returns true if user has MFA enrolled but hasn't verified yet.
 */
export async function isMFARequired(): Promise<boolean> {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error) return false;
    return data.currentLevel === 'aal1' && data.nextLevel === 'aal2';
}
