"use client";

import { useState, useRef, useCallback, useEffect } from 'react';
import Peer from 'simple-peer';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { File as FileIcon, Download, Check, Send, Paperclip } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { trackFileTransfer, formatBytes } from '@/lib/analytics';
import type { FileDetails } from '@/lib/types';

// --- Types ---
type MessageType = 'text' | 'file';
type MessageSender = 'me' | 'peer';

interface Message {
    id: string;
    sender: MessageSender;
    type: MessageType;
    content: string | FileDetails; // text content or file metadata
    timestamp: number;
    // For file messages:
    fileStatus?: 'sending' | 'sent' | 'receiving' | 'received' | 'downloaded';
    progress?: number;
    fileData?: {
        name: string;
        size: number;
        mimeType: string;
        blobUrl?: string; // For downloaded files
    };
}

interface TransferPanelProps {
    peer: Peer.Instance;
    connectionCode: string;
    isInitiator: boolean;
    initialFiles?: File[];
}

export default function TransferPanel({ peer, connectionCode, isInitiator, initialFiles = [] }: TransferPanelProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState("");
    const [isDragOver, setIsDragOver] = useState(false);

    // Active transfer tracking
    const currentTransferRef = useRef<{
        fileName: string;
        fileSize: number;
        receivedSize: number;
        chunks: any[];
    } | null>(null);

    const { toast } = useToast();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Scroll to bottom helper
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Initial files handling
    useEffect(() => {
        if (initialFiles.length > 0) {
            handleFiles(initialFiles);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // --- Core Logic ---

    // 1. Send Text
    const sendMessage = useCallback(() => {
        if (!inputValue.trim() || !peer || peer.destroyed) return;

        const text = inputValue.trim();
        setInputValue("");

        // Add to local UI
        setMessages(prev => [...prev, {
            id: Date.now().toString(),
            sender: 'me',
            type: 'text',
            content: text,
            timestamp: Date.now()
        }]);

        // Send to peer
        try {
            peer.send(JSON.stringify({ type: 'chat-text', payload: text }));
        } catch (err) {
            console.error('Failed to send message:', err);
            toast({ title: 'Error', description: 'Failed to send message', variant: 'destructive' });
        }
    }, [inputValue, peer, toast]);

    // 2. Send File Logic
    const sendFileRaw = useCallback((file: File, msgId: string) => {
        if (!peer || peer.destroyed) return;

        const chunkSize = 256 * 1024;
        let offset = 0;

        try {
            // Signal start
            peer.send(JSON.stringify({
                type: 'transferStart',
                payload: { fileName: file.name, fileSize: file.size, fileType: file.type, msgId }
            }));

            const reader = new FileReader();

            reader.onload = (e) => {
                if (peer.destroyed || !e.target?.result) return;

                try {
                    peer.send(e.target.result as ArrayBuffer);
                    offset += (e.target.result as ArrayBuffer).byteLength;

                    const progress = Math.min((offset / file.size) * 100, 100);

                    // Update UI progress
                    setMessages(prev => prev.map(m => {
                        if (m.id === msgId) {
                            return { ...m, progress, fileStatus: progress === 100 ? 'sent' : 'sending' };
                        }
                        return m;
                    }));

                    if (offset < file.size) {
                        readNextChunk();
                    } else {
                        // Complete
                        peer.send(JSON.stringify({
                            type: 'transferComplete',
                            payload: { fileName: file.name, msgId }
                        }));
                        trackFileTransfer(file.name, file.size, file.type, 'sent');
                    }
                } catch (err) {
                    console.error('Error sending chunk:', err);
                }
            };

            const readNextChunk = () => {
                const slice = file.slice(offset, offset + chunkSize);
                reader.readAsArrayBuffer(slice);
            };

            readNextChunk();

        } catch (err) {
            console.error("Send file error", err);
        }
    }, [peer]);

    // 3. Handle New Files Selection
    const handleFiles = (files: File[]) => {
        files.forEach(file => {
            const msgId = Date.now().toString() + Math.random().toString().slice(2);

            // Add pending message
            setMessages(prev => [...prev, {
                id: msgId,
                sender: 'me',
                type: 'file',
                content: { name: file.name, size: file.size, type: file.type },
                timestamp: Date.now(),
                fileStatus: 'sending',
                progress: 0,
                fileData: { name: file.name, size: file.size, mimeType: file.type }
            }]);

            // Start sending immediately
            sendFileRaw(file, msgId);
        });
    };

    const handlePeerData = useCallback((data: any) => {
        let signal: any = null;

        try {
            const textData = (data instanceof ArrayBuffer || data instanceof Uint8Array)
                ? new TextDecoder().decode(data)
                : data.toString();

            if (typeof textData === 'string' && textData.trim().startsWith('{')) {
                const parsed = JSON.parse(textData);
                if (parsed.type) signal = parsed;
            }
        } catch (e) {
            // Binary data usually
        }

        if (signal) {
            const { type, payload } = signal;

            switch (type) {
                case 'chat-text':
                    setMessages(prev => [...prev, {
                        id: Date.now().toString(),
                        sender: 'peer',
                        type: 'text',
                        content: payload,
                        timestamp: Date.now()
                    }]);
                    break;

                case 'transferStart':
                    // In a chat based system, we create a "Receiving" bubble
                    currentTransferRef.current = {
                        fileName: payload.fileName,
                        fileSize: payload.fileSize,
                        receivedSize: 0,
                        chunks: []
                    };

                    const newMsgId = payload.msgId || Date.now().toString();

                    setMessages(prev => [...prev, {
                        id: newMsgId,
                        sender: 'peer',
                        type: 'file',
                        content: { name: payload.fileName, size: payload.fileSize, type: payload.fileType },
                        timestamp: Date.now(),
                        fileStatus: 'receiving',
                        progress: 0,
                        fileData: { name: payload.fileName, size: payload.fileSize, mimeType: payload.fileType }
                    }]);
                    break;

                case 'transferComplete':
                    if (currentTransferRef.current && currentTransferRef.current.fileName === payload.fileName) {
                        try {
                            // Safely handle unknown types by defaulting
                            const fileType = (currentTransferRef.current as any).fileType || 'application/octet-stream';
                            const blob = new Blob(currentTransferRef.current.chunks, { type: fileType });
                            const url = URL.createObjectURL(blob);

                            setMessages(prev => prev.map(m => {
                                // Find the receiving message that matches this file
                                if (m.sender === 'peer' && m.type === 'file' && (m.content as FileDetails).name === payload.fileName && m.fileStatus === 'receiving') {
                                    return {
                                        ...m,
                                        fileStatus: 'received',
                                        progress: 100,
                                        fileData: { ...m.fileData!, blobUrl: url }
                                    };
                                }
                                return m;
                            }));

                            currentTransferRef.current = null;
                        } catch (e) { console.error("Blob creation failed", e); }
                    }
                    break;
            }
            return;
        }

        // Binary Data
        if (currentTransferRef.current) {
            const chunk = data instanceof Uint8Array ? data : new Uint8Array(data);
            currentTransferRef.current.chunks.push(chunk);
            currentTransferRef.current.receivedSize += chunk.byteLength;

            const { fileName, fileSize } = currentTransferRef.current;
            const progress = Math.min((currentTransferRef.current.receivedSize / fileSize) * 100, 100);

            // Update UI
            setMessages(prev => {
                return prev.map(m => {
                    if (m.sender === 'peer' && m.type === 'file' && (m.content as FileDetails).name === fileName && m.fileStatus === 'receiving') {
                        return { ...m, progress };
                    }
                    return m;
                });
            });
        }

    }, [peer]);

    useEffect(() => {
        if (peer && !peer.destroyed) {
            peer.on('data', handlePeerData);
            return () => { peer.off('data', handlePeerData); };
        }
    }, [peer, handlePeerData]);


    // Download Handler
    const handleDownload = (msg: Message) => {
        if (!msg.fileData?.blobUrl) return;
        const a = document.createElement('a');
        a.href = msg.fileData.blobUrl;
        a.download = msg.fileData.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, fileStatus: 'downloaded' } : m));
    };


    const formatTime = (ts: number) => {
        return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <Card className="w-full max-w-2xl h-[600px] flex flex-col shadow-xl">
            <CardHeader className="py-4 border-b flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse absolute -right-0.5 -top-0.5 border border-background"></div>
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                            {isInitiator ? 'P2' : 'P1'}
                        </div>
                    </div>
                    <div>
                        <CardTitle className="text-base">Connected Peer</CardTitle>
                        <p className="text-xs text-muted-foreground font-mono">{connectionCode}</p>
                    </div>
                </div>
                <Badge variant="outline" className="text-xs">
                    End-to-End Encrypted
                </Badge>
            </CardHeader>

            <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 bg-secondary/5"
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={(e) => {
                    e.preventDefault();
                    setIsDragOver(false);
                    if (e.dataTransfer.files?.length) handleFiles(Array.from(e.dataTransfer.files));
                }}
            >
                {isDragOver && (
                    <div className="absolute inset-0 bg-primary/20 backdrop-blur-sm z-50 flex items-center justify-center rounded-lg m-4 border-2 border-dashed border-primary">
                        <p className="text-primary font-bold text-lg">Drop files to send</p>
                    </div>
                )}

                {messages.length === 0 && (
                    <div className="text-center py-10 text-muted-foreground">
                        <div className="w-16 h-16 bg-muted rounded-full mx-auto mb-4 flex items-center justify-center">
                            <Send className="w-8 h-8 opacity-50" />
                        </div>
                        <p>No messages yet.</p>
                        <p className="text-sm">Send a message or drop a file to start.</p>
                    </div>
                )}

                {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-2xl px-4 py-2 shadow-sm ${msg.sender === 'me'
                                ? 'bg-primary text-primary-foreground rounded-br-none'
                                : 'bg-card border rounded-bl-none'
                            }`}>
                            {msg.type === 'text' ? (
                                <p className="whitespace-pre-wrap">{msg.content as string}</p>
                            ) : (
                                <div className="space-y-2 min-w-[200px]">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-background/20 rounded-lg">
                                            <FileIcon className="w-6 h-6" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium truncate text-sm">{(msg.content as FileDetails).name}</p>
                                            <p className="text-xs opacity-70">{formatBytes((msg.content as FileDetails).size)}</p>
                                        </div>
                                    </div>

                                    {(msg.fileStatus === 'sending' || msg.fileStatus === 'receiving') && (
                                        <div className="space-y-1">
                                            <Progress value={msg.progress} className="h-1.5" />
                                            <p className="text-[10px] text-right opacity-70">
                                                {Math.round(msg.progress || 0)}%
                                            </p>
                                        </div>
                                    )}

                                    {msg.sender === 'peer' && msg.fileStatus === 'received' && (
                                        <Button size="sm" variant="secondary" className="w-full h-8" onClick={() => handleDownload(msg)}>
                                            <Download className="w-3 h-3 mr-2" /> Download
                                        </Button>
                                    )}
                                    {msg.sender === 'peer' && msg.fileStatus === 'downloaded' && (
                                        <Button size="sm" variant="ghost" className="w-full h-8" onClick={() => handleDownload(msg)}>
                                            <Check className="w-3 h-3 mr-2" /> Saved
                                        </Button>
                                    )}
                                </div>
                            )}
                            <p className="text-[10px] opacity-50 text-right mt-1">{formatTime(msg.timestamp)}</p>
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </CardContent>

            <CardFooter className="p-3 border-t bg-background">
                <div className="flex w-full items-center gap-2">
                    <input
                        type="file"
                        multiple
                        className="hidden"
                        ref={fileInputRef}
                        onChange={(e) => {
                            if (e.target.files) handleFiles(Array.from(e.target.files));
                            e.target.value = ''; // Reset
                        }}
                    />
                    <Button size="icon" variant="ghost" onClick={() => fileInputRef.current?.click()}>
                        <Paperclip className="w-5 h-5" />
                    </Button>
                    <Input
                        placeholder="Type a message..."
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                        className="flex-1 rounded-full bg-secondary/20"
                    />
                    <Button size="icon" onClick={sendMessage} className="rounded-full">
                        <Send className="w-4 h-4" />
                    </Button>
                </div>
            </CardFooter>
        </Card>
    );
}
