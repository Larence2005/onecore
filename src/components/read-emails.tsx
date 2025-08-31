
"use client";

import { useEffect, useState, useCallback } from "react";
import { useSettings } from "@/providers/settings-provider";
import { getLatestEmails, getEmail } from "@/app/actions";
import type { Email, DetailedEmail } from "@/app/actions";
import { Button } from "./ui/button";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "./ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Terminal, Loader2, ChevronLeft, ChevronRight, Download, SlidersHorizontal } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { format, parseISO } from "date-fns";
import { Checkbox } from "./ui/checkbox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "./ui/select";
import { TicketItem } from "./ticket-item";

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
    <div className="w-full">
      <header className="flex items-center justify-between pb-4 border-b mb-4">
        <div className="flex items-center gap-4">
            <Checkbox id="select-all" />
            <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Sort by:</span>
                <Select defaultValue="date-created">
                    <SelectTrigger className="w-auto h-9">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="date-created">Date created</SelectItem>
                        <SelectItem value="date-updated">Date updated</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Layout:</span>
                <Select defaultValue="card">
                    <SelectTrigger className="w-auto h-9">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="card">Card</SelectItem>
                        <SelectItem value="list">List</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <Button variant="outline" size="sm" className="h-9">
                <Download className="mr-2 h-4 w-4" />
                Export
            </Button>
            <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">1 - {emails.length} of {emails.length}</span>
                <Button variant="outline" size="icon" className="h-9 w-9">
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                 <Button variant="outline" size="icon" className="h-9 w-9">
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
            <Button variant="outline" size="sm" className="h-9 xl:hidden">
                <SlidersHorizontal className="mr-2 h-4 w-4" />
                Filters
            </Button>
        </div>
      </header>
      <div className="flex-grow">
        {isLoading ? (
            <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="p-4 border rounded-lg space-y-3">
                        <Skeleton className="h-5 w-3/4 rounded-md" />
                        <div className="flex items-center gap-2">
                            <Skeleton className="h-4 w-24 rounded-md" />
                            <Skeleton className="h-4 w-48 rounded-md" />
                        </div>
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
            <ul className="space-y-4">
                {emails.map((email) => (
                    <TicketItem key={email.id} email={email} onClick={() => handleEmailClick(email.id)} />
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
      </div>
        {isLoadingEmail && (
            <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )}
      {selectedEmail && <EmailDetailDialog email={selectedEmail} onClose={() => setSelectedEmail(null)} />}
    </div>
  );
}
