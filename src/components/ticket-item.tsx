
"use client";

import type { Email } from "@/app/actions";
import { format, parseISO, isPast, differenceInDays } from "date-fns";
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

const types = [
    { value: 'Questions', label: 'Questions' },
    { value: 'Incident', label: 'Incident' },
    { value: 'Problem', label: 'Problem' },
    { value: 'Feature Request', label: 'Feature Request' },
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
    const [currentType, setCurrentType] = useState(email.type);
    
    const { toast } = useToast();

    const priorityDetails = priorities.find(p => p.value === currentPriority) || priorities[0];

    const isOverdue = email.deadline && isPast(parseISO(email.deadline)) && email.status !== 'Resolved' && email.status !== 'Closed';
    const isLate = email.deadline && email.closedAt && isPast(parseISO(email.deadline), parseISO(email.closedAt));

    const handleUpdate = async (field: 'priority' | 'assignee' | 'status' | 'type', value: string) => {
        // Optimistic UI update
        if (field === 'priority') setCurrentPriority(value);
        if (field === 'assignee') setCurrentAssignee(value);
        if (field === 'status') setCurrentStatus(value);
        if (field === 'type') setCurrentType(value);

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
            if (field === 'type') setCurrentType(email.type);

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
                        {isOverdue && <Badge variant="destructive">Overdue</Badge>}
                        {isLate && <Badge variant="destructive" className="bg-orange-500">Late</Badge>}
                        {email.tags?.map(tag => (
                           <Badge key={tag} variant="outline">{tag}</Badge>
                        ))}
                    </div>
                    <p className="font-medium text-foreground whitespace-nowrap overflow-hidden text-ellipsis">{email.subject}</p>

                    <p className="text-sm text-muted-foreground truncate">
                        {email.sender} &bull; Received: {format(parseISO(email.receivedDateTime), 'PPP')}
                        {email.deadline && ` • Deadline: ${format(parseISO(email.deadline), 'PPP')}`}
                    </p>
                </Link>

                <div className="flex flex-row sm:flex-col items-stretch gap-1 ml-auto sm:ml-4 flex-shrink-0 w-full sm:w-48">
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
                    <div>
                        <Select value={currentType} onValueChange={(value) => handleUpdate('type', value)}>
                            <SelectTrigger className="h-8 text-xs border-0 bg-transparent shadow-none focus:ring-0">
                                <SelectValue />
                            </SelectTrigger>
                             <SelectContent>
                                {types.map(t => (
                                     <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
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

    