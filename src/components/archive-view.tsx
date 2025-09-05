
"use client";

import { useEffect, useState } from "react";
import type { Email } from "@/app/actions";
import { getTicketsFromDB, unarchiveTickets } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Terminal, Archive, RotateCcw } from "lucide-react";
import { Skeleton } from "./ui/skeleton";
import { TicketItem } from "./ticket-item";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "./ui/button";

export function ArchiveView() {
    const { user, userProfile } = useAuth();
    const [archivedTickets, setArchivedTickets] = useState<Email[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedTickets, setSelectedTickets] = useState<string[]>([]);
    const { toast } = useToast();

    const fetchArchivedTickets = async () => {
        if (!user) return;
        setIsLoading(true);
        setError(null);
        try {
            const isOwner = userProfile?.uid === userProfile?.organizationOwnerUid;
            const tickets = await getTicketsFromDB({ 
                includeArchived: true, 
                agentEmail: isOwner ? undefined : user.email || '' 
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

    const handleSelectTicket = (ticketId: string, checked: boolean) => {
        if (checked) {
            setSelectedTickets(prev => [...prev, ticketId]);
        } else {
            setSelectedTickets(prev => prev.filter(id => id !== ticketId));
        }
    };
    
    const handleUnarchive = async () => {
        if(selectedTickets.length === 0) return;
        const result = await unarchiveTickets(selectedTickets);
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


    return (
        <div className="flex flex-col h-full bg-background p-2 sm:p-4 lg:p-6">
            {selectedTickets.length > 0 && (
                <div className="flex-shrink-0 flex items-center justify-between p-2 mb-4 bg-muted border rounded-lg">
                     <div className="flex items-center gap-2">
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
                            {archivedTickets.map((email) => (
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
        </div>
    );
}
