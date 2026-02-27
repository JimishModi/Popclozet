/**
 * CSRF Protection Utility
 * 
 * Generates and validates CSRF tokens for state-changing operations.
 * Uses the double-submit cookie pattern (since we're a SPA).
 */

const CSRF_TOKEN_KEY = 'popclozet_csrf';
const CSRF_HEADER = 'X-CSRF-Token';

/**
 * Generate a cryptographically random CSRF token.
 */
export function generateCsrfToken(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const token = Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');

    // Store in sessionStorage (not accessible cross-origin)
    sessionStorage.setItem(CSRF_TOKEN_KEY, token);
    return token;
}

/**
 * Get the current CSRF token (or generate one if missing).
 */
export function getCsrfToken(): string {
    const existing = sessionStorage.getItem(CSRF_TOKEN_KEY);
    if (existing) return existing;
    return generateCsrfToken();
}

/**
 * Validate a CSRF token against the stored one.
 */
export function validateCsrfToken(token: string): boolean {
    const stored = sessionStorage.getItem(CSRF_TOKEN_KEY);
    if (!stored || !token) return false;

    // Constant-time comparison to prevent timing attacks
    if (stored.length !== token.length) return false;
    let result = 0;
    for (let i = 0; i < stored.length; i++) {
        result |= stored.charCodeAt(i) ^ token.charCodeAt(i);
    }
    return result === 0;
}

/**
 * Add CSRF token to fetch headers.
 * Use this wrapper for all state-changing API calls.
 * 
 * Example:
 *   fetch('/api/order', { ...csrfHeaders(), method: 'POST', body: ... })
 */
export function csrfHeaders(): Record<string, string> {
    return { [CSRF_HEADER]: getCsrfToken() };
}

/**
 * Refresh the CSRF token (call after each state-changing request).
 */
export function refreshCsrfToken(): string {
    return generateCsrfToken();
}
