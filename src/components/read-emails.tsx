
"use client";

import { useEffect, useState, useCallback } from "react";
import { useSettings } from "@/providers/settings-provider";
import { getLatestEmails, getTicketsFromDB } from "@/app/actions";
import type { Email } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Terminal } from "lucide-react";
import { TicketsView } from "./tickets-view";
import { FilterState } from "./tickets-filter";

interface ReadEmailsProps {
  emails: Email[];
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
  filters: FilterState;
}


export function ReadEmails({ emails, isLoading, error, onRefresh, filters }: ReadEmailsProps) {
  const { isConfigured } = useSettings();

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
          onRefresh={onRefresh}
          filters={filters}
      />
    </div>
  );
}
