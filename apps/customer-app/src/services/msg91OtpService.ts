/**
 * MSG91 OTP Service
 * Handles all interactions with MSG91's browser-side OTP SDK.
 *
 * Loading strategy (CORS-proof):
 *   1. fetch() the script TEXT from a same-origin proxy URL
 *   2. Create a blob: URL from the text
 *   3. Inject the blob URL as a <script> tag
 * This completely avoids CORS because both the fetch and the script
 * execution happen on same-origin blob URLs.
 */

/** URLs to try, in order of preference */
const FETCH_URLS = [
    '/msg91-otp-sdk.js',                            // Local static file (most reliable)
    '/otp-provider.js',                              // Same-origin Vercel proxy
];

/** Direct remote URL — used ONLY as a last-resort <script> tag (bypasses CORS) */
const REMOTE_SCRIPT_URL = 'https://verify.msg91.com/otp-provider.js';

// Environment variables - must be set in .env file
const WIDGET_ID = import.meta.env.VITE_MSG91_WIDGET_ID as string;
const TOKEN_AUTH = import.meta.env.VITE_MSG91_TOKEN_AUTH as string;
let sdkReady = false;
let sdkInitPromise: Promise<void> | null = null;

/**
 * Fetch the MSG91 script body as text.
 * Tries each URL in FETCH_URLS until one succeeds.
 */
