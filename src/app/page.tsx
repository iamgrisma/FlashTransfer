"use client";

import { useState } from 'react';
import Peer from 'simple-peer';
import BidirectionalConnection from '@/components/bidirectional-connection';
import TransferPanel from '@/components/transfer-panel';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Zap, Lock, ArrowLeftRight, Users, BarChart3, Shield, File as FileIcon, UploadCloud } from 'lucide-react';
import { initSession, getSession, endSession } from '@/lib/analytics';
import Link from 'next/link';

export default function Home() {
  const [peer, setPeer] = useState<Peer.Instance | null>(null);
  const [connectionCode, setConnectionCode] = useState('');
  const [isInitiator, setIsInitiator] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [preSelectedFiles, setPreSelectedFiles] = useState<File[]>([]);

  const handleConnectionEstablished = (
    newPeer: Peer.Instance,
    code: string,
    initiator: boolean
  ) => {
    setPeer(newPeer);
    setConnectionCode(code);
    setIsInitiator(initiator);
    setIsConnected(true);

    // Initialize analytics session
    initSession('bidirectional');
  };

  const handleConnectionLost = () => {
    // End analytics session
    if (getSession()) {
      endSession();
    }

    setPeer(null);
    setConnectionCode('');
    setIsConnected(false);
    // Don't clear preSelectedFiles so they persist if connection fails
  };

  const handlePreSelection = (files: FileList) => {
    setPreSelectedFiles(prev => [...prev, ...Array.from(files)]);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold font-headline">FlashTransfer</h1>
            <p className="text-sm text-muted-foreground">Secure P2P File Sharing</p>
          </div>
          <Link href="/broadcast">
            <Button variant="outline">
              <Users className="mr-2 h-4 w-4" />
              Multi-User Mode
            </Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        {!isConnected ? (
          <>
            {/* Hero Section */}
            <section className="container mx-auto px-4 py-16 text-center">
              <div className="max-w-3xl mx-auto space-y-6">
                <div className="inline-block p-3 bg-primary/10 rounded-full mb-4">
                  <ArrowLeftRight className="h-12 w-12 text-primary" />
                </div>

                <h2 className="text-4xl md:text-5xl font-bold font-headline">
                  Share Files. Both Ways.
                </h2>

                <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                  Connect with anyone, send files to each other instantly. No servers, no limits,
                  completely private. It's like being in the same room.
                </p>

                {/* Pre-Connection File Selection */}
                <div className="max-w-xl mx-auto py-8">
                  <div className="bg-card border rounded-xl p-6 shadow-sm">
                    <h3 className="font-semibold mb-4 flex items-center justify-center gap-2">
                      <Zap className="h-4 w-4 text-yellow-500" />
                      Start by selecting files (Optional)
                    </h3>
                    {preSelectedFiles.length > 0 ? (
                      <div className="space-y-4">
                        <div className="bg-secondary/50 p-4 rounded-lg text-left">
                          <p className="font-medium mb-2">{preSelectedFiles.length} file(s) ready to send:</p>
                          <ul className="space-y-1 text-sm text-muted-foreground max-h-32 overflow-y-auto">
                            {preSelectedFiles.map((f, i) => (
                              <li key={i} className="flex items-center gap-2">
                                <FileIcon className="h-4 w-4" />
                                <span className="truncate">{f.name}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="flex gap-2 justify-center">
                          <Button variant="outline" onClick={() => setPreSelectedFiles([])}>Clear</Button>
                          <div className="relative">
                            <input
                              type="file"
                              multiple
                              className="absolute inset-0 opacity-0 cursor-pointer"
                              onChange={(e) => e.target.files && handlePreSelection(e.target.files)}
                            />
                            <Button>Add More</Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="relative group cursor-pointer border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 rounded-lg p-8 transition-all">
                        <input
                          type="file"
                          multiple
                          className="absolute inset-0 opacity-0 cursor-pointer z-10"
                          onChange={(e) => e.target.files && handlePreSelection(e.target.files)}
                        />
                        <div className="space-y-2">
                          <UploadCloud className="h-10 w-10 mx-auto text-muted-foreground group-hover:text-primary transition-colors" />
                          <p className="text-sm font-medium">Click to select files</p>
                          <p className="text-xs text-muted-foreground">or drag and drop</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-4">
                  <BidirectionalConnection
                    onConnectionEstablished={handleConnectionEstablished}
                    onConnectionLost={handleConnectionLost}
                  />
                </div>
              </div>
            </section>

            {/* Features Grid */}
            <section className="bg-secondary/30 py-16">
              <div className="container mx-auto px-4">
                <h3 className="text-3xl font-bold text-center mb-12 font-headline">
                  Why FlashTransfer?
                </h3>

                <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                  <Card>
                    <CardContent className="pt-6 text-center space-y-3">
                      <div className="inline-block p-3 bg-primary/10 rounded-full">
                        <ArrowLeftRight className="h-8 w-8 text-primary" />
                      </div>
                      <h4 className="font-semibold text-lg">Bidirectional Transfer</h4>
                      <p className="text-sm text-muted-foreground">
                        Both users can send AND receive files simultaneously. True peer-to-peer sharing.
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6 text-center space-y-3">
                      <div className="inline-block p-3 bg-primary/10 rounded-full">
                        <Lock className="h-8 w-8 text-primary" />
                      </div>
                      <h4 className="font-semibold text-lg">End-to-End Encrypted</h4>
                      <p className="text-sm text-muted-foreground">
                        WebRTC encryption ensures your files are private. No one can intercept or decrypt them.
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6 text-center space-y-3">
                      <div className="inline-block p-3 bg-primary/10 rounded-full">
                        <Zap className="h-8 w-8 text-primary" />
                      </div>
                      <h4 className="font-semibold text-lg">Blazing Fast</h4>
                      <p className="text-sm text-muted-foreground">
                        Direct browser-to-browser transfer. No server uploads mean instant file delivery.
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </section>

            {/* Premium Features Callout */}
            <section className="container mx-auto px-4 py-16">
              <Card className="max-w-4xl mx-auto border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
                <CardContent className="p-8">
                  <div className="flex flex-col md:flex-row items-center gap-6">
                    <div className="flex-shrink-0">
                      <div className="p-4 bg-background rounded-full">
                        <Users className="h-12 w-12 text-primary" />
                      </div>
                    </div>
                    <div className="flex-1 text-center md:text-left">
                      <h3 className="text-2xl font-bold mb-2">Need to Share with Multiple People?</h3>
                      <p className="text-muted-foreground mb-4">
                        Use our Multi-User Broadcast mode to send files to unlimited receivers
                        with real-time analytics and download tracking.
                      </p>
                      <div className="flex flex-wrap gap-4 justify-center md:justify-start text-sm">
                        <div className="flex items-center gap-2">
                          <BarChart3 className="h-4 w-4 text-primary" />
                          <span>Real-time Analytics</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-primary" />
                          <span>Connection Tracking</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-primary" />
                          <span>Unlimited Receivers</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      <Link href="/broadcast">
                        <Button size="lg">
                          Try Multi-User Mode
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* How It Works */}
            <section className="bg-secondary/30 py-16">
              <div className="container mx-auto px-4 max-w-4xl">
                <h3 className="text-3xl font-bold text-center mb-12 font-headline">
                  How It Works
                </h3>

                <div className="space-y-6">
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                      1
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">Select Files (Optional)</h4>
                      <p className="text-sm text-muted-foreground">
                        Choose files you want to send upfront, or add them later.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                      2
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">Create or Join</h4>
                      <p className="text-sm text-muted-foreground">
                        Generate a code to invite a peer, or enter a code to join them.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                      3
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">Instant Transfer</h4>
                      <p className="text-sm text-muted-foreground">
                        Files fly directly between your devices. No clouds, no waiting.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-8 p-4 bg-primary/10 border border-primary/20 rounded-lg">
                  <p className="text-sm font-medium mb-1">⚡ Pro Tip:</p>
                  <p className="text-sm text-muted-foreground">
                    Keep your browser tab open during transfer. Files transfer directly from your device—no server storage means maximum privacy and speed!
                  </p>
                </div>
              </div>
            </section>
          </>
        ) : (
          <section className="container mx-auto px-4 py-8 flex items-center justify-center">
            <TransferPanel
              peer={peer!}
              connectionCode={connectionCode}
              isInitiator={isInitiator}
              initialFiles={preSelectedFiles}
            />
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>FlashTransfer - Secure, Private, Peer-to-Peer File Sharing</p>
          <p className="mt-1">No accounts. No tracking. No server storage.</p>
        </div>
      </footer>
    </div>
  );
}
