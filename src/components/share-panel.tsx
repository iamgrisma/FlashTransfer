"use client";

import { useEffect, useState } from 'react';
import type { FileDetails, Permission } from '@/lib/types';
import { Check, Clock, Copy, Download, Edit, Eye, File as FileIcon, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';


interface SharePanelProps {
  fileDetails: FileDetails;
  uploadProgress: number;
  isUploading: boolean;
  onReset: () => void;
}

export default function SharePanel({ fileDetails, uploadProgress, isUploading, onReset }: SharePanelProps) {
  const [shareLink, setShareLink] = useState('');
  const [hasCopied, setHasCopied] = useState(false);
  const [selectedPermission, setSelectedPermission] = useState<Permission>("View Only");
  const { toast } = useToast();

  useEffect(() => {
    // Generate a fake share link once upload is complete
    if (!isUploading) {
      const randomId = Math.random().toString(36).substring(2, 10);
      setShareLink(`https://filezen.app/s/${randomId}`);
    }
  }, [isUploading]);

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };
  
  const handleCopy = () => {
    if (!shareLink) return;
    navigator.clipboard.writeText(shareLink);
    setHasCopied(true);
    toast({ title: 'Success', description: 'Link copied to clipboard!' });
    setTimeout(() => setHasCopied(false), 2000);
  };

  const permissionIcons: Record<Permission, React.ReactNode> = {
    "View Only": <Eye className="h-4 w-4 text-muted-foreground" />,
    "Download": <Download className="h-4 w-4 text-muted-foreground" />,
    "Editor": <Edit className="h-4 w-4 text-muted-foreground" />,
  };
  
  const permissions: Permission[] = ["View Only", "Download", "Editor"];

  return (
    <Card className="w-full max-w-lg shadow-lg animate-in fade-in-0 zoom-in-95">
      <CardHeader>
        <div className="flex justify-between items-start">
            <div>
                <CardTitle className="font-headline">Share File</CardTitle>
                <CardDescription>Your file is ready to be shared.</CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={onReset} aria-label="Upload another file">
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
        
        {isUploading && (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
                <Label htmlFor="upload-progress">Uploading...</Label>
                <span className="text-sm font-medium text-primary">{uploadProgress}%</span>
            </div>
            <Progress id="upload-progress" value={uploadProgress} />
          </div>
        )}

        {!isUploading && shareLink && (
          <div className="space-y-6 animate-in fade-in-50 duration-500">
            <div className="space-y-2">
              <Label htmlFor="share-link">Shareable Link</Label>
              <div className="flex space-x-2">
                <Input id="share-link" value={shareLink} readOnly className="text-base" />
                <Button onClick={handleCopy} size="icon" variant="outline" aria-label="Copy link">
                  {hasCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
                <Label htmlFor="expiration">Link Expiration</Label>
                <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-muted-foreground"/>
                    <Select defaultValue="7d">
                        <SelectTrigger id="expiration" className="w-full">
                            <SelectValue placeholder="Set expiration" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="1h">1 hour</SelectItem>
                            <SelectItem value="1d">1 day</SelectItem>
                            <SelectItem value="7d">7 days</SelectItem>
                            <SelectItem value="30d">30 days</SelectItem>
                            <SelectItem value="never">Never</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
            
            <div className="space-y-4 rounded-lg border p-4 bg-secondary/30">
              <h3 className="font-medium text-foreground">Manage Access</h3>
              <RadioGroup 
                  value={selectedPermission}
                  onValueChange={(value: Permission) => setSelectedPermission(value)}
                  className="space-y-1 pt-2"
              >
                  <Label>Access Level</Label>
                  {permissions.map((p) => (
                      <Label 
                          key={p} 
                          htmlFor={p} 
                          className="flex items-center space-x-3 p-3 rounded-md border has-[:checked]:border-primary has-[:checked]:bg-primary/5 transition-colors cursor-pointer"
                      >
                          <RadioGroupItem value={p} id={p} />
                          <div className="flex items-center gap-2 text-sm">
                              {permissionIcons[p]}
                              <span className="font-medium">{p}</span>
                          </div>
                      </Label>
                  ))}
              </RadioGroup>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter>
          <Button className="w-full text-lg py-6 bg-primary hover:bg-primary/90">Share File</Button>
      </CardFooter>
    </Card>
  );
}
