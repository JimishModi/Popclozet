/**
 * MSG91 OTP Service
 * Handles all interactions with MSG91's browser-side OTP SDK.
 *
 * Loading strategy (100% CORS-proof):
 *   Uses <script> tags exclusively — these are NEVER blocked by CORS.
 *   Tries multiple sources in order until one succeeds.
 */

/**
 * Script URLs to try in order, using <script> tags (not fetch).
 * <script> tags bypass CORS entirely — the browser loads and executes
 * cross-origin scripts without needing Access-Control headers.
 */
const SCRIPT_URLS = [
    '/msg91-otp-sdk.js',                            // Local static file (Vite public/)
    '/otp-provider.js',                              // Vercel proxy rewrite
    'https://verify.msg91.com/otp-provider.js',     // Remote CDN (script tags bypass CORS)
];

// Environment variables - must be set in .env file
const WIDGET_ID = import.meta.env.VITE_MSG91_WIDGET_ID as string;
const TOKEN_AUTH = import.meta.env.VITE_MSG91_TOKEN_AUTH as string;
let sdkReady = false;
let sdkInitPromise: Promise<void> | null = null;

/**
 * Try loading a script from a URL via a <script> tag.
 * Returns a promise that resolves when the script loads or rejects on error.
 */
function tryLoadScript(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
        // Remove previous attempts
        document.querySelectorAll('script[data-msg91-attempt]').forEach(el => el.remove());

        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.async = true;
        script.setAttribute('data-msg91-attempt', 'true');
        script.src = `${url}?cb=${Date.now()}`;

        const timeout = setTimeout(() => {
            script.remove();
            reject(new Error(`Script load timed out from ${url}`));
        }, 15000);

        script.onload = () => {
            clearTimeout(timeout);
            console.info(`[MSG91] Script loaded from ${url}`);
            // Verify the script actually defined initSendOTP
            if (typeof (window as any).initSendOTP === 'function') {
                resolve();
            } else {
                // Script loaded but it's not the right script (e.g. index.html served as JS)
                script.remove();
                reject(new Error(`Script from ${url} loaded but initSendOTP not found (possibly wrong file served)`));
            }
        };

        script.onerror = () => {
            clearTimeout(timeout);
            script.remove();
            reject(new Error(`Script failed to load from ${url}`));
        };

        document.head.appendChild(script);
    });
}

/**
 * Try loading the MSG91 script from each URL until one works.
 */
async function loadMsg91Script(): Promise<void> {
    // If already loaded from a previous attempt
    if (typeof (window as any).initSendOTP === 'function') {
        console.info('[MSG91] initSendOTP already available');
        return;
    }

    let lastError: Error | null = null;
    for (const url of SCRIPT_URLS) {
        try {
            console.info(`[MSG91] Trying to load script from ${url}...`);
            await tryLoadScript(url);
            return; // success
        } catch (err: any) {
            console.warn(`[MSG91] Failed: ${err.message}`);
            lastError = err;
        }
    }
    throw lastError || new Error('All MSG91 script load attempts failed');
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
            // ── Load the MSG91 script via <script> tags (CORS-proof) ──
            await loadMsg91Script();

            // ── Initialize the SDK ──
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
        } catch (err: any) {
            sdkInitPromise = null;
            reject(new Error(`Failed to load MSG91 OTP SDK: ${err.message}`));
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
