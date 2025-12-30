"use client";

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Users, ArrowLeft, Rocket, Clock, Zap } from 'lucide-react';
import Link from 'next/link';

export default function BroadcastPage() {
    return (
        <div className="min-h-screen bg-background flex flex-col">
            {/* Header */}
            <header className="border-b">
                <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
                    <Link href="/">
                        <Button variant="ghost" size="sm" className="gap-2">
                            <ArrowLeft className="h-4 w-4" />
                            Back to Home
                        </Button>
                    </Link>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 flex items-center justify-center p-4">
                <div className="max-w-2xl mx-auto text-center space-y-8">
                    {/* Icon */}
                    <div className="relative inline-block">
                        <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full animate-pulse"></div>
                        <div className="relative bg-primary/10 p-6 rounded-full inline-block">
                            <Users className="h-16 w-16 sm:h-20 sm:w-20 text-primary" />
                        </div>
                    </div>

                    {/* Title */}
                    <div className="space-y-3">
                        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold font-headline">
                            Multi-User Mode
                        </h1>
                        <p className="text-xl sm:text-2xl text-muted-foreground font-medium">
                            Coming Soon
                        </p>
                    </div>

                    {/* Description */}
                    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
                        <CardContent className="p-6 sm:p-8 space-y-4">
                            <p className="text-base sm:text-lg text-muted-foreground">
                                We're building something amazing! Multi-User Broadcast mode will allow you to:
                            </p>

                            <div className="grid sm:grid-cols-3 gap-4 pt-4">
                                <div className="flex flex-col items-center gap-2 p-4 bg-background/50 rounded-lg">
                                    <Rocket className="h-8 w-8 text-primary" />
                                    <p className="text-sm font-medium">Share with Multiple Users</p>
                                </div>
                                <div className="flex flex-col items-center gap-2 p-4 bg-background/50 rounded-lg">
                                    <Zap className="h-8 w-8 text-primary" />
                                    <p className="text-sm font-medium">Real-time Analytics</p>
                                </div>
                                <div className="flex flex-col items-center gap-2 p-4 bg-background/50 rounded-lg">
                                    <Clock className="h-8 w-8 text-primary" />
                                    <p className="text-sm font-medium">Download Tracking</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* CTA */}
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            In the meantime, enjoy our secure Peer-to-Peer file sharing
                        </p>
                        <Link href="/">
                            <Button size="lg" className="gap-2">
                                <ArrowLeft className="h-4 w-4" />
                                Try P2P Mode
                            </Button>
                        </Link>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="border-t py-6 mt-auto">
                <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
                    <p>FlashTransfer - Secure, Private, Peer-to-Peer File Sharing</p>
                </div>
            </footer>
        </div>
    );
}
