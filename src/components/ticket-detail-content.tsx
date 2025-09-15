

"use client";

import { useEffect, useState, useRef, useCallback } from 'react';
import { useSettings } from '@/providers/settings-provider';
import { getEmail, replyToEmailAction, updateTicket, getOrganizationMembers, fetchAndStoreFullConversation, addActivityLog, getActivityLog, forwardEmailAction, getCompanies } from '@/app/actions';
import type { DetailedEmail, Attachment, NewAttachment, OrganizationMember, ActivityLog, Recipient, Company } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal, ArrowLeft, User, Shield, CheckCircle, UserCheck, Send, RefreshCw, Pencil, MoreHorizontal, Paperclip, LayoutDashboard, List, Users, Building2, X, Tag, CalendarClock, Activity, FileType, HelpCircle, ShieldAlert, Bug, Lightbulb, CircleDot, Clock, CheckCircle2, Archive, LogOut, Share, Settings as SettingsIcon, CalendarDays, AlignLeft, AlignCenter, AlignRight, AlignJustify, RemoveFormatting, Building, Reply } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
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

    const processedHtml = prepareHtmlContent(htmlContent, attachments);

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
        </style>
        ${content || ''}
    `;

    return (
        <div className="p-4">
            {parse(styledHtml(mainContent))}
            {quotedContent && (
                 <Accordion type="single" collapsible className="my-4 border-0">
                    <AccordionItem value="item-1" className="border-l pl-4">
                        <AccordionTrigger className="py-0 hover:no-underline -ml-4 justify-start w-auto h-auto p-1">
                            <MoreHorizontal className="h-4 w-4" />
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

const downloadAttachment = (attachment: Attachment) => {
    const byteCharacters = atob(attachment.contentBytes);
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
}


export function TicketDetailContent({ id, baseUrl }: { id: string, baseUrl?: string }) {
    const { settings, isConfigured } = useSettings();
    const { toast } = useToast();
    const { user, userProfile, loading, logout } = useAuth();
    const router = useRouter();
    const [email, setEmail] = useState<DetailedEmail | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    const [replyingToMessageId, setReplyingToMessageId] = useState<string | null>(null);
    const [replyContent, setReplyContent] = useState('');
    const [replyTo, setReplyTo] = useState('');
    const [replyCc, setReplyCc] = useState('');
    const [replyBcc, setReplyBcc] = useState('');

    const [forwardingMessageId, setForwardingMessageId] = useState<string | null>(null);
    const [forwardTo, setForwardTo] = useState('');
    const [forwardCc, setForwardCc] = useState('');
    const [forwardBcc, setForwardBcc] = useState('');
    const [forwardComment, setForwardComment] = useState('');

    const [isSending, setIsSending] = useState(false);
    const [attachments, setAttachments] = useState<File[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [activityLog, setActivityLog] = useState<ActivityLog[]>([]);
    const previousEmailRef = useRef<DetailedEmail | null>(null);

    const [currentPriority, setCurrentPriority] = useState('');
    const [currentStatus, setCurrentStatus] = useState('');
    const [currentType, setCurrentType] = useState('');
    const [currentDeadline, setCurrentDeadline] = useState<Date | undefined>(undefined);
    const [currentTags, setCurrentTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState('');
    const [currentCompanyId, setCurrentCompanyId] = useState<string | null>(null);
    const [currentAssignee, setCurrentAssignee] = useState<string | null>(null);


    const [members, setMembers] = useState<OrganizationMember[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);


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
        router.push('/login');
        }
    }, [user, loading, router]);
    
    useEffect(() => {
        const fetchDropdownData = async () => {
            if (userProfile?.organizationId) {
                const [orgMembers, fetchedCompanies] = await Promise.all([
                    getOrganizationMembers(userProfile.organizationId),
                    getCompanies(userProfile.organizationId),
                ]);
                setMembers(orgMembers);
                setCompanies(fetchedCompanies);
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
                const previousTicket = previousEmailRef.current;
                const currentUserEmail = user.email!;

                if (previousTicket) {
                    if (ticketData.priority !== previousTicket.priority) {
                        await addActivityLog(userProfile.organizationId!, email.id, { type: 'Priority', details: `changed from ${previousTicket.priority} to ${ticketData.priority}`, date: new Date().toISOString(), user: currentUserEmail });
                    }
                    if (ticketData.status !== previousTicket.status) {
                         await addActivityLog(userProfile.organizationId!, email.id, { type: 'Status', details: `changed from ${previousTicket.status} to ${ticketData.status}`, date: new Date().toISOString(), user: currentUserEmail });
                    }
                     if (ticketData.type !== previousTicket.type) {
                        await addActivityLog(userProfile.organizationId!, email.id, { type: 'Type', details: `changed from ${previousTicket.type} to ${ticketData.type}`, date: new Date().toISOString(), user: currentUserEmail });
                    }
                     if (ticketData.deadline !== previousTicket.deadline) {
                        const detail = ticketData.deadline ? `set to ${format(parseISO(ticketData.deadline), 'MMM d, yyyy')}` : 'removed';
                        await addActivityLog(userProfile.organizationId!, email.id, { type: 'Deadline', details: `Deadline ${detail}`, date: new Date().toISOString(), user: currentUserEmail });
                    }
                    if (ticketData.companyId !== previousTicket.companyId) {
                        const prevCompanyName = companies.find(c => c.id === previousTicket.companyId)?.name || 'None';
                        const newCompanyName = companies.find(c => c.id === ticketData.companyId)?.name || 'None';
                        await addActivityLog(userProfile.organizationId!, email.id, { type: 'Company', details: `changed from ${prevCompanyName} to ${newCompanyName}`, date: new Date().toISOString(), user: currentUserEmail });
                    }
                     if (ticketData.assignee !== previousTicket.assignee) {
                        const prevAssigneeName = members.find(m => m.uid === previousTicket.assignee)?.name || 'Unassigned';
                        const newAssigneeName = members.find(m => m.uid === ticketData.assignee)?.name || 'Unassigned';
                        await addActivityLog(userProfile.organizationId!, email.id, { type: 'Assignee', details: `changed from ${prevAssigneeName} to ${newAssigneeName}`, date: new Date().toISOString(), user: currentUserEmail });
                    }

                    
                    const prevTags = new Set(previousTicket.tags || []);
                    const newTags = new Set(ticketData.tags || []);
                    const addedTags = [...newTags].filter(x => !prevTags.has(x));
                    const removedTags = [...prevTags].filter(x => !newTags.has(x));

                    if(addedTags.length > 0) await addActivityLog(userProfile.organizationId!, email.id, { type: 'Tags', details: `added: ${addedTags.join(', ')}`, date: new Date().toISOString(), user: currentUserEmail });
                    if(removedTags.length > 0) await addActivityLog(userProfile.organizationId!, email.id, { type: 'Tags', details: `removed: ${removedTags.join(', ')}`, date: new Date().toISOString(), user: currentUserEmail });
                }

                // Update UI state and ref
                 setEmail(prevEmail => prevEmail ? ({ ...prevEmail, ...ticketData }) : ticketData);
                 previousEmailRef.current = { ...(email || {}), ...ticketData } as DetailedEmail;
            }
        });

        return () => unsubscribe();
    }, [email?.id, userProfile?.organizationId, members, companies, user?.email]);

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

        // Optimistic UI updates
        if(field === 'priority') setCurrentPriority(value);
        if(field === 'status') setCurrentStatus(value);
        if(field === 'type') setCurrentType(value);
        if(field === 'deadline') setCurrentDeadline(value);
        if(field === 'companyId') setCurrentCompanyId(value);
        if(field === 'assignee') setCurrentAssignee(value);


        const result = await updateTicket(userProfile.organizationId, ticketIdToUpdate, { [field]: value }, settings, {name: userProfile.name, email: user.email});

        if (!result.success) {
             toast({
                variant: 'destructive',
                title: 'Update Failed',
                description: result.error,
            });
            // Revert optimistic updates on failure
            if(email){
                 if(field === 'priority') setCurrentPriority(email.priority);
                 if(field === 'status') setCurrentStatus(email.status);
                 if(field === 'type') setCurrentType(email.type || 'Incident');
                 if(field === 'deadline') setCurrentDeadline(email.deadline ? parseISO(email.deadline) : undefined);
                 if(field === 'companyId') setCurrentCompanyId(email.companyId || null);
                 if(field === 'assignee') setCurrentAssignee(email.assignee || null);
            }
        } else {
            toast({
                title: 'Ticket Updated',
                description: `The ${field} has been changed.`,
            });
        }
    };
    
    const handleDeadlineChange = (date: Date | undefined) => {
        setCurrentDeadline(date); // Optimistic update
        handleUpdate('deadline', date ? date.toISOString() : null);
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
        if (!isConfigured || !userProfile?.organizationId || !user || !user.email) {
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

            await replyToEmailAction(
                settings, 
                userProfile.organizationId, 
                replyingToMessageId, 
                replyContent, 
                email?.conversationId, 
                attachmentPayloads,
                { name: userProfile.name || user.email, email: user.email },
                replyCc, 
                replyBcc
            );

            toast({ title: "Reply Sent!", description: "Your reply has been sent successfully." });
            setReplyContent('');
            setAttachments([]);
            setReplyingToMessageId(null);
            setReplyTo('');
            setReplyCc('');
            setReplyBcc('');
            
            // After sending, immediately refresh the conversation from the source
            if (email?.conversationId) {
                await fetchAndStoreFullConversation(settings, userProfile.organizationId, email.conversationId);
            }


        } catch (err)
            {
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
        if (!isConfigured || !userProfile?.organizationId || !user?.email || !email || !email.ticketNumber) {
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
                settings, 
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
    
            if (email?.conversationId) {
                await fetchAndStoreFullConversation(settings, userProfile.organizationId, email.conversationId);
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
        if (message) {
            setReplyingToMessageId(messageId);
            setReplyTo(message.senderEmail || '');
            setForwardingMessageId(null);
            setReplyContent('');
            setReplyCc('');
            setReplyBcc('');
        }
    };

    const handleCancelReply = () => {
        setReplyingToMessageId(null);
        setReplyContent('');
        setAttachments([]);
        setReplyTo('');
        setReplyCc('');
        setReplyBcc('');
    };

    const handleForwardClick = (messageId: string) => {
        setReplyingToMessageId(null);
        setForwardTo('');
        setForwardCc('');
        setForwardBcc('');
        setForwardComment('');
        setForwardingMessageId(messageId);
    };

    const handleCancelForward = () => {
        setForwardingMessageId(null);
        setForwardTo('');
        setForwardCc('');
        setForwardBcc('');
        setForwardComment('');
    };

    const renderRecipientList = (recipients: Recipient[] | undefined) => {
        if (!recipients || recipients.length === 0) return null;
        return recipients.map(r => r.emailAddress.address).join(', ');
    }

    
    const renderMessageCard = (message: DetailedEmail, isFirstInThread: boolean) => {
        const regularAttachments = message.attachments?.filter(att => !att.isInline) || [];
        const isReplyingToThis = replyingToMessageId === message.id;
        const isForwardingThis = forwardingMessageId === message.id;

        return (
            <div key={message.id}>
                <Card className="overflow-hidden">
                    <CardHeader className="flex flex-row items-center gap-4 p-4 bg-muted/20 border-b">
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
                                {message.bccRecipients && message.bccRecipients.length > 0 && (
                                    <p>
                                        <span className="font-semibold">BCC:</span> {renderRecipientList(message.bccRecipients)}
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-2 text-xs text-muted-foreground">
                            <span>{format(parseISO(message.receivedDateTime), 'eee, MMM d, yyyy h:mm a')}</span>
                             <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                     <Button variant="ghost" size="icon" className="h-7 w-7">
                                        <MoreHorizontal className="h-4 w-4" />
                                     </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleReplyClick(message.id)}>
                                        <Reply className="mr-2 h-4 w-4" />
                                        <span>Reply</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleForwardClick(message.id)}>
                                        <Share className="mr-2 h-4 w-4" />
                                        <span>Forward</span>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                            {isFirstInThread && <h2 className="text-xl font-bold p-4 pb-0">{message.subject}</h2>}
                            {message.body.contentType === 'html' ? (
                                <CollapsibleEmailContent htmlContent={message.body.content} attachments={message.attachments} />
                            ) : (
                                <pre className="whitespace-pre-wrap text-sm p-4">{message.body.content}</pre>
                            )}
                        </div>
                        {regularAttachments.length > 0 && (
                            <div className="p-4 border-t">
                                <h3 className="text-sm font-medium mb-2">Attachments</h3>
                                <div className="flex flex-wrap gap-2">
                                    {regularAttachments.map(att => (
                                        <Button key={att.id} variant="outline" size="sm" onClick={() => downloadAttachment(att)}>
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
                        <CardContent className="p-4 space-y-4">
                            {!isConfigured ? (
                                    <Alert>
                                    <SettingsIcon className="h-4 w-4" />
                                    <AlertTitle>API Configuration Needed</AlertTitle>
                                    <AlertDescription>
                                        Please <Link href="/?view=settings" className="font-bold underline">configure your API settings</Link> to send replies.
                                    </AlertDescription>
                                </Alert>
                            ) : (
                                <>
                                    <div className="space-y-2">
                                        <Label htmlFor="reply-to">To</Label>
                                        <Input 
                                            id="reply-to"
                                            value={replyTo}
                                            readOnly
                                            className="bg-transparent border-0 border-b rounded-none px-0 focus:ring-0"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="reply-cc">Cc</Label>
                                        <AutocompleteInput 
                                            id="reply-cc"
                                            suggestions={members}
                                            value={replyCc}
                                            onChange={setReplyCc}
                                            placeholder="cc@example.com" 
                                            className="bg-transparent border-0 border-b rounded-none px-0 focus:ring-0"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="reply-bcc">Bcc</Label>
                                        <AutocompleteInput
                                            id="reply-bcc"
                                            suggestions={members}
                                            value={replyBcc}
                                            onChange={setReplyBcc}
                                            placeholder="bcc@example.com"
                                            className="bg-transparent border-0 border-b rounded-none px-0 focus:ring-0"
                                        />
                                    </div>
                                    <RichTextEditor
                                        value={replyContent}
                                        onChange={setReplyContent}
                                        onAttachmentClick={() => fileInputRef.current?.click()}
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
                            )}
                        </CardContent>
                    </Card>
                )}

                 {isForwardingThis && (
                    <Card className="mt-4">
                        <CardHeader>
                            <h3 className="text-lg font-semibold">Forward Email</h3>
                        </CardHeader>
                        <CardContent className="p-4 space-y-4">
                                {!isConfigured ? (
                                    <Alert>
                                    <SettingsIcon className="h-4 w-4" />
                                    <AlertTitle>API Configuration Needed</AlertTitle>
                                    <AlertDescription>
                                        Please <Link href="/?view=settings" className="font-bold underline">configure your API settings</Link> to forward emails.
                                    </AlertDescription>
                                </Alert>
                            ) : (
                                <>
                                    <div className="space-y-2">
                                        <Label htmlFor="forward-to">To</Label>
                                        <AutocompleteInput 
                                            id="forward-to"
                                            suggestions={members}
                                            value={forwardTo}
                                            onChange={setForwardTo}
                                            placeholder="recipient@example.com"
                                            className="bg-transparent border-0 border-b rounded-none px-0 focus:ring-0"
                                            />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="forward-cc">Cc</Label>
                                        <AutocompleteInput
                                            id="forward-cc"
                                            suggestions={members}
                                            value={forwardCc}
                                            onChange={setForwardCc}
                                            placeholder="cc@example.com"
                                            className="bg-transparent border-0 border-b rounded-none px-0 focus:ring-0"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="forward-bcc">Bcc</Label>
                                        <AutocompleteInput
                                            id="forward-bcc"
                                            suggestions={members}
                                            value={forwardBcc}
                                            onChange={setForwardBcc}
                                            placeholder="bcc@example.com"
                                            className="bg-transparent border-0 border-b rounded-none px-0 focus:ring-0"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="forward-comment">Comment (optional)</Label>
                                        <RichTextEditor
                                            value={forwardComment}
                                            onChange={setForwardComment}
                                            onAttachmentClick={() => toast({ title: "Attachments not supported for forwarding yet."})}
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
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>
        );
    }


    const handleLogout = async () => {
        try {
        await logout();
        router.push('/login');
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

    const handleMenuClick = (view: string) => {
        if(view === 'tickets' || view === '/') {
            router.push('/');
        } else if (view === 'archive') {
            router.push('/archive');
        } else {
            router.push(`/?view=${view}`); 
        }
    };
    
    const statusDetails = statuses.find(s => s.value === currentStatus) || statuses[0];
    const typeDetails = types.find(t => t.value === currentType) || types[1];
    const priorityDetails = priorities.find(p => p.value === currentPriority) || priorities[0];
    const assigneeName = members.find(m => m.uid === currentAssignee)?.name || 'Unassigned';


    return (
        <SidebarProvider>
            <div className="grid min-h-screen w-full lg:grid-cols-[240px_1fr]">
                <Sidebar className="w-[240px] hidden lg:flex flex-col py-6 h-full">
                    <div className="flex-grow flex flex-col">
                        <SidebarFooter className="p-4">
                            <div className="flex items-center gap-4">
                                <Avatar className="h-9 w-9">
                                <AvatarFallback>{userProfile?.name?.[0].toUpperCase() || user.email?.[0].toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col">
                                    <span className="font-medium text-sm">{userProfile?.name || user.email}</span>
                                    <Button variant="link" size="sm" className="h-auto p-0 justify-start text-xs" onClick={handleLogout}>Log Out</Button>
                                </div>
                            </div>
                        </SidebarFooter>
                        <SidebarContent className="flex-grow">
                            <SidebarMenu className="flex flex-col gap-2 px-4">
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
                                <SidebarMenuItem>
                                    <SidebarMenuButton onClick={() => handleMenuClick('settings')}>
                                    <SettingsIcon className="text-gray-500" />
                                    <span>Settings</span>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            </SidebarMenu>
                        </SidebarContent>
                        <SidebarHeader className="mt-auto p-4">
                            <div className="flex flex-col items-center justify-center gap-2">
                                <span className="text-xs text-muted-foreground">Product of</span>
                                <Image src="/navlogo.jpg" alt="Onecore Logo" width={140} height={160} />
                            </div>
                        </SidebarHeader>
                    </div>
                </Sidebar>

                <main className="flex-1 flex flex-col min-w-0">
                     <Header>
                        <div className="flex items-center gap-4">
                            <Button variant="outline" size="icon" asChild>
                                <Link href="/?view=tickets">
                                    <ArrowLeft className="h-4 w-4" />
                                </Link>
                            </Button>
                            <h1 className="text-xl font-bold truncate">
                                {email?.ticketNumber && <span className="text-muted-foreground">#{email.ticketNumber}</span>} {email?.subject || "Ticket Details"}
                            </h1>
                        </div>
                    </Header>
                    <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto">
                        <div className="flex-1 p-4 sm:p-6 lg:p-8 space-y-4">
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
                                <div className="space-y-6">
                                    {email.conversation && email.conversation.length > 0 ? (
                                        email.conversation.map((msg, index) => renderMessageCard(msg, index === 0))
                                    ) : (
                                        renderMessageCard(email, true)
                                    )}
                                </div>
                            )}
                        </div>
                        
                        <aside className="w-full lg:w-[400px] lg:border-l p-4 sm:p-6 lg:p-8 space-y-4 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto flex-shrink-0">
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
                                                    <Select value={currentAssignee || 'unassigned'} onValueChange={(value) => { handleUpdate('assignee', value === 'unassigned' ? null : value)}}>
                                                        <SelectTrigger className="h-auto p-0 border-0 bg-transparent shadow-none focus:ring-0 focus:ring-offset-0 text-sm w-auto justify-end">
                                                            <SelectValue>
                                                                <span className="flex items-center gap-2">
                                                                    {assigneeName}
                                                                </span>
                                                            </SelectValue>
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="unassigned">Unassigned</SelectItem>
                                                            {members.map(m => (
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
                                                <Select value={currentPriority} onValueChange={(value) => { handleUpdate('priority', value)}}>
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
                                                <Select value={currentStatus} onValueChange={(value) => { handleUpdate('status', value)}}>
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
                                                <Select value={currentType} onValueChange={(value) => { handleUpdate('type', value)}}>
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
                                                                    <t.icon className={cn("h-4 w-4", t.color)} />
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
                                                    <PopoverTrigger asChild>
                                                        <Button variant="ghost" size="sm" className="font-normal w-auto justify-end text-sm h-auto p-0">
                                                            {currentDeadline ? format(currentDeadline, 'MMMM d, yyyy') : 'Set deadline'}
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
                                                <Select value={currentCompanyId || 'none'} onValueChange={(value) => { handleUpdate('companyId', value === 'none' ? null : value)}}>
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
                                                {currentTags.map(tag => (
                                                    <Badge key={tag} variant="secondary">
                                                        {tag}
                                                        <button onClick={() => removeTag(tag)} className="ml-1 rounded-full hover:bg-background/50 p-0.5">
                                                            <X className="h-3 w-3" />
                                                        </button>
                                                    </Badge>
                                                ))}
                                            </div>
                                            <Input
                                                value={tagInput}
                                                onChange={(e) => setTagInput(e.target.value)}
                                                onKeyDown={handleTagKeyDown}
                                                placeholder="Add a tag..."
                                                className="h-8 text-sm"
                                            />
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card>
                                     <CardHeader>
                                        <h2 className="text-lg font-bold flex items-center gap-2"><Activity /> Activity</h2>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        {activityLog.length > 0 ? (
                                            activityLog.map((log) => (
                                                <TimelineItem key={log.id} type={log.type} date={log.date} user={log.user}>
                                                    {log.details}
                                                </TimelineItem>
                                            ))
                                        ) : (
                                            <p className="text-sm text-muted-foreground">No recent activity.</p>
                                        )}
                                    </CardContent>
                                </Card>
                                </>
                            )}
                        </aside>
                    </div>
                </main>
            </div>
        </SidebarProvider>
    );
}
