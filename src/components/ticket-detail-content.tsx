

"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { getEmail, replyToEmailAction, updateTicket, getOrganizationMembers, fetchAndStoreFullConversation, addActivityLog, getActivityLog, forwardEmailAction, getCompanies, addNoteToTicket, getTicketNotes, getAPISettings, getAttachmentContent } from '@/app/actions';
import type { DetailedEmail, Attachment, NewAttachment, OrganizationMember, ActivityLog, Recipient, Company, Note } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal, ArrowLeft, User, Shield, CheckCircle, UserCheck, Send, RefreshCw, Pencil, MoreHorizontal, Paperclip, LayoutDashboard, List, Users, Building2, X, Tag, CalendarClock, Activity, FileType, HelpCircle, ShieldAlert, Bug, Lightbulb, CircleDot, Clock, CheckCircle2, Archive, LogOut, Share, Settings as SettingsIcon, CalendarDays, AlignLeft, AlignCenter, AlignRight, AlignJustify, RemoveFormatting, Building, Reply, ReplyAll, MessageSquare, PlusCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useAuth } from '@/providers/auth-provider';
import { useRouter, useSearchParams } from 'next/navigation';
import { SidebarProvider, Sidebar, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarHeader, SidebarFooter } from '@/components/ui/sidebar';
import { Header } from '@/components/header';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import parse from 'html-react-parser';
import RichTextEditor from './rich-text-editor';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { doc, onSnapshot, collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { TimelineItem } from './timeline-item';
import { Label } from './ui/label';
import { TableIcon } from './ui/table-icon';
import { AutocompleteInput } from './autocomplete-input';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from './ui/dropdown-menu';
import Image from 'next/image';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';


type TimelineItemType = (DetailedEmail & { itemType: 'email' }) | (Note & { itemType: 'note' });
type PendingUpdate = {
  field: 'priority' | 'status' | 'type' | 'deadline' | 'companyId' | 'assignee';
  value: any;
  label: string;
} | null;


const prepareHtmlContent = (htmlContent: string, attachments: Attachment[] | undefined): string => {
    if (!htmlContent) {
        return '';
    }

    let processedHtml = htmlContent;

    if (attachments) {
        // Find all inline attachments
        const inlineAttachments = attachments.filter(att => att.isInline && att.contentId);

        inlineAttachments.forEach(att => {
            // The src in the img tag will be `cid:contentId`
            const cid = att.contentId!;
            // Create a regex that is not too greedy and handles variations
            const regex = new RegExp(`src=["']cid:${cid}["']`, 'g');
            const dataUri = `src="data:${att.contentType};base64,${att.contentBytes}"`;
            processedHtml = processedHtml.replace(regex, dataUri);
        });
    }

    return processedHtml;
};


const CollapsibleEmailContent = ({ htmlContent, attachments }: { htmlContent: string, attachments: Attachment[] | undefined }) => {
    // Regex to find common reply headers
    const replyHeaderRegex = /(<br\s*\/?>\s*)?(On\s.*wrote:|From:.*|Sent:.*|To:.*|Subject:.*)/is;
    const blockquoteRegex = /<blockquote.*?>/is;

    const findSplitIndex = (content: string) => {
        const headerMatch = content.match(replyHeaderRegex);
        const blockquoteMatch = content.match(blockquoteRegex);

        const headerIndex = headerMatch ? headerMatch.index : -1;
        const blockquoteIndex = blockquoteMatch ? blockquoteMatch.index : -1;

        if (headerIndex !== -1 && blockquoteIndex !== -1) {
            return Math.min(headerIndex, blockquoteIndex);
        }
        if (headerIndex !== -1) {
            return headerIndex;
        }
        if (blockquoteIndex !== -1) {
            return blockquoteIndex;
        }
        return -1;
    };
    
    // Instead of calling prepareHtmlContent here, we assume it's been called on the full body before.
    // However, if we need to process only a part of it, we need to pass attachments.
    // For now, let's assume the passed htmlContent is already processed.
    const processedHtml = htmlContent;


    const splitIndex = findSplitIndex(processedHtml);

    let mainContent, quotedContent;

    if (splitIndex !== -1) {
        mainContent = processedHtml.substring(0, splitIndex);
        quotedContent = processedHtml.substring(splitIndex);
    } else {
        mainContent = processedHtml;
        quotedContent = null;
    }

    const styledHtml = (content: string) => `
        <style>
            body { 
                font-family: sans-serif; 
                color: hsl(var(--foreground)); 
                background-color: transparent; 
                word-wrap: break-word;
                overflow-wrap: break-word;
            }
             img, table, td, th, div { 
                max-width: 100% !important; 
                height: auto !important; 
                overflow-wrap: break-word;
                word-wrap: break-word;
             }
             table {
                table-layout: fixed;
             }
             a {
                text-decoration: none !important;
             }
             a:hover {
                text-decoration: underline !important;
             }
        </style>
        ${content || ''}
    `;

    return (
        <div className="p-4">
            {parse(styledHtml(mainContent))}
            {quotedContent && (
                 <Accordion type="single" collapsible className="my-4">
                    <AccordionItem value="item-1" className="border-0 pl-4">
                        <AccordionTrigger className="py-0 hover:no-underline -ml-4 justify-start w-auto h-auto p-1">
                            <span className="sr-only">Show quoted text</span>
                        </AccordionTrigger>
                        <AccordionContent>
                           {parse(styledHtml(quotedContent))}
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            )}
        </div>
    );
};

const downloadAttachment = async (organizationId: string, messageId: string, attachment: Attachment) => {
    try {
        const attachmentContent = await getAttachmentContent(organizationId, messageId, attachment.id);
        if (!attachmentContent) throw new Error("Could not fetch attachment content.");
        
        const byteCharacters = atob(attachmentContent);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: attachment.contentType });

        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = attachment.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch(e) {
        console.error("Failed to download attachment", e);
    }
}


