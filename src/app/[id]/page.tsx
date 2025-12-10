'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Peer from 'simple-peer';
import { createClient } from '@/lib/supabase';
import { FileDetails } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, File as FileIcon, Loader } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';

export default function DownloadPage() {
  const params = useParams();
  const shareId = params.id as string;
  const supabase = createClient();

  const [fileDetails, setFileDetails] = useState<FileDetails | null>(null);
  const [status, setStatus] = useState('Connecting...');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [fileChunks, setFileChunks] = useState<any[]>([]);
  const [receivedSize, setReceivedSize] = useState(0);

  useEffect(() => {
    if (!shareId) return;

    const peer = new Peer({
      initiator: false,
      trickle: false,
    });

    const fetchOffer = async () => {
      const { data, error } = await supabase
        .from('fileshare')
        .select('p2p_offer')
        .eq('id', shareId)
        .single();
      
      if (error || !data || !data.p2p_offer) {
        setError('Invalid or expired share link.');
        console.error('Error fetching offer:', error);
        return;
      }
      
      peer.signal(JSON.parse(data.p2p_offer));
    };

    fetchOffer();

    peer.on('signal', async (signalData) => {
      await supabase
        .from('fileshare')
        .update({ p2p_answer: JSON.stringify(signalData) })
        .eq('id', shareId);
    });

    peer.on('connect', () => {
      setStatus('Waiting for file details...');
    });
    
    let totalSize = 0;

    peer.on('data', (chunk) => {
      try {
        const data = JSON.parse(chunk.toString());
        if (data.type === 'fileDetails') {
          const details = data.payload as FileDetails;
          setFileDetails(details);
          totalSize = details.size;
          setStatus('Ready to download');
        } else if (data.type === 'transferComplete') {
            setStatus('Download complete!');
            setDownloadProgress(100);
            const fileBlob = new Blob(fileChunks, { type: fileDetails?.type });
            const url = URL.createObjectURL(fileBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileDetails?.name || 'download';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
      } catch (e) {
        // This is a file chunk
        const newReceivedSize = receivedSize + chunk.byteLength;
        setReceivedSize(newReceivedSize);
        setFileChunks(prev => [...prev, chunk]);
        if (totalSize > 0) {
          const progress = Math.min((newReceivedSize / totalSize) * 100, 100);
          setDownloadProgress(progress);
        }
        setStatus('Downloading...');
      }
    });

    peer.on('close', () => {
      if (downloadProgress < 100) {
        setStatus('Sender disconnected.');
        setError('The connection was closed before the transfer could complete.');
      }
    });

    peer.on('error', (err) => {
      console.error('Peer error', err);
      setError('A connection error occurred.');
      setStatus('Error');
    });

    return () => {
      peer.destroy();
    };
  }, [shareId, supabase]);

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-lg shadow-lg">
        <CardHeader>
          <CardTitle>Download File</CardTitle>
          <CardDescription>{status}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && <p className="text-destructive text-center">{error}</p>}
          
          {!fileDetails && !error && (
            <div className="flex flex-col items-center justify-center space-y-4 p-10">
              <Loader className="h-12 w-12 text-primary animate-spin" />
              <p>Connecting to sender...</p>
            </div>
          )}

          {fileDetails && (
            <div>
              <div className="flex items-center space-x-4 p-4 rounded-md border bg-secondary/50 mb-6">
                <FileIcon className="h-8 w-8 text-primary" />
                <div className="flex-1 overflow-hidden">
                  <p className="text-sm font-medium truncate text-foreground">{fileDetails.name}</p>
                  <p className="text-sm text-muted-foreground">{formatBytes(fileDetails.size)}</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                    <Label htmlFor="download-progress">{status}</Label>
                    <span className="text-sm font-medium text-primary">{Math.round(downloadProgress)}%</span>
                </div>
                <Progress id="download-progress" value={downloadProgress} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
