
import { useState, useEffect, useCallback } from 'react';

export interface StoredConnection {
    id: string; // Unique ID for the peer
    name: string; // Display name (e.g., "Device_17123456")
    code: string; // The connection code used
    lastActive: number; // Timestamp
    peerLabel?: string; // Optional user-assigned label
}

const STORAGE_KEY = 'flash_transfer_history';
const EXPIRY_DAYS = 15;
const EXPIRY_MS = EXPIRY_DAYS * 24 * 60 * 60 * 1000;

export function useConnectionHistory() {
    const [history, setHistory] = useState<StoredConnection[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);

    // Load history on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed: StoredConnection[] = JSON.parse(stored);
                const now = Date.now();
                // Filter out expired connections
                const active = parsed.filter(c => (now - c.lastActive) < EXPIRY_MS);

                // Update storage if we cleaned up items
                if (active.length !== parsed.length) {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(active));
                }

                setHistory(active.sort((a, b) => b.lastActive - a.lastActive));
            }
        } catch (e) {
            console.error('Failed to load connection history', e);
        } finally {
            setIsLoaded(true);
        }
    }, []);

    const saveConnection = useCallback((connection: Omit<StoredConnection, 'lastActive'>) => {
        setHistory(prev => {
            const now = Date.now();
            // Remove existing entry if it exists (to update timestamp/details)
            const others = prev.filter(c => c.code !== connection.code);

            const newEntry: StoredConnection = {
                ...connection,
                lastActive: now,
            };

            const updated = [newEntry, ...others].slice(0, 10); // Keep max 10 recent

            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
            } catch (e) {
                console.error('Failed to save connection', e);
            }

            return updated;
        });
    }, []);

    const clearHistory = useCallback(() => {
        localStorage.removeItem(STORAGE_KEY);
        setHistory([]);
    }, []);

    const removeConnection = useCallback((code: string) => {
        setHistory(prev => {
            const updated = prev.filter(c => c.code !== code);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
            return updated;
        });
    }, []);

    return {
        history,
        saveConnection,
        clearHistory,
        removeConnection,
        isLoaded
    };
}