export function TicketDetailContent({ id, baseUrl }: { id: string, baseUrl?: string }) {
    const { toast } = useToast();
    const { user, userProfile, loading, logout } = useAuth();
    const router = useRouter();
    const [email, setEmail] = useState<DetailedEmail | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    const [replyingToMessageId, setReplyingToMessageId] = useState<string | null>(null);
    const [replyType, setReplyType] = useState<'reply' | 'reply-all' | null>(null);
    const [replyContent, setReplyContent] = useState('');
    const [replyTo, setReplyTo] = useState('');
    const [replyCc, setReplyCc] = useState('');
    const [replyBcc, setReplyBcc] = useState('');
    const [showReplyCc, setShowReplyCc] = useState(false);
    const [showReplyBcc, setShowReplyBcc] = useState(false);

    const [forwardingMessageId, setForwardingMessageId] = useState<string | null>(null);
    const [forwardTo, setForwardTo] = useState('');
    const [forwardCc, setForwardCc] = useState('');
    const [forwardBcc, setForwardBcc] = useState('');
    const [forwardComment, setForwardComment] = useState('');
    const [showForwardCc, setShowForwardCc] = useState(false);
    const [showForwardBcc, setShowForwardBcc] = useState(false);

    const [isSending, setIsSending] = useState(false);
    const [attachments, setAttachments] = useState<File[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [activityLog, setActivityLog] = useState<ActivityLog[]>([]);
    const [notes, setNotes] = useState<Note[]>([]);
    const previousEmailRef = useRef<DetailedEmail | null>(null);

    const [currentPriority, setCurrentPriority] = useState('');
    const [currentStatus, setCurrentStatus] = useState('');
    const [currentType, setCurrentType] = useState('');
    const [currentDeadline, setCurrentDeadline] = useState<Date | undefined>(undefined);
    const [currentTags, setCurrentTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState('');
    const [currentCompanyId, setCurrentCompanyId] = useState<string | null>(null);
    const [currentAssignee, setCurrentAssignee] = useState<string | null>(null);

    const [isAddingNote, setIsAddingNote] = useState(false);
    const [noteContent, setNoteContent] = useState('');
    const [isSavingNote, setIsSavingNote] = useState(false);


    const [members, setMembers] = useState<OrganizationMember[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [adminEmail, setAdminEmail] = useState<string>('');

    const [pendingUpdate, setPendingUpdate] = useState<PendingUpdate>(null);
    const [isUpdating, setIsUpdating] = useState(false);


    const priorities = [
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
    
    useEffect(() => {
        if (!loading && !user) {
        router.push('/');
        }
    }, [user, loading, router]);
    
    useEffect(() => {
        const fetchDropdownData = async () => {
            if (userProfile?.organizationId) {
                const [orgMembers, fetchedCompanies, settings] = await Promise.all([
                    getOrganizationMembers(userProfile.organizationId),
                    getCompanies(userProfile.organizationId),
                    getAPISettings(userProfile.organizationId),
                ]);
                setMembers(orgMembers);
                setCompanies(fetchedCompanies);
                if (settings?.userId) {
                    setAdminEmail(settings.userId);
                }
            }
        };
        fetchDropdownData();
    }, [userProfile]);

    const fetchEmailData = useCallback(async () => {
        if (!id || !userProfile?.organizationId) return;
    
        setIsLoading(true);
        try {
            const detailedEmail = await getEmail(userProfile.organizationId, id);
            
            if (!detailedEmail) {
                throw new Error("Ticket not found in the database.");
            }

            setEmail(detailedEmail);
            setCurrentPriority(detailedEmail.priority);
            setCurrentStatus(detailedEmail.status);
            setCurrentType(detailedEmail.type || 'Incident');
            setCurrentDeadline(detailedEmail.deadline ? parseISO(detailedEmail.deadline) : undefined);
            setCurrentTags(detailedEmail.tags || []);
            setCurrentCompanyId(detailedEmail.companyId || null);
            setCurrentAssignee(detailedEmail.assignee || null);
            // Set the initial state for comparison
            previousEmailRef.current = detailedEmail;

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
            setError(errorMessage);
            toast({
                variant: "destructive",
                title: "Failed to load email.",
                description: "This might happen if the email was deleted or if there's a network issue.",
            });
        } finally {
            setIsLoading(false);
        }
    }, [id, toast, userProfile?.organizationId]);

    useEffect(() => {
        fetchEmailData();
    }, [fetchEmailData]);
    
     useEffect(() => {
        if (!email?.id || !userProfile?.organizationId || !user?.email) return;

        const ticketDocRef = doc(db, 'organizations', userProfile.organizationId, 'tickets', email.id);

        const unsubscribe = onSnapshot(ticketDocRef, async (docSnap) => {
            if (docSnap.exists()) {
                const ticketData = { id: docSnap.id, ...docSnap.data() } as DetailedEmail;
                
                // Update UI state and ref
                 setEmail(prevEmail => prevEmail ? ({ ...prevEmail, ...ticketData }) : ticketData);
                 setCurrentDeadline(ticketData.deadline ? parseISO(ticketData.deadline) : undefined);
                 previousEmailRef.current = { ...(email || {}), ...ticketData } as DetailedEmail;
            }
        });

        return () => unsubscribe();
    }, [email?.id, userProfile?.organizationId]);

     useEffect(() => {
        if (!email?.id || !userProfile?.organizationId) return;

        const activityCollectionRef = collection(db, 'organizations', userProfile.organizationId, 'tickets', email.id, 'activity');
        const q = query(activityCollectionRef, orderBy('date', 'desc'));

        const unsubscribe = onSnapshot(q, async (querySnapshot) => {
            const fetchedLogs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActivityLog));
            setActivityLog(fetchedLogs);
        });

        return () => unsubscribe();
    }, [email?.id, userProfile?.organizationId]);

    useEffect(() => {
        if (!email?.id || !userProfile?.organizationId) return;

        const notesCollectionRef = collection(db, 'organizations', userProfile.organizationId, 'tickets', email.id, 'notes');
        const q = query(notesCollectionRef, orderBy('date', 'asc'));

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const fetchedNotes = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Note));
            setNotes(fetchedNotes);
        });

        return () => unsubscribe();
    }, [email?.id, userProfile?.organizationId]);

    useEffect(() => {
        if (!email?.conversationId || !userProfile?.organizationId) return;

        const conversationDocRef = doc(db, 'organizations', userProfile.organizationId, 'conversations', email.conversationId);
        
        const unsubscribe = onSnapshot(conversationDocRef, async (docSnap) => {
            if (docSnap.exists()) {
                const conversationData = docSnap.data();
                if (conversationData && conversationData.messages) {
                    const newConversation = conversationData.messages as DetailedEmail[];
                    setEmail(prevEmail => {
                        if (prevEmail) {
                            return { ...prevEmail, conversation: newConversation };
                        }
                        return null;
                    });
                }
            }
        });

        return () => unsubscribe();
    }, [email?.conversationId, userProfile?.organizationId]);

    
    const handleUpdate = async (field: 'priority' | 'status' | 'type' | 'deadline' | 'tags' | 'companyId' | 'assignee', value: any) => {
        if (!email || !userProfile?.organizationId || !user || !userProfile.name || !user.email) return;

        const ticketIdToUpdate = email.id;

        const result = await updateTicket(userProfile.organizationId, ticketIdToUpdate, { [field]: value }, {name: userProfile.name, email: user.email});

        if (!result.success) {
             toast({
                variant: 'destructive',
                title: 'Update Failed',
                description: result.error,
            });
        } else {
            toast({
                title: 'Ticket Updated',
                description: `The ${field} has been changed.`,
            });
        }
    };

    const handleConfirmUpdate = async () => {
        if (!pendingUpdate) return;
    
        setIsUpdating(true);
        const { field, value } = pendingUpdate;

        // Optimistic UI updates
        if(field === 'priority') setCurrentPriority(value);
        if(field === 'status') setCurrentStatus(value);
        if(field === 'type') setCurrentType(value);
        if(field === 'deadline') setCurrentDeadline(value);
        if(field === 'companyId') setCurrentCompanyId(value);
        if(field === 'assignee') setCurrentAssignee(value);
    
        await handleUpdate(field, value);

        setIsUpdating(false);
        setPendingUpdate(null);
    };

    const handleSelectChange = (field: 'priority' | 'status' | 'type' | 'assignee' | 'companyId', value: any) => {
        let label = '';
        if (field === 'assignee') {
            label = value === 'unassigned' ? 'Unassigned' : members.find(m => m.uid === value)?.name || '';
        } else if (field === 'companyId') {
            label = value === 'none' ? 'None' : companies.find(c => c.id === value)?.name || '';
        } else {
            const options = { priority: priorities, status: statuses, type: types }[field];
            label = options.find(o => o.value === value)?.label || '';
        }
        setPendingUpdate({ field, value: value === 'unassigned' || value === 'none' ? null : value, label });
    }
    
    const handleDeadlineChange = (date: Date | undefined) => {
        const label = date ? format(date, 'PP') : 'cleared';
        setPendingUpdate({ field: 'deadline', value: date ? date.toISOString() : null, label });
    }
    
    const handleTagKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && tagInput.trim()) {
            e.preventDefault();
            const newTag = tagInput.trim();
            if (!currentTags.includes(newTag)) {
                const updatedTags = [...currentTags, newTag];
                setCurrentTags(updatedTags);
                await handleUpdate('tags', updatedTags);
                setTagInput('');
            }
        }
    };

    const removeTag = async (tagToRemove: string) => {
        const updatedTags = currentTags.filter(tag => tag !== tagToRemove);
        setCurrentTags(updatedTags);
        await handleUpdate('tags', updatedTags);
    };


    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            setAttachments(prev => [...prev, ...Array.from(event.target.files!)]);
        }
    };

    const handleFileDrop = (files: FileList) => {
        setAttachments(prev => [...prev, ...Array.from(files)]);
    }

    const removeAttachment = (fileToRemove: File) => {
        setAttachments(prev => prev.filter(file => file !== fileToRemove));
    };

    const convertFileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                const base64String = (reader.result as string).split(',')[1];
                resolve(base64String);
            };
            reader.onerror = error => reject(error);
        });
    };

    const handleSendReply = async () => {
        if (!userProfile?.organizationId || !user || !user.email || !email) {
            toast({ variant: "destructive", title: "Cannot Reply", description: "Missing required information to send a reply." });
            return;
        }
        if (!replyContent.trim() && attachments.length === 0) {
            toast({ variant: "destructive", title: "Cannot send an empty reply." });
            return;
        }
        setIsSending(true);
        try {
            if(!replyingToMessageId) throw new Error("Could not determine message to reply to.");
            
            const attachmentPayloads: NewAttachment[] = await Promise.all(
                attachments.map(async (file) => ({
                    name: file.name,
                    contentType: file.type,
                    contentBytes: await convertFileToBase64(file),
                }))
            );

            const isClientReplying = userProfile.isClient === true;
            const isOwnerReplying = user.uid === userProfile.organizationOwnerUid;
            
            // Immediately hide reply form and show toast
            setReplyingToMessageId(null);
            toast({ title: "Sending Reply...", description: "Your reply is being sent." });

            await replyToEmailAction(
                userProfile.organizationId,
                email.id,
                replyingToMessageId, 
                replyContent, 
                email?.conversationId, 
                attachmentPayloads,
                { 
                    name: userProfile.name || user.email, 
                    email: user.email, 
                    isClient: isClientReplying, 
                    status: userProfile.status,
                    isOwner: isOwnerReplying,
                },
                replyTo,
                replyCc, 
                replyBcc
            );
            
            if (email.conversationId) {
                await fetchAndStoreFullConversation(userProfile.organizationId, email.conversationId);
            }

            // Clear state after action
            setReplyContent('');
            setAttachments([]);
            setReplyType(null);
            setReplyTo('');
            setReplyCc('');
            setReplyBcc('');
            setShowReplyCc(false);
            setShowReplyBcc(false);

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
            toast({
                variant: "destructive",
                title: "Failed to send reply.",
                description: errorMessage,
            });
        } finally {
            setIsSending(false);
        }
    };
    
    const handleSendForward = async () => {
        if (!userProfile?.organizationId || !user?.email || !email || !email.ticketNumber) {
            toast({ variant: "destructive", title: "Cannot Forward", description: "Missing required information to forward this email." });
            return;
        }
        if (!forwardTo.trim()) {
            toast({ variant: "destructive", title: "Forward recipient is required." });
            return;
        }
        setIsSending(true);
        try {
            const ticketId = email.id;
            if (!forwardingMessageId) throw new Error("Could not determine message to forward.");
    
            await forwardEmailAction(
                userProfile.organizationId, 
                ticketId, 
                forwardingMessageId, 
                forwardComment, 
                forwardTo, 
                forwardCc, 
                forwardBcc, 
                { name: userProfile.name || user.email, email: user.email },
                email.ticketNumber,
                email.subject
            );
            
            toast({ title: "Email Forwarded!", description: "Your email has been forwarded successfully." });
            setForwardingMessageId(null);
            setForwardTo('');
            setForwardCc('');
            setForwardBcc('');
            setForwardComment('');
            setShowForwardCc(false);
            setShowForwardBcc(false);
    
            if (email?.conversationId) {
                await fetchAndStoreFullConversation(userProfile.organizationId, email.conversationId);
            }
    
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
            toast({
                variant: "destructive",
                title: "Failed to forward email.",
                description: errorMessage,
            });
        } finally {
            setIsSending(false);
        }
    };

    const handleReplyClick = (messageId: string) => {
        const message = email?.conversation?.find(m => m.id === messageId);
        if (!message || !user?.email || !userProfile || !adminEmail || !email) return;

        const isClientReplying = userProfile.isClient === true;
        
        setReplyingToMessageId(messageId);
        setForwardingMessageId(null);
        setNoteContent('');
        setIsAddingNote(false);
        setReplyContent('');
        setReplyBcc('');
        setShowReplyBcc(false);
        setReplyType('reply');
    
        const ccRecipients = new Set<string>();

        if (isClientReplying) {
            ccRecipients.add(user.email.toLowerCase());
            const assignedAgent = members.find(m => m.uid === email.assignee);
            if (assignedAgent?.email) {
                ccRecipients.add(assignedAgent.email.toLowerCase());
            }
        } else {
            if (user.uid !== userProfile.organizationOwnerUid) {
                ccRecipients.add(user.email.toLowerCase());
            }
            if (email?.creator?.email) {
                ccRecipients.add(email.creator.email.toLowerCase());
            }
            const assignedAgent = members.find(m => m.uid === email.assignee);
             if (assignedAgent?.email) {
                ccRecipients.add(assignedAgent.email.toLowerCase());
            }
        }
        
        ccRecipients.delete(adminEmail.toLowerCase());
        
        setReplyTo(adminEmail);
        setReplyCc(Array.from(ccRecipients).join(', '));
        setShowReplyCc(true);
    };

    const handleReplyAllClick = (messageId: string) => {
        const message = email?.conversation?.find(m => m.id === messageId);
        if (!message || !user?.email || !userProfile || !adminEmail || !email) return;
        
        const isClientReplying = userProfile.isClient === true;

        setReplyingToMessageId(messageId);
        setReplyType('reply-all');
        setForwardingMessageId(null);
        setNoteContent('');
        setIsAddingNote(false);
        setReplyContent('');

        const ccRecipients = new Set<string>();

        message.ccRecipients?.forEach(r => ccRecipients.add(r.emailAddress.address.toLowerCase()));
        message.toRecipients?.forEach(r => ccRecipients.add(r.emailAddress.address.toLowerCase()));
        
        if (message.senderEmail) {
            ccRecipients.add(message.senderEmail.toLowerCase());
        }

        if (isClientReplying) {
            ccRecipients.add(user.email.toLowerCase());
            const assignedAgent = members.find(m => m.uid === email.assignee);
            if (assignedAgent?.email) {
                ccRecipients.add(assignedAgent.email.toLowerCase());
            }
        } else {
            if (user.uid !== userProfile.organizationOwnerUid) {
                ccRecipients.add(user.email.toLowerCase());
            }
            if (email?.creator?.email) {
                ccRecipients.add(email.creator.email.toLowerCase());
            }
            const assignedAgent = members.find(m => m.uid === email.assignee);
             if (assignedAgent?.email) {
                ccRecipients.add(assignedAgent.email.toLowerCase());
            }
        }

        ccRecipients.delete(adminEmail.toLowerCase());
        
        setReplyTo(adminEmail);
        setReplyCc(Array.from(ccRecipients).join(', '));
        setReplyBcc('');
        setShowReplyCc(true);
        setShowReplyBcc(false);
    };

    const handleCancelReply = () => {
        setReplyingToMessageId(null);
        setReplyType(null);
        setReplyContent('');
        setAttachments([]);
        setReplyTo('');
        setReplyCc('');
        setReplyBcc('');
        setShowReplyCc(false);
        setShowReplyBcc(false);
    };

    const handleForwardClick = (messageId: string) => {
        if(user?.email && userProfile){
            setReplyingToMessageId(null);
            setNoteContent('');
            setIsAddingNote(false);
            setForwardTo('');
            const ccRecipients = new Set<string>();

            // Only add current user to CC if they are not the admin
            if (user.uid !== userProfile.organizationOwnerUid) {
                ccRecipients.add(user.email);
            }
            setForwardCc(Array.from(ccRecipients).join(', '));
            setForwardBcc('');
            setForwardComment('');
            setForwardingMessageId(messageId);
			setShowForwardCc(false);
			setShowForwardBcc(false);
		}
	};

