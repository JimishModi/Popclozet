/**
 * MSG91 OTP Service (rider-app — identical logic to customer-app)
 * Handles all interactions with MSG91's browser-side OTP SDK.
 *
 * Loading strategy (100% CORS-proof):
 *   Uses <script> tags exclusively — these are NEVER blocked by CORS.
 *   Tries multiple sources in order until one succeeds.
 */

/**
 * Script URLs to try in order, using <script> tags (not fetch).
 * <script> tags bypass CORS entirely.
 */
const SCRIPT_URLS = [
    '/msg91-otp-sdk.js',                            // Local static file (Vite public/)
    '/otp-provider.js',                              // Vercel proxy rewrite
    'https://verify.msg91.com/otp-provider.js',     // Remote CDN (script tags bypass CORS)
];

const WIDGET_ID = (import.meta.env.VITE_MSG91_WIDGET_ID as string) || '366377675852303239353739';
const TOKEN_AUTH = (import.meta.env.VITE_MSG91_TOKEN_AUTH as string) || '502562TzkhrdLp69c0f130P1';

let sdkReady = false;
let sdkInitPromise: Promise<void> | null = null;

/**
 * Try loading a script from a URL via a <script> tag.
 */
function tryLoadScript(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
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
            if (typeof (window as any).initSendOTP === 'function') {
                resolve();
            } else {
                script.remove();
                reject(new Error(`Script from ${url} loaded but initSendOTP not found`));
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
    if (typeof (window as any).initSendOTP === 'function') {
        console.info('[MSG91] initSendOTP already available');
        return;
    }

    let lastError: Error | null = null;
    for (const url of SCRIPT_URLS) {
        try {
            console.info(`[MSG91] Trying to load script from ${url}...`);
            await tryLoadScript(url);
            return;
        } catch (err: any) {
            console.warn(`[MSG91] Failed: ${err.message}`);
            lastError = err;
        }
    }
    throw lastError || new Error('All MSG91 script load attempts failed');
}

function loadAndInit(identifier: string, autoSend = true): Promise<void> {
    if (sdkReady) return Promise.resolve();
    if (sdkInitPromise) return sdkInitPromise;

    sdkInitPromise = new Promise<void>(async (resolve, reject) => {
        if (!WIDGET_ID || !TOKEN_AUTH) {
            reject(new Error('MSG91 Configuration Missing: Please set VITE_MSG91_WIDGET_ID and VITE_MSG91_TOKEN_AUTH in your .env file.'));
            return;
        }

        const configuration: Record<string, any> = {
            widgetId: WIDGET_ID,
            tokenAuth: TOKEN_AUTH,
            identifier,
            exposeMethods: true,
            autoSend,
            success: (data: any) => console.info('[MSG91] init success', data),
            failure: (error: any) => console.error('[MSG91] init failure', error),
        };

        try {
            await loadMsg91Script();

            (window as any).initSendOTP(configuration);
            console.info('[MSG91] initSendOTP called');

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
                    reject(new Error('MSG91 SDK timed out'));
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

export async function loadAndInitMsg91(identifier: string, autoSend = true): Promise<void> {
    await loadAndInit(identifier, autoSend);
}

export async function sendOtp(identifier: string): Promise<any> {
    if (!sdkReady) {
        await loadAndInitMsg91(identifier);
        return { message: 'OTP sent via initialization' };
    }
    return new Promise((resolve, reject) => {
        if (typeof (window as any).sendOtp !== 'function') {
            return reject(new Error('MSG91 SDK not ready.'));
        }
        (window as any).sendOtp(
            identifier,
            (data: any) => resolve(data),
            (error: any) => {
                const msg = typeof error === 'string' ? error : error?.message || error?.error || 'Failed to send OTP';
                reject(new Error(msg));
            },
        );
    });
}

export async function verifyOtp(otpValue: string): Promise<{ message: string; type: string }> {
    if (!sdkReady) {
        return Promise.reject(new Error('MSG91 SDK not ready.'));
    }
    return new Promise((resolve, reject) => {
        if (typeof (window as any).verifyOtp !== 'function') {
            return reject(new Error('MSG91 SDK verify method not found.'));
        }
        (window as any).verifyOtp(
            otpValue,
            (data: any) => resolve(data),
            (error: any) => {
                const msg = typeof error === 'string' ? error : error?.message || error?.error || 'OTP verification failed';
                reject(new Error(msg));
            },
        );
    });
}

export function resendOtp(): Promise<any> {
    return new Promise((resolve, reject) => {
        if (typeof (window as any).retryOtp !== 'function') {
            return reject(new Error('MSG91 SDK not ready.'));
        }
        (window as any).retryOtp(
            1,
            (data: any) => resolve(data),
            (error: any) => {
                const msg = typeof error === 'string' ? error : error?.message || error?.error || 'Failed to resend OTP';
                reject(new Error(msg));
            },
        );
    });
}
