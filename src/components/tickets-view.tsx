
"use client";

import type { Email } from "@/app/actions-types";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Terminal, Archive, ChevronLeft, ChevronRight } from "lucide-react";
import { Checkbox } from "./ui/checkbox";
import { TicketItem } from "./ticket-item";
import { FilterState } from "./tickets-filter";
import { useMemo, useState, useEffect } from "react";
import { isAfter, subDays, parseISO, isPast, isBefore } from "date-fns";
import { archiveTickets } from "@/app/actions-new";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { useAuth } from '@/providers/auth-provider-new';

type TicketsViewProps = {
    emails: Email[];
    isLoading: boolean;
    error: string | null;
    onRefresh: () => void;
    filters: Omit<FilterState, 'groups'>;
};

const filterEmails = (emails: Email[], filters: Omit<FilterState, 'groups'>): Email[] => {
    return emails.filter(email => {
        // Search filter (Subject, Sender, Ticket Number)
        if (filters.search) {
            const searchTerm = filters.search.toLowerCase();
            const subjectMatch = email.subject.toLowerCase().includes(searchTerm);
            const senderMatch = email.sender.toLowerCase().includes(searchTerm);
            const ticketNumberMatch = email.ticketNumber?.toString().includes(searchTerm);

            if (!subjectMatch && !senderMatch && !ticketNumberMatch) {
                return false;
            }
        }
        
        // Tags and Company filter from sidebar
        if (filters.tags) {
            const tagSearchTerms = filters.tags.toLowerCase().split(',').map(t => t.trim()).filter(t => t);
            if (tagSearchTerms.length > 0) {
                const emailTags = (email.tags || []).map(t => t.toLowerCase());
                const companyName = (email.companyName || '').toLowerCase();
                const isResolvedLate = emailTags.includes('resolved late');
                const isOverdue = !isResolvedLate && email.deadline && isPast(parseISO(email.deadline)) && email.status !== 'Resolved' && email.status !== 'Closed';

                const hasMatch = tagSearchTerms.every(searchTerm => {
                    if (searchTerm === 'overdue') {
                        return isOverdue;
                    }
                    if (searchTerm === 'resolved late') {
                        return isResolvedLate;
                    }
                    return emailTags.some(emailTag => emailTag.includes(searchTerm)) ||
                           companyName.includes(searchTerm);
                });

                if (!hasMatch) {
                    return false;
                }
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
        if (filters.agents.length > 0 && !filters.agents.includes(email.assignee!)) {
            return false;
        }

        // Date created filter
        if (filters.created !== 'any' && filters.created !== 'custom') {
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
                 return true; // Should not happen for non-custom
            }
             if (!isAfter(emailDate, startDate)) {
                return false;
            }
        } else if (filters.created === 'custom' && filters.dateRange?.from) {
            const emailDate = parseISO(email.receivedDateTime);
            const fromDate = filters.dateRange.from;
            const toDate = filters.dateRange.to || new Date(); // default to now if not set
            if (!isAfter(emailDate, fromDate) || isAfter(emailDate, toDate)) {
                 return false;
            }
        }


        return true;
    });
};


export function TicketsView({ emails, isLoading, error, onRefresh, filters }: TicketsViewProps) {
    const { userProfile } = useAuth();
    const [selectedTickets, setSelectedTickets] = useState<string[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [ticketsPerPage, setTicketsPerPage] = useState(10);
    const { toast } = useToast();
    
    const filteredEmails = useMemo(() => filterEmails(emails, filters), [emails, filters]);

    // Reset page to 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [filters]);

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
        if(selectedTickets.length === 0 || !userProfile?.organizationId) return;
        const result = await archiveTickets(userProfile.organizationId, selectedTickets);
        if (result.success) {
            toast({
                title: 'Tickets Archived',
                description: `${selectedTickets.length} ticket(s) have been archived.`,
            });
            setSelectedTickets([]);
            // onRefresh is handled by real-time listener, but we might want it for manual refresh
            if(onRefresh) onRefresh();
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
        <div className="flex flex-col h-full bg-muted p-2 sm:p-4 lg:p-6">
            {selectedTickets.length > 0 && (
                <div className="flex-shrink-0 flex items-center justify-between p-2 mb-4 bg-muted border rounded-lg">
                     <div className="flex items-center gap-4">
                         <Checkbox
                            id="select-all-top"
                            checked={isAllSelected}
                            onCheckedChange={(checked) => handleSelectAll(!!checked)}
                            aria-label="Select all"
                         />
                         <span className="text-sm font-medium">{selectedTickets.length} selected</span>
                     </div>
                     <Button variant="outline" size="sm" onClick={handleArchive}>
                         <Archive className="mr-2 h-4 w-4" />
                         Archive
                     </Button>
                </div>
            )}
             <div className="flex-grow overflow-y-auto overflow-x-hidden">
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
                                    onRefresh={onRefresh}
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
                <div className="flex-shrink-0 flex items-center justify-between pt-4 mt-4 border-t">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>Rows per page</span>
                        <Select value={String(ticketsPerPage)} onValueChange={(value) => setTicketsPerPage(Number(value))}>
                            <SelectTrigger className="h-8 w-[70px]">
                                <SelectValue placeholder={String(ticketsPerPage)} />
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
