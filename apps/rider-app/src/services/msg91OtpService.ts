/**
 * MSG91 OTP Service (shared logic — identical to customer-app)
 * Handles all interactions with MSG91's browser-side OTP SDK.
 */

/** URLs to try, in order of preference */
const FETCH_URLS = [
    '/msg91-otp-sdk.js',                            // Local static file (most reliable)
    'https://verify.msg91.com/otp-provider.js',     // Direct CDN (fallback)
];

const WIDGET_ID = import.meta.env.VITE_MSG91_WIDGET_ID as string;
const TOKEN_AUTH = import.meta.env.VITE_MSG91_TOKEN_AUTH as string;

let sdkReady = false;
let sdkInitPromise: Promise<void> | null = null;

async function fetchScriptText(): Promise<string> {
    let lastError: Error | null = null;
    for (const url of FETCH_URLS) {
        try {
            console.info(`[MSG91] Fetching script from ${url}...`);
            const res = await fetch(`${url}?cb=${Date.now()}`, { cache: 'no-store' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const text = await res.text();
            if (!text || text.trim().startsWith('<!') || text.trim().startsWith('<html')) {
                throw new Error('Response is HTML, not JavaScript');
            }
            return text;
        } catch (err: any) {
            console.warn(`[MSG91] Failed to fetch from ${url}:`, err.message);
            lastError = err;
        }
    }
    throw lastError || new Error('All MSG91 script fetch attempts failed');
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
            const scriptText = await fetchScriptText();
            const blob = new Blob([scriptText], { type: 'application/javascript' });
            const blobUrl = URL.createObjectURL(blob);

            const script = document.createElement('script');
            script.type = 'text/javascript';
            script.src = blobUrl;
            script.async = true;

            script.onload = () => {
                URL.revokeObjectURL(blobUrl);
                try {
                    if (typeof (window as any).initSendOTP !== 'function') {
                        sdkInitPromise = null;
                        reject(new Error('initSendOTP not found after script load'));
                        return;
                    }
                    (window as any).initSendOTP(configuration);

                    const start = Date.now();
                    const poll = () => {
                        if (typeof (window as any).sendOtp === 'function') {
                            sdkReady = true;
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
                } catch (err) {
                    sdkInitPromise = null;
                    reject(err);
                }
            };

            script.onerror = () => {
                URL.revokeObjectURL(blobUrl);
                sdkInitPromise = null;
                reject(new Error('Failed to load MSG91 OTP script'));
            };

            document.head.appendChild(script);
        } catch (err: any) {
            sdkInitPromise = null;
            reject(new Error(`Failed to load MSG91 OTP script: ${err.message}`));
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
