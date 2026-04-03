// Inline types — @vercel/node is available at deploy time, not needed locally
type VercelRequest = { headers: Record<string, string | undefined> };
type VercelResponse = {
    status(code: number): VercelResponse;
    send(body: string): void;
    setHeader(name: string, value: string): void;
};

/**
 * Vercel Serverless Function — proxies the MSG91 OTP SDK script.
 *
 * MSG91's CDN (verify.msg91.com) does NOT send Access-Control-Allow-Origin
 * headers, which causes CORS failures when loading the script via a <script>
 * tag from Vercel preview deployments (and some browsers on custom domains).
 *
 * This function fetches the script server-side and serves it from the same
 * origin, completely bypassing CORS restrictions.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        const upstream = await fetch('https://verify.msg91.com/otp-provider.js', {
            headers: {
                'User-Agent': req.headers['user-agent'] || 'PopClozet-Proxy/1.0',
            },
        });

        if (!upstream.ok) {
            res.status(upstream.status).send(`MSG91 upstream returned ${upstream.status}`);
            return;
        }

        const scriptBody = await upstream.text();

        // Serve with correct content type + aggressive short-term cache
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600'); // 5min browser / 10min CDN
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(200).send(scriptBody);
    } catch (err: any) {
        console.error('[otp-provider proxy] fetch failed:', err);
        res.status(502).send('Failed to fetch MSG91 OTP script');
    }
}
