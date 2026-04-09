/**
 * Open Redirect Protection
 * 
 * Prevents attackers from tricking users into visiting malicious sites
 * via redirect parameters (e.g., ?redirect=https://evil.com).
 */

// Allowed redirect domains (add your production domains)
const ALLOWED_ORIGINS = [
    'localhost',
    'popclozet.in',
    'www.popclozet.in',
    'rider.popclozet.in',
];

/**
 * Validate a redirect URL to prevent open redirect attacks.
 * Only allows relative paths and whitelisted origins.
 * 
 * @returns The safe URL to redirect to, or '/' if the URL is suspicious
 */
export function safeRedirect(url: string | null | undefined, fallback = '/'): string {
    if (!url) return fallback;

    const trimmed = url.trim();

    // Allow relative paths (starting with /)
    if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
        return trimmed;
    }

    // Validate absolute URLs against whitelist
    try {
        const parsed = new URL(trimmed);

        // Block non-HTTPS (except localhost for dev)
        if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost') {
            return fallback;
        }

        // Check against allowed origins
        const isAllowed = ALLOWED_ORIGINS.some(
            (origin) => parsed.hostname === origin || parsed.hostname.endsWith(`.${origin}`)
        );

        return isAllowed ? trimmed : fallback;
    } catch {
        return fallback;
    }
}

/**
 * Extract and validate redirect param from URL search params.
 * Use this in auth callback handlers.
 */
export function getRedirectFromParams(searchParams: URLSearchParams): string {
    const redirect = searchParams.get('redirect') || searchParams.get('returnTo') || searchParams.get('next');
    return safeRedirect(redirect);
}
