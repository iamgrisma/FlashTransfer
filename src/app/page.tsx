"use client";

import { useState } from 'react';
import Peer from 'simple-peer';
import BidirectionalConnection from '@/components/bidirectional-connection';
import TransferPanel from '@/components/transfer-panel';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Zap, Lock, ArrowLeftRight, Users, BarChart3, Shield } from 'lucide-react';
import { initSession, getSession, endSession } from '@/lib/analytics';
import Link from 'next/link';

export default function Home() {
  const [peer, setPeer] = useState<Peer.Instance | null>(null);
  const [connectionCode, setConnectionCode] = useState('');
  const [isInitiator, setIsInitiator] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

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

                <div className="pt-8">
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
                      <h4 className="font-semibold mb-1">Create or Join a Connection</h4>
                      <p className="text-sm text-muted-foreground">
                        One person creates a connection code, the other enters it. Simple as that.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                      2
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">Direct P2P Connection Established</h4>
                      <p className="text-sm text-muted-foreground">
                        WebRTC creates an encrypted, direct connection between your browsers.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                      3
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">Share Files Both Ways</h4>
                      <p className="text-sm text-muted-foreground">
                        Both of you can drag & drop files to send. Files transfer instantly, encrypted end-to-end.
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
