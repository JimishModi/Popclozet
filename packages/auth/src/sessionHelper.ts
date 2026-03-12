/**
 * Secure Session Helper
 * 
 * Best practices for token storage and session management.
 * - Access tokens: kept in memory (not localStorage)
 * - Session metadata: stored with expiry checks
 * - Automatic cleanup on logout
 */

interface SessionData {
    userId: string;
    role: string;
    expiresAt: number;
    deviceId: string;
}

const SESSION_KEY = 'popclozet_session_meta';
const DEVICE_ID_KEY = 'popclozet_device_id';

/**
 * Generate a unique device fingerprint for this browser.
 * Used for "new device" detection and MFA triggers.
 */
export function getDeviceId(): string {
    let deviceId = localStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId) {
        deviceId = crypto.randomUUID();
        localStorage.setItem(DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
}

/**
 * Store session metadata (NOT the tokens themselves).
 * Tokens should remain in Supabase client memory.
 */
export function setSessionMeta(data: Omit<SessionData, 'deviceId'>): void {
    const session: SessionData = {
        ...data,
        deviceId: getDeviceId(),
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

/**
 * Get current session metadata.
 * Returns null if session is expired or missing.
 */
export function getSessionMeta(): SessionData | null {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;

    try {
        const data: SessionData = JSON.parse(raw);
        if (data.expiresAt < Date.now()) {
            clearSession();
            return null;
        }
        return data;
    } catch {
        clearSession();
        return null;
    }
}

/**
 * Clear all session data.
 * Call on logout or token expiry.
 */
export function clearSession(): void {
    sessionStorage.removeItem(SESSION_KEY);
    // Don't remove DEVICE_ID_KEY — it persists across sessions
}

/**
 * Check if the current session is from a new/unknown device.
 * Triggers MFA requirement if true.
 */
export function isNewDevice(): boolean {
    const knownDevices = localStorage.getItem('popclozet_known_devices');
    const currentDevice = getDeviceId();

    if (!knownDevices) return true;

    try {
        const devices: string[] = JSON.parse(knownDevices);
        return !devices.includes(currentDevice);
    } catch {
        return true;
    }
}

/**
 * Register current device as "known" after successful MFA.
 * Stores up to 5 known devices.
 */
export function registerKnownDevice(): void {
    const currentDevice = getDeviceId();
    const raw = localStorage.getItem('popclozet_known_devices');
    let devices: string[] = [];

    try {
        devices = raw ? JSON.parse(raw) : [];
    } catch {
        devices = [];
    }

    if (!devices.includes(currentDevice)) {
        devices.push(currentDevice);
        // Keep only last 5 devices
        if (devices.length > 5) devices.shift();
    }

    localStorage.setItem('popclozet_known_devices', JSON.stringify(devices));
}
