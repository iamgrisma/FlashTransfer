"use client";

import { useState } from 'react';
import FileUpload from '@/components/file-upload';
import SharePanel from '@/components/share-panel';
import { Send } from 'lucide-react';
import type { FileDetails } from '@/lib/types';

export default function Home() {
  const [fileDetails, setFileDetails] = useState<FileDetails | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleFileSelect = (file: File) => {
    setFileDetails({
      name: file.name,
      size: file.size,
      type: file.type,
    });
    setIsUploading(true);
    setUploadProgress(0);

    // Simulate upload
    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsUploading(false);
          return 100;
        }
        return prev + 10;
      });
    }, 200);
  };

  const handleReset = () => {
    setFileDetails(null);
    setIsUploading(false);
    setUploadProgress(0);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 selection:bg-primary/20">
      <header className="absolute top-0 left-0 w-full p-4 md:p-6">
        <div className="container mx-auto flex items-center gap-3">
          <Send className="text-primary h-7 w-7" />
          <h1 className="text-2xl font-bold font-headline text-foreground">FileZen</h1>
        </div>
      </header>
      <main className="w-full max-w-lg">
        {!fileDetails ? (
          <FileUpload onFileSelect={handleFileSelect} />
        ) : (
          <SharePanel
            fileDetails={fileDetails}
            uploadProgress={uploadProgress}
            isUploading={isUploading}
            onReset={handleReset}
          />
        )}
      </main>
    </div>
  );
}
