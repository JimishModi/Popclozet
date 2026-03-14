/**
 * Captcha verification utility
 * 
 * Uses hCaptcha for bot detection on signup/login forms.
 * Configure VITE_HCAPTCHA_SITE_KEY in your .env file.
 * 
 * Usage:
 *   import { CaptchaWidget, verifyCaptcha } from '@/utils/captcha';
 *   
 *   <CaptchaWidget onVerify={(token) => setCaptchaToken(token)} />
 */

const HCAPTCHA_VERIFY_URL = 'https://hcaptcha.com/siteverify';

/**
 * Get the hCaptcha site key from environment.
 * Falls back to test key in development.
 */
export function getCaptchaSiteKey(): string {
    return (
        (import.meta as any).env?.VITE_HCAPTCHA_SITE_KEY ||
        '10000000-ffff-ffff-ffff-000000000001' // hCaptcha test key
    );
}

/**
 * Load hCaptcha script dynamically.
 * Returns a promise that resolves when the script is loaded.
 */
export function loadCaptchaScript(): Promise<void> {
    return new Promise((resolve, reject) => {
        if (document.getElementById('hcaptcha-script')) {
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.id = 'hcaptcha-script';
        script.src = 'https://js.hcaptcha.com/1/api.js';
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load hCaptcha'));
        document.head.appendChild(script);
    });
}

/**
 * Server-side verification of captcha token.
 * Call this from your Edge Function or API route.
 */
export async function verifyCaptchaServer(
    token: string,
    secretKey: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const response = await fetch(HCAPTCHA_VERIFY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                response: token,
                secret: secretKey,
            }),
        });

        const data = await response.json();
        return { success: data.success };
    } catch (error) {
        return { success: false, error: 'Captcha verification failed' };
    }
}

/**
 * Client-side: Check if captcha is required.
 * Returns true if we should show captcha (production only).
 */
export function isCaptchaRequired(): boolean {
    const isProd = (import.meta as any).env?.PROD === 'true';
    const hasSiteKey = !!(import.meta as any).env?.VITE_HCAPTCHA_SITE_KEY;
    return isProd && hasSiteKey;
}
