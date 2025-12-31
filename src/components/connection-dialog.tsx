"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Loader, Link2, Copy, ArrowRight } from 'lucide-react';
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
    connectionCode?: string;
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

    // Determine what to show
    const isShowingCode = mode === 'create' && connectionCode;
    const showConnecting = isConnecting && !isShowingCode;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xs md:max-w-md rounded-2xl p-0 gap-0 overflow-hidden">
                {/* Header */}
                <div className="p-4 bg-muted/20 border-b">
                    <DialogTitle className="text-lg font-bold">
                        {showConnecting ? 'Connecting...' : (isShowingCode ? 'Share Code' : 'Connect')}
                    </DialogTitle>
                    <DialogDescription className="text-xs mt-1">
                        {showConnecting ? 'Establishing secure P2P link' : (isShowingCode ? 'Share with peer' : 'Enter code or create new')}
                    </DialogDescription>
                </div>

                <div className="p-4">
                    {showConnecting ? (
                        <div className="flex flex-col items-center justify-center py-8 space-y-4">
                            <div className="relative">
                                <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse"></div>
                                <Loader className="h-12 w-12 animate-spin text-primary relative z-10" />
                            </div>
                            <p className="text-sm text-muted-foreground font-medium animate-pulse">Looking for peer...</p>
                        </div>
                    ) : isShowingCode ? (
                        <div className="flex flex-col items-center space-y-6 py-2">
                            <div className="p-3 bg-white rounded-xl shadow-inner border">
                                <QRCodeSVG value={`${typeof window !== 'undefined' ? window.location.origin : ''}/s/${connectionCode}`} size={140} />
                            </div>
                            <div className="text-center w-full space-y-3">
                                <div className="flex items-center justify-center gap-3">
                                    <div className="text-3xl font-mono font-bold tracking-widest text-foreground">
                                        {connectionCode}
                                    </div>
                                    <Button size="icon" variant="outline" className="h-8 w-8" onClick={handleCopy}>
                                        <Copy className="h-3 w-3" />
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground">Share this code to connect</p>
                                <p className="text-[10px] text-muted-foreground/60">Waiting for peer...</p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Input Code */}
                            <div className="space-y-2">
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="Enter Code (e.g. 5X92L)"
                                        value={joinInput}
                                        onChange={(e) => setJoinInput(e.target.value.toUpperCase().slice(0, 5))}
                                        className="text-center font-mono uppercase tracking-widest text-lg h-12"
                                        onKeyDown={(e) => e.key === 'Enter' && joinInput.length === 5 && onJoin(joinInput)}
                                    />
                                    <Button
                                        onClick={() => onJoin(joinInput)}
                                        disabled={joinInput.length !== 5}
                                        size="icon"
                                        className="h-12 w-12 shrink-0 bg-primary"
                                    >
                                        <ArrowRight className="h-5 w-5" />
                                    </Button>
                                </div>
                            </div>

                            <div className="relative">
                                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                                <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">Or</span></div>
                            </div>

                            <Button
                                onClick={onCreate}
                                className="w-full h-12 text-sm font-medium" variant="outline"
                            >
                                <Link2 className="mr-2 h-4 w-4" />
                                Create New Connection
                            </Button>

                            {/* Recent */}
                            {history.length > 0 && (
                                <div className="space-y-2 pt-2">
                                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recent</h4>
                                    <ScrollArea className="max-h-[140px] -mx-2">
                                        <div className="space-y-1 px-2">
                                            {history.map((conn) => (
                                                <Button
                                                    key={conn.code}
                                                    variant="ghost"
                                                    className="w-full justify-start text-left h-auto py-2 px-3 border border-border/40 hover:bg-muted/50 hover:border-border"
                                                    onClick={() => onSelectRecent(conn)}
                                                >
                                                    <div className="flex flex-col items-start w-full gap-0.5">
                                                        <span className="font-medium text-xs">{conn.peerLabel || conn.name}</span>
                                                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                            {conn.code} • {formatDistanceToNow(conn.lastActive, { addSuffix: true })}
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
                </div>
            </DialogContent>
        </Dialog>
    );
}
