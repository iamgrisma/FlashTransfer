/**
 * Device Fingerprinting for Browser-Locked P2P Connections
 * Generates a unique identifier for each browser instance
 * Stored permanently in localStorage
 */

const DEVICE_ID_KEY = 'ft_device_id';

/**
 * Generate a unique device ID using crypto.randomUUID
 */
function generateDeviceId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback for older browsers
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

/**
 * Get or create device ID
 * Returns the stored device ID or creates a new one if it doesn't exist
 */
export function getDeviceId(): string {
    if (typeof window === 'undefined') return '';

    let deviceId = localStorage.getItem(DEVICE_ID_KEY);

    if (!deviceId) {
        deviceId = generateDeviceId();
        localStorage.setItem(DEVICE_ID_KEY, deviceId);
    }

    return deviceId;
}

/**
 * Clear device ID (for testing purposes only)
 */
export function clearDeviceId(): void {
    if (typeof window !== 'undefined') {
        localStorage.removeItem(DEVICE_ID_KEY);
    }
}
