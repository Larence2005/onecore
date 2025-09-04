
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
import { HelpCircle, ShieldAlert, Bug, Lightbulb, CircleDot, Clock, CheckCircle, CheckCircle2, User, Archive } from 'lucide-react';

type TicketItemProps = {
    email: Email;
    isSelected: boolean;
    onSelect: (ticketId: string, checked: boolean) => void;
};

const priorities = [
    { value: 'Low', label: 'Low', color: 'bg-green-500' },
    { value: 'Medium', label: 'Medium', color: 'bg-blue-500' },
    { value: 'High', label: 'High', color: 'bg-yellow-500' },
    { value: 'Urgent', label: 'Urgent', color: 'bg-red-500' },
];

const statuses = [
    { value: 'Open', label: 'Open', icon: CircleDot },
    { value: 'Pending', label: 'Pending', icon: Clock },
    { value: 'Resolved', label: 'Resolved', icon: CheckCircle },
    { value: 'Closed', label: 'Closed', icon: CheckCircle2 },
    { value: 'Archived', label: 'Archived', icon: Archive },
];

const types = [
    { value: 'Questions', label: 'Questions', icon: HelpCircle },
    { value: 'Incident', label: 'Incident', icon: ShieldAlert },
    { value: 'Problem', label: 'Problem', icon: Bug },
    { value: 'Feature Request', label: 'Feature Request', icon: Lightbulb },
];

const assignees = [
    'Unassigned',
    'John Doe',
    'Jane Smith'
]

export function TicketItem({ email, isSelected, onSelect }: TicketItemProps) {
    const [currentPriority, setCurrentPriority] = useState(email.priority);
    const [currentAssignee, setCurrentAssignee] = useState(email.assignee);
    const [currentStatus, setCurrentStatus] = useState(email.status);
    const [currentType, setCurrentType] = useState(email.type);
    
    const { toast } = useToast();

    const priorityDetails = priorities.find(p => p.value === currentPriority) || priorities[0];
    const typeDetails = types.find(t => t.value === currentType) || types[1];
    const statusDetails = statuses.find(s => s.value === currentStatus) || statuses[0];

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
        <li className={cn("transition-colors", isSelected ? 'bg-blue-50' : 'hover:bg-muted/50')}>
           <Card className="m-2 rounded-lg shadow-sm hover:shadow-md transition-shadow">
            <div className="flex flex-col sm:flex-row items-start sm:items-center p-4 gap-4">
                <div className="flex items-center gap-4 flex-shrink-0 w-full sm:w-auto">
                    <Checkbox id={`ticket-${email.id}`} checked={isSelected} onCheckedChange={(checked) => onSelect(email.id, !!checked)} />
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
                        {email.sender} &bull; Received: {format(parseISO(email.receivedDateTime), 'MMMM d, yyyy')}
                        {email.deadline && ` • Deadline: ${format(parseISO(email.deadline), 'MMMM d, yyyy')}`}
                    </p>
                </Link>

                <div className="flex flex-col items-end ml-auto sm:ml-4 flex-shrink-0 w-full sm:w-48">
                    <Select value={currentPriority} onValueChange={(value) => handleUpdate('priority', value)}>
                        <SelectTrigger className="h-7 text-xs border-0 bg-transparent shadow-none focus:ring-0 w-auto justify-end">
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
                    <Select value={currentAssignee} onValueChange={(value) => handleUpdate('assignee', value)}>
                        <SelectTrigger className="h-7 text-xs border-0 bg-transparent shadow-none focus:ring-0 w-auto justify-end">
                           <SelectValue>
                                <span className="flex items-center gap-2">
                                    <User className="h-4 w-4" />
                                    {currentAssignee}
                                </span>
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                           {assignees.map(a => (
                                 <SelectItem key={a} value={a}>
                                    <span className="flex items-center gap-2">
                                        <User className="h-4 w-4" />
                                        {a}
                                    </span>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={currentStatus} onValueChange={(value) => handleUpdate('status', value)}>
                        <SelectTrigger className="h-7 text-xs border-0 bg-transparent shadow-none focus:ring-0 w-auto justify-end">
                            <SelectValue>
                                <span className="flex items-center gap-2">
                                    <statusDetails.icon className="h-4 w-4" />
                                    {statusDetails.label}
                                </span>
                            </SelectValue>
                        </SelectTrigger>
                         <SelectContent>
                            {statuses.map(s => (
                                 <SelectItem key={s.value} value={s.value}>
                                    <span className="flex items-center gap-2">
                                        <s.icon className="h-4 w-4" />
                                        {s.label}
                                    </span>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={currentType} onValueChange={(value) => handleUpdate('type', value)}>
                        <SelectTrigger className="h-7 text-xs border-0 bg-transparent shadow-none focus:ring-0 w-auto justify-end">
                             <SelectValue>
                                <span className="flex items-center gap-2">
                                    <typeDetails.icon className="h-4 w-4" />
                                    {typeDetails.label}
                                </span>
                            </SelectValue>
                        </SelectTrigger>
                         <SelectContent>
                            {types.map(t => (
                                <SelectItem key={t.value} value={t.value}>
                                    <span className="flex items-center gap-2">
                                        <t.icon className="h-4 w-4" />
                                        {t.label}
                                    </span>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
            </Card>
        </li>
    );
}

    