
"use client";

import { useState, useEffect, useRef } from 'react';
import FileUpload from '@/components/file-upload';
import SharePanel from '@/components/share-panel';
import ReceiveForm from '@/components/receive-form';
import { Send, Download, Zap, Lock, Share2 } from 'lucide-react';
import type { FileDetails } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import Peer from 'simple-peer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { generateShareCode, obfuscateCode } from '@/lib/code';

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [transferProgress, setTransferProgress] = useState<{ [key: string]: number }>({});
  const [shareLink, setShareLink] = useState('');
  const [shareCode, setShareCode] = useState('');
  
  const peerRef = useRef<Peer.Instance | null>(null);
  const { toast } = useToast();
  const router = useRouter();

  const handleFileSelect = (selectedFiles: FileList) => {
    const filesArray = Array.from(selectedFiles);
    setFiles(filesArray);
    setIsConnecting(true);

    if (peerRef.current) {
      peerRef.current.destroy();
    }
    
    const newPeer = new Peer({ initiator: true, trickle: false });
    peerRef.current = newPeer;
    let offerSent = false;
    
    newPeer.on('signal', async (offer) => {
      if (newPeer.destroyed || offer.type !== 'offer' || offerSent) {
          return;
      }
      offerSent = true;
      
      const supabase = createClient();
      const newShortCode = generateShareCode();
      const newObfuscatedCode = obfuscateCode(newShortCode);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('fileshare')
        .insert([{ 
            p2p_offer: JSON.stringify(offer), 
            short_code: newShortCode,
            expires_at: expiresAt 
        }])
        .select('id')
        .single();

      if (error || !data) {
        console.error('Error creating share session:', error);
         toast({
          variant: 'destructive',
          title: 'Failed to Create Share',
          description: `Could not create a new share session. ${error?.message || 'Please check your network and database settings.'}`,
        });
        setIsConnecting(false);
        return;
      }
      
      setShareLink(`${window.location.origin}/s/${newObfuscatedCode}`);
      setShareCode(newObfuscatedCode);

      const shareId = data.id;
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
              try {
                newPeer.signal(JSON.parse(p2p_answer));
              } catch (err) {
                 console.error("Failed to apply answer signal", err);
                 if (!newPeer.destroyed) {
                    toast({ variant: 'destructive', title: 'Connection Failed', description: 'Could not establish connection with receiver.'});
                    handleReset();
                 }
              }
              channel.unsubscribe();
            }
          }
        )
        .subscribe();
    });

    const sendFile = (file: File, peer: Peer.Instance) => {
        const chunkSize = 64 * 1024; // 64KB
        let offset = 0;
        
        if (peer.destroyed) return;
        peer.send(JSON.stringify({ type: 'transferStart', payload: { fileName: file.name, fileSize: file.size } }));

        const readSlice = () => {
            if (!file || peer.destroyed) return;
            const slice = file.slice(offset, offset + chunkSize);
            const reader = new FileReader();
            
            reader.onload = (e) => {
                if (e.target?.result && !peer.destroyed) {
                    try {
                        const chunk = e.target.result as ArrayBuffer;
                        peer.send(new Uint8Array(chunk));
                        offset += chunk.byteLength;
                        
                        const progress = Math.min((offset / file.size) * 100, 100);
                        setTransferProgress(prev => ({ ...prev, [file.name]: progress }));

                        if (offset < file.size) {
                            readSlice();
                        } else {
                            console.log('File sent completely:', file.name);
                            if (!peer.destroyed) {
                                peer.send(JSON.stringify({ type: 'transferComplete', payload: { fileName: file.name } }));
                            }
                        }
                    } catch(err) {
                        console.error("Error sending file chunk:", err);
                        toast({ variant: 'destructive', title: 'Transfer Failed', description: 'Could not send file data.' });
                        handleReset();
                    }
                }
            };
            reader.readAsArrayBuffer(slice);
        };
        readSlice();
    }

    newPeer.on('connect', () => {
      console.log('Peer connected!');
      setIsConnecting(false);

      if (filesArray.length === 0) return;

      const filesDetails: FileDetails[] = filesArray.map(file => ({
        name: file.name,
        size: file.size,
        type: file.type,
      }));
      
      if (!newPeer.destroyed) {
        newPeer.send(JSON.stringify({ type: 'fileDetails', payload: filesDetails }));
      }
      
      const pingInterval = setInterval(() => {
        if (!newPeer.destroyed) {
          newPeer.send(JSON.stringify({ type: 'ping' }));
        } else {
          clearInterval(pingInterval);
        }
      }, 2000);

      newPeer.on('data', (chunk) => {
        try {
          const data = JSON.parse(chunk.toString());
          if (data.type === 'requestFile') {
            const fileToTransfer = files.find(f => f.name === data.payload.fileName);
            if (fileToTransfer) {
              sendFile(fileToTransfer, newPeer);
            }
          }
        } catch (e) {
          // This will be raw chunk data, so we ignore parse errors
        }
      });
    });
    
    newPeer.on('close', () => {
      console.log('Peer disconnected');
      toast({ title: 'Recipient Disconnected', description: 'The file transfer session has ended.'});
      handleReset();
    });

    newPeer.on('error', (err) => {
      console.error('Peer error', err);
      if (!newPeer.destroyed) {
        toast({ variant: 'destructive', title: 'Connection Error', description: `An unexpected connection error occurred: ${err.message}`});
        handleReset();
      }
    });
  };

  const handleReset = () => {
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    setFiles([]);
    setIsConnecting(false);
    setTransferProgress({});
    setShareLink('');
    setShareCode('');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 pt-24 selection:bg-primary/20">
      <main className="w-full flex-1 flex flex-col items-center justify-center container mx-auto">
        {files.length > 0 ? (
          <SharePanel
            files={files}
            transferProgress={transferProgress}
            isConnecting={isConnecting}
            onReset={handleReset}
            shareLink={shareLink}
            shortCode={shareCode}
          />
        ) : (
          <>
            <Tabs defaultValue="share" className="w-full max-w-lg mb-12">
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
            <div className="w-full max-w-4xl mx-auto prose prose-lg dark:prose-invert text-foreground/90 mt-20">
              <h2 className="text-3xl font-bold text-center mb-8 font-headline">The Secure, Serverless Way to Share Files</h2>
              <div className="grid md:grid-cols-3 gap-8 my-12 text-center">
                  <div className="flex flex-col items-center">
                      <Zap className="h-10 w-10 text-primary mb-3"/>
                      <h3 className="font-semibold text-xl mb-2">Blazing Fast</h3>
                      <p className="text-muted-foreground">Transfers happen directly between your browser and the recipient's. No server uploads mean your files arrive in record time.</p>
                  </div>
                   <div className="flex flex-col items-center">
                      <Lock className="h-10 w-10 text-primary mb-3"/>
                      <h3 className="font-semibold text-xl mb-2">Completely Private</h3>
                      <p className="text-muted-foreground">Your files are never stored on a server. The connection is end-to-end encrypted, ensuring only you and the recipient can see the files.</p>
                  </div>
                   <div className="flex flex-col items-center">
                      <Share2 className="h-10 w-10 text-primary mb-3"/>
                      <h3 className="font-semibold text-xl mb-2">Effortless Sharing</h3>
                      <p className="text-muted-foreground">Just drag, drop, and share a link. FileZen makes secure file sharing as simple as it gets.</p>                  </div>
              </div>
              
              <h3>What is Peer-to-Peer (P2P) File Sharing?</h3>
              <p>Traditional file-sharing services act as a middleman. You upload your file to their server, and the recipient downloads it from that same server. This means the service has a copy of your file, creating potential privacy risks and slower transfer speeds. FileZen cuts out the middleman. It uses a technology called WebRTC (Web Real-Time Communication) to create a direct, secure, and encrypted connection between your web browser and the recipient's. It's like handing the file over in person, but over the internet.</p>
              
              <h3>How FileZen Works: A Simple, Secure Process</h3>
              <p>Using FileZen is designed to be incredibly straightforward:</p>
              <ol>
                  <li><strong>Select Your Files:</strong> You start by dragging and dropping one or more files into the upload area on the homepage. Your files are not actually being "uploaded"—they are simply being prepared for transfer from your local machine.</li>
                  <li><strong>Generate a Secure Link:</strong> FileZen instantly generates a unique and private share link and a 5-character code. This link doesn't point to your file on a server; instead, it contains the necessary information for a recipient's browser to connect directly to yours.</li>
                  <li><strong>Share the Link or Code:</strong> You can share this link via email, a QR code, or simply by telling the recipient the share code. This is the "key" that allows them to initiate a connection.</li>
                  <li><strong>The Recipient Connects:</strong> When the recipient opens the link or enters the code, their browser sends a secure signal back to yours, establishing a direct P2P connection.</li>
                  <li><strong>Direct Transfer Begins:</strong> Once connected, the file transfer begins. The file data streams directly from your computer to the recipient's, chunk by chunk. You can see the transfer progress in real-time.</li>
              </ol>

              <h3>The Golden Rule: Keep Your Browser Tab Open!</h3>
              <p>Because FileZen is a serverless, P2P application, your browser acts as the "server" during the transfer. The files are sent directly from your device. This is the magic that ensures your privacy and boosts speed, but it comes with one important rule: **the sender must keep the FileZen browser tab open until the transfer is complete.** If you close the tab, the connection is broken, and the file transfer will stop. We'll show you a clear "Sender Offline" status if the connection is lost, so you always know what's happening.</p>
              
              <h3>Unmatched Privacy and Security</h3>
              <p>Your privacy is not an afterthought; it's the foundation of FileZen. By eliminating the server from the file transfer process, we eliminate the primary risk of data breaches and unauthorized access. We don't have your files, so we can't lose them, read them, or share them. All communication is encrypted end-to-end using the robust security protocols built into WebRTC. We don't have user accounts, we don't track what you send, and we don't keep any logs. It's truly anonymous and private file sharing for the modern web.</p>

            </div>
          </>
        )}
      </main>
    </div>
  );
}

    