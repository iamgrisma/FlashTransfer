import { useState, useEffect, useCallback } from 'react';
import type { FileDetails } from '@/lib/types';

export type MessageType = 'text' | 'file';
export type MessageSender = 'me' | 'peer';

export interface ChatMessage {
    id: string;
    sender: MessageSender;
    type: MessageType;
    content: string | FileDetails;
    timestamp: number;
    fileStatus?: 'sending' | 'sent' | 'receiving' | 'received' | 'downloaded' | 'error';
    progress?: number;
    fileData?: {
        name: string;
        size: number;
        mimeType: string;
        blobUrl?: string;
    };
}

export interface ChatSession {
    peerId: string; // The connection code or unique ID
    lastActive: number;
    messages: ChatMessage[];
}

const STORAGE_KEY = 'ft_chat_history';

export function useChatHistory(currentPeerId?: string) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);

    // Load history for current peer
    useEffect(() => {
        if (!currentPeerId) {
            setMessages([]); // Or load "offline queue" if we want
            return;
        }

        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                const history: Record<string, ChatSession> = JSON.parse(stored);
                if (history[currentPeerId]) {
                    setMessages(history[currentPeerId].messages);
                } else {
                    setMessages([]);
                }
            } catch (e) {
                console.error('Failed to load chat history', e);
            }
        }
    }, [currentPeerId]);

    // Save message
    const addMessage = useCallback((msg: ChatMessage) => {
        setMessages(prev => {
            const newMessages = [...prev, msg];

            // Persist if we have a peer ID
            if (currentPeerId) {
                try {
                    const stored = localStorage.getItem(STORAGE_KEY);
                    const history: Record<string, ChatSession> = stored ? JSON.parse(stored) : {};

                    history[currentPeerId] = {
                        peerId: currentPeerId,
                        lastActive: Date.now(),
                        messages: newMessages.map(m => ({
                            ...m,
                            // Don't store blobUrls or binary chunks in localStorage
                            fileData: m.fileData ? { ...m.fileData, blobUrl: undefined } : undefined,
                            fileStatus: m.fileStatus === 'sending' ? 'error' : m.fileStatus // reset stuck statuses
                        }))
                    };

                    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
                } catch (e) {
                    console.error('Failed to save chat message', e);
                }
            }

            return newMessages;
        });
    }, [currentPeerId]);

    // Update status of an existing message (e.g. progress)
    const updateMessage = useCallback((msgId: string, updates: Partial<ChatMessage>) => {
        setMessages(prev => {
            const newMessages = prev.map(m => m.id === msgId ? { ...m, ...updates } : m);
            // Verify persistence for status updates? Maybe too frequent. 
            // We'll trust the "addMessage" loop or on-unmount save? 
            // Ideally we save on major state changes or debounce.
            // For now, let's not spam localStorage on every progress tick.
            return newMessages;
        });
    }, []);

    // Force save current state (e.g. on unmount or completion)
    const saveCurrentSession = useCallback(() => {
        if (!currentPeerId || messages.length === 0) return;

        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            const history: Record<string, ChatSession> = stored ? JSON.parse(stored) : {};

            history[currentPeerId] = {
                peerId: currentPeerId,
                lastActive: Date.now(),
                messages: messages.map(m => ({
                    ...m,
                    fileData: m.fileData ? { ...m.fileData, blobUrl: undefined } : undefined
                }))
            };

            localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
        } catch (e) { console.error(e); }
    }, [currentPeerId, messages]);

    return {
        messages,
        addMessage,
        updateMessage,
        saveCurrentSession,
        setMessages // Allow bulk override if needed
    };
}