const handleSaveNote = async () => {
    if (!noteContent.trim() || !user || !userProfile?.organizationId || !email) return;
    
    setIsSavingNote(true);
    try {
        await addNoteToTicket(userProfile.organizationId, email.id, {
            content: noteContent,
            date: new Date().toISOString(),
            user: user.email || 'Unknown User'
        });
        toast({ title: 'Note added successfully' });
        setNoteContent('');
        setIsAddingNote(false);
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
        toast({ variant: 'destructive', title: 'Failed to add note', description: errorMessage });
    } finally {
        setIsSavingNote(false);
    }
};


const handleCancelForward = () => {
    setForwardingMessageId(null);
    setForwardTo('');
    setForwardCc('');
    setForwardBcc('');
    setForwardComment('');
    setShowForwardCc(false);
    setShowForwardBcc(false);
};

const renderRecipientList = (recipients: Recipient[] | undefined) => {
    if (!recipients || recipients.length === 0) return null;
    return recipients.map(r => r.emailAddress.address).join(', ');
}

const timeline: TimelineItemType[] = useMemo(() => {
    if (!email) return [];

    const emailItems: TimelineItemType[] = (email.conversation || [email]).map(e => ({
        ...e,
        itemType: 'email',
        date: e.receivedDateTime, // Normalize date property for sorting
    }));

    const noteItems: TimelineItemType[] = notes.map(note => ({
        ...note,
        itemType: 'note',
    }));

    return [...emailItems, ...noteItems].sort((a, b) => {
        return parseISO(a.date).getTime() - parseISO(b.date).getTime();
    });
}, [email, notes]);

