/**
 * XSS Sanitizer — prevents stored/reflected XSS attacks
 * 
 * Sanitizes ALL user-generated text content before storing or rendering.
 * "Never Trust User Input" — even after Zod validates the format.
 */

// Characters that have special meaning in HTML
const HTML_ESCAPE_MAP: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
    '`': '&#96;',
};

/**
 * Escape HTML special characters to prevent XSS.
 * Use this for any user text rendered in the DOM.
 */
export function escapeHtml(input: string): string {
    return input.replace(/[&<>"'`/]/g, (char) => HTML_ESCAPE_MAP[char] || char);
}

/**
 * Strip all HTML tags from a string.
 * Use this for plain-text fields (names, descriptions, etc.)
 */
export function stripHtml(input: string): string {
    return input
        .replace(/<[^>]*>/g, '')           // Remove HTML tags
        .replace(/javascript:/gi, '')       // Remove javascript: protocol
        .replace(/on\w+\s*=/gi, '')         // Remove event handlers (onclick=, etc.)
        .replace(/data:/gi, '')             // Remove data: URIs
        .replace(/vbscript:/gi, '')         // Remove vbscript: protocol
        .trim();
}

/**
 * Sanitize a URL to prevent javascript: and data: protocol attacks.
 * Only allows http:, https:, mailto:, and tel: protocols.
 */
export function sanitizeUrl(url: string): string {
    const trimmed = url.trim().toLowerCase();
    const allowedProtocols = ['http:', 'https:', 'mailto:', 'tel:'];

    try {
        const parsed = new URL(trimmed);
        if (!allowedProtocols.includes(parsed.protocol)) {
            return '#'; // Return safe fallback
        }
        return url.trim();
    } catch {
        // Relative URLs are OK
        if (trimmed.startsWith('/') || trimmed.startsWith('#') || trimmed.startsWith('.')) {
            return url.trim();
        }
        return '#';
    }
}

/**
 * Deep sanitize an object — recursively sanitizes all string values.
 * Use this before storing any user-submitted JSON/form data.
 */
export function sanitizeObject<T>(obj: T): T {
    if (typeof obj === 'string') {
        return stripHtml(obj) as unknown as T;
    }
    if (Array.isArray(obj)) {
        return obj.map(sanitizeObject) as unknown as T;
    }
    if (typeof obj === 'object' && obj !== null) {
        const result: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(obj)) {
            result[key] = sanitizeObject(value);
        }
        return result as T;
    }
    return obj;
}

/**
 * Sanitize a search query to prevent SQL injection via search inputs.
 * Escapes SQL wildcards and special characters.
 */
export function sanitizeSearchQuery(query: string): string {
    return query
        .replace(/[%_\\]/g, (char) => `\\${char}`)   // Escape SQL wildcards
        .replace(/'/g, "''")                           // Escape single quotes
        .slice(0, 200);                                // Limit length
}
