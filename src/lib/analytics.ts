/**
 * Analytics utilities for FlashTransfer
 * Handles session tracking (localStorage) and aggregate stats (database)
 */

// ============================================================================
// TYPES
// ============================================================================

export interface SessionStats {
    sessionId: string;
    startedAt: number;
    filesSent: number;
    filesReceived: number;
    bytesSent: number;
    bytesReceived: number;
    transferMode: 'p2p' | 'broadcast' | 'bidirectional';
    fileTypes: Record<string, number>; // { "pdf": 2, "image": 5 }
    peerInfo?: {
        browser?: string;
        os?: string;
    };
}

export interface AggregateStats {
    totalFilesTransferred: number;
    totalBytesTransferred: number;
    fileTypes: Record<string, number>;
    transferModes: Record<string, number>;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const SESSION_STORAGE_KEY = 'flashtransfer_session';
const STATS_CACHE_KEY = 'flashtransfer_aggregate_stats';
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

// ============================================================================
// SESSION MANAGEMENT (LocalStorage)
// ============================================================================

/**
 * Initialize a new transfer session
 */
export function initSession(transferMode: SessionStats['transferMode']): SessionStats {
    const session: SessionStats = {
        sessionId: generateSessionId(),
        startedAt: Date.now(),
        filesSent: 0,
        filesReceived: 0,
        bytesSent: 0,
        bytesReceived: 0,
        transferMode,
        fileTypes: {},
        peerInfo: detectPeerInfo(),
    };

    saveSession(session);
    return session;
}

/**
 * Get current session from localStorage
 */
export function getSession(): SessionStats | null {
    if (typeof window === 'undefined') return null;

    try {
        const stored = localStorage.getItem(SESSION_STORAGE_KEY);
        return stored ? JSON.parse(stored) : null;
    } catch (error) {
        console.error('Failed to get session:', error);
        return null;
    }
}

/**
 * Save session to localStorage
 */
export function saveSession(session: SessionStats): void {
    if (typeof window === 'undefined') return;

    try {
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } catch (error) {
        console.error('Failed to save session:', error);
    }
}

/**
 * Update session statistics
 */
export function updateSession(updates: Partial<SessionStats>): SessionStats | null {
    const session = getSession();
    if (!session) return null;

    const updated = { ...session, ...updates };
    saveSession(updated);
    return updated;
}

/**
 * Track file transfer in session
 */
export function trackFileTransfer(
    fileName: string,
    fileSize: number,
    fileType: string,
    direction: 'sent' | 'received'
): void {
    const session = getSession();
    if (!session) return;

    // Update counts
    if (direction === 'sent') {
        session.filesSent += 1;
        session.bytesSent += fileSize;
    } else {
        session.filesReceived += 1;
        session.bytesReceived += fileSize;
    }

    // Update file types
    const category = categorizeFileType(fileType);
    session.fileTypes[category] = (session.fileTypes[category] || 0) + 1;

    saveSession(session);
}

/**
 * End session and submit to analytics
 */
export async function endSession(): Promise<void> {
    const session = getSession();
    if (!session) return;

    // Submit to aggregate stats
    await submitSessionStats(session);

    // Clear session
    if (typeof window !== 'undefined') {
        localStorage.removeItem(SESSION_STORAGE_KEY);
    }
}

/**
 * Clear session without submitting stats
 */
export function clearSession(): void {
    if (typeof window !== 'undefined') {
        localStorage.removeItem(SESSION_STORAGE_KEY);
    }
}

// ============================================================================
// AGGREGATE STATS (Database)
// ============================================================================

/**
 * Submit session stats to aggregate database
 */
async function submitSessionStats(session: SessionStats): Promise<void> {
    try {
        const totalFiles = session.filesSent + session.filesReceived;
        const totalBytes = session.bytesSent + session.bytesReceived;

        if (totalFiles === 0) return; // Nothing to submit

        const response = await fetch('/api/analytics/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filesTransferred: totalFiles,
                bytesTransferred: totalBytes,
                fileTypes: session.fileTypes,
                transferMode: session.transferMode,
            }),
        });

        if (!response.ok) {
            console.error('Failed to submit stats:', await response.text());
        }
    } catch (error) {
        console.error('Error submitting session stats:', error);
    }
}

/**
 * Fetch aggregate statistics from database (with caching)
 */
export async function getAggregateStats(): Promise<AggregateStats | null> {
    // Check cache first
    const cached = getCachedStats();
    if (cached) return cached;

    try {
        const response = await fetch('/api/analytics/stats');
        if (!response.ok) return null;

        const stats = await response.json();
        cacheStats(stats);
        return stats;
    } catch (error) {
        console.error('Failed to fetch aggregate stats:', error);
        return null;
    }
}

/**
 * Manual stats update (for immediate feedback)
 */
export async function updateAggregateStats(
    filesTransferred: number,
    bytesTransferred: number,
    fileTypes: Record<string, number>,
    transferMode: string
): Promise<void> {
    try {
        await fetch('/api/analytics/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filesTransferred,
                bytesTransferred,
                fileTypes,
                transferMode,
            }),
        });
    } catch (error) {
        console.error('Failed to update aggregate stats:', error);
    }
}

// ============================================================================
// CACHING (SessionStorage for aggregate stats)
// ============================================================================

function getCachedStats(): AggregateStats | null {
    if (typeof window === 'undefined') return null;

    try {
        const cached = sessionStorage.getItem(STATS_CACHE_KEY);
        if (!cached) return null;

        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp > CACHE_DURATION_MS) {
            sessionStorage.removeItem(STATS_CACHE_KEY);
            return null;
        }

        return data;
    } catch (error) {
        return null;
    }
}

function cacheStats(stats: AggregateStats): void {
    if (typeof window === 'undefined') return;

    try {
        sessionStorage.setItem(
            STATS_CACHE_KEY,
            JSON.stringify({ data: stats, timestamp: Date.now() })
        );
    } catch (error) {
        console.error('Failed to cache stats:', error);
    }
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Categorize file type into broad categories
 */
export function categorizeFileType(mimeType: string): string {
    if (!mimeType) return 'other';

    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.startsWith('text/')) return 'document';

    if (mimeType.includes('pdf')) return 'pdf';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'document';
    if (mimeType.includes('sheet') || mimeType.includes('excel')) return 'spreadsheet';
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'presentation';
    if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('7z') || mimeType.includes('tar')) return 'archive';

    return 'other';
}

/**
 * Detect peer browser and OS information
 */
function detectPeerInfo(): { browser?: string; os?: string } {
    if (typeof window === 'undefined' || !navigator.userAgent) return {};

    const ua = navigator.userAgent;
    let browser = 'Unknown';
    let os = 'Unknown';

    // Detect browser
    if (ua.includes('Firefox/')) browser = 'Firefox';
    else if (ua.includes('Edg/')) browser = 'Edge';
    else if (ua.includes('Chrome/')) browser = 'Chrome';
    else if (ua.includes('Safari/') && !ua.includes('Chrome/')) browser = 'Safari';

    // Detect OS
    if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Mac OS')) os = 'macOS';
    else if (ua.includes('Linux')) os = 'Linux';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

    return { browser, os };
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Format number with commas
 */
export function formatNumber(num: number): string {
    return num.toLocaleString();
}
