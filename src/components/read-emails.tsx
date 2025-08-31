
"use client";

import { useEffect, useState, useCallback } from "react";
import { useSettings } from "@/providers/settings-provider";
import { getLatestEmails, getEmail } from "@/app/actions";
import type { Email, DetailedEmail } from "@/app/actions";
import { Button } from "./ui/button";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "./ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Terminal, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { format, parseISO } from "date-fns";
import { TicketsView } from "./tickets-view";

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
  const [isLoading, setIsLoading] = useState(true);
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
    } else {
        setIsLoading(false);
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
        <div className="flex items-center justify-center h-full">
            <Alert className="max-w-2xl mx-auto w-full">
                <Terminal className="h-4 w-4" />
                <AlertTitle>Configuration Required</AlertTitle>
                <AlertDescription>
                    Please go to the Settings tab to configure your Microsoft Graph API credentials before you can read emails.
                </AlertDescription>
            </Alert>
        </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <TicketsView
          emails={emails}
          isLoading={isLoading}
          error={error}
          onEmailClick={handleEmailClick}
          onRefresh={fetchEmails}
      />

      {isLoadingEmail && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-50">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
      )}
      {selectedEmail && <EmailDetailDialog email={selectedEmail} onClose={() => setSelectedEmail(null)} />}
    </div>
  );
}
