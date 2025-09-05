
"use client";

import type { Email } from "@/app/actions";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Terminal, Archive, ChevronLeft, ChevronRight } from "lucide-react";
import { Checkbox } from "./ui/checkbox";
import { TicketItem } from "./ticket-item";
import { FilterState } from "./tickets-filter";
import { useMemo, useState } from "react";
import { isAfter, subDays, parseISO } from "date-fns";
import { archiveTickets } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";


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
    const [selectedTickets, setSelectedTickets] = useState<string[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [ticketsPerPage, setTicketsPerPage] = useState(10);
    const { toast } = useToast();
    
    const filteredEmails = useMemo(() => filterEmails(emails, filters), [emails, filters]);

    // Pagination logic
    const indexOfLastTicket = currentPage * ticketsPerPage;
    const indexOfFirstTicket = indexOfLastTicket - ticketsPerPage;
    const currentTickets = filteredEmails.slice(indexOfFirstTicket, indexOfLastTicket);
    const totalPages = Math.ceil(filteredEmails.length / ticketsPerPage);


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
            {selectedTickets.length > 0 && (
                <div className="flex-shrink-0 flex items-center justify-between p-2 mb-4 bg-muted border rounded-lg">
                     <div className="flex items-center gap-2">
                         <span className="text-sm font-medium">{selectedTickets.length} selected</span>
                     </div>
                     <Button variant="outline" size="sm" onClick={handleArchive}>
                         <Archive className="mr-2 h-4 w-4" />
                         Archive
                     </Button>
                </div>
            )}
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
                        <ul className="space-y-0">
                            {currentTickets.map((email) => (
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
            {totalPages > 1 && (
                <div className="flex-shrink-0 flex items-center justify-between p-2 mt-4 border-t">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>Rows per page</span>
                        <Select value={String(ticketsPerPage)} onValueChange={(value) => setTicketsPerPage(Number(value))}>
                            <SelectTrigger className="h-8 w-[70px]">
                                <SelectValue placeholder={ticketsPerPage} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="10">10</SelectItem>
                                <SelectItem value="25">25</SelectItem>
                                <SelectItem value="50">50</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                        <span className="text-muted-foreground">
                            Page {currentPage} of {totalPages}
                        </span>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                disabled={currentPage === totalPages}
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
