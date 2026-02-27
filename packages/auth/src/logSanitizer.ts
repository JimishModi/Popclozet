/**
 * Log Sanitizer — strips PII from console output
 * 
 * Wraps console.log/warn/error to automatically redact sensitive data
 * like phone numbers, emails, tokens, and API keys before logging.
 */

const PII_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
    // Phone numbers (10-15 digits, with optional +)
    { pattern: /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, replacement: '[PHONE_REDACTED]' },
    // Email addresses
    { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: '[EMAIL_REDACTED]' },
    // JWT tokens (3 base64 sections separated by dots)
    { pattern: /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, replacement: '[JWT_REDACTED]' },
    // Supabase anon/service keys (typically start with eyJ)
    { pattern: /eyJ[a-zA-Z0-9_-]{50,}/g, replacement: '[KEY_REDACTED]' },
    // Generic API keys (long alphanumeric strings)
    { pattern: /(?:api[_-]?key|token|secret|password|authorization)['":\s]*['"]?([a-zA-Z0-9_-]{20,})/gi, replacement: '$1[REDACTED]' },
    // Credit card patterns (basic)
    { pattern: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, replacement: '[CARD_REDACTED]' },
    // OTP codes (6 digits in context)
    { pattern: /(?:otp|code|pin)['":\s]*['"]?(\d{4,6})/gi, replacement: '[OTP_REDACTED]' },
];

function sanitize(input: unknown): unknown {
    if (typeof input === 'string') {
        let sanitized = input;
        for (const { pattern, replacement } of PII_PATTERNS) {
            sanitized = sanitized.replace(pattern, replacement);
        }
        return sanitized;
    }

    if (typeof input === 'object' && input !== null) {
        try {
            const str = JSON.stringify(input);
            let sanitized = str;
            for (const { pattern, replacement } of PII_PATTERNS) {
                sanitized = sanitized.replace(pattern, replacement);
            }
            return JSON.parse(sanitized);
        } catch {
            return input;
        }
    }

    return input;
}

/**
 * Install the log sanitizer globally.
 * Call this ONCE at app startup (e.g., in main.tsx).
 * 
 * In production, this replaces console methods with sanitized versions.
 * In development, it's a no-op to preserve debugging experience.
 */
export function installLogSanitizer(forceEnable = false): void {
    const isProduction = import.meta.env?.PROD ?? false;

    if (!isProduction && !forceEnable) {
        return; // Don't sanitize in dev mode
    }

    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;
    const originalInfo = console.info;

    console.log = (...args: unknown[]) => originalLog(...args.map(sanitize));
    console.warn = (...args: unknown[]) => originalWarn(...args.map(sanitize));
    console.error = (...args: unknown[]) => originalError(...args.map(sanitize));
    console.info = (...args: unknown[]) => originalInfo(...args.map(sanitize));
}

export { sanitize };
