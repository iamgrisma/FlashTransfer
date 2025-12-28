"use client";

import { useState, useRef, useCallback, useEffect } from 'react';
import Peer from 'simple-peer';
import FileUpload from '@/components/file-upload';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { File as FileIcon, Upload, Download, Check, Loader, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { trackFileTransfer, formatBytes } from '@/lib/analytics';
import type { FileDetails, ScannedFile } from '@/lib/types';

interface TransferPanelProps {
    peer: Peer.Instance;
    connectionCode: string;
    isInitiator: boolean;
    initialFiles?: File[];
}

type FileTransferProgress = {
    [fileName: string]: number;
};

export default function TransferPanel({ peer, connectionCode, isInitiator, initialFiles = [] }: TransferPanelProps) {
    const [outgoingFiles, setOutgoingFiles] = useState<File[]>(initialFiles);
    const [incomingFiles, setIncomingFiles] = useState<ScannedFile[]>([]);
    const [selectedIncoming, setSelectedIncoming] = useState<string[]>([]);
    const [sendProgress, setSendProgress] = useState<FileTransferProgress>({});
    const [receiveProgress, setReceiveProgress] = useState<FileTransferProgress>({});

    const { toast } = useToast();
    const currentTransferRef = useRef<{
        fileName: string;
        fileSize: number;
        receivedSize: number;
        chunks: any[];
    } | null>(null);
    const downloadQueueRef = useRef<string[]>([]);

    // Initial sync and handshake
    useEffect(() => {
        if (peer && !peer.destroyed) {
            if (initialFiles.length > 0) {
                // Sender logic: Wait for request or just send update
                // We'll send update immediately just in case, but also listen for requests
                const fileDetails: FileDetails[] = initialFiles.map(f => ({
                    name: f.name,
                    size: f.size,
                    type: f.type
                }));

                try {
                    peer.send(JSON.stringify({
                        type: 'fileDetails',
                        payload: fileDetails
                    }));
                } catch (err) {
                    console.error('Failed to sync initial files:', err);
                }
            }

            if (!isInitiator) {
                // Receiver logic: Request file list immediately on connection
                setTimeout(() => {
                    try {
                        console.log('Requesting file list from host...');
                        peer.send(JSON.stringify({ type: 'requestFileList' }));
                    } catch (err) {
                        console.error('Failed to request file list:', err);
                    }
                }, 500);
            }
        }
    }, [peer, initialFiles, isInitiator]);

    // Send file to peer
    const sendFile = useCallback((file: File) => {
        const chunkSize = 256 * 1024; // 256KB chunks (faster)
        let offset = 0;

        if (!peer || peer.destroyed) {
            toast({ title: 'Error', description: 'Not connected to peer', variant: 'destructive' });
            return;
        }

        try {
            // Send transfer start signal
            peer.send(JSON.stringify({
                type: 'transferStart',
                payload: { fileName: file.name, fileSize: file.size, fileType: file.type }
            }));

            const reader = new FileReader();

            reader.onload = (e) => {
                if (peer.destroyed || !e.target?.result) return;

                try {
                    peer.send(e.target.result as ArrayBuffer);
                    offset += (e.target.result as ArrayBuffer).byteLength;

                    const progress = Math.min((offset / file.size) * 100, 100);
                    setSendProgress(prev => ({ ...prev, [file.name]: progress }));

                    if (offset < file.size) {
                        readNextChunk();
                    } else {
                        peer.send(JSON.stringify({
                            type: 'transferComplete',
                            payload: { fileName: file.name }
                        }));
                        trackFileTransfer(file.name, file.size, file.type, 'sent');
                    }
                } catch (err) {
                    console.error('Error sending chunk:', err);
                }
            };

            const readNextChunk = () => {
                if (offset >= file.size || peer.destroyed) return;
                // Reading slice is fast, no need to over-optimize unless using SharedArrayBuffer
                const slice = file.slice(offset, offset + chunkSize);
                reader.readAsArrayBuffer(slice);
            };

            readNextChunk();
        } catch (err) {
            console.error('Failed to send file:', err);
            toast({ title: 'Error', description: 'Failed to send file', variant: 'destructive' });
        }
    }, [peer, toast]);

    // Handle incoming data from peer
    const handlePeerData = useCallback((data: any) => {
        // Handle binary data (file chunks)
        if (data instanceof ArrayBuffer || data instanceof Uint8Array) {
            if (currentTransferRef.current) {
                const chunk = data instanceof Uint8Array ? data : new Uint8Array(data);
                currentTransferRef.current.chunks.push(chunk);
                currentTransferRef.current.receivedSize += chunk.byteLength;

                const { fileName, fileSize } = currentTransferRef.current;
                const progress = Math.min((currentTransferRef.current.receivedSize / fileSize) * 100, 100);
                setReceiveProgress(prev => ({ ...prev, [fileName]: progress }));
            }
            return;
        }

        // Handle JSON signals
        try {
            const message = JSON.parse(data.toString());
            const { type, payload } = message;

            switch (type) {
                case 'fileDetails':
                    // Peer is offering files
                    const newFiles: ScannedFile[] = payload.map((f: FileDetails) => ({
                        ...f,
                        scanStatus: 'unscanned' as const
                    }));
                    setIncomingFiles(prev => [...prev, ...newFiles]);
                    toast({ title: 'Files Available', description: `Peer is sharing ${newFiles.length} file(s)` });
                    break;

                case 'transferStart':
                    currentTransferRef.current = {
                        fileName: payload.fileName,
                        fileSize: payload.fileSize,
                        receivedSize: 0,
                        chunks: []
                    };
                    setReceiveProgress(prev => ({ ...prev, [payload.fileName]: 0 }));
                    break;

                case 'transferComplete':
                    if (currentTransferRef.current && currentTransferRef.current.fileName === payload.fileName) {
                        const file = incomingFiles.find(f => f.name === payload.fileName);
                        if (file) {
                            downloadFile(payload.fileName, currentTransferRef.current.chunks, file.type, file.size);
                        }
                        currentTransferRef.current = null;
                        downloadQueueRef.current.shift();
                        processDownloadQueue();
                    }
                    break;

                case 'requestFileList':
                    // Peer asked for list of available files
                    const fileList: FileDetails[] = outgoingFiles.map(f => ({
                        name: f.name,
                        size: f.size,
                        type: f.type
                    }));
                    if (fileList.length > 0) {
                        peer.send(JSON.stringify({
                            type: 'fileDetails',
                            payload: fileList
                        }));
                    }
                    break;

                case 'requestFile':
                    // Peer is requesting a file we offered
                    const fileToSend = outgoingFiles.find(f => f.name === payload.fileName);
                    if (fileToSend) {
                        sendFile(fileToSend);
                    }
                    break;
            }
        } catch (err) {
            // Not JSON, ignore
        }
    }, [incomingFiles, outgoingFiles, sendFile, toast]);

    // Setup peer event listeners
    useEffect(() => {
        if (peer && !peer.destroyed) {
            peer.on('data', handlePeerData);

            return () => {
                if (peer && !peer.destroyed) {
                    peer.off('data', handlePeerData);
                }
            };
        }
    }, [peer, handlePeerData]);

    // Download file
    const downloadFile = useCallback((
        fileName: string,
        chunks: any[],
        fileType: string,
        fileSize: number
    ) => {
        try {
            const blob = new Blob(chunks, { type: fileType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            setReceiveProgress(prev => ({ ...prev, [fileName]: 100 }));
            trackFileTransfer(fileName, fileSize, fileType, 'received');
            toast({ title: 'Download Complete', description: `${fileName} saved successfully` });
        } catch (err) {
            console.error('Failed to download file:', err);
            toast({ title: 'Error', description: 'Failed to save file', variant: 'destructive' });
        }
    }, [toast]);

    // Process download queue
    const processDownloadQueue = useCallback(() => {
        if (peer && !peer.destroyed && peer.connected && downloadQueueRef.current.length > 0) {
            const nextFile = downloadQueueRef.current[0];
            peer.send(JSON.stringify({
                type: 'requestFile',
                payload: { fileName: nextFile }
            }));
        }
    }, [peer]);

    // Handle file upload
    const handleFileSelect = useCallback((selectedFiles: FileList) => {
        const newFiles = Array.from(selectedFiles);
        setOutgoingFiles(prev => [...prev, ...newFiles]);

        // Notify peer about new files
        if (peer && peer.connected) {
            const fileDetails: FileDetails[] = newFiles.map(f => ({
                name: f.name,
                size: f.size,
                type: f.type
            }));
            peer.send(JSON.stringify({
                type: 'fileDetails',
                payload: fileDetails
            }));
        }
    }, [peer]);

    // Send selected outgoing files
    const sendSelected = useCallback(() => {
        outgoingFiles.forEach(file => {
            if (!sendProgress[file.name] || sendProgress[file.name] === 100) {
                sendFile(file);
            }
        });
    }, [outgoingFiles, sendProgress, sendFile]);

    // Download selected incoming files
    const downloadSelected = useCallback(() => {
        const filesToDownload = selectedIncoming.filter(
            name => !downloadQueueRef.current.includes(name)
        );
        downloadQueueRef.current.push(...filesToDownload);
        processDownloadQueue();
    }, [selectedIncoming, processDownloadQueue]);

    // Remove outgoing file
    const removeOutgoingFile = (fileName: string) => {
        setOutgoingFiles(prev => prev.filter(f => f.name !== fileName));
        setSendProgress(prev => {
            const newProgress = { ...prev };
            delete newProgress[fileName];
            return newProgress;
        });
    };

    return (
        <Card className="w-full max-w-4xl">
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle className="font-headline">File Transfer</CardTitle>
                    <Badge variant="outline" className="font-mono">{connectionCode}</Badge>
                </div>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue={isInitiator ? "send" : "receive"} className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="send">
                            <Upload className="mr-2 h-4 w-4" />
                            Sending ({outgoingFiles.length})
                        </TabsTrigger>
                        <TabsTrigger value="receive">
                            <Download className="mr-2 h-4 w-4" />
                            Receiving ({incomingFiles.length})
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="send" className="space-y-4 mt-4">
                        <FileUpload onFileSelect={handleFileSelect} isSessionActive={true} />

                        {outgoingFiles.length > 0 && (
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <h3 className="font-medium">Files to Send</h3>
                                </div>

                                <div className="space-y-2 max-h-96 overflow-y-auto">
                                    {outgoingFiles.map(file => {
                                        const progress = sendProgress[file.name] || 0;
                                        return (
                                            <div key={file.name} className="flex items-center gap-3 p-3 border rounded-lg">
                                                <FileIcon className="h-8 w-8 text-primary flex-shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium truncate">{file.name}</p>
                                                    <p className="text-sm text-muted-foreground">{formatBytes(file.size)}</p>
                                                    {progress > 0 && progress < 100 && (
                                                        <Progress value={progress} className="h-2 mt-1" />
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {progress === 100 ? (
                                                        <Check className="h-5 w-5 text-green-500" />
                                                    ) : progress > 0 ? (
                                                        <span className="text-sm font-medium text-primary">{Math.round(progress)}%</span>
                                                    ) : (
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            onClick={() => removeOutgoingFile(file.name)}
                                                            aria-label={`Remove ${file.name}`}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="receive" className="space-y-4 mt-4">
                        {incomingFiles.length === 0 ? (
                            <div className="text-center p-8 text-muted-foreground">
                                <Download className="mx-auto h-12 w-12 mb-2 opacity-50" />
                                <p>No files available yet</p>
                                <p className="text-sm">Waiting for peer to share files...</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <h3 className="font-medium">Available Files</h3>
                                    <Button
                                        onClick={downloadSelected}
                                        disabled={selectedIncoming.length === 0}
                                        size="sm"
                                    >
                                        <Download className="mr-2 h-4 w-4" />
                                        Download Selected ({selectedIncoming.length})
                                    </Button>
                                </div>

                                <div className="space-y-2 max-h-96 overflow-y-auto">
                                    {incomingFiles.map(file => {
                                        const progress = receiveProgress[file.name] || 0;
                                        const isSelected = selectedIncoming.includes(file.name);

                                        return (
                                            <div key={file.name} className="flex items-center gap-3 p-3 border rounded-lg">
                                                <Checkbox
                                                    checked={isSelected}
                                                    aria-label={`Select ${file.name} for download`}
                                                    onCheckedChange={(checked) => {
                                                        if (checked) {
                                                            setSelectedIncoming(prev => [...prev, file.name]);
                                                        } else {
                                                            setSelectedIncoming(prev => prev.filter(n => n !== file.name));
                                                        }
                                                    }}
                                                />
                                                <FileIcon className="h-8 w-8 text-primary flex-shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium truncate">{file.name}</p>
                                                    <p className="text-sm text-muted-foreground">{formatBytes(file.size)}</p>
                                                    {progress > 0 && progress < 100 && (
                                                        <Progress value={progress} className="h-2 mt-1" />
                                                    )}
                                                </div>
                                                <div>
                                                    {progress === 100 ? (
                                                        <Check className="h-5 w-5 text-green-500" />
                                                    ) : progress > 0 ? (
                                                        <Loader className="h-5 w-5 animate-spin text-primary" />
                                                    ) : null}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}
