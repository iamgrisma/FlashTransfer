
"use client";

import { useState, useRef, useCallback } from 'react';
import FileUpload from '@/components/file-upload';
import SharePanel from '@/components/share-panel';
import ReceiveForm from '@/components/receive-form';
import { Send, Download, Zap, Lock, Share2 } from 'lucide-react';
import type { FileDetails } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import Peer from 'simple-peer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from '@/hooks/use-toast';
import { generateShareCode, obfuscateCode } from '@/lib/code';
import type { RealtimeChannel } from '@supabase/supabase-js';

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [shareId, setShareId] = useState<string | null>(null);
  const [shareCode, setShareCode] = useState('');

  const peerRef = useRef<Peer.Instance | null>(null);
  const { toast } = useToast();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [transferProgress, setTransferProgress] = useState<{ [fileName: string]: number }>({});

  const handleReset = useCallback(() => {
    console.error('handleReset CALLED. Stack trace:', new Error().stack);
    peerRef.current?.destroy();
    peerRef.current = null;
    if (channelRef.current) {
      channelRef.current.unsubscribe();
      channelRef.current = null;
    }
    setFiles([]);
    setShareId(null);
    setShareCode('');
    setTransferProgress({});
  }, []);

  const sendFile = (file: File, peer: Peer.Instance) => {
    const chunkSize = 64 * 1024; // 64KB
    let offset = 0;

    if (!peer || peer.destroyed) {
      console.error("Attempted to send file but peer is destroyed or doesn't exist.");
      toast({ title: 'Connection Error', description: 'Cannot send file, connection is not active.', variant: 'destructive' });
      return;
    }

    try {
      peer.send(JSON.stringify({ type: 'transferStart', payload: { fileName: file.name, fileSize: file.size } }));
    } catch (e) {
      console.error("Failed to send transferStart signal", e);
      return;
    }

    const reader = new FileReader();

    reader.onload = (e) => {
      if (peer.destroyed || !e.target?.result) return;
      try {
        peer.send(e.target.result as ArrayBuffer);
        offset += (e.target.result as ArrayBuffer).byteLength;

        const progress = Math.min((offset / file.size) * 100, 100);
        setTransferProgress(prev => ({ ...prev, [file.name]: progress }));

        if (offset < file.size) {
          readNextChunk();
        } else {
          peer.send(JSON.stringify({ type: 'transferComplete', payload: { fileName: file.name } }));
        }
      } catch (err) {
        console.error("Error sending file chunk:", err);
      }
    };

    const readNextChunk = () => {
      if (offset >= file.size || peer.destroyed) return;
      const slice = file.slice(offset, offset + chunkSize);
      reader.readAsArrayBuffer(slice);
    }

    readNextChunk();
  };

  // SENDER: Main logic to create a share session
  const hasCreatedOffer = useRef(false);

  const createShareSession = useCallback(async (initialFiles: File[]) => {
    console.log('createShareSession called with files:', initialFiles.length);
    setFiles(initialFiles);

    // Reset the offer tracking
    hasCreatedOffer.current = false;

    // SENDER is the initiator
    const newPeer = new Peer({ initiator: true, trickle: false });
    peerRef.current = newPeer;
    const supabase = createClient();

    // SENDER: When the offer signal is ready, save it to the database
    newPeer.on('signal', async (offer) => {
      console.log('SENDER: Signal received from simple-peer:', offer.type);

      // This event can fire multiple times, but the offer is only generated once for the initiator.
      // We only proceed if the offer is of type 'offer' AND we haven't created one yet.
      if (offer.type !== 'offer') {
        console.log('SENDER: Ignoring non-offer signal (waiting for complete offer).');
        return;
      }

      if (hasCreatedOffer.current) {
        console.warn('SENDER: Offer already created. Ignoring duplicate signal.');
        return;
      }

      hasCreatedOffer.current = true;
      console.log('SENDER: Generated Offer. Creating share session in DB...');

      const newShortCode = generateShareCode();
      const newObfuscatedCode = obfuscateCode(newShortCode);

      // Calculate expiration (e.g., 24 hours from now)
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('fileshare')
        .insert([{
          short_code: newShortCode,
          p2p_offer: JSON.stringify(offer),
          expires_at: expiresAt
        }])
        .select('id')
        .single();

      if (error || !data) {
        console.error('Error creating share session:', error);
        toast({
          variant: 'destructive',
          title: 'Failed to Create Share',
          description: `Could not create a new share session. ${error?.message || 'Please try again.'}`,
        });
        handleReset(); // Consider passing a reason here if handleReset accepted one
        return;
      }

      console.log('SENDER: Share session created. ID:', data.id);
      const newShareId = data.id;
      setShareId(newShareId);
      setShareCode(newObfuscatedCode);

      // SENDER: Listen on a unique channel for the receiver's answer
      const channel = supabase.channel(`share-session-${newShareId}`);
      channelRef.current = channel;

      let hasProcessedAnswer = false;

      channel.on('broadcast', { event: 'answer' }, ({ payload }) => {
        console.log('SENDER: Received answer signal from Receiver via Supabase.');

        if (hasProcessedAnswer) {
          console.warn('SENDER: Already processed an answer. Ignoring duplicate.');
          return;
        }

        if (peerRef.current && !peerRef.current.destroyed && payload.answer) {
          console.log('SENDER: Signaling peer with answer.');
          try {
            peerRef.current.signal(payload.answer);
            hasProcessedAnswer = true;
          } catch (err) {
            console.error('SENDER: Error signaling peer with answer:', err);
          }
        } else {
          console.warn('SENDER: Peer destroyed or answer missing when trying to signal.');
        }
      }).subscribe((status) => {
        console.log('SENDER: Supabase channel subscription status:', status);
      });
    });

    newPeer.on('connect', () => {
      console.log('SENDER: Peer connected with a receiver.');
      toast({ title: 'Receiver Connected', description: 'A connection has been established.' });
      const filesDetails: FileDetails[] = (initialFiles || []).map(file => ({
        name: file.name,
        size: file.size,
        type: file.type,
      }));
      if (peerRef.current && !peerRef.current.destroyed) {
        console.log('SENDER: Sending fileDetails to receiver.');
        peerRef.current.send(JSON.stringify({ type: 'fileDetails', payload: filesDetails }));
      }
    });

    newPeer.on('data', (chunk) => {
      // console.log('SENDER: Received data chunk'); // Too verbose for binary
      try {
        const data = JSON.parse(chunk.toString());
        console.log('SENDER: Received control message:', data.type);
        if (data.type === 'requestFile') {
          const fileToTransfer = files.find(f => f.name === data.payload.fileName);
          if (fileToTransfer && peerRef.current && !peerRef.current.destroyed) {
            console.log('SENDER: Request to send file:', fileToTransfer.name);
            sendFile(fileToTransfer, peerRef.current);
          } else {
            console.error('SENDER: File requested not found or peer unavailable:', data.payload.fileName);
          }
        }
      } catch (e) {
        // Not JSON, likely a file chunk - ignore.
      }
    });

    newPeer.on('error', (err) => {
      console.error('Sender Peer error:', err);
      // Do not reset the whole session, just log the error. The session should remain active for other potential connections.
      toast({ title: 'Connection Error', description: 'A peer connection experienced an error.', variant: 'destructive' });
    });

    newPeer.on('close', () => {
      console.log('SENDER: Peer connection closed.');
    });

  }, [toast, handleReset, files]);

  const handleFileSelect = (selectedFiles: FileList) => {
    const filesArray = Array.from(selectedFiles);
    if (!shareId) {
      createShareSession(filesArray);
    } else {
      const newFiles = [...files, ...filesArray.filter(f => !files.some(existing => existing.name === f.name))];
      setFiles(newFiles);
      const filesDetails: FileDetails[] = newFiles.map(file => ({
        name: file.name,
        size: file.size,
        type: file.type,
      }));
      if (peerRef.current && peerRef.current.connected) {
        peerRef.current.send(JSON.stringify({ type: 'fileDetails', payload: filesDetails }));
      }
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 pt-24 selection:bg-primary/20">
      <main className="w-full flex-1 flex flex-col items-center justify-center container mx-auto">
        {shareId ? (
          <SharePanel
            files={files}
            transferProgress={transferProgress}
            onReset={handleReset}
            shareLink={`${window.location.origin}/s/${shareCode}`}
            shortCode={shareCode}
            onFileAdd={handleFileSelect}
          />
        ) : (
          <>
            <Tabs defaultValue="share" className="w-full max-w-lg mb-12">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="share"><Send className="mr-2" />Share File</TabsTrigger>
                <TabsTrigger value="receive"><Download className="mr-2" />Receive File</TabsTrigger>
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
                  <Zap className="h-10 w-10 text-primary mb-3" />
                  <h3 className="font-semibold text-xl mb-2">Blazing Fast</h3>
                  <p className="text-muted-foreground">Transfers happen directly between your browser and the recipient's. No server uploads mean your files arrive in record time.</p>
                </div>
                <div className="flex flex-col items-center">
                  <Lock className="h-10 w-10 text-primary mb-3" />
                  <h3 className="font-semibold text-xl mb-2">Completely Private</h3>
                  <p className="text-muted-foreground">Your files are never stored on a server. The connection is end-to-end encrypted, ensuring only you and the recipient can see the files.</p>
                </div>
                <div className="flex flex-col items-center">
                  <Share2 className="h-10 w-10 text-primary mb-3" />
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

