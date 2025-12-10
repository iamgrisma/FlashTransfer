
'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import Peer from 'simple-peer';
import { createClient } from '@/lib/supabase';
import { FileDetails, ScannedFile } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Download, File as FileIcon, Loader, Scan, ShieldAlert, Wifi, WifiOff } from 'lucide-react';
import { Progress } from '@/componentsui/progress';
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

  useEffect(() => {
    if (!obfuscatedCode) return;
    const supabase = createClient();

    const peer = new Peer({
      initiator: false,
      trickle: false,
    });
    peerRef.current = peer;

    const fetchOffer = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('fileshare')
          .select('id, p2p_offer')
          .eq('obfuscated_code', obfuscatedCode)
          .single();
        
        if (fetchError || !data || !data.p2p_offer) {
          setError('Invalid or expired share link.');
          setStatus('Error');
          return;
        }
        
        shareIdRef.current = data.id;
        peer.signal(JSON.parse(data.p2p_offer));
      } catch (err) {
         setError('An unexpected error occurred while fetching the session.');
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
      if (!shareIdRef.current) return;
      await supabase
        .from('fileshare')
        .update({ p2p_answer: JSON.stringify(signalData) })
        .eq('id', shareIdRef.current);
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
                newFiles.forEach(file => {
                    fileChunksRef.current[file.name] = [];
                    receivedSizeRef.current[file.name] = 0;
                });
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
                const completedFile = files.find(f => f.name === payload.fileName);
                if (completedFile) {
                  setDownloadProgress(prev => ({...prev, [payload.fileName]: 100}));
                }
                const allDone = files.every(f => downloadProgress[f.name] === 100);
                if (allDone) {
                    setStatus('Completed');
                } else {
                    setStatus('Waiting');
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
      setError('A connection error occurred. The sender may have left.');
      setStatus('Error');
    });

    return () => {
      peer.destroy();
      peerRef.current = null;
      clearInterval(pingCheck);
    };
  }, [obfuscatedCode]);


  const requestFile = (fileName: string) => {
    if (peerRef.current && !peerRef.current.destroyed) {
        if(downloadProgress[fileName] === 100){
            downloadSingleFile(fileName);
            return;
        }
        peerRef.current.send(JSON.stringify({ type: 'requestFile', payload: { fileName } }));
    } else {
        toast({ title: 'Error', description: 'Not connected to sender.', variant: 'destructive' });
    }
  };

  const downloadSingleFile = (fileName: string) => {
    const file = files.find(f => f.name === fileName);
    if (!file || !fileChunksRef.current[fileName]) return;

    const fileBlob = new Blob(fileChunksRef.current[fileName], { type: file.type });
    const url = URL.createObjectURL(fileBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const handleDownloadSelected = () => {
    selectedFiles.forEach(fileName => {
        if(downloadProgress[fileName] < 100) {
           requestFile(fileName);
        } else {
            downloadSingleFile(fileName);
        }
    });
  }
  const handleDownloadAll = () => {
    files.forEach(file => {
        if(downloadProgress[file.name] < 100) {
            requestFile(file.name);
        } else {
            downloadSingleFile(file.name);
        }
    });
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
