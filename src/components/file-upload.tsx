
"use client";

import { useRef, useState } from 'react';
import type { ChangeEvent, DragEvent, KeyboardEvent } from 'react';
import { UploadCloud, PlusCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  onFileSelect: (files: FileList) => void;
  isSessionActive?: boolean;
}

export default function FileUpload({ onFileSelect, isSessionActive = false }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFiles = (files: FileList | undefined | null) => {
    if (files && files.length > 0) {
      onFileSelect(files);
    } else {
      toast({
        title: 'No Files Selected',
        description: 'Please select one or more files.',
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
    const files = e.dataTransfer.files;
    handleFiles(files);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    handleFiles(files);
    // Reset file input to allow selecting the same file again
    if(e.target) e.target.value = '';
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <Card
      className={cn(
        'transition-all duration-300 border-2 shadow-lg hover:shadow-xl hover:border-primary/50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        isDragging ? 'border-primary ring-2 ring-primary/50 bg-primary/5' : 'border-dashed'
      )}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={isSessionActive ? "Add more files" : "Upload files"}
    >
      <CardContent className="p-10 text-center">
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="p-4 bg-primary/10 rounded-full border-8 border-primary/5">
            {isSessionActive ? (
              <PlusCircle className={cn('h-12 w-12 text-primary transition-colors', isDragging && 'text-primary-foreground')} />
            ) : (
              <UploadCloud className={cn('h-12 w-12 text-primary transition-colors', isDragging && 'text-primary-foreground')} />
            )}
          </div>
          <div className="space-y-1">
            <p className="text-lg font-semibold text-foreground">
              {isSessionActive ? "Add more files" : "Drag & drop files here"}
            </p>
            <p className="text-sm text-muted-foreground">or click to browse and upload</p>
          </div>
        </div>
        <Input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleInputChange}
          multiple
          tabIndex={-1}
          aria-hidden="true"
        />
      </CardContent>
    </Card>
  );
}
