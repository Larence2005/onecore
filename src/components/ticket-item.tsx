
"use client";

import type { Email } from "@/app/actions";
import { format, parseISO } from "date-fns";
import { Checkbox } from "./ui/checkbox";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

type TicketItemProps = {
    email: Email;
    onClick: () => void;
};

// Mock data for additional fields
const priorities = [
    { value: 'low', label: 'Low', color: 'bg-green-500' },
    { value: 'medium', label: 'Medium', color: 'bg-blue-500' },
    { value: 'high', label: 'High', color: 'bg-yellow-500' },
    { value: 'urgent', label: 'Urgent', color: 'bg-red-500' },
];

const statuses = [
    { value: 'open', label: 'Open' },
    { value: 'pending', label: 'Pending' },
    { value: 'resolved', label: 'Resolved' },
    { value: 'closed', label: 'Closed' },
];

const getPriority = (subject: string) => {
    const hash = subject.split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
    return priorities[Math.abs(hash) % priorities.length];
};

const getStatus = (subject: string) => {
    const hash = subject.split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
    return statuses[Math.abs(hash) % statuses.length];
};

export function TicketItem({ email, onClick }: TicketItemProps) {
    const priority = getPriority(email.subject);
    const status = getStatus(email.subject);

    const senderInitial = email.sender?.[0]?.toUpperCase() || 'U';

    return (
        <li className="border rounded-lg transition-colors hover:bg-muted/50">
            <div className="flex items-start p-4 pl-8">
                <div className="flex items-center gap-4 flex-shrink-0 pt-1">
                    <Checkbox id={`ticket-${email.id}`} />
                    <Avatar className="h-8 w-8">
                         <AvatarFallback className="text-xs bg-muted-foreground/20 text-foreground">{senderInitial}</AvatarFallback>
                    </Avatar>
                </div>

                <div className="flex-grow ml-4" onClick={onClick} role="button">
                    <div className="flex items-center gap-2 mb-1">
                        <Badge variant="destructive">Overdue</Badge>
                        <Badge variant="secondary">Customer responded</Badge>
                        <Badge variant="outline">CHG</Badge>
                    </div>
                    <p className="font-medium text-foreground truncate">{email.subject}</p>
                    <p className="text-sm text-muted-foreground">
                        {email.sender} &bull; Customer responded: {format(parseISO(email.receivedDateTime), 'd')} days ago &bull; Overdue by: {Math.floor(Math.random() * 10) + 1} days
                    </p>
                </div>

                <div className="flex flex-col items-stretch gap-2 ml-4 flex-shrink-0 w-36">
                    <div>
                        <Select defaultValue={priority.value}>
                            <SelectTrigger className="h-8 text-xs">
                                <SelectValue>
                                    <span className="flex items-center gap-2">
                                        <span className={`h-2 w-2 rounded-full ${priority.color}`} />
                                        {priority.label}
                                    </span>
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                {priorities.map(p => (
                                     <SelectItem key={p.value} value={p.value}>
                                        <span className="flex items-center gap-2">
                                            <span className={`h-2 w-2 rounded-full ${p.color}`} />
                                            {p.label}
                                        </span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                     <div>
                        <Select defaultValue="onecore-su">
                            <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                               <SelectItem value="onecore-su">-- / Onecore Su...</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                     <div>
                        <Select defaultValue={status.value}>
                            <SelectTrigger className="h-8 text-xs">
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
        </li>
    );
}
