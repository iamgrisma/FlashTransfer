"use client";

import { useState } from 'react';
import Peer from 'simple-peer';
import { Button } from '@/components/ui/button';
import { Users, Zap, Link2 } from 'lucide-react';
import Link from 'next/link';
import { useConnectionHistory } from '@/hooks/use-connection-history';
import { useChatHistory } from '@/hooks/use-chat-history';
import { useBidirectionalConnection } from '@/components/connection/use-connection';
import { ConnectionDialog } from '@/components/connection-dialog';
import ChatInterface from '@/components/chat-interface';
import { initSession, getSession, endSession } from '@/lib/analytics';
import { Badge } from '@/components/ui/badge';

export default function Home() {
  const [peer, setPeer] = useState<Peer.Instance | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const {
    mode,
    connectionCode,
    inputCode,
    setInputCode,
    isConnecting,
    createConnection,
    joinConnection,
    handleDisconnect,
  } = useBidirectionalConnection({
    onConnectionEstablished: (newPeer, code, initiator) => {
      setPeer(newPeer);
      setIsConnected(true);
      setIsDialogOpen(false);
      saveConnection({ id: code, name: `Peer_${code}`, code, peerLabel: `Peer ${code}` });
      initSession('bidirectional');
    },
    onConnectionLost: () => {
      setPeer(null);
      setIsConnected(false);
      if (getSession()) endSession();
    }
  });

  const { saveConnection } = useConnectionHistory();
  const chatHistory = useChatHistory(isConnected ? connectionCode : undefined);

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden text-sm md:text-base">
      {/* Minimal Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm z-10 shrink-0 h-14 flex items-center justify-between px-4">
        <div className="font-bold tracking-tight text-lg flex items-center gap-2">
          <span className="text-primary italic">Flash</span>Transfer
          {isConnected && (
            <Badge variant="outline" className="ml-2 font-mono hidden sm:inline-flex border-green-500 text-green-600 bg-green-50">
              {connectionCode}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isConnected && (
            <Button variant="ghost" size="sm" onClick={handleDisconnect} className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 px-2">
              <Link2 className="w-4 h-4 mr-1.5" /> Disconnect
            </Button>
          )}
          <Link href="/broadcast">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
              <Users className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Chat */}
      <main className="flex-1 overflow-hidden relative">
        <ChatInterface
          peer={peer}
          isConnected={isConnected}
          connectionCode={connectionCode}
          onConnectRequest={() => setIsDialogOpen(true)}
          onJoinCode={(code) => { setInputCode(code); joinConnection(code); }}
          historyHook={chatHistory}
        />
      </main>

      <ConnectionDialog
        isOpen={isDialogOpen}
        onOpenChange={(open) => setIsDialogOpen(open)}
        onJoin={(code) => { setInputCode(code); joinConnection(code); }}
        onCreate={() => createConnection(false)}
        onSelectRecent={(conn) => { setInputCode(conn.code); joinConnection(conn.code); }}
        connectionCode={connectionCode}
        isConnecting={isConnecting}
        mode={mode}
      />
    </div>
  );
}
