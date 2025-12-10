
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function JoinPage() {
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const { toast } = useToast();

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) {
      toast({
        variant: 'destructive',
        title: 'Invalid Code',
        description: 'Please enter a valid 6-digit share code.',
      });
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase
        .from('fileshare')
        .select('id')
        .eq('short_code', code)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (error || !data) {
        throw new Error('Share session not found or has expired.');
      }
      
      router.push(`/${data.id}`);

    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Could not find the share session.',
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader>
          <CardTitle>Join a Share Session</CardTitle>
          <CardDescription>Enter the 6-digit code from the sender to begin the file download.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleJoin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="share-code">Share Code</Label>
              <Input
                id="share-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ABCDEF"
                maxLength={6}
                className="text-2xl h-14 text-center tracking-[0.3em] font-mono"
                disabled={isLoading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Join
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Or, <Link href="/" className="text-primary underline">start a new share</Link>.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
