
"use client";

import { useEffect, useState, useMemo } from "react";
import type { Email } from "@/app/actions-types";
import { getTicketsFromDB, unarchiveTickets } from "@/app/actions-new";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Terminal, Archive, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import { Skeleton } from "./ui/skeleton";
import { TicketItem } from "./ticket-item";
import { useAuth } from '@/providers/auth-provider-new';
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Card, CardFooter } from "./ui/card";
import { Checkbox } from "./ui/checkbox";

export function ArchiveView() {
    const { user, userProfile } = useAuth();
    const [archivedTickets, setArchivedTickets] = useState<Email[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedTickets, setSelectedTickets] = useState<string[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [ticketsPerPage, setTicketsPerPage] = useState(10);
    const { toast } = useToast();

    const fetchArchivedTickets = async () => {
        if (!user || !userProfile?.organizationId) return;
        setIsLoading(true);
        setError(null);
        try {
            const tickets = await getTicketsFromDB(userProfile.organizationId, { 
                includeArchived: true, 
            });
            setArchivedTickets(tickets);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
            setError(errorMessage);
            toast({
                variant: "destructive",
                title: "Failed to load archived tickets.",
                description: errorMessage,
            });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (user && userProfile) {
            fetchArchivedTickets();
        }
    }, [user, userProfile]);

    const paginatedTickets = useMemo(() => {
        const startIndex = (currentPage - 1) * ticketsPerPage;
        const endIndex = startIndex + ticketsPerPage;
        return archivedTickets.slice(startIndex, endIndex);
    }, [archivedTickets, currentPage, ticketsPerPage]);

    const totalPages = Math.ceil(archivedTickets.length / ticketsPerPage);

    const handleSelectTicket = (ticketId: string, checked: boolean) => {
        if (checked) {
            setSelectedTickets(prev => [...prev, ticketId]);
        } else {
            setSelectedTickets(prev => prev.filter(id => id !== ticketId));
        }
    };
    
    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedTickets(archivedTickets.map(email => email.id));
        } else {
            setSelectedTickets([]);
        }
    };
    
    const handleUnarchive = async () => {
        if(selectedTickets.length === 0 || !userProfile?.organizationId) return;
        const result = await unarchiveTickets(userProfile.organizationId, selectedTickets);
        if (result.success) {
            toast({
                title: 'Tickets Unarchived',
                description: `${selectedTickets.length} ticket(s) have been restored to the inbox.`,
            });
            setSelectedTickets([]);
            fetchArchivedTickets();
        } else {
            toast({
                variant: 'destructive',
                title: 'Unarchiving Failed',
                description: result.error,
            });
        }
    };

    const isAllSelected = archivedTickets.length > 0 && selectedTickets.length === archivedTickets.length;


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
                     <Button variant="outline" size="sm" onClick={handleUnarchive}>
                         <RotateCcw className="mr-2 h-4 w-4" />
                         Unarchive
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
                ) : archivedTickets.length > 0 ? (
                    <div className="border-t">
                        <ul className="space-y-0">
                            {paginatedTickets.map((email) => (
                                <TicketItem 
                                    key={email.id} 
                                    email={email} 
                                    isSelected={selectedTickets.includes(email.id)}
                                    onSelect={handleSelectTicket}
                                    isArchivedView={true}
                                />
                            ))}
                        </ul>
                    </div>
                ) : (
                    <div className="text-center py-16">
                        <Archive className="mx-auto h-12 w-12 text-muted-foreground" />
                        <h3 className="mt-4 text-lg font-semibold">No Archived Tickets</h3>
                        <p className="mt-2 text-sm text-muted-foreground">
                            You can archive tickets from the main tickets view.
                        </p>
                    </div>
                )}
            </div>
             {totalPages > 1 && (
                <CardFooter className="flex items-center justify-between pt-6 mt-4 border-t">
                    <div className="text-sm text-muted-foreground">
                        Showing {Math.min(ticketsPerPage * currentPage, archivedTickets.length)} of {archivedTickets.length} tickets.
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Rows per page</span>
                            <Select value={String(ticketsPerPage)} onValueChange={(value) => { setTicketsPerPage(Number(value)); setCurrentPage(1); }}>
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
                        <div className="text-sm text-muted-foreground">
                            Page {currentPage} of {totalPages}
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </CardFooter>
            )}
        </div>
    );
}
