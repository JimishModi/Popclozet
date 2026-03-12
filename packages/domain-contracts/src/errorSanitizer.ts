/**
 * Error Sanitizer — prevents stack trace and internal info leakage
 * 
 * In production, error messages shown to users must NEVER contain:
 * - Stack traces
 * - Database column/table names
 * - Internal file paths
 * - Supabase internal error codes
 * - SQL query fragments
 */

interface SafeError {
    message: string;
    code: string;
    statusCode: number;
}

// Map of internal error patterns to user-friendly messages
const ERROR_MAP: Array<{ pattern: RegExp; safe: SafeError }> = [
    {
        pattern: /duplicate key|unique constraint|23505/i,
        safe: { message: 'This record already exists.', code: 'DUPLICATE', statusCode: 409 },
    },
    {
        pattern: /foreign key|23503/i,
        safe: { message: 'Referenced record not found.', code: 'REFERENCE_ERROR', statusCode: 400 },
    },
    {
        pattern: /not null|23502/i,
        safe: { message: 'Required field is missing.', code: 'MISSING_FIELD', statusCode: 400 },
    },
    {
        pattern: /check constraint|23514/i,
        safe: { message: 'Invalid value provided.', code: 'INVALID_VALUE', statusCode: 400 },
    },
    {
        pattern: /permission denied|42501|new row violates/i,
        safe: { message: 'You do not have permission for this action.', code: 'FORBIDDEN', statusCode: 403 },
    },
    {
        pattern: /JWT|token|expired|auth/i,
        safe: { message: 'Your session has expired. Please sign in again.', code: 'AUTH_EXPIRED', statusCode: 401 },
    },
    {
        pattern: /rate limit|too many/i,
        safe: { message: 'Too many requests. Please wait and try again.', code: 'RATE_LIMITED', statusCode: 429 },
    },
    {
        pattern: /timeout|ETIMEDOUT|ECONNREFUSED/i,
        safe: { message: 'Service temporarily unavailable. Please try again.', code: 'TIMEOUT', statusCode: 503 },
    },
    {
        pattern: /relation.*does not exist|42P01/i,
        safe: { message: 'An internal error occurred.', code: 'INTERNAL', statusCode: 500 },
    },
];

/**
 * Convert any error into a safe, user-friendly error.
 * NEVER expose internal details to the frontend.
 */
export function sanitizeError(error: unknown): SafeError {
    const rawMessage = error instanceof Error ? error.message : String(error);

    // Check against known patterns
    for (const { pattern, safe } of ERROR_MAP) {
        if (pattern.test(rawMessage)) {
            return safe;
        }
    }

    // Default: generic error (never leak the original message)
    return {
        message: 'Something went wrong. Please try again later.',
        code: 'UNKNOWN',
        statusCode: 500,
    };
}

/**
 * Wrap an async function to automatically sanitize errors.
 * Use this around all Supabase calls in services.
 * 
 * Example:
 *   const result = await safeAsync(() => supabase.from('orders').select());
 */
export async function safeAsync<T>(
    fn: () => Promise<T>,
    fallback?: T
): Promise<{ data: T | null; error: SafeError | null }> {
    try {
        const data = await fn();
        return { data, error: null };
    } catch (err) {
        console.error('[SafeAsync] Original error:', err); // Logged in sanitized form by logSanitizer
        return { data: fallback ?? null, error: sanitizeError(err) };
    }
}

/**
 * Check if an error is a specific safe error code.
 */
export function isErrorCode(error: SafeError | null, code: string): boolean {
    return error?.code === code;
}
