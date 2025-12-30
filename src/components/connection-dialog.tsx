"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Loader, Link2, Download, Copy, RefreshCw } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useConnectionHistory, StoredConnection } from '@/hooks/use-connection-history';
import { formatDistanceToNow } from 'date-fns';

interface ConnectionDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onJoin: (code: string) => void;
    onCreate: () => void;
    onSelectRecent: (conn: StoredConnection) => void;
    connectionCode?: string; // If creating, show this
    isConnecting: boolean;
    mode: 'none' | 'create' | 'join';
}

export function ConnectionDialog({
    isOpen,
    onOpenChange,
    onJoin,
    onCreate,
    onSelectRecent,
    connectionCode,
    isConnecting,
    mode
}: ConnectionDialogProps) {
    const [joinInput, setJoinInput] = useState('');
    const { history } = useConnectionHistory();
    const { toast } = useToast();

    const handleCopy = () => {
        if (connectionCode) {
            const url = `${window.location.origin}/s/${connectionCode}`;
            navigator.clipboard.writeText(url);
            toast({ title: 'Link Copied', description: 'Share this link with your peer.' });
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Connect to a Peer</DialogTitle>
                    <DialogDescription>
                        Establish a secure P2P connection to start chatting and sharing files.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Mode: Selection (Default) implies mode === 'none' usually, but here checking prop */}
                    {mode === 'none' && (
                        <div className="space-y-4">
                            {/* Join Input */}
                            <div className="flex space-x-2">
                                <Input
                                    placeholder="Enter 5-digit code"
                                    value={joinInput}
                                    onChange={(e) => setJoinInput(e.target.value.toUpperCase().slice(0, 5))}
                                    className="uppercase tracking-widest font-mono text-center text-lg"
                                />
                                <Button
                                    onClick={() => onJoin(joinInput)}
                                    disabled={joinInput.length !== 5 || isConnecting}
                                >
                                    {isConnecting ? <Loader className="animate-spin" /> : 'Join'}
                                </Button>
                            </div>

                            <div className="relative">
                                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                                <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">Or</span></div>
                            </div>

                            <Button
                                onClick={onCreate}
                                className="w-full" variant="outline" size="lg"
                                disabled={isConnecting}
                            >
                                {isConnecting ? <Loader className="mr-2 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
                                Create New Connection
                            </Button>

                            {/* Recent Connections */}
                            {history.length > 0 && (
                                <div className="pt-2">
                                    <h4 className="text-sm font-medium mb-2 text-muted-foreground">Recent Connections</h4>
                                    <ScrollArea className="h-32 rounded-md border p-2">
                                        <div className="space-y-1">
                                            {history.map((conn) => (
                                                <Button
                                                    key={conn.code}
                                                    variant="ghost"
                                                    className="w-full justify-start text-left h-auto py-2 px-3"
                                                    onClick={() => onSelectRecent(conn)}
                                                >
                                                    <div className="flex flex-col items-start w-full gap-1">
                                                        <span className="font-medium text-xs">{conn.peerLabel || conn.name}</span>
                                                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                            Code: {conn.code} • {formatDistanceToNow(conn.lastActive, { addSuffix: true })}
                                                        </span>
                                                    </div>
                                                </Button>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Mode: Creating - Show Code/QR */}
                    {mode === 'create' && connectionCode && (
                        <div className="flex flex-col items-center space-y-4 animate-in fade-in zoom-in-95">
                            <div className="p-4 bg-white rounded-xl shadow-sm border">
                                <QRCodeSVG value={`${typeof window !== 'undefined' ? window.location.origin : ''}/s/${connectionCode}`} size={160} />
                            </div>

                            <div className="text-center space-y-2 w-full">
                                <p className="text-sm text-muted-foreground">Share this code with your peer</p>
                                <div className="flex items-center justify-center gap-2">
                                    <div className="text-4xl font-mono font-bold tracking-widest text-primary">
                                        {connectionCode}
                                    </div>
                                    <Button size="icon" variant="ghost" onClick={handleCopy}>
                                        <Copy className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>

                            <div className="flex items-center text-xs text-secondary-foreground bg-secondary/50 px-3 py-1 rounded-full">
                                <Loader className="h-3 w-3 mr-2 animate-spin" />
                                Waiting for peer to join...
                            </div>
                        </div>
                    )}

                    {/* Mode: Joining */}
                    {mode === 'join' && (
                        <div className="flex flex-col items-center justify-center py-8 space-y-4">
                            <Loader className="h-10 w-10 animate-spin text-primary" />
                            <p className="text-muted-foreground">Connecting to peer...</p>
                        </div>
                    )}

                </div>
            </DialogContent>
        </Dialog>
    );
}
