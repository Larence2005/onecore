
"use client";

import { useEffect, useState } from "react";
import type { Email } from "@/app/actions";
import { getTicketsFromDB } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Terminal, Archive } from "lucide-react";
import { Skeleton } from "./ui/skeleton";
import { TicketItem } from "./ticket-item";
import { useAuth } from "@/providers/auth-provider";

export function ArchiveView() {
    const { user } = useAuth();
    const [archivedTickets, setArchivedTickets] = useState<Email[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();

    const fetchArchivedTickets = async () => {
        if (!user) return;
        setIsLoading(true);
        setError(null);
        try {
            const tickets = await getTicketsFromDB({ includeArchived: true, agentEmail: user.email || '' });
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
        fetchArchivedTickets();
    }, [user]);

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
                ) : archivedTickets.length > 0 ? (
                    <div className="border-t">
                        <ul className="space-y-0">
                            {archivedTickets.map((email) => (
                                <TicketItem 
                                    key={email.id} 
                                    email={email} 
                                    isSelected={false} // Archived items can't be selected for actions
                                    onSelect={() => {}} // No-op
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
