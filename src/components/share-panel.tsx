"use client";

import { useState } from 'react';
import QRCode from 'qrcode.react';
import type { FileDetails } from '@/lib/types';
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
  fileDetails: FileDetails;
  uploadProgress: number;
  isUploading: boolean; 
  onReset: () => void;
  shareLink: string;
  shortCode: string;
}

export default function SharePanel({ fileDetails, uploadProgress, isUploading, onReset, shareLink, shortCode }: SharePanelProps) {
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
    const subject = `File Share: ${fileDetails.name}`;
    const body = `Someone has shared a file with you. Click the link to download:\n\n${shareLink}\n\nOr, go to ${window.location.origin}/join and enter the code: ${shortCode}`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };


  return (
    <Card className="w-full max-w-lg shadow-lg animate-in fade-in-0 zoom-in-95">
      <CardHeader>
        <div className="flex justify-between items-start">
            <div>
                <CardTitle className="font-headline">Share File</CardTitle>
                <CardDescription>
                  {isUploading ? "Waiting for recipient to connect..." : "Ready to transfer."}
                </CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={onReset} aria-label="Cancel share">
                <X className="h-5 w-5" />
            </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center space-x-4 p-4 rounded-md border bg-secondary/50">
          <FileIcon className="h-8 w-8 text-primary" />
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-medium truncate text-foreground">{fileDetails.name}</p>
            <p className="text-sm text-muted-foreground">{formatBytes(fileDetails.size)}</p>
          </div>
        </div>
        
        {(isUploading || uploadProgress > 0) && (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
                <Label htmlFor="upload-progress">
                  {isUploading ? "Waiting for connection..." : "Transferring..."}
                </Label>
                {uploadProgress > 0 && <span className="text-sm font-medium text-primary">{Math.round(uploadProgress)}%</span>}
            </div>
            {isUploading && <div className="flex items-center justify-center p-4"><Loader className="animate-spin text-primary"/></div>}
            {!isUploading && <Progress id="upload-progress" value={uploadProgress} />}
          </div>
        )}

        {shareLink && (
          <div className="space-y-4">
            <Separator />
             <div className="space-y-2">
                <Label htmlFor="short-code">Share Code</Label>
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
                    <div className="flex items-center justify-center p-4">
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
            Keep this window open until the file transfer is complete.
          </p>
      </CardFooter>
    </Card>
  );
}
