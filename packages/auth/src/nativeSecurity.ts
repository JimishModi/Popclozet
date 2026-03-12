/**
 * Native Security Helpers
 * 
 * Security features that work in both PWA and native (Capacitor) modes:
 * - Screenshot/screen recording prevention (native only)
 * - Biometric authentication (native only)
 * - Root/Jailbreak detection (native only)
 * - Secure clipboard (PWA + native)
 * 
 * These gracefully degrade to no-ops in PWA/browser mode.
 */

// ─── Feature Detection ───────────────────────────────────────

export function isNativeApp(): boolean {
    return !!(window as any).Capacitor;
}

export function isPWA(): boolean {
    return window.matchMedia('(display-mode: standalone)').matches;
}

// ─── Screenshot Prevention (Native) ─────────────────────────

/**
 * Prevent screenshots on sensitive screens (OTP, payments).
 * Only works in native Capacitor apps (Android FLAG_SECURE, iOS screenshots).
 * In PWA mode, applies CSS overlay as a visual deterrent.
 */
export function enableScreenProtection(): void {
    if (isNativeApp()) {
        // Capacitor native call (requires capacitor-screen-protection plugin)
        try {
            const { ScreenProtection } = (window as any).Capacitor?.Plugins || {};
            if (ScreenProtection?.enable) {
                (ScreenProtection.enable as () => void)();
            }
        } catch {
            // Plugin not installed — fallback silently
        }
    }

    // CSS-based deterrent (works in browser too)
    document.body.classList.add('screen-protected');
}

export function disableScreenProtection(): void {
    if (isNativeApp()) {
        try {
            const { ScreenProtection } = (window as any).Capacitor?.Plugins || {};
            if (ScreenProtection?.disable) {
                (ScreenProtection.disable as () => void)();
            }
        } catch {
            // noop
        }
    }

    document.body.classList.remove('screen-protected');
}

// ─── Biometric Authentication (Native) ──────────────────────

export interface BiometricResult {
    success: boolean;
    type?: 'fingerprint' | 'face' | 'iris';
    error?: string;
}

/**
 * Check if biometric auth is available on the device.
 */
export async function isBiometricAvailable(): Promise<boolean> {
    if (!isNativeApp()) return false;

    try {
        const { NativeBiometric } = (window as any).Capacitor?.Plugins || {};
        if (NativeBiometric?.isAvailable) {
            const result = await (NativeBiometric.isAvailable as () => Promise<{ isAvailable: boolean }>)();
            return result.isAvailable;
        }
    } catch {
        // noop
    }
    return false;
}

/**
 * Prompt for biometric authentication.
 * Use before sensitive actions (viewing PII, confirming payments).
 */
export async function authenticateWithBiometric(
    reason = 'Verify your identity'
): Promise<BiometricResult> {
    if (!isNativeApp()) {
        return { success: false, error: 'Biometric auth requires the native app' };
    }

    try {
        const { NativeBiometric } = (window as any).Capacitor?.Plugins || {};
        if (NativeBiometric?.verifyIdentity) {
            await (NativeBiometric.verifyIdentity as (opts: { reason: string }) => Promise<void>)({
                reason,
            });
            return { success: true };
        }
    } catch (error) {
        return { success: false, error: String(error) };
    }

    return { success: false, error: 'Biometric plugin not available' };
}

// ─── Root/Jailbreak Detection (Native) ──────────────────────

/**
 * Check if the device is rooted (Android) or jailbroken (iOS).
 * Rooted devices break the OS security sandbox.
 */
export async function isDeviceCompromised(): Promise<boolean> {
    if (!isNativeApp()) return false;

    try {
        const { RootDetection } = (window as any).Capacitor?.Plugins || {};
        if (RootDetection?.isRooted) {
            const result = await (RootDetection.isRooted as () => Promise<{ isRooted: boolean }>)();
            return result.isRooted;
        }
    } catch {
        // If detection fails, assume safe
    }
    return false;
}

// ─── Secure Clipboard (PWA + Native) ────────────────────────

/**
 * Copy text to clipboard and auto-clear after a timeout.
 * Prevents OTPs and sensitive data from lingering in clipboard.
 */
export async function secureCopy(
    text: string,
    clearAfterMs = 30000 // Auto-clear after 30 seconds
): Promise<void> {
    try {
        await navigator.clipboard.writeText(text);

        // Auto-clear clipboard
        setTimeout(async () => {
            try {
                await navigator.clipboard.writeText('');
            } catch {
                // Clipboard access may be denied if tab isn't focused
            }
        }, clearAfterMs);
    } catch {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
    }
}

// ─── Screen Protection CSS ──────────────────────────────────
// Inject this CSS once at app startup

export function injectScreenProtectionCSS(): void {
    if (document.getElementById('screen-protection-css')) return;

    const style = document.createElement('style');
    style.id = 'screen-protection-css';
    style.textContent = `
    .screen-protected {
      -webkit-user-select: none;
      user-select: none;
    }
    @media print {
      .screen-protected * {
        display: none !important;
      }
      .screen-protected::after {
        content: "Printing is disabled for security reasons.";
        display: block;
        font-size: 24px;
        text-align: center;
        padding: 100px;
      }
    }
  `;
    document.head.appendChild(style);
}
