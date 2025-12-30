"use client";

import { useState, useCallback, useEffect } from 'react';
import Peer from 'simple-peer';
import { Button } from '@/components/ui/button';
import { ArrowLeftRight, Users, Zap, Link2 } from 'lucide-react';
import Link from 'next/link';
import { useConnectionHistory } from '@/hooks/use-connection-history';
import { useChatHistory } from '@/hooks/use-chat-history';
import { useBidirectionalConnection } from '@/components/connection/use-connection';
import { ConnectionDialog } from '@/components/connection-dialog';
import ChatInterface from '@/components/chat-interface';
import { initSession, getSession, endSession } from '@/lib/analytics';
import { Input } from '@/components/ui/input';

export default function Home() {
  // Connection State
  const [peer, setPeer] = useState<Peer.Instance | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // UI State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [quickJoinCode, setQuickJoinCode] = useState('');

  // History Hooks
  // We use current connection code as "peerID" for chat history logic
  // If not connected, we should use 'offline_buffer' or something? 
  // Actually, for "Upload First", we just start a chat session. 
  // When we connect, we might need to migrate messages? 
  // Simplified: Chat logic stays ephemeral until connected? Or we use a "Draft" session.
  // Let's use `connectionCode` from the hook.

  const {
    mode,
    connectionCode,
    inputCode,
    setInputCode,
    isConnecting,
    error,
    createConnection,
    joinConnection,
    handleDisconnect,
    handleRotateSession
  } = useBidirectionalConnection({
    onConnectionEstablished: (newPeer, code, initiator) => {
      setPeer(newPeer);
      setIsConnected(true);
      setIsDialogOpen(false); // Close dialog on success
      saveConnection({
        id: code,
        name: `Peer_${code}`,
        code,
        peerLabel: `Peer ${code}`
      });
      initSession('bidirectional');
    },
    onConnectionLost: () => {
      setPeer(null);
      setIsConnected(false);
      if (getSession()) endSession();
    }
  });

  const { saveConnection, history } = useConnectionHistory();
  const chatHistory = useChatHistory(isConnected ? connectionCode : undefined); // History active only when connected for now? 
  // Improvement: If we want offline queue, we pass a dummy ID or handle internal state in component.
  // ChatInterface handles "not connected" by just showing local messages.

  // Handlers
  const handleOpenConnect = () => {
    // Allow user to choose "Create" or "Join"
    // If we already have a code (hosting), show code
    setIsDialogOpen(true);
    if (mode === 'none') {
      // Default state
    }
  };

  const handleQuickJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickJoinCode.length === 5) {
      setIsDialogOpen(true); // Show loader/status in dialog
      setInputCode(quickJoinCode);
      joinConnection(quickJoinCode); // Use the override
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Top Bar */}
      <header className="border-b bg-secondary/10 backdrop-blur-md z-10 shrink-0">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between gap-4">
          {/* Logo / Title */}
          <div className="flex items-center gap-2 md:gap-3 shrink-0">
            <div className="bg-primary/20 p-1.5 rounded-lg">
              <ArrowLeftRight className="h-4 w-4 md:h-5 md:w-5 text-primary" />
            </div>
            <h1 className="text-lg font-bold tracking-tight hidden md:block">FlashTransfer</h1>
            {/* Mobile simplified title */}
            <h1 className="text-lg font-bold tracking-tight md:hidden">Flash</h1>
          </div>

          {/* Connection Controls */}
          <div className="flex-1 flex items-center justify-center max-w-sm mx-auto">
            {isConnected ? (
              <div className="flex items-center gap-2 bg-green-500/10 text-green-600 px-3 py-1.5 rounded-full text-sm font-medium animate-in fade-in">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span>Connected: {connectionCode}</span>
                <Button variant="ghost" size="icon" className="h-5 w-5 ml-1 text-muted-foreground hover:text-destructive" onClick={handleDisconnect} title="Disconnect">
                  <Link2 className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <form onSubmit={handleQuickJoin} className="flex gap-2 w-full">
                <Input
                  placeholder="Enter Code (e.g. A1B2C)"
                  className="bg-background/50 h-9 font-mono uppercase tracking-wide text-center"
                  maxLength={5}
                  value={quickJoinCode}
                  onChange={(e) => setQuickJoinCode(e.target.value.toUpperCase())}
                />
                <Button type="submit" size="sm" variant="default" className="shrink-0" disabled={quickJoinCode.length !== 5}>
                  Join
                </Button>
              </form>
            )}
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <Link href="/broadcast">
              <Button variant="ghost" size="icon" title="Broadcast Mode">
                <Users className="h-4 w-4" />
              </Button>
            </Link>
            {!isConnected && (
              <Button size="sm" variant="secondary" onClick={handleOpenConnect} className="gap-2">
                <Zap className="h-4 w-4 fill-current" />
                <span className="hidden sm:inline">Connect</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Chat Area */}
      <main className="flex-1 overflow-hidden relative">
        <ChatInterface
          peer={peer}
          isConnected={isConnected}
          connectionCode={connectionCode}
          onConnectRequest={handleOpenConnect}
          historyHook={chatHistory}
        />
      </main>

      {/* Connection Dialog */}
      <ConnectionDialog
        isOpen={isDialogOpen}
        onOpenChange={(open) => {
          if (!open && isConnecting) {
            // Prevent closing if critical? Or allow background?
            // For now, allow closing but if connecting users might lose state visibility. 
            // Let's allow closing (it hides modal, connection attempt continues in hook state).
          }
          setIsDialogOpen(open);
        }}
        onJoin={(code) => {
          setInputCode(code);
          joinConnection(code);
        }}
        onCreate={() => {
          createConnection(false);
        }}
        onSelectRecent={(conn) => {
          setInputCode(conn.code);
          joinConnection(conn.code);
        }}
        connectionCode={connectionCode}
        isConnecting={isConnecting}
        mode={mode}
      />
    </div>
  );
}
