
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Wifi, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ActiveConnectionProps {
    connectionCode: string;
    remotePeerStatus: 'online' | 'offline' | 'left';
    onDisconnect: () => void;
    onRotateSession?: () => void;
    isHost: boolean;
}

export function ActiveConnection({
    connectionCode,
    remotePeerStatus,
    onDisconnect,
    onRotateSession,
    isHost
}: ActiveConnectionProps) {
    const { toast } = useToast();

    const handleCopy = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            toast({ title: 'Copied!', description: 'Code copied to clipboard' });
        } catch (err) {
            toast({ title: 'Failed to copy', variant: 'destructive' });
        }
    };

    return (
        <div className="space-y-4 animate-in fade-in">
            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-center">
                <Wifi className="mx-auto h-8 w-8 text-green-500 mb-2" />
                <p className="font-medium text-green-700 dark:text-green-400">Connection Established!</p>
                <div className="flex items-center justify-center gap-2 mt-1">
                    <span className={`h-2 w-2 rounded-full ${remotePeerStatus === 'online' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                    <p className="text-sm text-muted-foreground capitalize">Peer {remotePeerStatus}</p>
                </div>
            </div>

            <div className="space-y-2">
                <Label>Connection Code</Label>
                <div className="flex gap-2">
                    <Input
                        value={connectionCode}
                        readOnly
                        className="text-center text-xl tracking-widest font-mono"
                    />
                    <Button onClick={() => handleCopy(connectionCode)} size="icon" variant="outline">
                        <Copy className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <div className="flex gap-2">
                <Button onClick={onDisconnect} variant="outline" className="flex-1">
                    Disconnect
                </Button>

                {isHost && onRotateSession && (
                    <Button onClick={onRotateSession} variant="destructive" className="flex-1">
                        End & New Code
                    </Button>
                )}
            </div>
        </div>
    );
}
