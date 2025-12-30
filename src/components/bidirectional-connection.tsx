"use client";

import Peer from 'simple-peer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader, Wifi, WifiOff, Link2 } from 'lucide-react';
import { useBidirectionalConnection } from '@/components/connection/use-connection';
import { CreateConnection } from '@/components/connection/create-connection';
import { JoinConnection } from '@/components/connection/join-connection';
import { ActiveConnection } from '@/components/connection/active-connection';
import { useEffect } from 'react';

interface BidirectionalConnectionProps {
    onConnectionEstablished: (peer: Peer.Instance, connectionCode: string, isInitiator: boolean) => void;
    onConnectionLost: () => void;
    targetCode?: string | null; // Code to auto-join
}

export default function BidirectionalConnection({
    onConnectionEstablished,
    onConnectionLost,
    targetCode
}: BidirectionalConnectionProps) {
    const {
        mode,
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
    } = useBidirectionalConnection({ onConnectionEstablished, onConnectionLost });

    // Auto-join if targetCode is provided
    useEffect(() => {
        if (targetCode && !isConnected && !isConnecting && mode === 'none') {
            joinConnection(targetCode);
        }
    }, [targetCode, isConnected, isConnecting, mode, joinConnection]);

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
                            onClick={() => createConnection(false)}
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

                        <JoinConnection
                            inputCode={inputCode}
                            setInputCode={setInputCode}
                            isConnecting={isConnecting}
                            onJoin={joinConnection}
                        />
                    </div>
                )}

                {!isConnected && mode === 'create' && connectionCode && (
                    <CreateConnection
                        connectionCode={connectionCode}
                        isConnecting={isConnecting}
                        onDisconnect={handleDisconnect}
                    />
                )}

                {!isConnected && mode === 'join' && (
                    <div className="text-center p-8 space-y-4 animate-in fade-in">
                        <div className="p-4 bg-secondary/50 rounded-lg">
                            <Loader className="mx-auto h-8 w-8 animate-spin text-primary mb-2" />
                            <p className="text-sm text-muted-foreground">Reconnecting to session {connectionCode || targetCode}...</p>
                        </div>
                        <Button onClick={handleDisconnect} variant="ghost">Cancel</Button>
                    </div>
                )}

                {isConnected && (
                    <ActiveConnection
                        connectionCode={connectionCode}
                        remotePeerStatus={remotePeerStatus}
                        onDisconnect={handleDisconnect}
                        onRotateSession={handleRotateSession}
                        isHost={mode === 'create'}
                    />
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
