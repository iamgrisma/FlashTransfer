"use client";

import { useState, useRef, useCallback, useEffect } from 'react';
import Peer from 'simple-peer';
import { createClient } from '@/lib/supabase/client';
import { generateShareCode, obfuscateCode, reverseObfuscateCode } from '@/lib/code';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader, Wifi, WifiOff, Copy, Check, Link2 } from 'lucide-react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import QRCode from 'qrcode.react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface BidirectionalConnectionProps {
    onConnectionEstablished: (peer: Peer.Instance, connectionCode: string, isInitiator: boolean) => void;
    onConnectionLost: () => void;
}

type ConnectionMode = 'none' | 'create' | 'join';

export default function BidirectionalConnection({
    onConnectionEstablished,
    onConnectionLost
}: BidirectionalConnectionProps) {
    const [mode, setMode] = useState<ConnectionMode>('none');
    const [connectionCode, setConnectionCode] = useState('');
    const [inputCode, setInputCode] = useState('');
    const [isConnecting, setIsConnecting] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasCopied, setHasCopied] = useState(false);

    const peerRef = useRef<Peer.Instance | null>(null);
    const channelRef = useRef<RealtimeChannel | null>(null);
    const shareIdRef = useRef<string | null>(null);
    const { toast } = useToast();

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (peerRef.current) {
                peerRef.current.destroy();
            }
            if (channelRef.current) {
                channelRef.current.unsubscribe();
            }
        };
    }, []);

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        setHasCopied(true);
        toast({ title: 'Copied!', description: 'Connection code copied to clipboard' });
        setTimeout(() => setHasCopied(false), 2000);
    };

    // Create a new connection (initiator)
    const createConnection = useCallback(async () => {
        setIsConnecting(true);
        setError(null);

        try {
            const supabase = createClient();
            const newPeer = new Peer({ initiator: true, trickle: false });
            peerRef.current = newPeer;

            newPeer.on('signal', async (offer) => {
                if (offer.type !== 'offer') return;

                const shortCode = generateShareCode();
                const obfuscatedCode = obfuscateCode(shortCode);
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

                if (dbError || !data) {
                    throw new Error('Failed to create connection session');
                }

                shareIdRef.current = data.id;
                setConnectionCode(obfuscatedCode);
                setMode('create');

                // Listen for answer
                const channel = supabase.channel(`share-session-${data.id}`);
                channelRef.current = channel;

                channel.on('broadcast', { event: 'answer' }, ({ payload }) => {
                    if (peerRef.current && !peerRef.current.destroyed && payload.answer) {
                        peerRef.current.signal(payload.answer);
                    }
                }).subscribe();
            });

            newPeer.on('connect', () => {
                setIsConnected(true);
                setIsConnecting(false);
                toast({ title: 'Connected!', description: 'Peer-to-peer connection established' });
                onConnectionEstablished(newPeer, connectionCode, true);
            });

            newPeer.on('error', (err) => {
                console.error('Peer error:', err);
                setError('Connection error occurred');
                setIsConnecting(false);
                onConnectionLost();
            });

            newPeer.on('close', () => {
                setIsConnected(false);
                toast({ title: 'Disconnected', description: 'Peer connection closed', variant: 'destructive' });
                onConnectionLost();
            });

        } catch (err: any) {
            setError(err.message || 'Failed to create connection');
            setIsConnecting(false);
        }
    }, [connectionCode, onConnectionEstablished, onConnectionLost, toast]);

    // Join an existing connection (answerer)
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
                setConnectionCode(inputCode);
                setMode('join');
                toast({ title: 'Connected!', description: 'Peer-to-peer connection established' });
                onConnectionEstablished(newPeer, inputCode, false);
            });

            newPeer.on('error', (err) => {
                console.error('Peer error:', err);
                setError('Connection error occurred');
                setIsConnecting(false);
                onConnectionLost();
            });

            newPeer.on('close', () => {
                setIsConnected(false);
                toast({ title: 'Disconnected', description: 'Peer connection closed', variant: 'destructive' });
                onConnectionLost();
            });

            newPeer.signal(offer);

        } catch (err: any) {
            setError(err.message || 'Failed to join connection');
            setIsConnecting(false);
        }
    }, [inputCode, onConnectionEstablished, onConnectionLost, toast]);

    const handleDisconnect = () => {
        if (peerRef.current) {
            peerRef.current.destroy();
        }
        if (channelRef.current) {
            channelRef.current.unsubscribe();
        }
        setMode('none');
        setConnectionCode('');
        setInputCode('');
        setIsConnected(false);
        setIsConnecting(false);
        setError(null);
        onConnectionLost();
    };

    const shareLink = connectionCode ? `${typeof window !== 'undefined' ? window.location.origin : ''}/s/${connectionCode}` : '';

    return (
        <Card className="w-full max-w-lg">
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle className="font-headline">Bidirectional P2P Connection</CardTitle>
                        <CardDescription>
                            {isConnected ? 'Connected - You can now send and receive files' : 'Create or join a connection'}
                        </CardDescription>
                    </div>
                    <Badge variant={isConnected ? 'default' : 'secondary'} className="flex items-center gap-2">
                        {isConnected ? <Wifi className="text-green-400" /> : <WifiOff className="text-gray-400" />}
                        {isConnected ? 'Connected' : 'Disconnected'}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {!isConnected && mode === 'none' && (
                    <div className="space-y-3">
                        <Button
                            onClick={createConnection}
                            disabled={isConnecting}
                            className="w-full"
                            size="lg"
                        >
                            {isConnecting ? <Loader className="mr-2 animate-spin" /> : <Link2 className="mr-2" />}
                            Create New Connection
                        </Button>

                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-background px-2 text-muted-foreground">Or</span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="join-code">Enter Connection Code</Label>
                            <div className="flex gap-2">
                                <Input
                                    id="join-code"
                                    placeholder="Enter 5-character code"
                                    value={inputCode}
                                    onChange={(e) => setInputCode(e.target.value.toLowerCase())}
                                    maxLength={5}
                                    className="text-center text-lg tracking-widest font-mono uppercase"
                                />
                                <Button onClick={joinConnection} disabled={isConnecting || inputCode.length !== 5}>
                                    {isConnecting ? <Loader className="animate-spin" /> : 'Join'}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {!isConnected && mode === 'create' && connectionCode && (
                    <div className="space-y-4 animate-in fade-in">
                        <div className="text-center p-4 bg-secondary/50 rounded-lg">
                            <Loader className="mx-auto h-8 w-8 animate-spin text-primary mb-2" />
                            <p className="text-sm text-muted-foreground">Waiting for peer to connect...</p>
                        </div>

                        <div className="space-y-2">
                            <Label>Share this code with your peer</Label>
                            <div className="flex gap-2">
                                <Input
                                    value={connectionCode}
                                    readOnly
                                    className="text-center text-2xl tracking-[0.3em] font-mono"
                                />
                                <Button onClick={() => handleCopy(connectionCode)} size="icon" variant="outline">
                                    {hasCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                </Button>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <Button onClick={() => handleCopy(shareLink)} variant="outline" className="flex-1">
                                <Copy className="mr-2 h-4 w-4" /> Copy Link
                            </Button>

                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button variant="outline">QR Code</Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-xs">
                                    <DialogHeader>
                                        <DialogTitle>Scan to Connect</DialogTitle>
                                    </DialogHeader>
                                    <div className="flex items-center justify-center p-4 bg-white rounded-md">
                                        <QRCode value={shareLink} size={200} />
                                    </div>
                                </DialogContent>
                            </Dialog>
                        </div>

                        <Button onClick={handleDisconnect} variant="ghost" className="w-full">
                            Cancel
                        </Button>
                    </div>
                )}

                {isConnected && (
                    <div className="space-y-4 animate-in fade-in">
                        <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-center">
                            <Wifi className="mx-auto h-8 w-8 text-green-500 mb-2" />
                            <p className="font-medium text-green-700 dark:text-green-400">Connection Established!</p>
                            <p className="text-sm text-muted-foreground">You can now send and receive files</p>
                        </div>

                        <div className="space-y-2">
                            <Label>Connection Code</Label>
                            <Input
                                value={connectionCode}
                                readOnly
                                className="text-center text-xl tracking-widest font-mono"
                            />
                        </div>

                        <Button onClick={handleDisconnect} variant="destructive" className="w-full">
                            Disconnect
                        </Button>
                    </div>
                )}

                {error && (
                    <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive">
                        {error}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
