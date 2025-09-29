
"use client";

import { useEffect, useState, useCallback } from "react";
import { getLatestEmails, getTicketsFromDB } from "@/app/actions";
import type { Email } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Terminal } from "lucide-react";
import { TicketsView } from "./tickets-view";
import { FilterState } from "./tickets-filter";
import { useAuth } from "@/providers/auth-provider";

interface ReadEmailsProps {
  emails: Email[];
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
  filters: FilterState;
}


export function ReadEmails({ emails, isLoading, error, onRefresh, filters }: ReadEmailsProps) {
  const { userProfile } = useAuth();
  
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
