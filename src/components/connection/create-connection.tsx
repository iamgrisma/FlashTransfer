
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader, Link2, Copy, Check } from 'lucide-react';
import QRCode from 'qrcode.react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

interface CreateConnectionProps {
    connectionCode: string;
    isConnecting: boolean;
    onDisconnect: () => void;
}

export function CreateConnection({ connectionCode, isConnecting, onDisconnect }: CreateConnectionProps) {
    const [hasCopied, setHasCopied] = useState(false);
    const { toast } = useToast();

    const handleCopy = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setHasCopied(true);
            toast({ title: 'Copied!', description: 'Code copied to clipboard' });
            setTimeout(() => setHasCopied(false), 2000);
        } catch (err) {
            toast({ title: 'Failed to copy', variant: 'destructive' });
        }
    };

    const shareLink = connectionCode ? `${typeof window !== 'undefined' ? window.location.origin : ''}/s/${connectionCode}` : '';

    return (
        <div className="space-y-4 animate-in fade-in">
            <div className="text-center p-4 bg-secondary/50 rounded-lg">
                <Loader className="mx-auto h-8 w-8 animate-spin text-primary mb-2" />
                <p className="text-sm text-muted-foreground">Waiting for peer to connect...</p>
                <p className="text-xs text-muted-foreground mt-1">If peer disconnects, we'll auto-recover.</p>
            </div>

            <div className="space-y-2">
                <Label>Share this code with your peer</Label>
                <div className="flex gap-2">
                    <Input
                        value={connectionCode}
                        readOnly
                        className="text-center text-2xl tracking-[0.3em] font-mono"
                    />
                    <Button onClick={() => handleCopy(connectionCode)} size="icon" variant="outline">
                        {hasCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                </div>
            </div>

            <div className="flex gap-2">
                <Button onClick={() => handleCopy(shareLink)} variant="outline" className="flex-1">
                    <Copy className="mr-2 h-4 w-4" /> Copy Link
                </Button>

                <Dialog>
                    <DialogTrigger asChild>
                        <Button variant="outline">QR Code</Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-xs">
                        <DialogHeader>
                            <DialogTitle>Scan to Connect</DialogTitle>
                        </DialogHeader>
                        <div className="flex items-center justify-center p-4 bg-white rounded-md">
                            <QRCode value={shareLink} size={200} />
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <Button onClick={onDisconnect} variant="ghost" className="w-full">
                Cancel
            </Button>
        </div>
    );
}
