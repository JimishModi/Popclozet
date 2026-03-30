/**
 * MSG91 OTP Service
 * Handles all interactions with MSG91's browser-side OTP SDK.
 * Script: https://verify.msg91.com/otp-provider.js
 */

const MSG91_SCRIPT_URL = 'https://verify.msg91.com/otp-provider.js';

// Environment variables with hardcoded fallbacks for the current environment
const WIDGET_ID = (import.meta.env.VITE_MSG91_WIDGET_ID as string) || '366377675852303239353739';
const TOKEN_AUTH = (import.meta.env.VITE_MSG91_TOKEN_AUTH as string) || '502562TzkhrdLp69c0f130P1';

let sdkReady = false;
let sdkInitPromise: Promise<void> | null = null;

function loadAndInit(identifier: string, autoSend = true): Promise<void> {
    // If already ready, resolve immediately
    if (sdkReady) return Promise.resolve();
    // If already initializing, return the same promise
    if (sdkInitPromise) return sdkInitPromise;

    sdkInitPromise = new Promise<void>((resolve, reject) => {
        if (!WIDGET_ID || !TOKEN_AUTH) {
            reject(new Error('MSG91 Configuration Missing: Please set VITE_MSG91_WIDGET_ID and VITE_MSG91_TOKEN_AUTH in your .env file.'));
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

        // Remove any existing script to avoid duplicates
        const existing = document.querySelector(`script[src="${MSG91_SCRIPT_URL}"]`);
        if (existing) existing.remove();

        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = MSG91_SCRIPT_URL;
        script.async = true;

        script.onload = () => {
            try {
                if (typeof (window as any).initSendOTP !== 'function') {
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
                        reject(new Error('MSG91 SDK timed out'));
                        return;
                    }
                    setTimeout(poll, 150);
                };
                poll();
            } catch (err) {
                reject(err);
            }
        };

        script.onerror = () => {
            sdkInitPromise = null;
            reject(new Error('Failed to load MSG91 OTP script'));
        };

        document.head.appendChild(script);
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
            (data: any) => { console.info('[MSG91] OTP sent', data); resolve(data); },
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
            (data: any) => { console.info('[MSG91] OTP verified', data); resolve(data); },
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
            (data: any) => { console.info('[MSG91] OTP resent', data); resolve(data); },
            (error: any) => {
                const msg = typeof error === 'string' ? error : error?.message || error?.error || 'Failed to resend OTP';
                reject(new Error(msg));
            },
        );
    });
}