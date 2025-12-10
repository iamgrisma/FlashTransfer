"use client";

import { useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { UploadCloud } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
}

export default function FileUpload({ onFileSelect }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFile = (file: File | undefined | null) => {
    if (file) {
      onFileSelect(file);
    } else {
      toast({
        title: 'Invalid File',
        description: 'Please select a valid file to upload.',
        variant: 'destructive',
      });
    }
  };

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    handleFile(file);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    handleFile(file);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <Card
      className={cn(
        'transition-all duration-300 border-2 shadow-lg hover:shadow-xl hover:border-primary/50',
        isDragging ? 'border-primary ring-2 ring-primary/50 bg-primary/5' : 'border-dashed'
      )}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <CardContent className="p-10 text-center cursor-pointer">
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="p-4 bg-primary/10 rounded-full border-8 border-primary/5">
            <UploadCloud className={cn('h-12 w-12 text-primary transition-colors', isDragging && 'text-primary-foreground')} />
          </div>
          <div className="space-y-1">
            <p className="text-lg font-semibold text-foreground">
              Drag & drop files here
            </p>
            <p className="text-sm text-muted-foreground">or click to browse and upload</p>
          </div>
        </div>
        <Input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleInputChange}
        />
      </CardContent>
    </Card>
  );
}
