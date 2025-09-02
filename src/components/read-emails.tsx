
"use client";

import { useEffect, useState, useCallback } from "react";
import { useSettings } from "@/providers/settings-provider";
import { getLatestEmails, getTicketsFromDB } from "@/app/actions";
import type { Email } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Terminal } from "lucide-react";
import { TicketsView } from "./tickets-view";

export function ReadEmails() {
  const { settings, isConfigured } = useSettings();
  const { toast } = useToast();
  const [emails, setEmails] = useState<Email[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEmails = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    // Immediately fetch from the database to show existing data
    try {
        const dbEmails = await getTicketsFromDB();
        setEmails(dbEmails);
    } catch (dbError) {
        const dbErrorMessage = dbError instanceof Error ? dbError.message : "An unknown database error occurred.";
        setError(dbErrorMessage);
        setEmails([]);
    } finally {
        setIsLoading(false);
    }

    // Then, trigger the API sync in the background if configured
    if (isConfigured) {
        try {
            await getLatestEmails(settings);
            // After sync, refresh data from DB to show any new emails
            const updatedDbEmails = await getTicketsFromDB();
            setEmails(updatedDbEmails);
        } catch (syncError) {
            const syncErrorMessage = syncError instanceof Error ? syncError.message : "An unknown sync error occurred.";
            // We can choose to show a non-blocking toast notification here
            toast({
                variant: "destructive",
                title: "Failed to sync with email server.",
                description: syncErrorMessage,
            });
        }
    }
  }, [settings, isConfigured, toast]);

  useEffect(() => {
    fetchEmails();
  }, [fetchEmails]);


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
          onRefresh={fetchEmails}
      />
    </div>
  );
}
