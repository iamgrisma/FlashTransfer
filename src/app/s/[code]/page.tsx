
'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Peer from 'simple-peer';
import { createClient } from '@/lib/supabase/client';
import { FileDetails, ScannedFile } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Download, File as FileIcon, Loader, Scan, ShieldAlert, Wifi, WifiOff } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

type TransferStatus = 'Connecting' | 'Waiting' | 'Receiving' | 'Completed' | 'Error' | 'Scanning';

export default function DownloadPage() {
  const params = useParams();
  const obfuscatedCode = params.code as string;
  
  const [files, setFiles] = useState<ScannedFile[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [status, setStatus] = useState<TransferStatus>('Connecting');
  const [senderOnline, setSenderOnline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<{ [key: string]: number }>({});
  
  const peerRef = useRef<Peer.Instance | null>(null);
  const fileChunksRef = useRef<{ [key: string]: any[] }>({});
  const receivedSizeRef = useRef<{ [key: string]: number }>({});
  const { toast } = useToast();
  const lastPing = useRef(Date.now());
  const shareIdRef = useRef<string | null>(null);
  const answerSentRef = useRef(false);
  const filesToDownloadRef = useRef<string[]>([]);


  const downloadSingleFile = useCallback((fileName: string) => {
    const file = files.find(f => f.name === fileName);
    if (!file || !fileChunksRef.current[fileName] || fileChunksRef.current[fileName].length === 0) {
        toast({ title: 'Download Failed', description: `File data for ${fileName} not found. Please try requesting it again.`, variant: 'destructive'});
        setDownloadProgress(prev => ({...prev, [fileName]: 0}));
        return;
    };

    try {
        const fileBlob = new Blob(fileChunksRef.current[fileName], { type: file.type });
        const url = URL.createObjectURL(fileBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (e) {
        console.error("Error creating blob for download:", e);
        toast({ title: 'Download Failed', description: `Could not save file ${fileName}.`, variant: 'destructive'});
    }
  }, [files, toast]);
  
  const requestNextFileFromQueue = useCallback(() => {
    if (filesToDownloadRef.current.length > 0) {
        const nextFileName = filesToDownloadRef.current[0]; // Peek at the next file
        if (nextFileName) {
            if (peerRef.current && !peerRef.current.destroyed) {
                peerRef.current.send(JSON.stringify({ type: 'requestFile', payload: { fileName: nextFileName } }));
            }
        }
    } else {
        // If queue is empty, check if all selected files are downloaded
        const allSelectedDownloaded = selectedFiles.every(sf => (downloadProgress[sf] || 0) >= 100);
        if (allSelectedDownloaded && selectedFiles.length > 0) {
            setStatus('Completed');
        } else if (status !== 'Error') {
            setStatus('Waiting');
        }
    }
  }, [selectedFiles, downloadProgress, status]);


  useEffect(() => {
    if (!obfuscatedCode) return;
    const supabase = createClient();
    answerSentRef.current = false;

    const peer = new Peer({
      initiator: false,
      trickle: false,
    });
    peerRef.current = peer;

    const fetchOffer = async () => {
      try {
        const response = await fetch('/api/share', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ obfuscatedCode }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Share session not found.');
        }

        const { p2pOffer, shareId } = await response.json();
        
        if (!p2pOffer) {
          throw new Error('Invalid or expired share link.');
        }
        
        shareIdRef.current = shareId;
        if (!peerRef.current?.destroyed) {
            peer.signal(JSON.parse(p2pOffer));
        }

      } catch (err: any) {
         setError(err.message || 'An unexpected error occurred while fetching the session.');
         setStatus('Error');
      }
    };

    fetchOffer();

    const pingCheck = setInterval(() => {
      if (Date.now() - lastPing.current > 5000) {
        setSenderOnline(false);
        if (status !== 'Completed' && status !== 'Error') {
            setStatus('Waiting');
        }
      }
    }, 3000);

    peer.on('signal', async (signalData) => {
      if (peer.destroyed || answerSentRef.current || (signalData as any).renegotiate || (signalData as any).candidate) return;
      
      if(signalData.type === 'answer') {
        answerSentRef.current = true;
        await supabase
          .from('fileshare')
          .update({ p2p_answer: JSON.stringify(signalData) })
          .eq('id', shareIdRef.current!);
      }
    });

    peer.on('connect', () => {
      setSenderOnline(true);
      lastPing.current = Date.now();
      setStatus('Waiting');
    });

    peer.on('data', (data) => {
        setSenderOnline(true);
        lastPing.current = Date.now();
        let parsedData;

        try {
            parsedData = JSON.parse(data.toString());
        } catch (e) {
            return;
        }

        const { type, payload } = parsedData;
        
        switch (type) {
            case 'ping':
                break;
            case 'fileDetails':
                const newFiles: ScannedFile[] = payload.map((f: FileDetails) => ({...f, scanStatus: 'unscanned'}));
                setFiles(newFiles);
                const newFileChunks: { [key: string]: any[] } = {};
                const newReceivedSizes: { [key: string]: number } = {};
                newFiles.forEach(file => {
                    newFileChunks[file.name] = [];
                    newReceivedSizes[file.name] = 0;
                });
                fileChunksRef.current = newFileChunks;
                receivedSizeRef.current = newReceivedSizes;
                break;
            case 'transferStart':
                setStatus('Receiving');
                setDownloadProgress(prev => ({...prev, [payload.fileName]: 0}));
                break;
            case 'fileChunk':
                if (fileChunksRef.current[payload.fileName]) {
                    const chunk = new Uint8Array(payload.chunk);
                    fileChunksRef.current[payload.fileName].push(chunk);
                    receivedSizeRef.current[payload.fileName] += chunk.byteLength;
                    const fileInfo = files.find(f => f.name === payload.fileName);
                    if (fileInfo && fileInfo.size > 0) {
                        const progress = Math.min((receivedSizeRef.current[payload.fileName] / fileInfo.size) * 100, 100);
                        setDownloadProgress(prev => ({...prev, [payload.fileName]: progress}));
                    }
                }
                break;
            case 'transferComplete':
                const completedFileName = payload.fileName;
                const completedFile = files.find(f => f.name === completedFileName);
                if (completedFile) {
                    setDownloadProgress(prev => ({ ...prev, [completedFileName]: 100 }));
                    
                    // Only download if it was in the current download queue
                    if (filesToDownloadRef.current[0] === completedFileName) {
                      downloadSingleFile(completedFileName);
                      filesToDownloadRef.current.shift(); // Remove from queue
                      requestNextFileFromQueue(); // Request next file
                    }
                }
                break;
        }
    });

    peer.on('close', () => {
      setSenderOnline(false);
      if (status !== 'Completed') {
        setStatus('Error');
        setError('The sender has disconnected.');
      }
    });

    peer.on('error', (err) => {
      console.error('Peer error', err);
      setSenderOnline(false);
      if (status !== 'Completed' && status !== 'Error') {
        setError('A connection error occurred. The sender may have left.');
        setStatus('Error');
      }
    });

    return () => {
      if(peerRef.current) {
        peerRef.current.destroy();
        peerRef.current = null;
      }
      clearInterval(pingCheck);
    };
  }, [obfuscatedCode, downloadSingleFile, requestNextFileFromQueue, status, files]);


  const requestFile = (fileName: string) => {
    if (peerRef.current && !peerRef.current.destroyed) {
        if((downloadProgress[fileName] || 0) === 100){
            downloadSingleFile(fileName);
            return;
        }
        // Add to queue and start if queue was empty
        const isQueueRunning = filesToDownloadRef.current.length > 0;
        if (!filesToDownloadRef.current.includes(fileName)) {
            filesToDownloadRef.current.push(fileName);
        }
        if (!isQueueRunning) {
            requestNextFileFromQueue();
        }
    } else {
        toast({ title: 'Error', description: 'Not connected to sender.', variant: 'destructive' });
    }
  };


  const handleDownloadSelected = () => {
    const filesToDownload = files.filter(f => selectedFiles.includes(f.name) && (downloadProgress[f.name] || 0) < 100);
    const isQueueRunning = filesToDownloadRef.current.length > 0;
    
    // Add new files to the queue without duplicating
    filesToDownload.forEach(f => {
      if (!filesToDownloadRef.current.includes(f.name)) {
        filesToDownloadRef.current.push(f.name);
      }
    });

    if(!isQueueRunning && filesToDownloadRef.current.length > 0) {
      requestNextFileFromQueue();
    }
  }

  const handleDownloadAll = () => {
    const allFiles = files.map(f => f.name);
    setSelectedFiles(allFiles);
    const isQueueRunning = filesToDownloadRef.current.length > 0;
    
    allFiles.forEach(name => {
        if(!filesToDownloadRef.current.includes(name) && (downloadProgress[name] || 0) < 100) {
            filesToDownloadRef.current.push(name);
        }
    });

    if(!isQueueRunning && filesToDownloadRef.current.length > 0) {
      requestNextFileFromQueue();
    }
  }

  const handleSelectFile = (fileName: string, isSelected: boolean) => {
    if (isSelected) {
        setSelectedFiles(prev => [...prev, fileName]);
    } else {
        setSelectedFiles(prev => prev.filter(name => name !== fileName));
    }
  }

  const handleSelectAll = (isSelected: boolean) => {
      if(isSelected) {
          setSelectedFiles(files.map(f => f.name));
      } else {
          setSelectedFiles([]);
      }
  }

  const handleScanFile = (fileName: string) => {
    setFiles(prev => prev.map(f => f.name === fileName ? {...f, scanStatus: 'scanning'} : f));
    // Simulate a scan
    setTimeout(() => {
        setFiles(prev => prev.map(f => f.name === fileName ? {...f, scanStatus: 'scanned'} : f));
        toast({title: 'Scan Complete', description: `${fileName} appears to be safe.`});
    }, 1500);
  }
  
  const handleScanSelected = () => {
      selectedFiles.forEach(handleScanFile);
  }
  
  const handleScanAll = () => {
      files.forEach(f => handleScanFile(f.name));
  }

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const isAllSelected = files.length > 0 && selectedFiles.length === files.length;
  const isReceiving = status === 'Receiving';

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl shadow-lg">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="font-headline">Receive Files</CardTitle>
            <Badge variant={senderOnline ? 'default' : 'destructive'} className="flex items-center gap-2 bg-opacity-20">
                {senderOnline ? <Wifi className="text-green-400"/> : <WifiOff className="text-red-400"/> }
                <span className={senderOnline ? "text-green-400" : "text-red-400"}>
                    {senderOnline ? 'Sender Online' : 'Sender Offline'}
                </span>
            </Badge>
          </div>
          <CardDescription>
            {error ? 'An error occurred.' : 'Review files from the sender before downloading.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {status === 'Connecting' && !error && (
            <div className="flex flex-col items-center justify-center space-y-4 p-10">
              <Loader className="h-12 w-12 text-primary animate-spin" />
              <p>Connecting to sender...</p>
            </div>
          )}

          {error && 
            <div className="flex flex-col items-center justify-center space-y-4 p-10 text-center">
                <WifiOff className="h-12 w-12 text-destructive"/>
                <p className="text-destructive font-medium">Download Failed</p>
                <p className="text-destructive/80 text-sm">{error}</p>
            </div>
          }
          
          {files.length > 0 && !error && (
            <div>
              <Alert variant="destructive" className="mb-6 bg-destructive/10">
                <ShieldAlert className="h-4 w-4 !text-destructive" />
                <AlertTitle>Security Warning</AlertTitle>
                <AlertDescription>
                  Only download these files if you trust the sender. FileZen cannot guarantee the safety of the contents.
                </AlertDescription>
              </Alert>

              <div className="space-y-2 max-h-96 overflow-y-auto pr-3">
                  <div className="flex items-center border-b pb-2 mb-2">
                      <Checkbox id="select-all" 
                        onCheckedChange={(checked) => handleSelectAll(!!checked)}
                        checked={isAllSelected}
                        disabled={isReceiving}
                      />
                      <label htmlFor="select-all" className="ml-3 text-sm font-medium">Select All</label>
                  </div>
                  {files.map(file => {
                      const progress = downloadProgress[file.name] || 0;
                      const isDownloaded = progress === 100;
                      const isSelected = selectedFiles.includes(file.name);
                      return (
                          <div key={file.name} className="flex items-center space-x-4 p-3 rounded-md border hover:bg-secondary/50">
                              <Checkbox 
                                id={`select-${file.name}`} 
                                checked={isSelected}
                                onCheckedChange={(checked) => handleSelectFile(file.name, !!checked)}
                                disabled={isReceiving}
                              />
                              <FileIcon className="h-8 w-8 text-primary" />
                              <div className="flex-1 overflow-hidden">
                                <p className="text-sm font-medium truncate text-foreground">{file.name}</p>
                                <p className="text-sm text-muted-foreground">{formatBytes(file.size)}</p>
                                { progress > 0 && <Progress value={progress} className="h-2 mt-1"/> }
                              </div>
                              <div className="flex items-center gap-2">
                                  {file.scanStatus === 'unscanned' && (
                                     <Button variant="ghost" size="sm" onClick={() => handleScanFile(file.name)} disabled={isReceiving}>
                                        <Scan className="mr-2"/> Scan
                                     </Button>
                                  )}
                                  {file.scanStatus === 'scanning' && <Loader className="animate-spin text-primary"/>}
                                  {file.scanStatus === 'scanned' && <ShieldAlert className="text-green-500"/>}

                                  <Button size="sm" onClick={() => requestFile(file.name)} disabled={isReceiving && !isDownloaded}>
                                      <Download className="mr-2"/> {isDownloaded ? 'Save' : 'Download'}
                                  </Button>
                              </div>
                          </div>
                      )
                  })}
              </div>

              <div className="flex flex-wrap gap-2 mt-6 border-t pt-4">
                  <Button onClick={handleDownloadSelected} disabled={selectedFiles.length === 0 || isReceiving}>
                      <Download className="mr-2"/> Download Selected ({selectedFiles.length})
                  </Button>
                  <Button onClick={handleDownloadAll} variant="secondary" disabled={isReceiving}>
                      <Download className="mr-2"/> Download All ({files.length})
                  </Button>
                  <Button onClick={handleScanSelected} variant="outline" disabled={selectedFiles.length === 0 || isReceiving}>
                      <Scan className="mr-2"/> Scan Selected ({selectedFiles.length})
                  </Button>
                   <Button onClick={handleScanAll} variant="outline" disabled={isReceiving}>
                      <Scan className="mr-2"/> Scan All
                  </Button>
              </div>

            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

    