
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import FileUpload from '@/components/file-upload';
import SharePanel from '@/components/share-panel';
import { Send, Link as LinkIcon } from 'lucide-react';
import type { FileDetails } from '@/lib/types';
import { createClient } from '@/lib/supabase';
import Peer from 'simple-peer';
import { Button } from '@/components/ui/button';

export default function Home() {
  const [fileDetails, setFileDetails] = useState<FileDetails | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [shareLink, setShareLink] = useState('');
  const [shortCode, setShortCode] = useState('');
  const router = useRouter();

  const handleFileSelect = (file: File) => {
    const fileInfo = {
      name: file.name,
      size: file.size,
      type: file.type,
    };
    setFileDetails(fileInfo);
    setIsUploading(true);

    const supabase = createClient();
    const peer = new Peer({ initiator: true, trickle: false });
    let shareId: string;

    const generateShortCode = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let result = '';
      for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    }

    peer.on('signal', async (offer) => {
      if (peer.initiator) {
        const generatedCode = generateShortCode();
        setShortCode(generatedCode);

        const { data, error } = await supabase
          .from('fileshare')
          .insert([{ p2p_offer: JSON.stringify(offer), short_code: generatedCode }])
          .select('id')
          .single();

        if (error || !data) {
          console.error('Error creating share session:', error);
          return;
        }
        shareId = data.id;
        setShareLink(`${window.location.origin}/${shareId}`);

        const channel = supabase
          .channel(`fileshare-${shareId}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'fileshare',
              filter: `id=eq.${shareId}`,
            },
            (payload) => {
              const { p2p_answer } = payload.new as { p2p_answer: string };
              if (p2p_answer && !peer.destroyed) {
                peer.signal(JSON.parse(p2p_answer));
                channel.unsubscribe();
              }
            }
          )
          .subscribe();
      }
    });

    peer.on('connect', () => {
      console.log('Peer connected!');
      setIsUploading(false);

      peer.send(JSON.stringify({ type: 'fileDetails', payload: fileInfo }));
      
      const chunkSize = 64 * 1024;
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
              if (!peer.destroyed) {
                readSlice();
              }
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
  };

  const handleReset = () => {
    setFileDetails(null);
    setIsUploading(false);
    setUploadProgress(0);
    setShareLink('');
    setShortCode('');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 selection:bg-primary/20">
      <header className="absolute top-0 left-0 w-full p-4 md:p-6">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Send className="text-primary h-7 w-7" />
            <h1 className="text-2xl font-bold font-headline text-foreground">FileZen</h1>
          </div>
          <Button variant="ghost" onClick={() => router.push('/join')}>
            <LinkIcon className="mr-2" />
            Enter Code
          </Button>
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
            shortCode={shortCode}
          />
        )}
      </main>
    </div>
  );
}
