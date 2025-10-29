
"use client";

import type { Email } from "@/app/actions-types";
import type { OrganizationMember } from "@/app/actions-new";
import { format, parseISO, isPast, differenceInDays } from "date-fns";
import { Checkbox } from "./ui/checkbox";
import { Badge } from "./ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { cn } from "@/lib/utils";
import { Card } from "./ui/card";
import Link from 'next/link';
import { updateTicket, getOrganizationMembers } from "@/app/actions-new";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, memo } from "react";
import { HelpCircle, ShieldAlert, Bug, Lightbulb, CircleDot, Clock, CheckCircle, CheckCircle2, User, Building, FileType, RefreshCw } from 'lucide-react';
import { useAuth } from "@/providers/auth-provider-new";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "./ui/alert-dialog";
import { Button } from "./ui/button";


type TicketItemProps = {
    email: Email;
    isSelected: boolean;
    onSelect: (ticketId: string, checked: boolean) => void;
    isArchivedView?: boolean;
    onRefresh?: () => void;
};

type PendingUpdate = {
    field: 'priority' | 'status' | 'type' | 'assignee';
    value: string;
    label: string;
} | null;

const priorities = [
    { value: 'None', label: 'None', color: 'bg-gray-500' },
    { value: 'Low', label: 'Low', color: 'bg-green-500' },
    { value: 'Medium', label: 'Medium', color: 'bg-blue-500' },
    { value: 'High', label: 'High', color: 'bg-yellow-500' },
    { value: 'Urgent', label: 'Urgent', color: 'bg-red-500' },
];

const statuses = [
    { value: 'Open', label: 'Open', icon: CircleDot, color: 'text-blue-500' },
    { value: 'Pending', label: 'Pending', icon: Clock, color: 'text-orange-500' },
    { value: 'Resolved', label: 'Resolved', icon: CheckCircle, color: 'text-green-500' },
    { value: 'Closed', label: 'Closed', icon: CheckCircle2, color: 'text-gray-500' },
];

const types = [
    { value: 'Questions', label: 'Questions', icon: HelpCircle, color: 'text-blue-500' },
    { value: 'Incident', label: 'Incident', icon: ShieldAlert, color: 'text-orange-500' },
    { value: 'Problem', label: 'Problem', icon: Bug, color: 'text-red-500' },
    { value: 'Feature Request', label: 'Feature Request', icon: Lightbulb, color: 'text-purple-500' },
];

