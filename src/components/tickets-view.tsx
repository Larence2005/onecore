
"use client";

import type { Email } from "@/app/actions";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Terminal } from "lucide-react";
import { Checkbox } from "./ui/checkbox";
import { TicketItem } from "./ticket-item";

type TicketsViewProps = {
    emails: Email[];
    isLoading: boolean;
    error: string | null;
    onEmailClick: (id: string) => void;
    onRefresh: () => void;
};

export function TicketsView({ emails, isLoading, error, onEmailClick, onRefresh }: TicketsViewProps) {
    return (
        <div className="flex flex-col h-full bg-background p-4 sm:p-6 lg:p-8">
            <header className="sticky top-0 bg-background z-10 flex items-center justify-between py-4 border-b mb-4 flex-shrink-0">
                <div className="flex items-center gap-4">
                    <Checkbox id="select-all" />
                    <h1 className="text-xl font-bold">Tickets</h1>
                </div>
            </header>
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
                ) : emails.length > 0 ? (
                    <ul className="space-y-4">
                        {emails.map((email) => (
                            <TicketItem key={email.id} email={email} onClick={() => onEmailClick(email.id)} />
                        ))}
                    </ul>
                ) : (
                    <div className="text-center py-10">
                        <p className="text-muted-foreground">No emails found.</p>
                        <Button variant="secondary" className="mt-4" onClick={onRefresh}>
                            Try refreshing
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
