
"use client";

import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { Tag, CalendarClock, UserCheck, Shield, CheckCircle, FileType, Pencil, Building, Forward } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TimelineItemProps {
    type: 'Tags' | 'Deadline' | 'Assignee' | 'Priority' | 'Status' | 'Type' | 'Create' | 'Company' | 'Forward' | string;
    date: string;
    user: string;
    children: React.ReactNode;
}

const getIcon = (type: TimelineItemProps['type']) => {
    switch (type) {
        case 'Tags':
            return <Tag className="h-4 w-4" />;
        case 'Deadline':
            return <CalendarClock className="h-4 w-4" />;
        case 'Assignee':
            return <UserCheck className="h-4 w-4" />;
        case 'Priority':
            return <Shield className="h-4 w-4" />;
        case 'Status':
            return <CheckCircle className="h-4 w-4" />;
        case 'Type':
            return <FileType className="h-4 w-4" />;
        case 'Company':
            return <Building className="h-4 w-4" />;
        case 'Create':
            return <Pencil className="h-4 w-4" />;
        case 'Forward':
            return <Forward className="h-4 w-4" />;
        default:
            return <Pencil className="h-4 w-4" />;
    }
}

export function TimelineItem({ type, date, children, user }: TimelineItemProps) {
    const isSystemUser = user === 'System' || (typeof user === 'string' && !user.includes('@'));
    
    // Handle cases where `user` might be null or undefined, or not a string
    const displayUser = typeof user === 'string' ? (isSystemUser ? 'System' : user) : 'Unknown';

    return (
        <div className="flex items-start gap-4">
            <div className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground flex-shrink-0"
            )}>
                {getIcon(type)}
            </div>
            <div className="flex-1 space-y-1 min-w-0">
                <div className="text-sm text-foreground break-words">
                    <span className="font-semibold">{displayUser}</span>
                    <span className="text-muted-foreground"> {type === "Create" ? 'created a ticket' : 'updated the ticket'}</span>
                </div>
                <div className="text-sm text-foreground break-words">{children}</div>
                <time className="text-xs text-muted-foreground">
                    {format(parseISO(date), "MMM d, yyyy 'at' h:mm a")}
                </time>
            </div>
        </div>
    );
}
