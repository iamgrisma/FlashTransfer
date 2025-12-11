
"use client";

import { useState } from 'react';
import QRCode from 'qrcode.react';
import FileUpload from '@/components/file-upload';
import { Check, Copy, File as FileIcon, Loader, Mail, QrCode, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from './ui/separator';

interface SharePanelProps {
  files: File[];
  transferProgress: { [key: string]: number };
  onReset: () => void;
  shareLink: string;
  shortCode: string;
  onFileAdd: (files: FileList) => void;
}

export default function SharePanel({ files, transferProgress, onReset, shareLink, shortCode, onFileAdd }: SharePanelProps) {
  const [hasCopied, setHasCopied] = useState(false);
  const { toast } = useToast();

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };
  
  const handleCopy = (textToCopy: string) => {
    navigator.clipboard.writeText(textToCopy);
    setHasCopied(true);
    toast({ title: 'Success', description: 'Copied to clipboard!' });
    setTimeout(() => setHasCopied(false), 2000);
  };

  const handleShareEmail = () => {
    const subject = `File Share Invitation`;
    const body = `Someone has shared ${files.length} file(s) with you using FileZen.\n\nTo download, enter this code on the FileZen website: ${shortCode}\n\nOr use this direct link:\n${shareLink}`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const totalProgress = files.length > 0 
    ? files.reduce((acc, file) => acc + (transferProgress[file.name] || 0), 0) / files.length
    : 0;
  const isTransferring = Object.values(transferProgress).some(p => p > 0 && p < 100);
  const isConnecting = !shareLink;

  return (
    <Card className="w-full max-w-lg shadow-lg animate-in fade-in-0 zoom-in-95">
      <CardHeader>
        <div className="flex justify-between items-start">
            <div>
                <CardTitle className="font-headline">Share Files</CardTitle>
                <CardDescription>
                  {isConnecting ? "Generating share session..." : (isTransferring ? "Transfer in progress..." : "Ready to transfer. Waiting for receivers...")}
                </CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={onReset} aria-label="Cancel share">
                <X className="h-5 w-5" />
            </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
            {files.map(file => (
                <div key={file.name} className="flex items-center space-x-4 p-3 rounded-md border bg-secondary/50">
                    <FileIcon className="h-8 w-8 text-primary" />
                    <div className="flex-1 overflow-hidden">
                        <p className="text-sm font-medium truncate text-foreground">{file.name}</p>
                        <p className="text-sm text-muted-foreground">{formatBytes(file.size)}</p>
                    </div>
                    {transferProgress[file.name] !== undefined && (
                      <div className="w-24 text-right">
                        {transferProgress[file.name] < 100 ? (
                            <span className="text-sm font-medium text-primary">{Math.round(transferProgress[file.name])}%</span>
                        ) : (
                            <Check className="h-5 w-5 text-green-500" />
                        )}
                      </div>
                    )}
                </div>
            ))}
        </div>
        
        {isConnecting && (
           <div className="flex items-center justify-center p-4"><Loader className="animate-spin text-primary h-8 w-8"/></div>
        )}

        {totalProgress > 0 && totalProgress < 100 && (
          <div className="space-y-2">
              <div className="flex justify-between items-center">
                  <Label>Overall Progress</Label>
                  <span className="text-sm font-medium text-primary">{Math.round(totalProgress)}%</span>
              </div>
              <Progress value={totalProgress} />
          </div>
        )}

        <Separator />
        
        <FileUpload onFileSelect={onFileAdd} isSessionActive={true} />

        {shareLink && (
          <div className="space-y-4 animate-in fade-in-0">
            <Separator />
             <div className="space-y-2">
                <Label htmlFor="short-code">Share Code (5 characters)</Label>
                <div className="flex space-x-2">
                  <Input id="short-code" value={shortCode} readOnly className="text-2xl h-14 text-center tracking-[0.3em] font-mono" />
                  <Button onClick={() => handleCopy(shortCode)} size="icon" variant="outline" aria-label="Copy code">
                    <Copy className="h-5 w-5" />
                  </Button>
                </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="share-link">Or Share Full Link</Label>
              <div className="flex space-x-2">
                <Input id="share-link" value={shareLink} readOnly />
                <Button onClick={() => handleCopy(shareLink)} size="icon" variant="outline" aria-label="Copy link">
                  {hasCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
           
            <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={handleShareEmail}><Mail className="mr-2"/> Email</Button>
                
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline"><QrCode className="mr-2" /> QR Code</Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-xs">
                    <DialogHeader>
                      <DialogTitle>Scan QR Code</DialogTitle>
                    </DialogHeader>
                    <div className="flex items-center justify-center p-4 bg-white rounded-md">
                      {shareLink && <QRCode value={shareLink} size={200} />}
                    </div>
                  </DialogContent>
                </Dialog>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter>
          <p className="text-xs text-muted-foreground text-center w-full">
            Keep this window open. Receivers can connect as long as this tab is open.
          </p>
      </CardFooter>
    </Card>
  );
}

    