
import { useState, useRef, useCallback, useEffect } from 'react';
import Peer from 'simple-peer';
import { createClient } from '@/lib/supabase/client';
import { generateShareCode, obfuscateCode, reverseObfuscateCode } from '@/lib/code';
import { useToast } from '@/hooks/use-toast';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type ConnectionMode = 'none' | 'create' | 'join';

export interface UseBidirectionalConnectionProps {
    onConnectionEstablished: (peer: Peer.Instance, connectionCode: string, isInitiator: boolean) => void;
    onConnectionLost: () => void;
}

export function useBidirectionalConnection({
    onConnectionEstablished,
    onConnectionLost
}: UseBidirectionalConnectionProps) {
    const [mode, setMode] = useState<ConnectionMode>('none');
    const [connectionCode, setConnectionCode] = useState('');
    const [inputCode, setInputCode] = useState('');
    const [isConnecting, setIsConnecting] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [remotePeerStatus, setRemotePeerStatus] = useState<'online' | 'offline' | 'left'>('offline');

    const peerRef = useRef<Peer.Instance | null>(null);
    const channelRef = useRef<RealtimeChannel | null>(null);
    const shareIdRef = useRef<string | null>(null);
    const { toast } = useToast();

    const connectionSuccessfulRef = useRef(false);

    // cleanup on unmount
    useEffect(() => {
        return () => {
            if (peerRef.current && !connectionSuccessfulRef.current) {
                console.log('Cleaning up peer (unsuccessful connection)');
                peerRef.current.destroy();
            }
            if (channelRef.current) {
                channelRef.current.unsubscribe();
            }
        };
    }, []);

    // Session Persistence Helpers
    const saveSession = (mode: ConnectionMode, code: string, id?: string) => {
        if (typeof window === 'undefined') return;
        sessionStorage.setItem('ft_session', JSON.stringify({ mode, code, id }));
    };

    const clearSession = () => {
        if (typeof window === 'undefined') return;
        sessionStorage.removeItem('ft_session');
    };

    // Load session on mount
    useEffect(() => {
        const stored = sessionStorage.getItem('ft_session');
        if (stored) {
            try {
                const session = JSON.parse(stored);
                if (session.mode === 'create') {
                    setConnectionCode(session.code);
                    if (session.id) shareIdRef.current = session.id;
                    setMode('create');
                    // Automatically resume hosting
                    createConnection(true);
                } else if (session.mode === 'join') {
                    setInputCode(session.code);
                    // For joiners, just pre-fill code
                }
            } catch (e) {
                console.error('Failed to parse session', e);
            }
        }
    }, []);

    const createConnection = useCallback(async (isResume = false) => {
        setIsConnecting(true);
        setError(null);

        try {
            const supabase = createClient();
            const newPeer = new Peer({ initiator: true, trickle: false });
            peerRef.current = newPeer;

            const shortCode = isResume && connectionCode ? connectionCode : generateShareCode();
            const obfuscatedCode = isResume ? connectionCode : obfuscateCode(shortCode);

            newPeer.on('signal', async (offer) => {
                if (offer.type !== 'offer') return;

                if (isResume && shareIdRef.current) {
                    // RESUME
                    const response = await fetch('/api/signaling/offer', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            id: shareIdRef.current,
                            p2p_offer: offer
                        })
                    });

                    if (!response.ok) throw new Error('Failed to update session offer');

                    const channel = supabase.channel(`share-session-${shareIdRef.current}`);
                    channelRef.current = channel;
                    channel.on('broadcast', { event: 'answer' }, ({ payload }) => {
                        if (peerRef.current && !peerRef.current.destroyed && payload.answer) {
                            peerRef.current.signal(payload.answer);
                        }
                    }).subscribe();

                } else {
                    // NEW
                    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
                    const { data, error: dbError } = await supabase
                        .from('fileshare')
                        .insert([{
                            short_code: shortCode,
                            p2p_offer: JSON.stringify(offer),
                            transfer_mode: 'bidirectional',
                            expires_at: expiresAt
                        }])
                        .select('id')
                        .single();

                    if (dbError || !data) throw new Error('Failed to create connection session');

                    shareIdRef.current = data.id;
                    setConnectionCode(obfuscatedCode);
                    setMode('create');
                    saveSession('create', obfuscatedCode, data.id);

                    const channel = supabase.channel(`share-session-${data.id}`);
                    channelRef.current = channel;
                    channel.on('broadcast', { event: 'answer' }, ({ payload }) => {
                        if (peerRef.current && !peerRef.current.destroyed && payload.answer) {
                            peerRef.current.signal(payload.answer);
                        }
                    }).subscribe();
                }
            });

            newPeer.on('connect', () => {
                setIsConnected(true);
                setIsConnecting(false);
                setRemotePeerStatus('online');
                toast({ title: 'Connected!', description: 'Peer-to-peer connection established' });
                connectionSuccessfulRef.current = true;
                onConnectionEstablished(newPeer, isResume ? connectionCode : obfuscatedCode, true);
            });

            newPeer.on('error', (err) => {
                console.error('Peer error:', err);
                toast({ title: 'Connection Issue', description: 'Retrying connection...', variant: 'destructive' });
            });

            newPeer.on('close', () => {
                setIsConnected(false);
                connectionSuccessfulRef.current = false;
                toast({ title: 'Peer Disconnected', description: 'Waiting for reconnection...' });
                if (peerRef.current) peerRef.current.destroy();
                createConnection(true);
            });

        } catch (err: any) {
            setError(err.message || 'Failed to create connection');
            setIsConnecting(false);
        }
    }, [connectionCode, onConnectionEstablished, toast]);

    const joinConnection = useCallback(async () => {
        if (!inputCode || inputCode.length !== 5) {
            setError('Please enter a valid 5-character code');
            return;
        }

        setIsConnecting(true);
        setError(null);

        try {
            const supabase = createClient();
            const shortCode = reverseObfuscateCode(inputCode);

            const { data, error: fetchError } = await supabase
                .from('fileshare')
                .select('id, p2p_offer')
                .eq('short_code', shortCode)
                .eq('transfer_mode', 'bidirectional')
                .single();

            if (fetchError || !data) {
                throw new Error('Connection code not found or expired');
            }

            shareIdRef.current = data.id;
            const offer = JSON.parse(data.p2p_offer);

            const newPeer = new Peer({ initiator: false, trickle: false });
            peerRef.current = newPeer;

            newPeer.on('signal', (answer) => {
                if (answer.type !== 'answer') return;

                const channel = supabase.channel(`share-session-${data.id}`);
                channelRef.current = channel;

                channel.subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                        channel.send({
                            type: 'broadcast',
                            event: 'answer',
                            payload: { answer },
                        });
                    }
                });
            });

            newPeer.on('connect', () => {
                setIsConnected(true);
                setIsConnecting(false);
                setRemotePeerStatus('online');
                setConnectionCode(inputCode);
                setMode('join');
                saveSession('join', inputCode, data.id);
                toast({ title: 'Connected!', description: 'Peer-to-peer connection established' });
                connectionSuccessfulRef.current = true;
                onConnectionEstablished(newPeer, inputCode, false);
            });

            newPeer.on('error', (err) => {
                console.error('Peer error:', err);
                toast({ title: 'Error', description: 'Connection failed. Try refreshing.', variant: 'destructive' });
                setIsConnecting(false);
            });

            newPeer.on('close', () => {
                setIsConnected(false);
                toast({ title: 'Disconnected', description: 'Host connection lost', variant: 'destructive' });
                onConnectionLost();
            });

            newPeer.signal(offer);

        } catch (err: any) {
            setError(err.message || 'Failed to join connection');
            setIsConnecting(false);
        }
    }, [inputCode, onConnectionEstablished, onConnectionLost, toast]);

    const handleDisconnect = () => {
        clearSession();
        if (peerRef.current) peerRef.current.destroy();
        if (channelRef.current) channelRef.current.unsubscribe();

        setMode('none');
        setConnectionCode('');
        setInputCode('');
        setIsConnected(false);
        setIsConnecting(false);
        setError(null);
        onConnectionLost();
    };

    const handleRotateSession = () => {
        if (peerRef.current && peerRef.current.connected) {
            try {
                peerRef.current.send(JSON.stringify({ type: 'system', action: 'session_ended' }));
            } catch (e) { /* ignore */ }
        }

        clearSession();
        if (peerRef.current) peerRef.current.destroy();
        if (channelRef.current) channelRef.current.unsubscribe();

        setConnectionCode('');
        setMode('create');
        setIsConnected(false);
        onConnectionLost();
        createConnection(false);
    };

    return {
        mode,
        setMode,
        connectionCode,
        inputCode,
        setInputCode,
        isConnecting,
        isConnected,
        error,
        remotePeerStatus,
        createConnection,
        joinConnection,
        handleDisconnect,
        handleRotateSession
    };
}
