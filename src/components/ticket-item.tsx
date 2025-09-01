
"use client";

import type { Email } from "@/app/actions";
import { format, parseISO } from "date-fns";
import { Checkbox } from "./ui/checkbox";
import { Badge } from "./ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { cn } from "@/lib/utils";
import { Card } from "./ui/card";
import Link from 'next/link';
import { updateTicket } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

type TicketItemProps = {
    email: Email;
};

const priorities = [
    { value: 'Low', label: 'Low', color: 'bg-green-500' },
    { value: 'Medium', label: 'Medium', color: 'bg-blue-500' },
    { value: 'High', label: 'High', color: 'bg-yellow-500' },
    { value: 'Urgent', label: 'Urgent', color: 'bg-red-500' },
];

const statuses = [
    { value: 'Open', label: 'Open' },
    { value: 'Pending', label: 'Pending' },
    { value: 'Resolved', label: 'Resolved' },
    { value: 'Closed', label: 'Closed' },
];

const assignees = [
    'Unassigned',
    'John Doe',
    'Jane Smith'
]

export function TicketItem({ email }: TicketItemProps) {
    const [currentPriority, setCurrentPriority] = useState(email.priority);
    const [currentAssignee, setCurrentAssignee] = useState(email.assignee);
    const [currentStatus, setCurrentStatus] = useState(email.status);
    
    const { toast } = useToast();

    const priorityDetails = priorities.find(p => p.value === currentPriority) || priorities[0];

    const handleUpdate = async (field: 'priority' | 'assignee' | 'status', value: string) => {
        // Optimistic UI update
        if (field === 'priority') setCurrentPriority(value);
        if (field === 'assignee') setCurrentAssignee(value);
        if (field === 'status') setCurrentStatus(value);

        const result = await updateTicket(email.id, { [field]: value });
        if (result.success) {
            toast({
                title: 'Ticket Updated',
                description: `The ${field} has been changed to ${value}.`,
            });
        } else {
            // Revert UI on failure
            if (field === 'priority') setCurrentPriority(email.priority);
            if (field === 'assignee') setCurrentAssignee(email.assignee);
            if (field === 'status') setCurrentStatus(email.status);

            toast({
                variant: 'destructive',
                title: 'Update Failed',
                description: result.error,
            });
        }
    };


    return (
        <li className="transition-colors hover:bg-muted/50">
           <Card className="m-2 rounded-lg shadow-sm hover:shadow-md transition-shadow">
            <div className="flex flex-col sm:flex-row items-start sm:items-center p-4 gap-4">
                <div className="flex items-center gap-4 flex-shrink-0 w-full sm:w-auto">
                    <Checkbox id={`ticket-${email.id}`} />
                </div>
                
                <Link href={`/tickets/${email.id}`} className="flex-grow min-w-0 w-full cursor-pointer">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge variant="destructive">Overdue</Badge>
                        <Badge variant="secondary">Customer responded</Badge>
                        <Badge variant="outline">CHG</Badge>
                    </div>
                    <p className="font-medium text-foreground whitespace-nowrap overflow-hidden text-ellipsis">{email.subject}</p>

                    <p className="text-sm text-muted-foreground truncate">
                        {email.sender} &bull; Customer responded: {format(parseISO(email.receivedDateTime), 'd')} days ago &bull; Overdue by: {Math.floor(Math.random() * 10) + 1} days
                    </p>
                </Link>

                <div className="flex flex-row sm:flex-col items-stretch gap-1 ml-auto sm:ml-4 flex-shrink-0 w-full sm:w-36">
                    <div>
                        <Select value={currentPriority} onValueChange={(value) => handleUpdate('priority', value)}>
                            <SelectTrigger className="h-8 text-xs border-0 bg-transparent shadow-none focus:ring-0">
                                <SelectValue>
                                    <span className="flex items-center gap-2">
                                        <span className={cn("h-2 w-2 rounded-full", priorityDetails.color)} />
                                        {priorityDetails.label}
                                    </span>
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                {priorities.map(p => (
                                     <SelectItem key={p.value} value={p.value}>
                                        <span className="flex items-center gap-2">
                                            <span className={cn("h-2 w-2 rounded-full",p.color)} />
                                            {p.label}
                                        </span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                     <div>
                        <Select value={currentAssignee} onValueChange={(value) => handleUpdate('assignee', value)}>
                            <SelectTrigger className="h-8 text-xs border-0 bg-transparent shadow-none focus:ring-0">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                               {assignees.map(a => (
                                     <SelectItem key={a} value={a}>{a}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                     <div>
                        <Select value={currentStatus} onValueChange={(value) => handleUpdate('status', value)}>
                            <SelectTrigger className="h-8 text-xs border-0 bg-transparent shadow-none focus:ring-0">
                                <SelectValue />
                            </SelectTrigger>
                             <SelectContent>
                                {statuses.map(s => (
                                     <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>
            </Card>
        </li>
    );
}