export const TicketItem = memo(function TicketItem({ email, isSelected, onSelect, isArchivedView = false, onRefresh }: TicketItemProps) {
    const { user, userProfile } = useAuth();
    const [currentPriority, setCurrentPriority] = useState(email.priority);
    const [currentStatus, setCurrentStatus] = useState(email.status);
    const [currentType, setCurrentType] = useState(email.type);
    const [currentAssignee, setCurrentAssignee] = useState(email.assignee);
    const [members, setMembers] = useState<OrganizationMember[]>([]);

    const [isUpdating, setIsUpdating] = useState(false);
    const [pendingUpdate, setPendingUpdate] = useState<PendingUpdate>(null);
    
    const { toast } = useToast();

    useEffect(() => {
        if (userProfile?.organizationId) {
            getOrganizationMembers(userProfile.organizationId).then(setMembers);
        }
    }, [userProfile]);

    const isOwner = user?.id === userProfile?.organizationOwnerUid;
    const isClient = userProfile?.isClient === true;

    const priorityDetails = priorities.find(p => p.value === currentPriority) || priorities[0];
    const typeDetails = types.find(t => t.value === currentType) || types[1];
    const statusDetails = statuses.find(s => s.value === currentStatus) || statuses[0];
    const assigneeName = members.find(m => m.uid === currentAssignee)?.name || 'Unassigned';

    const isResolvedLate = !!(email.tags?.includes('Resolved Late'));
    const isOverdue = !isResolvedLate && email.deadline && isPast(parseISO(email.deadline)) && email.status !== 'Resolved' && email.status !== 'Closed';
    const isCompleted = currentStatus === 'Resolved' || currentStatus === 'Closed';
    
    // Show blue strip for tickets that need attention:
    // 1. New tickets (status is 'Open' and no replies yet)
    // 2. Client has replied (lastReplier === 'client')
    // 3. Current user hasn't replied yet (check if user email is not in the conversation)
    const needsAttention = !isCompleted && (
        (email as any).lastReplier === 'client' || 
        currentStatus === 'Open'
    );

    const handleConfirmUpdate = async () => {
        if (!pendingUpdate || !userProfile?.organizationId || !user || !userProfile.name || !user.email) return;

        setIsUpdating(true);
        const { field, value, label } = pendingUpdate;
        
        // Optimistic UI update
        if (field === 'priority') setCurrentPriority(value);
        if (field === 'status') setCurrentStatus(value);
        if (field === 'type') setCurrentType(value);
        if (field === 'assignee') setCurrentAssignee(value);

        const finalValue = field === 'assignee' && value === 'unassigned' ? null : value;

        // Auto-set or clear deadline when priority changes
        if (field === 'priority' && userProfile?.deadlineSettings) {
            const deadlineSettings = userProfile.deadlineSettings as any;
            
            // If priority is "None", clear the deadline
            if (value === 'None') {
                const result = await updateTicket(userProfile.organizationId, email.id, { 
                    priority: value,
                    deadline: null
                }, user.uid);
                
                if (result.success) {
                    toast({
                        title: 'Ticket Updated',
                        description: `Priority changed to ${label} and deadline cleared`,
                    });
                    
                    if (onRefresh) {
                        onRefresh();
                    }
                } else {
                    // Revert UI on failure
                    setCurrentPriority(email.priority);
                    toast({
                        variant: 'destructive',
                        title: 'Update Failed',
                        description: result.error,
                    });
                }
                setIsUpdating(false);
                setPendingUpdate(null);
                return;
            }
            
            // If priority has deadline settings, auto-set the deadline
            const daysToAdd = deadlineSettings[value];
            
            if (daysToAdd !== undefined && daysToAdd > 0) {
                const newDeadline = new Date();
                newDeadline.setDate(newDeadline.getDate() + daysToAdd);
                
                const result = await updateTicket(userProfile.organizationId, email.id, { 
                    priority: value,
                    deadline: newDeadline.toISOString()
                }, user.uid);
                
                if (result.success) {
                    toast({
                        title: 'Ticket Updated',
                        description: `Priority changed to ${label} and deadline set to ${format(newDeadline, 'PPP')}`,
                    });
                    
                    if (onRefresh) {
                        onRefresh();
                    }
                } else {
                    // Revert UI on failure
                    setCurrentPriority(email.priority);
                    toast({
                        variant: 'destructive',
                        title: 'Update Failed',
                        description: result.error,
                    });
                }
                setIsUpdating(false);
                setPendingUpdate(null);
                return;
            }
        }

        const result = await updateTicket(userProfile.organizationId, email.id, { [field]: finalValue }, user.uid);
        
        if (result.success) {
            toast({
                title: 'Ticket Updated',
                description: `The ${field} has been changed.`,
            });
            
            // Refresh the ticket list to show updated data
            if (onRefresh) {
                onRefresh();
            }
        } else {
            // Revert UI on failure
            if (field === 'priority') setCurrentPriority(email.priority);
            if (field === 'status') setCurrentStatus(email.status);
            if (field === 'type') setCurrentType(email.type);
            if (field === 'assignee') setCurrentAssignee(email.assignee);

            toast({
                variant: 'destructive',
                title: 'Update Failed',
                description: result.error,
            });
        }
        setIsUpdating(false);
        setPendingUpdate(null);
    };

    const handleSelectChange = (field: 'priority' | 'status' | 'type' | 'assignee', value: string) => {
        let label = '';
        if (field === 'assignee') {
            label = value === 'unassigned' ? 'Unassigned' : members.find(m => m.uid === value)?.name || '';
        } else {
            const options = { priority: priorities, status: statuses, type: types }[field];
            label = options.find(o => o.value === value)?.label || '';
        }
        setPendingUpdate({ field, value, label });
    }

    const renderTags = () => (
        <>
            {isResolvedLate && <Badge variant="destructive" className="bg-orange-500">Resolved Late</Badge>}
            {isOverdue && <Badge variant="destructive">Overdue</Badge>}
            {email.companyName && <Badge variant="secondary" className="bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300"><Building className="mr-1 h-3 w-3" />{email.companyName}</Badge>}
            {email.tags?.filter(t => t !== 'Resolved Late' && !t.startsWith('deadline-reminder-sent-day-')).map(tag => (
                <Badge key={tag} variant="outline">{tag}</Badge>
            ))}
        </>
    );

    return (
        <li className={cn(
            "transition-colors", 
            isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : '',
            isCompleted ? '' : 'hover:bg-muted/50'
        )}>
            <AlertDialog open={!!pendingUpdate} onOpenChange={(open) => !open && setPendingUpdate(null)}>
                <Card className={cn(
                   "m-2 rounded-lg shadow-sm transition-all",
                   isCompleted 
                    ? 'bg-muted/60 hover:shadow-md'
                    : 'hover:shadow-md',
                   needsAttention && 'border-l-4 border-l-blue-500'
                )}>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center p-4 gap-4">
                        <div className="flex items-center gap-4 flex-shrink-0 w-full sm:w-auto">
                            <Checkbox id={`ticket-${email.id}`} checked={isSelected} onCheckedChange={(checked) => onSelect(email.id, !!checked)} />
                            <div className="flex items-center gap-2">
                                {email.ticketNumber && <span className="text-sm font-medium text-muted-foreground">#{email.ticketNumber}</span>}
                                <div className="flex sm:hidden items-center gap-2 flex-wrap">{renderTags()}</div>
                            </div>
                        </div>
                        
                        <Link href={`/tickets/${email.id}`} className="flex-1 min-w-0 w-full cursor-pointer">
                            <div className="hidden sm:flex items-center gap-2 mb-1 flex-wrap">
                                {renderTags()}
                            </div>
                            <p className="font-medium text-foreground truncate">{email.subject}</p>

                            <div className="text-sm text-muted-foreground flex flex-col sm:flex-row sm:items-center sm:gap-2 truncate">
                                <span>{email.sender}</span>
                                <span className="hidden sm:inline">&bull;</span>
                                <div className="flex items-center gap-2">
                                    <span>Received: {format(parseISO(email.receivedDateTime), 'MMMM d, yyyy')}</span>
                                    {email.deadline && <span>&bull; Deadline: {format(parseISO(email.deadline), 'MMMM d, yyyy')}</span>}
                                </div>
                            </div>
                        </Link>

                        <div className="hidden sm:flex flex-col items-end ml-auto sm:ml-4 flex-shrink-0 w-full sm:w-48">
                            <Select value={currentPriority} onValueChange={(value) => handleSelectChange('priority', value)} disabled={isArchivedView || isClient}>
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
                             <Select value={currentType} onValueChange={(value) => handleSelectChange('type', value)} disabled={isArchivedView || isClient}>
                                <SelectTrigger className="h-7 text-xs border-0 bg-transparent shadow-none focus:ring-0 w-auto justify-end">
                                    <SelectValue>
                                        <span className="flex items-center gap-2">
                                            <typeDetails.icon className={cn("h-4 w-4", typeDetails.color)} />
                                            {typeDetails.label}
                                        </span>
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    {types.map(t => (
                                        <SelectItem key={t.value} value={t.value}>
                                            <span className="flex items-center gap-2">
                                                <t.icon className={cn("h-4 w-4", t.color)} />
                                                {t.label}
                                            </span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={currentStatus} onValueChange={(value) => handleSelectChange('status', value)} disabled={isArchivedView || isClient}>
                                <SelectTrigger className="h-7 text-xs border-0 bg-transparent shadow-none focus:ring-0 w-auto justify-end">
                                    <SelectValue>
                                        <span className="flex items-center gap-2">
                                            <statusDetails.icon className={cn("h-4 w-4", statusDetails.color)} />
                                            {statusDetails.label}
                                        </span>
                                    </SelectValue>
                                </SelectTrigger>
                                 <SelectContent>
                                    {statuses.map(s => (
                                         <SelectItem key={s.value} value={s.value}>
                                            <span className="flex items-center gap-2">
                                                <s.icon className={cn("h-4 w-4", s.color)} />
                                                {s.label}
                                            </span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {isOwner ? (
                                 <Select value={currentAssignee || 'unassigned'} onValueChange={(value) => handleSelectChange('assignee', value)} disabled={isArchivedView || isClient}>
                                     <SelectTrigger className="h-7 text-xs border-0 bg-transparent shadow-none focus:ring-0 w-auto justify-end">
                                         <SelectValue>
                                             <span className="flex items-center gap-2">
                                                <User className="h-4 w-4 text-muted-foreground" />
                                                {assigneeName}
                                             </span>
                                         </SelectValue>
                                     </SelectTrigger>
                                     <SelectContent>
                                        <SelectItem value="unassigned">Unassigned</SelectItem>
                                        {members.filter(m => m.uid && !m.isClient && (m as any).hasLicense).map(m => (
                                            <SelectItem key={m.uid} value={m.uid!}>{m.name}</SelectItem>
                                        ))}
                                     </SelectContent>
                                 </Select>
                            ) : (
                                <div className="h-7 text-xs flex items-center justify-end gap-2 text-muted-foreground px-2">
                                    <User className="h-4 w-4" />
                                    {assigneeName}
                                </div>
                            )}
                        </div>
                    </div>
                </Card>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Change</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to change the {pendingUpdate?.field} to "{pendingUpdate?.label}"?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setPendingUpdate(null)}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmUpdate} disabled={isUpdating}>
                            {isUpdating && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                            Confirm
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </li>
    );
});