async function fetchScriptText(): Promise<string> {
    let lastError: Error | null = null;
    for (const url of FETCH_URLS) {
        try {
            console.info(`[MSG91] Fetching script from ${url}...`);
            const res = await fetch(`${url}?cb=${Date.now()}`, { cache: 'no-store' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const text = await res.text();
            // Sanity check — the response should contain JS, not an HTML error page
            if (!text || text.trim().startsWith('<!') || text.trim().startsWith('<html')) {
                throw new Error('Response is HTML, not JavaScript');
            }
            console.info(`[MSG91] Script fetched successfully from ${url} (${text.length} bytes)`);
            return text;
        } catch (err: any) {
            console.warn(`[MSG91] Failed to fetch from ${url}:`, err.message);
            lastError = err;
        }
    }
    throw lastError || new Error('All MSG91 script fetch attempts failed');
}

function loadAndInit(identifier: string, autoSend = true): Promise<void> {
    // If already ready, resolve immediately
    if (sdkReady) return Promise.resolve();
    // If already initializing, return the same promise
    if (sdkInitPromise) return sdkInitPromise;

    sdkInitPromise = new Promise<void>(async (resolve, reject) => {
        if (!WIDGET_ID || !TOKEN_AUTH) {
            reject(new Error('MSG91 Configuration Missing: Please set VITE_MSG91_WIDGET_ID and VITE_MSG91_TOKEN_AUTH in your .env file.'));
            return;
        }

        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            sdkInitPromise = null;
            reject(new Error('Device appears offline. Please reconnect and try again.'));
            return;
        }

        const configuration: Record<string, any> = {
            widgetId: WIDGET_ID,
            tokenAuth: TOKEN_AUTH,
            identifier,
            exposeMethods: true,
            autoSend: autoSend,
            success: (data: any) => console.info('[MSG91] init success callback (OTP may have been sent)', data),
            failure: (error: any) => console.error('[MSG91] init failure callback', error),
        };

        // Remove any previously injected MSG91 scripts
        document.querySelectorAll('script[data-msg91]').forEach(el => el.remove());

        try {
            // ── Step 1: Fetch script text via same-origin proxy ──────────
            const scriptText = await fetchScriptText();

            // ── Step 2: Create blob URL (same-origin, no CORS) ───────────
            const blob = new Blob([scriptText], { type: 'application/javascript' });
            const blobUrl = URL.createObjectURL(blob);

            // ── Step 3: Inject as <script> tag ───────────────────────────
            const script = document.createElement('script');
            script.type = 'text/javascript';
            script.async = true;
            script.setAttribute('data-msg91', 'true');
            script.src = blobUrl;

            const loadTimeout = setTimeout(() => {
                script.remove();
                URL.revokeObjectURL(blobUrl);
                sdkInitPromise = null;
                reject(new Error('MSG91 script execution timed out (15s).'));
            }, 15000);

            script.onload = () => {
                clearTimeout(loadTimeout);
                URL.revokeObjectURL(blobUrl);

                try {
                    if (typeof (window as any).initSendOTP !== 'function') {
                        sdkInitPromise = null;
                        reject(new Error('initSendOTP not found after script load'));
                        return;
                    }

                    (window as any).initSendOTP(configuration);
                    console.info('[MSG91] initSendOTP called');

                    // Poll until SDK methods appear on window (max 10s)
                    const start = Date.now();
                    const poll = () => {
                        if (typeof (window as any).sendOtp === 'function') {
                            sdkReady = true;
                            console.info('[MSG91] SDK ready');
                            resolve();
                            return;
                        }
                        if (Date.now() - start >= 10000) {
                            sdkInitPromise = null;
                            reject(new Error('MSG91 SDK timed out waiting for sendOtp method'));
                            return;
                        }
                        setTimeout(poll, 150);
                    };
                    poll();
                } catch (err) {
                    sdkInitPromise = null;
                    reject(err);
                }
            };

            script.onerror = () => {
                clearTimeout(loadTimeout);
                script.remove();
                URL.revokeObjectURL(blobUrl);
                sdkInitPromise = null;
                reject(new Error('Failed to execute MSG91 OTP script from blob URL.'));
            };

            try {
                document.head.appendChild(script);
            } catch {
                document.body.appendChild(script);
            }
        } catch (fetchErr: any) {
            // ── Fallback: direct <script> tag injection (bypasses CORS) ──
            console.warn(`[MSG91] Blob approach failed: ${fetchErr.message}. Trying direct script tag...`);
            try {
                await new Promise<void>((res, rej) => {
                    const fallbackScript = document.createElement('script');
                    fallbackScript.type = 'text/javascript';
                    fallbackScript.async = true;
                    fallbackScript.setAttribute('data-msg91', 'true');
                    fallbackScript.src = `${REMOTE_SCRIPT_URL}?cb=${Date.now()}`;

                    const fallbackTimeout = setTimeout(() => {
                        fallbackScript.remove();
                        rej(new Error('Direct script tag timed out (15s)'));
                    }, 15000);

                    fallbackScript.onload = () => {
                        clearTimeout(fallbackTimeout);
                        console.info('[MSG91] Script loaded via direct script tag fallback');
                        res();
                    };
                    fallbackScript.onerror = () => {
                        clearTimeout(fallbackTimeout);
                        fallbackScript.remove();
                        rej(new Error('Direct script tag also failed'));
                    };
                    document.head.appendChild(fallbackScript);
                });

                // Script loaded via fallback — now init
                if (typeof (window as any).initSendOTP !== 'function') {
                    sdkInitPromise = null;
                    reject(new Error('initSendOTP not found after fallback script load'));
                    return;
                }
                (window as any).initSendOTP(configuration);
                console.info('[MSG91] initSendOTP called (fallback path)');

                const start = Date.now();
                const poll = () => {
                    if (typeof (window as any).sendOtp === 'function') {
                        sdkReady = true;
                        console.info('[MSG91] SDK ready (fallback path)');
                        resolve();
                        return;
                    }
                    if (Date.now() - start >= 10000) {
                        sdkInitPromise = null;
                        reject(new Error('MSG91 SDK timed out waiting for sendOtp method (fallback)'));
                        return;
                    }
                    setTimeout(poll, 150);
                };
                poll();
            } catch (fallbackErr: any) {
                sdkInitPromise = null;
                reject(new Error(`Failed to load MSG91 OTP script. ${fetchErr.message}. Fallback: ${fallbackErr.message}`));
            }
        }
    });

    return sdkInitPromise;
}

/**
 * Load & initialise the MSG91 SDK with the given phone identifier.
 * Identifier format: 91XXXXXXXXXX (country code without +)
 * @param autoSend If true (default), initSendOTP will trigger an SMS immediately.
 */
export async function loadAndInitMsg91(identifier: string, autoSend = true): Promise<void> {
    await loadAndInit(identifier, autoSend);
}
/**
 * Send OTP to the given identifier.
 * Must call loadAndInitMsg91() first.
 */
export async function sendOtp(identifier: string): Promise<any> {
    if (!sdkReady) {
        console.info('[MSG91] Initializing SDK (this sends the first OTP via initSendOTP)...');
        await loadAndInitMsg91(identifier);
        return { message: 'OTP sent via initialization' };
    }

    return new Promise((resolve, reject) => {
        if (typeof (window as any).sendOtp !== 'function') {
            return reject(new Error('MSG91 SDK not ready after initialization.'));
        }
        (window as any).sendOtp(
            identifier,
            (data: any) => {
                console.info('[MSG91] OTP sent', data);
                resolve(data);
            },
            (error: any) => {
                const msg = typeof error === 'string' ? error : error?.message || error?.error || 'Failed to send OTP';
                reject(new Error(msg));
            },
        );
    });
}

/**
 * Verify the OTP entered by the user.
 * Returns response data including the access token on success.
 */
export async function verifyOtp(otpValue: string): Promise<{ message: string; type: string }> {
    if (!sdkReady) {
        return Promise.reject(new Error('MSG91 SDK not ready. Please wait for OTP to be sent first.'));
    }

    return new Promise((resolve, reject) => {
        if (typeof (window as any).verifyOtp !== 'function') {
            return reject(new Error('MSG91 SDK verify method not found.'));
        }
        (window as any).verifyOtp(
            otpValue,
            (data: any) => {
                console.info('[MSG91] OTP verified', data);
                resolve(data);
            },
            (error: any) => {
                const msg = typeof error === 'string' ? error : error?.message || error?.error || 'OTP verification failed';
                reject(new Error(msg));
            },
        );
    });
}

/**
 * Resend OTP via default channel.
 */
export function resendOtp(): Promise<any> {
    return new Promise((resolve, reject) => {
        if (typeof (window as any).retryOtp !== 'function') {
            return reject(new Error('MSG91 SDK not ready. Call loadAndInitMsg91 first.'));
        }
        (window as any).retryOtp(
            1, // 1 = SMS channel
            (data: any) => {
                console.info('[MSG91] OTP resent', data);
                resolve(data);
            },
            (error: any) => {
                const msg = typeof error === 'string' ? error : error?.message || error?.error || 'Failed to resend OTP';
                reject(new Error(msg));
            },
        );
    });
}
