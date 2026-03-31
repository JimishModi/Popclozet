/**
 * Cloudflare Worker — Edge Rate Limiter + Geo-Blocking + Honeypots
 * 
 * Deploy this as a Cloudflare Worker in front of your app.
 * It handles Level 1 network security at the edge BEFORE
 * traffic reaches your app servers.
 * 
 * Setup:
 *   1. Install wrangler: npm i -g wrangler
 *   2. wrangler login
 *   3. wrangler deploy
 */

// ─── Configuration ───────────────────────────────────────────

const CONFIG = {
    // Countries where popclozet operates (ISO 3166 alpha-2)
    ALLOWED_COUNTRIES: ['IN', 'US', 'GB', 'AE', 'SG'],

    // Rate limits (requests per window)
    RATE_LIMIT_WINDOW: 60,       // seconds
    RATE_LIMIT_MAX_API: 100,     // API calls per minute per IP
    RATE_LIMIT_MAX_AUTH: 10,     // Auth calls per minute per IP

    // Honeypot paths — accessing these = instant ban
    HONEYPOTS: [
        '/admin/login.php',
        '/phpmyadmin',
        '/wp-admin',
        '/wp-login.php',
        '/.env',
        '/administrator',
        '/xmlrpc.php',
        '/config.php',
        '/backup.sql',
        '/db.sql',
    ],

    // Ban duration (hours)
    BAN_DURATION_HOURS: 24,
};

// ─── Rate Limit Store (uses Cloudflare KV) ───────────────────

interface RateLimitEntry {
    count: number;
    resetAt: number;
}

async function checkRateLimit(
    ip: string,
    endpoint: string,
    maxRequests: number,
    kv: KVNamespace
): Promise<{ allowed: boolean; remaining: number }> {
    const key = `rate:${ip}:${endpoint}`;
    const now = Date.now();

    const raw = await kv.get(key);
    let entry: RateLimitEntry = raw
        ? JSON.parse(raw)
        : { count: 0, resetAt: now + CONFIG.RATE_LIMIT_WINDOW * 1000 };

    // Reset window if expired
    if (now > entry.resetAt) {
        entry = { count: 0, resetAt: now + CONFIG.RATE_LIMIT_WINDOW * 1000 };
    }

    entry.count++;
    await kv.put(key, JSON.stringify(entry), {
        expirationTtl: CONFIG.RATE_LIMIT_WINDOW
    });

    return {
        allowed: entry.count <= maxRequests,
        remaining: Math.max(0, maxRequests - entry.count),
    };
}

// ─── Ban Store ───────────────────────────────────────────────

async function banIP(ip: string, reason: string, kv: KVNamespace): Promise<void> {
    await kv.put(`ban:${ip}`, JSON.stringify({ reason, bannedAt: Date.now() }), {
        expirationTtl: CONFIG.BAN_DURATION_HOURS * 3600,
    });
}

async function isIPBanned(ip: string, kv: KVNamespace): Promise<boolean> {
    return (await kv.get(`ban:${ip}`)) !== null;
}

// ─── Main Worker ─────────────────────────────────────────────

export default {
    async fetch(request: Request, env: { RATE_LIMIT_KV: KVNamespace }): Promise<Response> {
        const url = new URL(request.url);
        const ip = request.headers.get('cf-connecting-ip') || 'unknown';
        const country = request.headers.get('cf-ipcountry') || 'XX';
        const kv = env.RATE_LIMIT_KV;

        // ─── 1. Check if IP is banned ────────────────────────
        if (await isIPBanned(ip, kv)) {
            return new Response('Access Denied', { status: 403 });
        }

        // ─── 2. Honeypot check ───────────────────────────────
        if (CONFIG.HONEYPOTS.includes(url.pathname.toLowerCase())) {
            await banIP(ip, `Honeypot accessed: ${url.pathname}`, kv);
            return new Response('Not Found', { status: 404 });
        }

        // ─── 3. Geo-blocking ─────────────────────────────────
        if (!CONFIG.ALLOWED_COUNTRIES.includes(country)) {
            return new Response(
                JSON.stringify({ error: 'Service not available in your region' }),
                { status: 451, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // ─── 4. Rate limiting ────────────────────────────────
        const isAuthEndpoint = url.pathname.includes('/auth/') || url.pathname.includes('/login');
        const maxRequests = isAuthEndpoint ? CONFIG.RATE_LIMIT_MAX_AUTH : CONFIG.RATE_LIMIT_MAX_API;
        const endpoint = isAuthEndpoint ? 'auth' : 'api';

        const rateCheck = await checkRateLimit(ip, endpoint, maxRequests, kv);

        if (!rateCheck.allowed) {
            return new Response(
                JSON.stringify({
                    error: 'Too many requests',
                    retryAfter: CONFIG.RATE_LIMIT_WINDOW
                }),
                {
                    status: 429,
                    headers: {
                        'Content-Type': 'application/json',
                        'Retry-After': CONFIG.RATE_LIMIT_WINDOW.toString(),
                        'X-RateLimit-Remaining': '0',
                    }
                }
            );
        }

        // ─── 5. Add security headers and pass through ────────
        const response = await fetch(request);
        const newResponse = new Response(response.body, response);

        newResponse.headers.set('X-RateLimit-Remaining', rateCheck.remaining.toString());
        newResponse.headers.set('X-Content-Type-Options', 'nosniff');
        newResponse.headers.set('X-Frame-Options', 'SAMEORIGIN');
        newResponse.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');

        return newResponse;
    },
};

// Type declarations for Cloudflare Workers
interface KVNamespace {
    get(key: string): Promise<string | null>;
    put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}
