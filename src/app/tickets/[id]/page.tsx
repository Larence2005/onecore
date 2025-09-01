
"use client";

import { useEffect, useState } from 'react';
import { useSettings } from '@/providers/settings-provider';
import { getEmail } from '@/app/actions';
import type { DetailedEmail } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function TicketDetailPage({ params }: { params: { id: string } }) {
    const { id } = params;
    const { settings, isConfigured } = useSettings();
    const { toast } = useToast();
    const [email, setEmail] = useState<DetailedEmail | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchEmail() {
            if (!isConfigured) {
                setError("Please configure your Microsoft Graph API credentials in Settings.");
                setIsLoading(false);
                return;
            }
            if (!id) return;

            setIsLoading(true);
            try {
                const detailedEmail = await getEmail(settings, id);
                setEmail(detailedEmail);
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
                setError(errorMessage);
                toast({
                    variant: "destructive",
                    title: "Failed to load email.",
                    description: errorMessage,
                });
            } finally {
                setIsLoading(false);
            }
        }

        fetchEmail();
    }, [id, settings, isConfigured, toast]);

    return (
        <div className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 space-y-4">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" asChild>
                    <Link href="/">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <h1 className="text-xl font-bold">Ticket Details</h1>
            </div>
            
            {isLoading && (
                <Card>
                    <CardHeader>
                        <Skeleton className="h-8 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-64 w-full" />
                    </CardContent>
                </Card>
            )}

            {error && (
                 <Alert variant="destructive">
                    <Terminal className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {!isLoading && !error && email && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-2xl">{email.subject}</CardTitle>
                        <CardDescription>
                            From: {email.sender} | Received: {format(parseISO(email.receivedDateTime), 'PPP p')}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                         <div className="flex-grow overflow-auto border rounded-md p-4 min-h-[60vh]">
                            {email.body.contentType === 'html' ? (
                                <iframe srcDoc={email.body.content} className="w-full h-full border-0 min-h-[inherit]" />
                            ) : (
                                <pre className="whitespace-pre-wrap text-sm">{email.body.content}</pre>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
