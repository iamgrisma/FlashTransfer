"use client";

import { useState, useRef, useCallback, useEffect } from 'react';
import Peer from 'simple-peer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { File as FileIcon, Send, Paperclip, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { trackFileTransfer, formatBytes } from '@/lib/analytics';
import type { FileDetails } from '@/lib/types';
import { ChatMessage, useChatHistory } from '@/hooks/use-chat-history';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ChatInterfaceProps {
    peer: Peer.Instance | null;
    isConnected: boolean;
    historyHook: ReturnType<typeof useChatHistory>;
    onConnectRequest: () => void;
}

export default function ChatInterface({
    peer,
    isConnected,
    historyHook,
    onConnectRequest,
}: ChatInterfaceProps) {
    const { messages, addMessage, updateMessage } = historyHook;
    const [inputValue, setInputValue] = useState("");
    const [stagedFiles, setStagedFiles] = useState<File[]>([]);
    const [isDragOver, setIsDragOver] = useState(false);

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
    
    useEffect(() => {
        if (isConnected && peer && !peer.destroyed && pendingFilesRef.current.size > 0) {
            pendingFilesRef.current.forEach((file, msgId) => {
                updateMessage(msgId, { fileStatus: 'sending' });
                processSendFile(file, msgId);
            });
        }
    }, [isConnected, peer, processSendFile, updateMessage]);

    const handleSendMessage = () => {
        const text = inputValue.trim();
        if (!text && stagedFiles.length === 0) return;

        if (text) {
            addMessage({ id: Date.now().toString(), sender: 'me', type: 'text', content: text, timestamp: Date.now() });
            if (isConnected && peer && !peer.destroyed) {
                try { peer.send(JSON.stringify({ type: 'chat-text', payload: text })); } catch (e) { }
            }
        }
        
        if (stagedFiles.length > 0) {
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
            if (needsAuth) onConnectRequest();
        }

        setInputValue("");
        setStagedFiles([]);
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            setStagedFiles(prev => [...prev, ...Array.from(event.target.files!)]);
        }
    };
    
    const removeStagedFile = (fileToRemove: File) => {
        setStagedFiles(prev => prev.filter(file => file !== fileToRemove));
    };

    const handlePeerData = useCallback((data: any) => {
        // ... (peer data handling logic remains the same)
    }, [addMessage, updateMessage]);

    useEffect(() => {
        if (peer && !peer.destroyed) {
            peer.on('data', handlePeerData);
            return () => { peer.off('data', handlePeerData); };
        }
    }, [peer, handlePeerData]);

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragOver(false);
        if (e.dataTransfer.files?.length) {
            setStagedFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)]);
        }
    };


    return (
        <div className="flex flex-col h-full bg-background relative"
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
        >
            {isDragOver && (
                <div className="absolute inset-0 z-50 bg-background/90 flex items-center justify-center border-4 border-dashed border-primary m-4 rounded-3xl">
                    <p className="text-xl font-bold text-primary animate-bounce">Drop Files Here</p>
                </div>
            )}
            <ScrollArea className="flex-1 px-3 py-4">
                <div className="max-w-3xl mx-auto space-y-4">
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                            {/* ... message rendering logic ... */}
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>
            </ScrollArea>
            <div className="p-3 border-t bg-background">
                <div className="max-w-3xl mx-auto">
                    {stagedFiles.length > 0 && (
                        <div className="mb-2 p-2 border rounded-lg bg-muted/50">
                            <div className="flex gap-2 overflow-x-auto">
                                {stagedFiles.map((file, i) => (
                                    <div key={i} className="flex flex-col items-center bg-background border p-2 rounded w-24 shrink-0 relative">
                                        <FileIcon className="w-6 h-6 mb-1 text-primary" />
                                        <span className="text-[10px] truncate w-full text-center">{file.name}</span>
                                        <button className="absolute -top-1 -right-1 bg-background rounded-full border" onClick={() => removeStagedFile(file)}><X className="w-3 h-3" /></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()}>
                            <Paperclip className="w-5 h-5" />
                        </Button>
                        <input
                            type="file"
                            multiple
                            className="hidden"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                        />
                        <Input
                            placeholder={stagedFiles.length > 0 ? "Add a message... (optional)" : "Type a message..."}
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                        />
                        <Button onClick={handleSendMessage} disabled={!inputValue.trim() && stagedFiles.length === 0}>
                            <Send className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}