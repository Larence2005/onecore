
"use client";

import type { Email } from "@/app/actions";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Terminal, ChevronLeft, ChevronRight, Download, SlidersHorizontal } from "lucide-react";
import { Checkbox } from "./ui/checkbox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "./ui/select";
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
        <div className="flex flex-col h-full">
            <header className="flex items-center justify-between pb-4 border-b mb-4 flex-shrink-0">
                <div className="flex items-center gap-4">
                    <Checkbox id="select-all" />
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Sort by:</span>
                        <Select defaultValue="date-created">
                            <SelectTrigger className="w-auto h-9">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="date-created">Date created</SelectItem>
                                <SelectItem value="date-updated">Date updated</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Layout:</span>
                        <Select defaultValue="card">
                            <SelectTrigger className="w-auto h-9">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="card">Card</SelectItem>
                                <SelectItem value="list">List</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <Button variant="outline" size="sm" className="h-9">
                        <Download className="mr-2 h-4 w-4" />
                        Export
                    </Button>
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">1 - {emails.length} of {emails.length}</span>
                        <Button variant="outline" size="icon" className="h-9 w-9">
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon" className="h-9 w-9">
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                    <Button variant="outline" size="sm" className="h-9 xl:hidden">
                        <SlidersHorizontal className="mr-2 h-4 w-4" />
                        Filters
                    </Button>
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
