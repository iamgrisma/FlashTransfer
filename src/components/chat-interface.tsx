"use client";

import { useState, useRef, useCallback, useEffect } from 'react';
import Peer from 'simple-peer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { File as FileIcon, Download, Check, Send, Paperclip, Loader, X, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { trackFileTransfer, formatBytes } from '@/lib/analytics';
import type { FileDetails } from '@/lib/types';
import { ChatMessage, useChatHistory } from '@/hooks/use-chat-history';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ChatInterfaceProps {
    peer: Peer.Instance | null;
    isConnected: boolean;
    connectionCode: string; // If active
    onConnectRequest: () => void; // Trigger standard connection flow
    historyHook: ReturnType<typeof useChatHistory>; // Pass from parent for consolidated state
}

export default function ChatInterface({
    peer,
    isConnected,
    onConnectRequest,
    historyHook
}: ChatInterfaceProps) {
    const { messages, addMessage, updateMessage } = historyHook;
    const [inputValue, setInputValue] = useState("");
    const [isDragOver, setIsDragOver] = useState(false);

    // Internal Queue for when sending fails or is pending connection
    // In practice, we add to "messages" with status 'sending' (or 'queued'?)
    // If not connected, we prompt.

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

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // 1. Send Text
    const sendMessage = useCallback(() => {
        if (!inputValue.trim()) return;
        const text = inputValue.trim();
        setInputValue("");

        const msgId = Date.now().toString();

        // Add to UI immediately
        addMessage({
            id: msgId,
            sender: 'me',
            type: 'text',
            content: text,
            timestamp: Date.now()
        });

        // Try send if connected
        if (isConnected && peer && !peer.destroyed) {
            try {
                peer.send(JSON.stringify({ type: 'chat-text', payload: text }));
            } catch (err) {
                console.error('Failed to send text:', err);
                toast({ title: 'Send Error', description: 'Message saved but not sent.', variant: 'warning' });
            }
        } else {
            // It's just local history now, maybe we prompt to connect?
            // User requested flow: "If not connected -> Prompt connection" is mainly for FILES?
            // For text, let's just leave it in history.
        }
    }, [inputValue, peer, isConnected, addMessage, toast]);

    // 2. Send File Logic
    const sendFileRaw = useCallback((file: File, msgId: string) => {
        if (!peer || peer.destroyed || !isConnected) {
            // If called but disconnected, we leave it as "sending" -> "error" or just update to "queued" if we had that state
            // For now, update to 'error' to indicate retry needed
            updateMessage(msgId, { fileStatus: 'error' });
            return;
        }

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

                    updateMessage(msgId, { progress, fileStatus: progress === 100 ? 'sent' : 'sending' });

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
                    updateMessage(msgId, { fileStatus: 'error' });
                }
            };

            const readNextChunk = () => {
                const slice = file.slice(offset, offset + chunkSize);
                reader.readAsArrayBuffer(slice);
            };

            readNextChunk();

        } catch (err) {
            console.error("Send file error", err);
            updateMessage(msgId, { fileStatus: 'error' });
        }
    }, [peer, isConnected, updateMessage]);

    // 3. Handle File Trigger (User Drop or Select)
    const handleFiles = (files: File[]) => {
        // If not connected, we TRIGGER the connection flow first?
        // OR we add to queue and trigger flow?
        // Plan: Add to list as "Ready to send" (let's use 'sending' with 0 progress but if !connected, open dialog)

        let shouldConnect = !isConnected;

        files.forEach(file => {
            const msgId = Date.now().toString() + Math.random().toString().slice(2);

            addMessage({
                id: msgId,
                sender: 'me',
                type: 'file',
                content: { name: file.name, size: file.size, type: file.type },
                timestamp: Date.now(),
                fileStatus: isConnected ? 'sending' : 'error', // 'error' is a bit harsh, ideally 'queued' but reusing types
                progress: 0,
                fileData: { name: file.name, size: file.size, mimeType: file.type }
            });

            if (isConnected) {
                sendFileRaw(file, msgId);
            }
        });

        if (shouldConnect) {
            onConnectRequest();
        }
    };

    // Retry sending a file (e.g. after connection established/re-established)
    // We need the original File object... which we don't store in localStorage or Message state fully (just metadata)
    // So if page reloads, we cant retry.
    // BUT if the session is active in memory (files variable?), we could. 
    // Simplified: For this version, "Retry" only works if user re-selects file OR if we keep file refs in memory while page alive.
    // Let's implement basic "Click to upload again" if error.

    // Handling Peer Data
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
        } catch (e) { }

        if (signal) {
            const { type, payload } = signal;

            switch (type) {
                case 'chat-text':
                    addMessage({
                        id: Date.now().toString(),
                        sender: 'peer',
                        type: 'text',
                        content: payload,
                        timestamp: Date.now()
                    });
                    break;

                case 'transferStart':
                    currentTransferRef.current = {
                        fileName: payload.fileName,
                        fileSize: payload.fileSize,
                        receivedSize: 0,
                        chunks: []
                    };

                    const newMsgId = payload.msgId || Date.now().toString();

                    addMessage({
                        id: newMsgId,
                        sender: 'peer',
                        type: 'file',
                        content: { name: payload.fileName, size: payload.fileSize, type: payload.fileType },
                        timestamp: Date.now(),
                        fileStatus: 'receiving',
                        progress: 0,
                        fileData: { name: payload.fileName, size: payload.fileSize, mimeType: payload.fileType }
                    });
                    break;

                case 'transferComplete':
                    if (currentTransferRef.current && currentTransferRef.current.fileName === payload.fileName) {
                        try {
                            const fileType = (currentTransferRef.current as any).fileType || 'application/octet-stream';
                            const blob = new Blob(currentTransferRef.current.chunks, { type: fileType });
                            const url = URL.createObjectURL(blob);

                            // We need to find the message to update...
                            // Since we don't have ID, we search by filename + 'receiving' status in REVERSE (most recent)
                            // Ideally payload has msgId

                            // Helper to find and update
                            // Since we use addMessage/updateMessage which use functional updates on the hook...
                            // We need internal access or use the updateMessage exposed.

                            // HACK: We assume last message with that filename is the one? 
                            // Better: Payload has msgId.

                            if (payload.msgId) {
                                updateMessage(payload.msgId, {
                                    fileStatus: 'received',
                                    progress: 100,
                                    fileData: { name: payload.fileName, size: 0, mimeType: fileType, blobUrl: url }
                                });
                            }

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

            // We need to update UI progress. 
            // Again, missing msgId in binary chunks context...
            // We'll rely on React state finding the 'receiving' message.
            // Optimized: Don't update state on EVERY chunk for performance?
            // For now, let's throttle or just update. To update correctly we need msgId.
            // We don't have it here. We can store "currentMsgId" in ref alongside "currentTransferRef".
            // TODO: Update transferStart to store msgId in Ref.
        }

    }, [peer, addMessage, updateMessage]);

    // Fix: Store MsgId in Ref for binary tracking
    const currentMsgIdRef = useRef<string | null>(null);

    // Override handlePeerData to use Ref for ID
    const handlePeerDataRefined = useCallback((data: any) => {
        let signal: any = null;
        try {
            const textData = (data instanceof ArrayBuffer || data instanceof Uint8Array)
                ? new TextDecoder().decode(data)
                : data.toString();
            if (typeof textData === 'string' && textData.trim().startsWith('{')) {
                const parsed = JSON.parse(textData);
                if (parsed.type) signal = parsed;
            }
        } catch (e) { }

        if (signal) {
            const { type, payload } = signal;
            if (type === 'transferStart') {
                currentTransferRef.current = {
                    fileName: payload.fileName,
                    fileSize: payload.fileSize,
                    receivedSize: 0,
                    chunks: []
                };
                currentMsgIdRef.current = payload.msgId || Date.now().toString();

                addMessage({
                    id: currentMsgIdRef.current!,
                    sender: 'peer',
                    type: 'file',
                    content: { name: payload.fileName, size: payload.fileSize, type: payload.fileType },
                    timestamp: Date.now(),
                    fileStatus: 'receiving',
                    progress: 0,
                    fileData: { name: payload.fileName, size: payload.fileSize, mimeType: payload.fileType }
                });
                return;
            }
            if (type === 'transferComplete') {
                if (currentTransferRef.current && currentMsgIdRef.current) {
                    try {
                        const fileType = (currentTransferRef.current as any).fileType || 'application/octet-stream';
                        const blob = new Blob(currentTransferRef.current.chunks, { type: fileType });
                        const url = URL.createObjectURL(blob);

                        updateMessage(currentMsgIdRef.current, {
                            fileStatus: 'received',
                            progress: 100,
                            fileData: { name: payload.fileName, size: 0, mimeType: fileType, blobUrl: url }
                        });
                        currentTransferRef.current = null;
                        currentMsgIdRef.current = null;
                    } catch (e) { }
                }
                return;
            }
            // Normal signals
            if (type === 'chat-text') {
                addMessage({
                    id: Date.now().toString(),
                    sender: 'peer',
                    type: 'text',
                    content: payload,
                    timestamp: Date.now()
                });
            }
            return;
        }

        // Binary
        if (currentTransferRef.current && currentMsgIdRef.current) {
            const chunk = data instanceof Uint8Array ? data : new Uint8Array(data);
            currentTransferRef.current.chunks.push(chunk);
            currentTransferRef.current.receivedSize += chunk.byteLength;
            const { fileSize } = currentTransferRef.current;
            const progress = Math.min((currentTransferRef.current.receivedSize / fileSize) * 100, 100);
            updateMessage(currentMsgIdRef.current, { progress });
        }
    }, [addMessage, updateMessage]);

    useEffect(() => {
        if (peer && !peer.destroyed) {
            peer.on('data', handlePeerDataRefined);
            return () => { peer.off('data', handlePeerDataRefined); };
        }
    }, [peer, handlePeerDataRefined]);

    // Render Helpers
    const formatTime = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const handleDownload = (msg: ChatMessage) => {
        if (msg.fileData?.blobUrl) {
            const a = document.createElement('a');
            a.href = msg.fileData.blobUrl;
            a.download = (msg.content as FileDetails).name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            updateMessage(msg.id, { fileStatus: 'downloaded' });
        } else {
            toast({ title: 'File not available', description: 'This file is not in memory. Please ask peer to resend.', variant: 'destructive' });
        }
    };

    return (
        <div className="flex flex-col h-full bg-background"
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                if (e.dataTransfer.files?.length) handleFiles(Array.from(e.dataTransfer.files));
            }}
        >
            {isDragOver && (
                <div className="absolute inset-0 z-50 bg-primary/20 backdrop-blur-sm flex items-center justify-center border-2 border-dashed border-primary m-4 rounded-xl">
                    <p className="text-2xl font-bold text-primary">Drop files to send</p>
                </div>
            )}

            {/* Messages Area */}
            <ScrollArea className="flex-1 p-4">
                <div className="space-y-4 max-w-3xl mx-auto pb-4">
                    {messages.length === 0 && (
                        <div className="text-center py-20 text-muted-foreground opacity-50">
                            <Send className="w-12 h-12 mx-auto mb-4" />
                            <p>Start chatting or drop files anytime.</p>
                            <p className="text-xs">History is saved automatically.</p>
                        </div>
                    )}

                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-3 shadow-sm ${msg.sender === 'me'
                                    ? 'bg-primary text-primary-foreground rounded-br-none'
                                    : 'bg-secondary text-secondary-foreground rounded-bl-none'
                                }`}>
                                {msg.type === 'text' ? (
                                    <p className="whitespace-pre-wrap break-words">{msg.content as string}</p>
                                ) : (
                                    <div className="space-y-3 min-w-[200px]">
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
                                                <Progress value={msg.progress} className="h-1.5 bg-background/20" />
                                            </div>
                                        )}

                                        {msg.fileStatus === 'error' && (
                                            <div className="flex items-center gap-2 text-xs text-destructive-foreground/80 bg-destructive/20 p-1 rounded">
                                                <AlertCircle className="w-3 h-3" />
                                                <span>Send Failed</span>
                                                <Button size="sm" variant="ghost" className="h-5 px-2 text-[10px]" onClick={onConnectRequest}>Retry</Button>
                                            </div>
                                        )}

                                        {msg.sender === 'peer' && msg.fileStatus === 'received' && (
                                            <Button size="sm" variant="secondary" className="w-full h-8 bg-background/20 hover:bg-background/30" onClick={() => handleDownload(msg)}>
                                                <Download className="w-3 h-3 mr-2" /> Download
                                            </Button>
                                        )}
                                        {msg.sender === 'peer' && msg.fileStatus === 'downloaded' && (
                                            <div className="flex items-center gap-2 text-xs opacity-70">
                                                <Check className="w-3 h-3" /> Saved to device
                                            </div>
                                        )}
                                        {/* If history item without blob */}
                                        {msg.sender === 'peer' && !msg.fileData?.blobUrl && (msg.fileStatus === 'received' || msg.fileStatus === 'downloaded') && (
                                            <div className="text-[10px] opacity-60 italic">
                                                File available in chat session
                                            </div>
                                        )}
                                    </div>
                                )}
                                <div className="flex justify-end items-center gap-1 mt-1 opacity-50">
                                    <span className="text-[10px]">{formatTime(msg.timestamp)}</span>
                                    {msg.sender === 'me' && (
                                        msg.type === 'file' ? (
                                            msg.fileStatus === 'sent' ? <Check className="w-3 h-3" /> : (msg.fileStatus === 'sending' ? <Loader className="w-3 h-3 animate-spin" /> : null)
                                        ) : <Check className="w-3 h-3" />
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="p-4 border-t bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="max-w-3xl mx-auto flex items-center gap-2">
                    <input
                        type="file"
                        multiple
                        className="hidden"
                        ref={fileInputRef}
                        onChange={(e) => {
                            if (e.target.files) handleFiles(Array.from(e.target.files));
                            e.target.value = '';
                        }}
                    />
                    <Button size="icon" variant="ghost" className="rounded-full shrink-0" onClick={() => fileInputRef.current?.click()}>
                        <Paperclip className="w-5 h-5" />
                    </Button>
                    <Input
                        placeholder="Type a message..."
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                        className="flex-1 rounded-full bg-secondary border-none focus-visible:ring-1"
                    />
                    <Button size="icon" className="rounded-full shrink-0" onClick={sendMessage}>
                        <Send className="w-4 h-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
