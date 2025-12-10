
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

export default function ReceiveForm() {
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 5) {
      toast({
        variant: 'destructive',
        title: 'Invalid Code',
        description: 'Please enter a valid 5-character alphanumeric code.',
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/share', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ shortCode: code }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Share code not found or expired.');
      }

      const { obfuscatedCode } = await response.json();
      
      if (!obfuscatedCode) {
        throw new Error('Invalid response from server.');
      }
      
      router.push(`/s/${obfuscatedCode}`);

    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Could not find a share session with that code.',
      });
      setIsLoading(false);
    }
  };

  return (
    <Card className="shadow-none border-none">
        <CardHeader className="text-center">
            <CardTitle>Receive a File</CardTitle>
            <CardDescription>Enter the 5-character code from the sender to begin the file download.</CardDescription>
        </CardHeader>
        <CardContent>
            <form onSubmit={handleJoin} className="space-y-6">
                <div className="space-y-2">
                <Label htmlFor="share-code" className="sr-only">Share Code</Label>
                <Input
                    id="share-code"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
                    placeholder="a1b2c"
                    maxLength={5}
                    className="text-2xl h-14 text-center tracking-[0.3em] font-mono"
                    disabled={isLoading}
                    autoComplete="off"
                />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading || code.length !== 5}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Join
                </Button>
            </form>
        </CardContent>
    </Card>
  );
}
