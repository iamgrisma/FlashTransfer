/**
 * Client-side auth token provider
 * Token is generated server-side on page load and injected into HTML
 */

let cachedToken: { token: string; timestamp: number; expiresAt: number } | null = null;

/**
 * Get auth token for API requests
 * Token is embedded in page by server during SSR
 */
export async function getAuthToken(): Promise<{ token: string; timestamp: number } | null> {
    // Check if we have a valid cached token
    if (cachedToken && Date.now() < cachedToken.expiresAt) {
        return { token: cachedToken.token, timestamp: cachedToken.timestamp };
    }

    // Try to get token from meta tag (injected by server)
    if (typeof window !== 'undefined') {
        const tokenMeta = document.querySelector('meta[name="auth-token"]');
        const timestampMeta = document.querySelector('meta[name="auth-timestamp"]');

        if (tokenMeta && timestampMeta) {
            const token = tokenMeta.getAttribute('content') || '';
            const timestamp = parseInt(timestampMeta.getAttribute('content') || '0', 10);

            if (token && timestamp) {
                // Cache for 1.5 minutes (less than 2-minute server window)
                cachedToken = {
                    token,
                    timestamp,
                    expiresAt: Date.now() + 90 * 1000, // 1.5 minutes
                };

                return { token, timestamp };
            }
        }
    }

    // Fallback: fetch new token from server
    try {
        const response = await fetch('/api/auth/token');
        if (!response.ok) {
            console.error('Failed to get auth token');
            return null;
        }

        const data = await response.json();
        cachedToken = {
            token: data.token,
            timestamp: data.timestamp,
            expiresAt: Date.now() + 90 * 1000,
        };

        return { token: data.token, timestamp: data.timestamp };
    } catch (error) {
        console.error('Error fetching auth token:', error);
        return null;
    }
}
