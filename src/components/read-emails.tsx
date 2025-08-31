
"use client";

import { useEffect, useState, useCallback } from "react";
import { useSettings } from "@/providers/settings-provider";
import { getLatestEmails, getEmail } from "@/app/actions";
import type { Email, DetailedEmail } from "@/app/actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "./ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Terminal, RefreshCw, Loader2 } from "lucide-react";
import { Separator } from "./ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { format, parseISO } from "date-fns";

function EmailDetailDialog({ email, onClose }: { email: DetailedEmail; onClose: () => void; }) {
    return (
        <Dialog open={!!email} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="truncate">{email.subject}</DialogTitle>
                    <DialogDescription>
                        From: {email.sender} | Received: {format(parseISO(email.receivedDateTime), 'PPP p')}
                    </DialogDescription>
                </DialogHeader>
                <div className="flex-grow overflow-auto border rounded-md p-4">
                     {email.body.contentType === 'html' ? (
                        <iframe srcDoc={email.body.content} className="w-full h-full border-0" />
                    ) : (
                        <pre className="whitespace-pre-wrap text-sm">{email.body.content}</pre>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

export function ReadEmails() {
  const { settings, isConfigured } = useSettings();
  const { toast } = useToast();
  const [emails, setEmails] = useState<Email[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<DetailedEmail | null>(null);
  const [isLoadingEmail, setIsLoadingEmail] = useState(false);


  const fetchEmails = useCallback(async () => {
    if (!isConfigured) {
        setIsLoading(false);
        return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const latestEmails = await getLatestEmails(settings);
      setEmails(latestEmails);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      setError(errorMessage);
      toast({
        variant: "destructive",
        title: "Failed to fetch emails.",
        description: errorMessage,
      });
      setEmails([]);
    } finally {
      setIsLoading(false);
    }
  }, [settings, isConfigured, toast]);

  useEffect(() => {
    if (isConfigured) {
        fetchEmails();
    }
  }, [fetchEmails, isConfigured]);

  const handleEmailClick = async (emailId: string) => {
    setIsLoadingEmail(true);
    try {
        const detailedEmail = await getEmail(settings, emailId);
        setSelectedEmail(detailedEmail);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        toast({
            variant: "destructive",
            title: "Failed to load email.",
            description: errorMessage,
        });
    } finally {
        setIsLoadingEmail(false);
    }
  }

  if (!isConfigured && !isLoading) {
    return (
        <Alert className="max-w-2xl mx-auto w-full">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Configuration Required</AlertTitle>
            <AlertDescription>
                Please go to the Settings tab to configure your Microsoft Graph API credentials before you can read emails.
            </AlertDescription>
        </Alert>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex justify-between items-start">
            <div>
                <CardTitle className="font-headline">Tickets</CardTitle>
                <CardDescription>Showing the latest tickets from your inbox.</CardDescription>
            </div>
            <Button variant="outline" size="icon" onClick={fetchEmails} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                <span className="sr-only">Refresh emails</span>
            </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
            <div className="space-y-6">
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="space-y-2">
                        <Skeleton className="h-5 w-3/4 rounded-md" />
                        <Skeleton className="h-4 w-1/2 rounded-md" />
                        <Skeleton className="h-4 w-5/6 rounded-md" />
                    </div>
                ))}
            </div>
        ) : error ? (
            <Alert variant="destructive">
                <Terminal className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        ) : emails.length > 0 ? (
            <ul className="space-y-2">
            {emails.map((email, index) => (
              <li key={email.id}>
                <button 
                  className="w-full text-left p-4 rounded-lg hover:bg-muted/50 transition-colors disabled:opacity-50"
                  onClick={() => handleEmailClick(email.id)}
                  disabled={isLoadingEmail}
                >
                  <div className="flex justify-between items-start">
                    <p className="text-sm font-medium truncate text-foreground pr-4">{email.subject}</p>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(parseISO(email.receivedDateTime), 'PP')}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">From: {email.sender}</p>
                  <p className="text-xs text-muted-foreground truncate pt-1">{email.bodyPreview}</p>
                </button>
                {index < emails.length - 1 && <Separator />}
              </li>
            ))}
          </ul>
        ) : (
            <div className="text-center py-10">
                <p className="text-muted-foreground">No emails found.</p>
                <Button variant="secondary" className="mt-4" onClick={fetchEmails}>
                    Try refreshing
                </Button>
            </div>
        )}
        {isLoadingEmail && (
            <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )}
      </CardContent>
      {selectedEmail && <EmailDetailDialog email={selectedEmail} onClose={() => setSelectedEmail(null)} />}
    </Card>
  );
}
