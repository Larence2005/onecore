
"use client";

import type { Email } from "@/app/actions";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Terminal, Archive } from "lucide-react";
import { Checkbox } from "./ui/checkbox";
import { TicketItem } from "./ticket-item";
import { FilterState } from "./tickets-filter";
import { useMemo, useState } from "react";
import { isAfter, subDays, parseISO } from "date-fns";
import { archiveTickets } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";


type TicketsViewProps = {
    emails: Email[];
    isLoading: boolean;
    error: string | null;
    onRefresh: () => void;
    filters: FilterState;
};

const filterEmails = (emails: Email[], filters: FilterState): Email[] => {
    return emails.filter(email => {
        // Search filter (Subject, Sender)
        if (filters.search) {
            const searchTerm = filters.search.toLowerCase();
            const subjectMatch = email.subject.toLowerCase().includes(searchTerm);
            const senderMatch = email.sender.toLowerCase().includes(searchTerm);
            if (!subjectMatch && !senderMatch) {
                return false;
            }
        }
        
        // Tags filter
        if (filters.tags) {
            const tagSearchTerm = filters.tags.toLowerCase();
            if (!email.tags?.some(tag => tag.toLowerCase().includes(tagSearchTerm))) {
                return false;
            }
        }

        // Status filter
        if (filters.statuses.length > 0 && !filters.statuses.includes(email.status)) {
            return false;
        }
        
        // Priority filter
        if (filters.priorities.length > 0 && !filters.priorities.includes(email.priority)) {
            return false;
        }

        // Type filter
        if (filters.types.length > 0 && !filters.types.includes(email.type)) {
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
    const [selectedTickets, setSelectedTickets] = useState<string[]>([]);
    const { toast } = useToast();

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedTickets(filteredEmails.map(email => email.id));
        } else {
            setSelectedTickets([]);
        }
    };

    const handleSelectTicket = (ticketId: string, checked: boolean) => {
        if (checked) {
            setSelectedTickets(prev => [...prev, ticketId]);
        } else {
            setSelectedTickets(prev => prev.filter(id => id !== ticketId));
        }
    };
    
    const handleArchive = async () => {
        if(selectedTickets.length === 0) return;
        const result = await archiveTickets(selectedTickets);
        if (result.success) {
            toast({
                title: 'Tickets Archived',
                description: `${selectedTickets.length} ticket(s) have been archived.`,
            });
            setSelectedTickets([]);
            onRefresh();
        } else {
            toast({
                variant: 'destructive',
                title: 'Archiving Failed',
                description: result.error,
            });
        }
    };

    const isAllSelected = filteredEmails.length > 0 && selectedTickets.length === filteredEmails.length;


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
                        <div className="flex items-center gap-4 p-4 border-b bg-muted/50 min-h-[58px]">
                            {selectedTickets.length > 0 ? (
                                <>
                                    <Checkbox 
                                        id="select-all" 
                                        onCheckedChange={handleSelectAll}
                                        checked={isAllSelected}
                                    />
                                    <span className="text-sm font-medium text-muted-foreground">{selectedTickets.length} selected</span>
                                    <Button variant="outline" size="sm" onClick={handleArchive}>
                                        <Archive className="mr-2 h-4 w-4" />
                                        Archive
                                    </Button>
                                </>
                            ) : (
                                <div className="w-4 h-4" /> // Placeholder to maintain layout
                            )}
                        </div>
                        <ul className="space-y-0">
                            {filteredEmails.map((email) => (
                                <TicketItem 
                                    key={email.id} 
                                    email={email} 
                                    isSelected={selectedTickets.includes(email.id)}
                                    onSelect={handleSelectTicket}
                                />
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
