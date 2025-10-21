

"use client";

import { useEffect, useState, useCallback } from "react";
import { getLatestEmails } from "@/app/actions-email";
import { getTicketsFromDB } from "@/app/actions-new";
import type { Email } from "@/app/actions-types";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Terminal } from "lucide-react";
import { TicketsView } from "./tickets-view";
import { FilterState } from "./tickets-filter";
import { useAuth } from '@/providers/auth-provider-new';

interface ReadEmailsProps {
  emails: Email[];
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
  filters: Omit<FilterState, 'groups'>;
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
