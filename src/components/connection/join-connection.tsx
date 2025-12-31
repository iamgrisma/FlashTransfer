
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader } from 'lucide-react';

interface JoinConnectionProps {
    inputCode: string;
    setInputCode: (code: string) => void;
    isConnecting: boolean;
    onJoin: () => void;
}

export function JoinConnection({ inputCode, setInputCode, isConnecting, onJoin }: JoinConnectionProps) {
    return (
        <div className="space-y-2">
            <Label htmlFor="join-code">Enter Connection Code</Label>
            <div className="flex gap-2">
                <Input
                    id="join-code"
                    placeholder="Enter 5-character code"
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value.toLowerCase())}
                    maxLength={5}
                    className="text-center text-lg tracking-widest font-mono uppercase"
                />
                <Button onClick={onJoin} disabled={isConnecting || inputCode.length !== 5}>
                    {isConnecting ? <Loader className="animate-spin" /> : 'Join'}
                </Button>
            </div>
        </div>
    );
}
