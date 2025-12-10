
"use client";

import { useState } from 'react';
import FileUpload from '@/components/file-upload';
import SharePanel from '@/components/share-panel';
import ReceiveForm from '@/components/receive-form';
import { Send, Download } from 'lucide-react';
import type { FileDetails } from '@/lib/types';
import { createClient } from '@/lib/supabase';
import Peer from 'simple-peer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from '@/hooks/use-toast';

export default function Home() {
  const [fileDetails, setFileDetails] = useState<FileDetails | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [transferProgress, setTransferProgress] = useState(0);
  const [shareLink, setShareLink] = useState('');
  const [shortCode, setShortCode] = useState('');
  const [peer, setPeer] = useState<Peer.Instance | null>(null);
  const { toast } = useToast();


  const handleFileSelect = (file: File) => {
    const fileInfo = {
      name: file.name,
      size: file.size,
      type: file.type,
    };
    setFileDetails(fileInfo);
    setIsConnecting(true);

    const supabase = createClient();
    const newPeer = new Peer({ initiator: true, trickle: false });
    setPeer(newPeer);
    let shareId: string;

    const generateShortCode = () => {
      return Math.floor(100000 + Math.random() * 900000).toString();
    }

    newPeer.on('signal', async (offer) => {
      if (newPeer.initiator) {
        const generatedCode = generateShortCode();
        setShortCode(generatedCode);

        // Set expiration for 1 hour from now
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

        const { data, error } = await supabase
          .from('fileshare')
          .insert([{ p2p_offer: JSON.stringify(offer), short_code: generatedCode, expires_at: expiresAt }])
          .select('id')
          .single();

        if (error || !data) {
          console.error('Error creating share session:', error);
           toast({
            variant: 'destructive',
            title: 'Failed to Create Share',
            description: 'Could not create a new share session. Please ensure RLS policies for `fileshare` table allow inserts.',
          });
          setIsConnecting(false);
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
              if (p2p_answer && !newPeer.destroyed) {
                newPeer.signal(JSON.parse(p2p_answer));
                channel.unsubscribe();
              }
            }
          )
          .subscribe();
      }
    });

    newPeer.on('connect', () => {
      console.log('Peer connected!');
      setIsConnecting(false);

      newPeer.send(JSON.stringify({ type: 'fileDetails', payload: fileInfo }));
      
      const chunkSize = 64 * 1024;
      let offset = 0;

      const readSlice = () => {
        const slice = file.slice(offset, offset + chunkSize);
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result && !newPeer.destroyed) {
            try {
              newPeer.send(e.target.result as ArrayBuffer);
              offset += (e.target.result as ArrayBuffer).byteLength;
              setTransferProgress(Math.min((offset / file.size) * 100, 100));

              if (offset < file.size) {
                  readSlice();
              } else {
                console.log('File sent');
                newPeer.send(JSON.stringify({ type: 'transferComplete' }));
              }
            } catch(err) {
              console.error("Error sending file chunk:", err);
              handleReset();
            }
          }
        };
        reader.readAsArrayBuffer(slice);
      };
      
      readSlice();
    });
    
    newPeer.on('close', () => {
      console.log('Peer disconnected');
      handleReset();
    });

    newPeer.on('error', (err) => {
      console.error('Peer error', err);
      handleReset();
    });
  };

  const handleReset = () => {
    peer?.destroy();
    setPeer(null);
    setFileDetails(null);
    setIsConnecting(false);
    setTransferProgress(0);
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
        </div>
      </header>
      <main className="w-full max-w-lg">
        {fileDetails ? (
          <SharePanel
            fileDetails={fileDetails}
            transferProgress={transferProgress}
            isConnecting={isConnecting}
            onReset={handleReset}
            shareLink={shareLink}
            shortCode={shortCode}
          />
        ) : (
          <Tabs defaultValue="share" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="share"><Send className="mr-2"/>Share File</TabsTrigger>
              <TabsTrigger value="receive"><Download className="mr-2"/>Receive File</TabsTrigger>
            </TabsList>
            <TabsContent value="share" className="mt-6">
              <FileUpload onFileSelect={handleFileSelect} />
            </TabsContent>
            <TabsContent value="receive" className="mt-6">
              <ReceiveForm />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}