const isReplyCcVisible = showReplyCc || !!replyCc;
const isReplyBccVisible = showReplyBcc || !!replyBcc;
const isForwardCcVisible = showForwardCc || !!forwardCc;
const isForwardBccVisible = showForwardBcc || !!forwardBcc;

const renderMessageCard = (message: DetailedEmail, isFirstInThread: boolean) => {
    const regularAttachments = message.attachments?.filter(att => !att.isInline) || [];
    const isReplyingToThis = replyingToMessageId === message.id;
    const isForwardingThis = forwardingMessageId === message.id;
    const showReplyAll = (message.ccRecipients && message.ccRecipients.length > 0) || (message.toRecipients && message.toRecipients.length > 1);

    return (
        <div key={message.id}>
            <Card className="overflow-hidden">
                <CardHeader className="flex flex-row items-start gap-4 p-4 bg-muted border-b">
                    <Avatar className="h-10 w-10">
                        <AvatarFallback>{message.sender?.[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 grid gap-1 text-sm">
                        <div className="font-semibold">{message.sender}</div>
                        <div className="text-xs text-muted-foreground">
                            <p>
                                <span className="font-semibold">From:</span> {message.senderEmail}
                            </p>
                            <p>
                                <span className="font-semibold">To:</span> {renderRecipientList(message.toRecipients)}
                            </p>
                            {message.ccRecipients && message.ccRecipients.length > 0 && (
                                <p>
                                    <span className="font-semibold">CC:</span> {renderRecipientList(message.ccRecipients)}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 text-xs text-muted-foreground">
                        <span>{format(parseISO(message.receivedDateTime), 'eee, MMM d, yyyy h:mm a')}</span>
                         <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleReplyClick(message.id)}>
                                <Reply className="h-4 w-4" />
                            </Button>
                            {showReplyAll && (
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleReplyAllClick(message.id)}>
                                    <ReplyAll className="h-4 w-4" />
                                </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleForwardClick(message.id)}>
                                <Share className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                        {isFirstInThread && <h2 className="text-xl font-bold p-4 pb-0">{message.subject}</h2>}
                        {message.body.contentType === 'html' ? (
                            <CollapsibleEmailContent htmlContent={prepareHtmlContent(message.body.content, message.attachments)} attachments={message.attachments} />
                        ) : (
                            <pre className="whitespace-pre-wrap text-sm p-4">{message.body.content}</pre>
                        )}
                    </div>
                    {regularAttachments.length > 0 && (
                        <div className="p-4 border-t">
                            <h3 className="text-sm font-medium mb-2">Attachments</h3>
                            <div className="flex flex-wrap gap-2">
                                {regularAttachments.map(att => (
                                    <Button key={att.id} variant="outline" size="sm" onClick={() => downloadAttachment(userProfile!.organizationId!, message.id, att)}>
                                        <Paperclip className="mr-2 h-4 w-4" />
                                        {att.name}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

             {isReplyingToThis && (
                <Card className="mt-4">
                    <CardHeader>
                        <CardTitle>
                            {replyType === 'reply-all' ? 'Reply All Email' : 'Reply Email'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-4">
                            <>
                                <div className="flex items-center gap-2 border-b">
                                    <Label htmlFor="reply-to" className="py-2.5">To</Label>
                                    <AutocompleteInput
                                        id="reply-to"
                                        suggestions={members.filter(m => m.uid)}
                                        value={replyTo}
                                        onChange={setReplyTo}
                                        placeholder="to@example.com"
                                        className="flex-1 h-auto px-0"
                                    />
                                    <div className="flex-shrink-0">
                                        {!isReplyCcVisible && (
                                            <Button variant="link" size="sm" type="button" className="h-auto p-1 text-xs" onClick={() => setShowReplyCc(true)}>Cc</Button>
                                        )}
                                        {!isReplyBccVisible && (
                                            <Button variant="link" size="sm" type="button" className="h-auto p-1 text-xs" onClick={() => setShowReplyBcc(true)}>Bcc</Button>
                                        )}
                                    </div>
                                </div>
                                {isReplyCcVisible && (
                                    <div className="flex items-center gap-2 border-b">
                                        <Label htmlFor="reply-cc" className="py-2.5">Cc</Label>
                                        <AutocompleteInput 
                                            id="reply-cc"
                                            suggestions={members.filter(m => m.uid)}
                                            value={replyCc}
                                            onChange={setReplyCc}
                                            placeholder="cc@example.com" 
                                            className="flex-1 h-auto px-0"
                                        />
                                    </div>
                                )}
                                {isReplyBccVisible && (
                                    <div className="flex items-center gap-2 border-b">
                                        <Label htmlFor="reply-bcc" className="py-2.5">Bcc</Label>
                                        <AutocompleteInput
                                            id="reply-bcc"
                                            suggestions={members.filter(m => m.uid)}
                                            value={replyBcc}
                                            onChange={setReplyBcc}
                                            placeholder="bcc@example.com"
                                            className="flex-1 h-auto px-0"
                                        />
                                    </div>
                                )}
                                <RichTextEditor
                                    value={replyContent}
                                    onChange={setReplyContent}
                                    onAttachmentClick={() => fileInputRef.current?.click()}
                                    onFileDrop={handleFileDrop}
                                />
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    multiple
                                    onChange={handleFileChange}
                                    className="hidden"
                                />
                                {attachments.length > 0 && (
                                    <div className="space-y-2">
                                        <h4 className="text-sm font-medium">Attachments</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {attachments.map((file, index) => (
                                                <Badge key={index} variant="secondary" className="flex items-center gap-2">
                                                    <span>{file.name}</span>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-4 w-4 rounded-full"
                                                        onClick={() => removeAttachment(file)}
                                                    >
                                                        <X className="h-3 w-3" />
                                                        <span className="sr-only">Remove attachment</span>
                                                    </Button>
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                    <div className="flex justify-end gap-2">
                                    <Button variant="ghost" onClick={handleCancelReply}>Cancel</Button>
                                    <Button onClick={handleSendReply} disabled={isSending}>
                                        {isSending ? (
                                            <>
                                                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                                Sending...
                                            </>
                                        ) : (
                                            <>
                                                <Send className="mr-2 h-4 w-4" />
                                                Send Reply
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </>
                    </CardContent>
                </Card>
            )}

             {isForwardingThis && (
                <Card className="mt-4">
                    <CardHeader>
                        <CardTitle>Forward Email</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-4">
                            <>
                                <div className="flex items-center gap-2 border-b">
                                    <Label htmlFor="forward-to" className="py-2.5">To</Label>
                                    <AutocompleteInput 
                                        id="forward-to"
                                        suggestions={members.filter(m => m.uid)}
                                        value={forwardTo}
                                        onChange={setForwardTo}
                                        placeholder="recipient@example.com"
                                        className="flex-1 h-auto px-0"
                                    />
                                    <div className="flex-shrink-0">
                                        {!isForwardCcVisible && (
                                            <Button variant="link" size="sm" type="button" className="h-auto p-1 text-xs" onClick={() => setShowForwardCc(true)}>Cc</Button>
                                        )}
                                        {!isForwardBccVisible && (
                                            <Button variant="link" size="sm" type="button" className="h-auto p-1 text-xs" onClick={() => setShowForwardBcc(true)}>Bcc</Button>
                                        )}
                                    </div>
                                </div>
                                {isForwardCcVisible && (
                                    <div className="flex items-center gap-2 border-b">
                                        <Label htmlFor="forward-cc" className="py-2.5">Cc</Label>
                                        <AutocompleteInput
                                            id="forward-cc"
                                            suggestions={members.filter(m => m.uid)}
                                            value={forwardCc}
                                            onChange={setForwardCc}
                                            placeholder="cc@example.com"
                                            className="flex-1 h-auto px-0"
                                        />
                                    </div>
                                )}
                                {isForwardBccVisible && (
                                    <div className="flex items-center gap-2 border-b">
                                        <Label htmlFor="forward-bcc" className="py-2.5">Bcc</Label>
                                        <AutocompleteInput
                                            id="forward-bcc"
                                            suggestions={members.filter(m => m.uid)}
                                            value={forwardBcc}
                                            onChange={setForwardBcc}
                                            placeholder="bcc@example.com"
                                            className="flex-1 h-auto px-0"
                                        />
                                    </div>
                                )}
                                <div className="space-y-2 pt-4">
                                    <Label htmlFor="forward-comment">Comment (optional)</Label>
                                    <RichTextEditor
                                        value={forwardComment}
                                        onChange={setForwardComment}
                                        onAttachmentClick={() => toast({ title: "Attachments not supported for forwarding yet."})}
                                        onFileDrop={handleFileDrop}
                                    />
                                </div>
                                    <div className="flex justify-end gap-2">
                                    <Button variant="ghost" onClick={handleCancelForward}>Cancel</Button>
                                    <Button onClick={handleSendForward} disabled={isSending}>
                                        {isSending ? (
                                            <>
                                                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                                Forwarding...
                                            </>
                                        ) : (
                                            <>
                                                <Send className="mr-2 h-4 w-4" />
                                                Forward
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

const renderNoteCard = (note: Note) => {
    const member = members.find(m => m.email === note.user);
    return (
        <Card key={note.id} className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
            <CardHeader className="flex flex-row items-center gap-4 p-4">
                <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-yellow-100 dark:bg-yellow-800">{member?.name?.[0]?.toUpperCase() || 'N'}</AvatarFallback>
                </Avatar>
                <div className="flex-1 grid gap-1 text-sm">
                    <div className="font-semibold">{member?.name || note.user} <span className="text-muted-foreground font-normal">added a note</span></div>
                </div>
                <div className="text-xs text-muted-foreground">
                    {format(parseISO(note.date), 'eee, MMM d, yyyy h:mm a')}
                </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                    {parse(note.content)}
                </div>
            </CardContent>
        </Card>
    );
};


const handleLogout = async () => {
    try {
    await logout();
    router.push('/');
    } catch (error) {
    console.error("Failed to log out", error);
    }
};

if (loading || !user) {
    return (
    <div className="flex items-center justify-center min-h-screen">
        <p>Loading...</p>
    </div>
    );
}

const isOwner = user?.uid === userProfile?.organizationOwnerUid;
const isClient = userProfile?.isClient === true;

const handleMenuClick = (view: string) => {
    if (view === 'archive') {
        router.push('/archive');
    } else if (view === 'create-ticket') {
        router.push('/create-ticket');
    } else {
        router.push(`/dashboard?view=${view}`); 
    }
};

const statusDetails = statuses.find(s => s.value === currentStatus) || statuses[0];
const typeDetails = types.find(t => t.value === currentType) || types[1];
const priorityDetails = priorities.find(p => p.value === currentPriority) || priorities[0];
const assigneeName = members.find(m => m.uid === currentAssignee)?.name || 'Unassigned';


return (
    <SidebarProvider>
        <AlertDialog open={!!pendingUpdate} onOpenChange={(open) => !open && setPendingUpdate(null)}>
            <div className="grid min-h-screen w-auto lg:grid-cols-[240px_1fr]">
                <Sidebar className="w-[240px] hidden lg:flex flex-col py-6 h-full">
                    <div className="flex-grow flex flex-col">
                        <SidebarHeader className="p-4 flex flex-col gap-4">
                            <div className="flex items-center justify-center">
                                <Image src="/quickdesk_logowithtext_nobg.png" alt="Quickdesk Logo" width="120" height="60" unoptimized />
                            </div>
                            <div className="flex items-center gap-4">
                                <Avatar className="h-9 w-9">
                                <AvatarFallback>{userProfile?.name?.[0].toUpperCase() || user.email?.[0].toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col">
                                    <span className="font-medium text-sm">{userProfile?.name || user.email}</span>
                                    <Button variant="link" size="sm" className="h-auto p-0 justify-start text-xs" onClick={handleLogout}>Log Out</Button>
                                </div>
                            </div>
                        </SidebarHeader>
                        <SidebarContent className="flex-grow">
                             <SidebarMenu className="flex flex-col gap-2 px-4">
                                {isClient ? (
                                    <>
                                        <SidebarMenuItem>
                                            <SidebarMenuButton onClick={() => handleMenuClick('tickets')} isActive>
                                                <List className="text-green-500" />
                                                <span>Tickets</span>
                                            </SidebarMenuButton>
                                        </SidebarMenuItem>
                                        <SidebarMenuItem>
                                            <SidebarMenuButton onClick={() => handleMenuClick('create-ticket')}>
                                                <PlusCircle className="text-blue-500" />
                                                <span>Create Ticket</span>
                                            </SidebarMenuButton>
                                        </SidebarMenuItem>
                                    </>
                                ) : (
                                    <>
                                        <SidebarMenuItem>
                                            <SidebarMenuButton onClick={() => handleMenuClick('analytics')}>
                                            <LayoutDashboard className="text-purple-500" />
                                            <span>Dashboard</span>
                                            </SidebarMenuButton>
                                        </SidebarMenuItem>
                                        <SidebarMenuItem>
                                            <SidebarMenuButton onClick={() => handleMenuClick('tickets')} isActive>
                                            <List className="text-green-500" />
                                            <span>Tickets</span>
                                            </SidebarMenuButton>
                                        </SidebarMenuItem>
                                        <SidebarMenuItem>
                                            <SidebarMenuButton onClick={() => handleMenuClick('compose')}>
                                            <Pencil className="text-blue-500" />
                                            <span>Compose</span>
                                            </SidebarMenuButton>
                                        </SidebarMenuItem>
                                        <SidebarMenuItem>
                                            <SidebarMenuButton onClick={() => handleMenuClick('archive')}>
                                                <Archive className="text-orange-500" />
                                                <span>Archive</span>
                                            </SidebarMenuButton>
                                        </SidebarMenuItem>
                                        <SidebarMenuItem>
                                            <SidebarMenuButton onClick={() => handleMenuClick('clients')}>
                                            <Users className="text-pink-500" />
                                            <span>Clients</span>
                                            </SidebarMenuButton>
                                        </SidebarMenuItem>
                                        <SidebarMenuItem>
                                            <SidebarMenuButton onClick={() => handleMenuClick('organization')}>
                                            <Building2 className="text-yellow-500" />
                                            <span>Organization</span>
                                            </SidebarMenuButton>
                                        </SidebarMenuItem>
                                    </>
                                )}
                                <SidebarMenuItem>
                                    <SidebarMenuButton onClick={() => handleMenuClick('settings')}>
                                    <SettingsIcon className="text-gray-500" />
                                    <span>Settings</span>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            </SidebarMenu>
                        </SidebarContent>
                    </div>
                </Sidebar>

                <main className="flex-1 flex flex-col min-w-0">
                     <Header>
                        <div className="flex items-center gap-4">
                            <Button variant="outline" size="icon" asChild>
                                <Link href="/dashboard?view=tickets">
                                    <ArrowLeft className="h-4 w-4" />
                                </Link>
                            </Button>
                            <h1 className="text-xl font-bold truncate">
                                {email?.ticketNumber && <span className="text-muted-foreground">#{email.ticketNumber}</span>} {email?.subject || "Ticket Details"}
                            </h1>
                        </div>
                    </Header>
                    <div className="flex-1 grid lg:grid-cols-[1fr_320px] overflow-y-auto">
                        <div className="p-4 sm:p-6 lg:p-8 space-y-4 overflow-y-auto">
                                {isLoading && (
                                    <div className="space-y-4">
                                        {[...Array(2)].map((_, i) => (
                                            <Card key={i}>
                                                <CardHeader className="flex flex-row items-center gap-4 p-4">
                                                    <Skeleton className="h-10 w-10 rounded-full" />
                                                    <div className="flex-1 space-y-2">
                                                        <Skeleton className="h-4 w-1/4" />
                                                        <Skeleton className="h-3 w-1/3" />
                                                    </div>
                                                </CardHeader>
                                                <CardContent className="p-4">
                                                    <Skeleton className="h-24 w-full" />
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                )}

                                {error && (
                                    <Alert variant="destructive">
                                        <Terminal className="h-4 w-4" />
                                        <AlertTitle>Error</AlertTitle>
                                        <AlertDescription>{error}</AlertDescription>
                                    </Alert>
                                )}

                                {!isLoading && !error && email && (
                                    <>
                                        <div className="space-y-4">
                                            {timeline.map((item, index) => {
                                                if (item.itemType === 'email') {
                                                    return renderMessageCard(item, index === 0);
                                                }
                                                if (item.itemType === 'note') {
                                                    return renderNoteCard(item);
                                                }
                                                return null;
                                            })}
                                        </div>
                                        <div className="mt-4">
                                            {!isAddingNote && !replyingToMessageId && !forwardingMessageId && !isClient && (
                                                <Button variant="outline" onClick={() => setIsAddingNote(true)}>
                                                    <MessageSquare className="mr-2 h-4 w-4" />
                                                    Add Note
                                                </Button>
                                            )}
                                            {isAddingNote && (
                                                <Card>
                                                    <CardHeader>
                                                        <CardTitle>Add Internal Note</CardTitle>
                                                    </CardHeader>
                                                    <CardContent className="space-y-4">
                                                        <RichTextEditor value={noteContent} onChange={setNoteContent} onAttachmentClick={() => {}} onFileDrop={handleFileDrop} />
                                                        <div className="flex justify-end gap-2">
                                                            <Button variant="ghost" onClick={() => { setIsAddingNote(false); setNoteContent(''); }}>Cancel</Button>
                                                            <Button onClick={handleSaveNote} disabled={isSavingNote}>
                                                                {isSavingNote && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                                                                Save Note
                                                            </Button>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                            
                            <aside className="border-l bg-background p-4 sm:p-6 lg:p-8 space-y-4 overflow-y-auto">
                                {isLoading && (
                                    <>
                                    <Card>
                                        <CardHeader>
                                            <Skeleton className="h-6 w-1/2" />
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            <Skeleton className="h-4 w-full" />
                                            <Skeleton className="h-4 w-full" />
                                            <Skeleton className="h-4 w-full" />
                                            <Skeleton className="h-4 w-full" />
                                            <Skeleton className="h-4 w-full" />
                                        </CardContent>
                                    </Card>
                                    <Card>
                                        <CardHeader>
                                            <Skeleton className="h-6 w-1/2" />
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            <Skeleton className="h-4 w-full" />
                                            <Skeleton className="h-4 w-full" />
                                        </CardContent>
                                    </Card>
                                    </>
                                )}
                                {!isLoading && email && (
                                    <>
                                    <Card>
                                        <CardHeader>
                                            <h2 className="text-lg font-bold">Properties</h2>
                                        </CardHeader>
                                        <CardContent className="space-y-4 text-sm">
                                            <div className="grid grid-cols-1 gap-y-4">
                                                <div className="space-y-1">
                                                    <div className="text-muted-foreground flex items-center gap-2 text-xs"><User size={14} /> Client</div>
                                                    <div className="font-medium text-sm truncate" title={email.sender}>{email.sender}</div>
                                                    <div className="text-xs text-muted-foreground truncate" title={email.senderEmail}>{email.senderEmail}</div>
                                                </div>
                                                <div className="space-y-1">
                                                    <div className="text-muted-foreground flex items-center gap-2 text-xs"><CalendarDays size={14} /> Submitted</div>
                                                    <div className="font-medium text-sm">{format(parseISO(email.receivedDateTime), 'MMMM d, yyyy')}</div>
                                                </div>
                                            </div>

                                            <Separator />
                                            
                                            <div className="grid grid-cols-1 gap-y-4">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-muted-foreground flex items-center gap-2 text-xs"><UserCheck size={14} /> Assignee</span>
                                                    {isOwner ? (
                                                        <Select value={currentAssignee || 'unassigned'} onValueChange={(value) => handleSelectChange('assignee', value)}>
                                                            <SelectTrigger className="h-auto p-0 border-0 bg-transparent shadow-none focus:ring-0 focus:ring-offset-0 text-sm w-auto justify-end">
                                                                <SelectValue>
                                                                    <span className="flex items-center gap-2">
                                                                        {assigneeName}
                                                                    </span>
                                                                </SelectValue>
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="unassigned">Unassigned</SelectItem>
                                                                {members.filter(m => m.uid).map(m => (
                                                                    <SelectItem key={m.uid} value={m.uid!}>
                                                                        {m.name}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    ) : (
                                                        <span className="font-medium text-sm">{assigneeName}</span>
                                                    )}
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-muted-foreground flex items-center gap-2 text-xs"><Shield size={14} /> Priority</span>
                                                    <Select value={currentPriority} onValueChange={(value) => handleSelectChange('priority', value)} disabled={isClient}>
                                                        <SelectTrigger className="h-auto p-0 border-0 bg-transparent shadow-none focus:ring-0 focus:ring-offset-0 text-sm w-auto justify-end">
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
                                                <div className="flex items-center justify-between">
                                                    <span className="text-muted-foreground flex items-center gap-2 text-xs"><CheckCircle size={14} /> Status</span>
                                                    <Select value={currentStatus} onValueChange={(value) => handleSelectChange('status', value)} disabled={isClient}>
                                                        <SelectTrigger className="h-auto p-0 border-0 bg-transparent shadow-none focus:ring-0 focus:ring-offset-0 text-sm w-auto justify-end">
                                                            <SelectValue>
                                                                <span className="flex items-center gap-2">
                                                                    {statusDetails && <statusDetails.icon className={cn("h-4 w-4", statusDetails.color)} />}
                                                                    {statusDetails?.label}
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
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-muted-foreground flex items-center gap-2 text-xs"><FileType size={14} /> Type</span>
                                                    <Select value={currentType} onValueChange={(value) => handleSelectChange('type', value)} disabled={isClient}>
                                                        <SelectTrigger className="h-auto p-0 border-0 bg-transparent shadow-none focus:ring-0 focus:ring-offset-0 text-sm w-auto justify-end">
                                                            <SelectValue>
                                                                <span className="flex items-center gap-2">
                                                                    {typeDetails && <typeDetails.icon className={cn("h-4 w-4", typeDetails.color)} />}
                                                                    {typeDetails?.label}
                                                                </span>
                                                            </SelectValue>
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {types.map(t => (
                                                                <SelectItem key={t.value} value={t.value}>
                                                                    <span className="flex items-center gap-2">
                                                                        <t.icon className={cn("h-4w-4", t.color)} />
                                                                        {t.label}
                                                                    </span>
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-muted-foreground flex items-center gap-2 text-xs"><CalendarClock size={14} /> Deadline</span>
                                                    <Popover>
                                                        <PopoverTrigger asChild disabled={isClient || !!currentPriority}>
                                                            <Button variant="ghost" size="sm" className="font-normal w-auto justify-end text-sm h-auto p-0 disabled:opacity-100 disabled:cursor-default text-right">
                                                                {currentDeadline ? (
                                                                    <div>
                                                                        <div>{format(currentDeadline, 'PP')}</div>
                                                                        <div className="text-muted-foreground text-xs">{format(currentDeadline, 'p')}</div>
                                                                    </div>
                                                                ) : 'Set deadline'}
                                                            </Button>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-auto p-0" align="end">
                                                            <Calendar
                                                                mode="single"
                                                                selected={currentDeadline}
                                                                onSelect={handleDeadlineChange}
                                                                initialFocus
                                                            />
                                                        </PopoverContent>
                                                    </Popover>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-muted-foreground flex items-center gap-2 text-xs"><Building size={14} /> Company</span>
                                                    <Select value={currentCompanyId || 'none'} onValueChange={(value) => handleSelectChange('companyId', value)} disabled={isClient}>
                                                        <SelectTrigger className="h-auto p-0 border-0 bg-transparent shadow-none focus:ring-0 focus:ring-offset-0 text-sm w-auto justify-end">
                                                            <SelectValue>
                                                                <span className="flex items-center gap-2">
                                                                    {companies.find(c => c.id === currentCompanyId)?.name || 'None'}
                                                                </span>
                                                            </SelectValue>
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="none">None</SelectItem>
                                                            {companies.map(c => (
                                                                <SelectItem key={c.id} value={c.id}>
                                                                    {c.name}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                            
                                            <Separator />

                                            <div className="space-y-2 col-span-2">
                                                <span className="text-muted-foreground flex items-center gap-2 text-xs"><Tag size={14} /> Tags</span>
                                                <div className="flex flex-wrap gap-2">
                                                    {currentTags.filter(tag => tag !== 'Resolved Late' && !tag.startsWith('deadline-reminder-sent-day-')).map(tag => (
                                                        <Badge key={tag} variant="secondary">
                                                            {tag}
                                                            {!isClient && (
                                                                <button onClick={() => removeTag(tag)} className="ml-1 rounded-full hover:bg-background/50 p-0.5">
                                                                    <X className="h-3 w-3" />
                                                                </button>
                                                            )}
                                                        </Badge>
                                                    ))}
                                                </div>
                                                {!isClient && (
                                                    <Input
                                                        value={tagInput}
                                                        onChange={(e) => setTagInput(e.target.value)}
                                                        onKeyDown={handleTagKeyDown}
                                                        placeholder="Add a tag..."
                                                        className="h-8 text-sm"
                                                    />
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                    {!isClient && (
                                        <Card>
                                            <CardHeader>
                                                <h2 className="text-lg font-bold flex items-center gap-2"><Activity /> Activity</h2>
                                            </CardHeader>
                                            <CardContent className="space-y-4">
                                                {activityLog.filter(log => log.type !== 'Note').map((log) => (
                                                    <TimelineItem key={log.id} type={log.type} date={log.date} user={log.user}>
                                                        {log.details}
                                                    </TimelineItem>
                                                ))}
                                            </CardContent>
                                        </Card>
                                    )}
                                    </>
                                )}
                            </aside>
                        </div>
                </main>
            </div>
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
    </SidebarProvider>
);
}
