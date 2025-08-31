"use client";

import { useEffect, useState, useCallback } from "react";
import { useSettings } from "@/providers/settings-provider";
import { getLatestEmails, Email } from "@/lib/graph";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "./ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Terminal, RefreshCw } from "lucide-react";
import { Separator } from "./ui/separator";

export function ReadEmails() {
  const { settings, isConfigured } = useSettings();
  const { toast } = useToast();
  const [emails, setEmails] = useState<Email[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchEmails = useCallback(async () => {
    if (!isConfigured) {
        setIsLoading(false);
        return;
    }
    setIsLoading(true);
    try {
      const latestEmails = await getLatestEmails(settings);
      setEmails(latestEmails);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to fetch emails.",
        description: error instanceof Error ? error.message : "An unknown error occurred.",
      });
      setEmails([]);
    } finally {
      setIsLoading(false);
    }
  }, [settings, isConfigured, toast]);

  useEffect(() => {
    fetchEmails();
  }, [fetchEmails]);

  if (!isConfigured && !isLoading) {
    return (
        <Alert className="max-w-2xl mx-auto">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Configuration Required</AlertTitle>
            <AlertDescription>
                Please go to the Settings tab to configure your Microsoft Graph API credentials before you can read emails.
            </AlertDescription>
        </Alert>
    );
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex justify-between items-start">
            <div>
                <CardTitle className="font-headline">Inbox</CardTitle>
                <CardDescription>Showing the latest emails from your inbox.</CardDescription>
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
                    </div>
                ))}
            </div>
        ) : emails.length > 0 ? (
            <ul className="space-y-4">
            {emails.map((email, index) => (
              <li key={email.id}>
                <div>
                  <p className="text-sm font-medium truncate text-foreground">{email.subject}</p>
                  <p className="text-sm text-muted-foreground truncate">From: {email.sender}</p>
                </div>
                {index < emails.length - 1 && <Separator className="my-4" />}
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
      </CardContent>
    </Card>
  );
}
