
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import FileUpload from '@/components/file-upload';
import SharePanel from '@/components/share-panel';
import { Send } from 'lucide-react';
import type { FileDetails } from '@/lib/types';
import { createClient } from '@/lib/supabase';
import Peer from 'simple-peer';

export default function Home() {
  const [fileDetails, setFileDetails] = useState<FileDetails | null>(null);
  const [isUploading, setIsUploading] = useState(false); // This will now represent "waiting for connection"
  const [uploadProgress, setUploadProgress] = useState(0); // This will show transfer progress
  const [shareLink, setShareLink] = useState('');
  const router = useRouter();

  const handleFileSelect = async (file: File) => {
    const supabase = createClient();
    const fileDetails = {
      name: file.name,
      size: file.size,
      type: file.type,
    };
    setFileDetails(fileDetails);
    setIsUploading(true); // Indicates we are starting the process

    const peer = new Peer({
      initiator: true,
      trickle: false,
    });

    const { data, error } = await supabase
      .from('fileshare')
      .insert([{}])
      .select('id')
      .single();

    if (error || !data) {
      console.error('Error creating share session', error);
      // Handle error state in UI
      return;
    }
    const shareId = data.id;

    peer.on('signal', async (signalData) => {
      await supabase
        .from('fileshare')
        .update({ offer: JSON.stringify(signalData) })
        .eq('id', shareId);
    });

    const channel = supabase
      .channel(`fileshare-${shareId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'fileshare', filter: `id=eq.${shareId}` },
        (payload) => {
          const { answer } = payload.new;
          if (answer && peer && !peer.destroyed) {
            peer.signal(JSON.parse(answer));
            channel.unsubscribe();
          }
        }
      )
      .subscribe();

    peer.on('connect', () => {
      console.log('Peer connected!');
      setIsUploading(false); // Connection established, ready to send

      peer.send(JSON.stringify({ type: 'fileDetails', payload: fileDetails }));
      
      const chunkSize = 64 * 1024; // 64KB
      let offset = 0;

      const readSlice = () => {
        const slice = file.slice(offset, offset + chunkSize);
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            peer.send(e.target.result as ArrayBuffer);
            offset += (e.target.result as ArrayBuffer).byteLength;
            setUploadProgress(Math.min((offset / file.size) * 100, 100));

            if (offset < file.size) {
              readSlice();
            } else {
              console.log('File sent');
              peer.send(JSON.stringify({ type: 'transferComplete' }));
            }
          }
        };
        reader.readAsArrayBuffer(slice);
      };
      
      readSlice();
    });
    
    peer.on('close', () => {
      console.log('Peer disconnected');
      handleReset();
    });

    peer.on('error', (err) => {
      console.error('Peer error', err);
      handleReset();
    });

    setShareLink(`${window.location.origin}/${shareId}`);
  };

  const handleReset = () => {
    setFileDetails(null);
    setIsUploading(false);
    setUploadProgress(0);
    setShareLink('');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 selection:bg-primary/20">
      <header className="absolute top-0 left-0 w-full p-4 md:p-6">
        <div className="container mx-auto flex items-center gap-3">
          <Send className="text-primary h-7 w-7" />
          <h1 className="text-2xl font-bold font-headline text-foreground">FileZen</h1>
        </div>
      </header>
      <main className="w-full max-w-lg">
        {!fileDetails ? (
          <FileUpload onFileSelect={handleFileSelect} />
        ) : (
          <SharePanel
            fileDetails={fileDetails}
            uploadProgress={uploadProgress}
            isUploading={isUploading}
            onReset={handleReset}
            shareLink={shareLink}
          />
        )}
      </main>
    </div>
  );
}
