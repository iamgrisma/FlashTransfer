"use client";

import { useState, useCallback } from 'react';
import Peer from 'simple-peer';
import BidirectionalConnection from '@/components/bidirectional-connection';
import TransferPanel from '@/components/transfer-panel';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Zap, ArrowLeftRight, Users, History, Clock, X, Trash2 } from 'lucide-react';
import { initSession, getSession, endSession } from '@/lib/analytics';
import Link from 'next/link';
import { useConnectionHistory, StoredConnection } from '@/hooks/use-connection-history';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function Home() {
  const [peer, setPeer] = useState<Peer.Instance | null>(null);
  const [connectionCode, setConnectionCode] = useState('');
  const [isInitiator, setIsInitiator] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  // We keep pre-selected files for "drop to start" feel, but they flow into chat
  const [preSelectedFiles, setPreSelectedFiles] = useState<File[]>([]);

  const { history, saveConnection, removeConnection, clearHistory } = useConnectionHistory();
  const [targetReconnectCode, setTargetReconnectCode] = useState<string | null>(null);

  const handleConnectionEstablished = useCallback((
    newPeer: Peer.Instance,
    code: string,
    initiator: boolean
  ) => {
    setPeer(newPeer);
    setConnectionCode(code);
    setIsInitiator(initiator);
    setIsConnected(true);
    setTargetReconnectCode(null); // Reset reconnect target

    // Save to history
    // Generate a name if not exists (e.g. Device_1234)
    // In a real app we might exchange names over the wire first
    const name = `Peer_${code}`;
    saveConnection({
      id: code, // simple ID
      name,
      code,
      peerLabel: 'Unknown Device'
    });

    // Initialize analytics session
    initSession('bidirectional');
  }, [saveConnection]);

  const handleConnectionLost = useCallback(() => {
    if (getSession()) {
      endSession();
    }
    setPeer(null);
    setConnectionCode('');
    setIsConnected(false);
  }, []);

  const handleReconnect = (conn: StoredConnection) => {
    setTargetReconnectCode(conn.code);
  };

  return (
    <div className="flex flex-col h-full min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b bg-secondary/20 backdrop-blur-md sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-primary/20 p-2 rounded-lg">
              <ArrowLeftRight className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold font-headline tracking-tight">FlashTransfer</h1>
              <p className="text-xs text-muted-foreground hidden md:block">Secure P2P Chat & Share</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href="/broadcast">
              <Button variant="ghost" size="sm" className="hidden md:flex">
                <Users className="mr-2 h-4 w-4" />
                Broadcast Mode
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8 flex flex-col items-center">
        {!isConnected ? (
          <div className="w-full max-w-5xl grid lg:grid-cols-[300px_1fr] gap-8">
            {/* Sidebar: Recent Connections */}
            <div className="order-2 lg:order-1 space-y-4">
              <Card className="bg-secondary/10 border-none shadow-none">
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold flex items-center gap-2">
                      <History className="h-4 w-4 text-primary" />
                      Recent
                    </h3>
                    {history.length > 0 && (
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={clearHistory} title="Clear History">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>

                  {history.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No recent connections.</p>
                  ) : (
                    <ScrollArea className="h-[300px]">
                      <div className="space-y-2">
                        {history.map((conn) => (
                          <div key={conn.code} className="group flex items-center justify-between p-3 rounded-lg bg-background border hover:border-primary/50 transition-colors cursor-pointer" onClick={() => handleReconnect(conn)}>
                            <div className="min-w-0">
                              <p className="font-medium truncate text-sm">{conn.peerLabel || conn.name}</p>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                <span>{new Date(conn.lastActive).toLocaleDateString()}</span>
                              </div>
                            </div>
                            <Button size="sm" variant="secondary" className="opacity-0 group-hover:opacity-100 transition-opacity">
                              Join
                            </Button>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>

              <div className="bg-primary/5 rounded-xl p-4 text-sm text-muted-foreground">
                <p><strong>Note:</strong> Recent connections are stored locally for 15 days. You can instantly reconnect if the other peer is online with the same code.</p>
              </div>
            </div>

            {/* Main Area */}
            <div className="order-1 lg:order-2 flex flex-col items-center space-y-8">
              <div className="text-center space-y-4 max-w-2xl">
                <h2 className="text-4xl md:text-5xl font-bold font-headline leading-tight">
                  Instant <span className="text-primary">Chat & Share</span>
                </h2>
                <p className="text-lg text-muted-foreground">
                  Connect directly with your peers. No signups, no cloud storage, just secure end-to-end data transfer.
                </p>
              </div>

              <BidirectionalConnection
                onConnectionEstablished={handleConnectionEstablished}
                onConnectionLost={handleConnectionLost}
                targetCode={targetReconnectCode}
              />
            </div>
          </div>
        ) : (
          <div className="w-full flex justify-center animate-in fade-in slide-in-from-bottom-4 duration-500">
            <TransferPanel
              peer={peer!}
              connectionCode={connectionCode}
              isInitiator={isInitiator}
              initialFiles={preSelectedFiles}
            />
          </div>
        )}
      </main>
    </div>
  );
}
