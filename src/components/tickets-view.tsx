
"use client";

import type { Email } from "@/app/actions";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Terminal } from "lucide-react";
import { Checkbox } from "./ui/checkbox";
import { TicketItem } from "./ticket-item";
import { FilterState } from "./tickets-filter";
import { useMemo } from "react";
import { isAfter, subDays, parseISO } from "date-fns";


type TicketsViewProps = {
    emails: Email[];
    isLoading: boolean;
    error: string | null;
    onRefresh: () => void;
    filters: FilterState;
};

const filterEmails = (emails: Email[], filters: FilterState): Email[] => {
    return emails.filter(email => {
        // Search filter
        if (filters.search) {
            const searchTerm = filters.search.toLowerCase();
            const subjectMatch = email.subject.toLowerCase().includes(searchTerm);
            const senderMatch = email.sender.toLowerCase().includes(searchTerm);
            const tagMatch = email.tags?.some(tag => tag.toLowerCase().includes(searchTerm));
            if (!subjectMatch && !senderMatch && !tagMatch) {
                return false;
            }
        }

        // Status filter
        if (filters.statuses.length > 0 && !filters.statuses.includes(email.status)) {
            return false;
        }

        // Agent filter
        if (filters.agents.length > 0 && !filters.agents.includes(email.assignee)) {
            return false;
        }

        // Group filter - Assuming no group data for now, so this is a placeholder
        if (filters.groups.length > 0) {
            // return false; // No group data on email object
        }

        // Date created filter
        if (filters.created !== 'any') {
            const emailDate = parseISO(email.receivedDateTime);
            let startDate: Date;
            if (filters.created === 'today') {
                startDate = subDays(new Date(), 1);
            } else if (filters.created === '7d') {
                startDate = subDays(new Date(), 7);
            } else if (filters.created === '30d') {
                startDate = subDays(new Date(), 30);
            } else if (filters.created === '90d') {
                startDate = subDays(new Date(), 90);
            } else {
                startDate = new Date(0); // Should not happen with 'any' check
            }

            if (!isAfter(emailDate, startDate)) {
                return false;
            }
        }

        return true;
    });
};


export function TicketsView({ emails, isLoading, error, onRefresh, filters }: TicketsViewProps) {
    const filteredEmails = useMemo(() => filterEmails(emails, filters), [emails, filters]);

    return (
        <div className="flex flex-col h-full bg-background p-2 sm:p-4 lg:p-6">
             <div className="flex-grow overflow-y-auto">
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
                ) : filteredEmails.length > 0 ? (
                     <div className="border-t">
                        <div className="flex items-center gap-4 p-4 border-b bg-muted/50">
                            <Checkbox id="select-all" />
                            <span className="text-sm font-medium text-muted-foreground">Select all</span>
                        </div>
                        <ul className="space-y-0">
                            {filteredEmails.map((email) => (
                                <TicketItem key={email.id} email={email} />
                            ))}
                        </ul>
                    </div>
                ) : (
                    <div className="text-center py-10">
                        <p className="text-muted-foreground">No emails match the current filters.</p>
                        <Button variant="secondary" className="mt-4" onClick={onRefresh}>
                            Refresh Tickets
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
