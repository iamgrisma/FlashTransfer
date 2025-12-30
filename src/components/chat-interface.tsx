"use client";

import { useState, useRef, useCallback, useEffect } from 'react';
import Peer from 'simple-peer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { File as FileIcon, Download, Check, Send, Paperclip, Loader, AlertCircle, X, UploadCloud, Link } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { trackFileTransfer, formatBytes } from '@/lib/analytics';
import type { FileDetails } from '@/lib/types';
import { ChatMessage, useChatHistory } from '@/hooks/use-chat-history';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';

interface ChatInterfaceProps {
    peer: Peer.Instance | null;
    isConnected: boolean;
    connectionCode: string;
    onConnectRequest: () => void;
    onJoinCode: (code: string) => void; // New prop for direct join from top bar
    historyHook: ReturnType<typeof useChatHistory>;
}

export default function ChatInterface({
    peer,
    isConnected,
    onConnectRequest,
    onJoinCode,
    historyHook
}: ChatInterfaceProps) {
    const { messages, addMessage, updateMessage } = historyHook;
    const [inputValue, setInputValue] = useState("");
    const [joinInput, setJoinInput] = useState("");
    const [isDragOver, setIsDragOver] = useState(false);

    // Staging State
    const [stagedFiles, setStagedFiles] = useState<File[]>([]);

    const pendingFilesRef = useRef<Map<string, File>>(new Map());
    const currentTransferRef = useRef<{
        fileName: string;
        fileSize: number;
        receivedSize: number;
        chunks: any[];
    } | null>(null);
    const currentMsgIdRef = useRef<string | null>(null);

    const { toast } = useToast();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, stagedFiles]);

    // --- Core Send Logic ---
    const processSendFile = useCallback((file: File, msgId: string) => {
        if (!peer || peer.destroyed) return;
        const chunkSize = 256 * 1024;
        let offset = 0;
        try {
            peer.send(JSON.stringify({ type: 'transferStart', payload: { fileName: file.name, fileSize: file.size, fileType: file.type, msgId } }));
            const reader = new FileReader();
            reader.onload = (e) => {
                if (peer.destroyed || !e.target?.result) return;
                try {
                    peer.send(e.target.result as ArrayBuffer);
                    offset += (e.target.result as ArrayBuffer).byteLength;
                    const progress = Math.min((offset / file.size) * 100, 100);
                    updateMessage(msgId, { progress, fileStatus: progress === 100 ? 'sent' : 'sending' });
                    if (offset < file.size) { readNextChunk(); }
                    else {
                        peer.send(JSON.stringify({ type: 'transferComplete', payload: { fileName: file.name, msgId } }));
                        trackFileTransfer(file.name, file.size, file.type, 'sent');
                        pendingFilesRef.current.delete(msgId);
                    }
                } catch (err) { updateMessage(msgId, { fileStatus: 'error' }); }
            };
            const readNextChunk = () => { const slice = file.slice(offset, offset + chunkSize); reader.readAsArrayBuffer(slice); };
            readNextChunk();
        } catch (err) { updateMessage(msgId, { fileStatus: 'error' }); }
    }, [peer, updateMessage]);

    // Auto-Flush
    useEffect(() => {
        if (isConnected && peer && !peer.destroyed && pendingFilesRef.current.size > 0) {
            pendingFilesRef.current.forEach((file, msgId) => {
                updateMessage(msgId, { fileStatus: 'sending' });
                processSendFile(file, msgId);
            });
        }
    }, [isConnected, peer, processSendFile, updateMessage]);

    // --- Handlers ---
    const handleSendStaged = () => {
        if (stagedFiles.length === 0) return;

        let needsAuth = false;
        stagedFiles.forEach(file => {
            const msgId = Date.now().toString() + Math.random().toString().slice(2);
            addMessage({
                id: msgId,
                sender: 'me',
                type: 'file',
                content: { name: file.name, size: file.size, type: file.type },
                timestamp: Date.now(),
                fileStatus: 'sending',
                progress: 0,
                fileData: { name: file.name, size: file.size, mimeType: file.type }
            });
            pendingFilesRef.current.set(msgId, file);
            if (isConnected) processSendFile(file, msgId);
            else needsAuth = true;
        });

        setStagedFiles([]);
        if (needsAuth) onConnectRequest();
    };

    const handleSendText = () => {
        if (!inputValue.trim()) return;
        const text = inputValue.trim();
        setInputValue("");
        addMessage({ id: Date.now().toString(), sender: 'me', type: 'text', content: text, timestamp: Date.now() });
        if (isConnected && peer && !peer.destroyed) {
            try { peer.send(JSON.stringify({ type: 'chat-text', payload: text })); } catch (e) { }
        }
    };

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
            toast({
                title: 'File Expired',
                description: 'We do not store files on servers. Please ask the sender to come online and resend it.',
                variant: 'destructive'
            });
        }
    };

    // Peer Data & Render Helpers... (Omitting full copy if unchanged, but providing full file to be safe)
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
            if (type === 'transferStart') {
                currentTransferRef.current = { fileName: payload.fileName, fileSize: payload.fileSize, receivedSize: 0, chunks: [] };
                currentMsgIdRef.current = payload.msgId || Date.now().toString();
                addMessage({ id: currentMsgIdRef.current!, sender: 'peer', type: 'file', content: { name: payload.fileName, size: payload.fileSize, type: payload.fileType }, timestamp: Date.now(), fileStatus: 'receiving', progress: 0, fileData: { name: payload.fileName, size: payload.fileSize, mimeType: payload.fileType } });
                return;
            }
            if (type === 'transferComplete') {
                if (currentTransferRef.current && currentMsgIdRef.current) {
                    try {
                        const fileType = (currentTransferRef.current as any).fileType || 'application/octet-stream';
                        const blob = new Blob(currentTransferRef.current.chunks, { type: fileType });
                        const url = URL.createObjectURL(blob);
                        updateMessage(currentMsgIdRef.current, { fileStatus: 'received', progress: 100, fileData: { name: payload.fileName, size: 0, mimeType: fileType, blobUrl: url } });
                        currentTransferRef.current = null;
                        currentMsgIdRef.current = null;
                    } catch (e) { }
                }
                return;
            }
            if (type === 'chat-text') {
                addMessage({ id: Date.now().toString(), sender: 'peer', type: 'text', content: payload, timestamp: Date.now() });
            }
            return;
        }
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
            peer.on('data', handlePeerData);
            return () => { peer.off('data', handlePeerData); };
        }
    }, [peer, handlePeerData]);


    return (
        <div className="flex flex-col h-full bg-background relative"
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setIsDragOver(false); if (e.dataTransfer.files?.length) setStagedFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)]); }}
        >
            {isDragOver && (
                <div className="absolute inset-0 z-50 bg-background/90 flex items-center justify-center border-4 border-dashed border-primary m-4 rounded-3xl">
                    <p className="text-xl font-bold text-primary animate-bounce">Drop Files Here</p>
                </div>
            )}

            {/* TOP PANEL - Strict Request */}
            <div className="flex-none p-4 border-b bg-muted/20 space-y-4">

                {/* 1. Enter Receive Code Area (Only if Disconnected) */}
                {!isConnected && (
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Input
                                placeholder="Enter Receive Code"
                                className="pl-9 font-mono uppercase"
                                maxLength={5}
                                value={joinInput}
                                onChange={(e) => setJoinInput(e.target.value.toUpperCase())}
                            />
                            <Link className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        </div>
                        <Button
                            onClick={() => onJoinCode(joinInput)}
                            disabled={joinInput.length !== 5}
                        >
                            Connect
                        </Button>
                    </div>
                )}

                {/* 2. Upload File Area */}
                {/* Logic: If files staged, show Send Button. Else show Upload Box. */}
                {stagedFiles.length > 0 ? (
                    <div className="bg-background border rounded-xl p-3 shadow-sm animate-in fade-in">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="font-semibold text-sm">Selected Files ({stagedFiles.length})</h3>
                            <Button onClick={handleSendStaged} className="gap-2">
                                <Send className="w-4 h-4" />
                                {isConnected ? 'Send Now' : 'Send'}
                            </Button>
                        </div>
                        <div className="flex gap-2 overflow-x-auto">
                            {stagedFiles.map((f, i) => (
                                <div key={i} className="flex flex-col items-center bg-muted p-2 rounded w-24 shrink-0 relative">
                                    <FileIcon className="w-6 h-6 mb-1 text-primary" />
                                    <span className="text-[10px] truncate w-full text-center">{f.name}</span>
                                    <button className="absolute -top-1 -right-1 bg-background rounded-full border" onClick={() => setStagedFiles(s => s.filter((_, idx) => idx !== i))}><X className="w-3 h-3" /></button>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-muted-foreground/20 rounded-xl p-6 flex flex-col items-center justify-center text-muted-foreground hover:bg-muted/30 hover:border-primary/50 cursor-pointer transition-colors"
                    >
                        <UploadCloud className="w-8 h-8 mb-2 opacity-50" />
                        <p className="text-sm font-medium">Click to Upload Files</p>
                        <p className="text-xs opacity-70">or drag and drop</p>
                    </div>
                )}

                <input
                    type="file" multiple className="hidden" ref={fileInputRef}
                    onChange={(e) => { if (e.target.files) setStagedFiles(prev => [...prev, ...Array.from(e.target.files!)]); e.target.value = ''; }}
                />
            </div>

            {/* Middle: Chat History */}
            <ScrollArea className="flex-1 px-3 py-4">
                <div className="max-w-3xl mx-auto space-y-4">
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${msg.sender === 'me' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                                }`}>
                                {msg.type === 'text' && <p>{msg.content as string}</p>}
                                {msg.type === 'file' && (
                                    <div className="flex items-center gap-3 min-w-[200px]">
                                        <FileIcon className="w-5 h-5" />
                                        <div className="flex-1 overflow-hidden">
                                            <p className="truncate text-sm font-medium">{(msg.content as FileDetails).name}</p>
                                            <p className="text-xs opacity-80">{formatBytes((msg.content as FileDetails).size)}</p>
                                            {(msg.fileStatus === 'sending' || msg.fileStatus === 'receiving') && <Progress value={msg.progress} className="h-1 mt-1 bg-background/20" />}
                                            {msg.sender === 'peer' && msg.fileStatus === 'received' && (
                                                <Button size="sm" variant="secondary" className="h-6 text-[10px] mt-2 w-full" onClick={() => handleDownload(msg)}>Download</Button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>
            </ScrollArea>

            {/* Bottom: Text Input Only */}
            <div className="p-3 border-t bg-background">
                <div className="flex gap-2 max-w-3xl mx-auto">
                    <Input
                        placeholder="Type a message..."
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
                    />
                    <Button onClick={handleSendText} disabled={!inputValue.trim()}>
                        <Send className="w-4 h-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
