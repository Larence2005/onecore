
"use client";

import { useEffect, useState, useCallback } from "react";
import { useSettings } from "@/providers/settings-provider";
import { getLatestEmails } from "@/app/actions";
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
