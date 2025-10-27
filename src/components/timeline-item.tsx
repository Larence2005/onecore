
"use client";

import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { Tag, CalendarClock, UserCheck, Shield, CheckCircle, FileType, Pencil, Building, Forward, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TimelineItemProps {
    type: 'Tags' | 'Deadline' | 'Assignee' | 'Priority' | 'Status' | 'Type' | 'Create' | 'Company' | 'Forward' | 'Note' | 'Update' | string;
    date: string;
    user: string;
    children: React.ReactNode;
}

const getIcon = (type: TimelineItemProps['type']) => {
    switch (type) {
        case 'Tags':
            return <Tag className="h-4 w-4 text-purple-500" />;
        case 'Deadline':
            return <CalendarClock className="h-4 w-4 text-red-500" />;
        case 'Assignee':
            return <UserCheck className="h-4 w-4 text-blue-500" />;
        case 'Priority':
            return <Shield className="h-4 w-4 text-orange-500" />;
        case 'Status':
            return <CheckCircle className="h-4 w-4 text-green-500" />;
        case 'Type':
            return <FileType className="h-4 w-4 text-indigo-500" />;
        case 'Company':
            return <Building className="h-4 w-4 text-pink-500" />;
        case 'Create':
            return <Pencil className="h-4 w-4 text-green-500" />;
        case 'Forward':
            return <Forward className="h-4 w-4 text-teal-500" />;
        case 'Note':
            return <MessageSquare className="h-4 w-4 text-yellow-500" />;
        case 'Update':
            return <Pencil className="h-4 w-4 text-blue-500" />;
        default:
            return <Pencil className="h-4 w-4 text-gray-500" />;
    }
}

export function TimelineItem({ type, date, children, user }: TimelineItemProps) {
    const isSystemUser = user === 'System' || (typeof user === 'string' && !user.includes('@'));
    
    // Handle cases where `user` might be null or undefined, or not a string
    const displayUser = typeof user === 'string' ? (isSystemUser ? 'System' : user) : 'Unknown';

    return (
        <div className="flex items-start gap-4">
            <div className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full bg-muted flex-shrink-0"
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
