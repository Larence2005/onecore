
"use client";

import { useEffect, useState, useRef, useCallback } from 'react';
import { useSettings } from '@/providers/settings-provider';
import { getEmail, replyToEmailAction, updateTicket } from '@/app/actions';
import type { DetailedEmail } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal, ArrowLeft, User, Calendar, Shield, CheckCircle, UserCheck, Send, RefreshCw, Pencil } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useAuth } from '@/providers/auth-provider';
import { useRouter } from 'next/navigation';
import { SidebarProvider, Sidebar, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarHeader, SidebarFooter } from '@/components/ui/sidebar';
import { Header } from '@/components/header';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { LayoutDashboard, List, Users, Building2, Settings } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';


const EmailIframe = ({ htmlContent }: { htmlContent: string }) => {
    const iframeRef = useRef<HTMLIFrameElement>(null);

    const setupIframe = useCallback(() => {
        if (iframeRef.current && iframeRef.current.contentWindow) {
            const doc = iframeRef.current.contentWindow.document;
            const body = doc.body;
            const documentElement = doc.documentElement;
            if (body) {
                const resizeIframe = () => {
                    if (iframeRef.current) {
                        const newHeight = Math.max(body.scrollHeight, documentElement.scrollHeight);
                        iframeRef.current.style.height = `${newHeight}px`;
                    }
                };

                resizeIframe();

                const observer = new MutationObserver(resizeIframe);
                observer.observe(body, { childList: true, subtree: true, attributes: true, characterData: true });
                
                if (iframeRef.current.contentWindow) {
                    iframeRef.current.contentWindow.addEventListener('resize', resizeIframe);
                }

                return () => {
                    observer.disconnect();
                    if(iframeRef.current && iframeRef.current.contentWindow) {
                       iframeRef.current.contentWindow.removeEventListener('resize', resizeIframe);
                    }
                };
            }
        }
    }, []);
    
    useEffect(() => {
        const cleanup = setupIframe();
        return cleanup;
    }, [htmlContent, setupIframe]);
    
    const styledHtmlContent = `
        <style>
            body { 
                margin: 0; 
                padding: 1rem;
                font-family: sans-serif; 
                color: hsl(var(--foreground)); 
                background-color: transparent; 
                word-wrap: break-word;
                overflow-wrap: break-word;
                overflow: hidden;
            }
            img { max-width: 100% !important; height: auto !important; }
            * { max-width: 100%; }
        </style>
        ${htmlContent || ''}
    `;

    return (
        <iframe 
            ref={iframeRef}
            srcDoc={styledHtmlContent} 
            className="w-full border-0" 
            onLoad={setupIframe}
            scrolling="no"
        />
    );
};


export function TicketDetailContent({ id }: { id: string }) {
    const { settings, isConfigured } = useSettings();
    const { toast } = useToast();
    const { user, loading, logout } = useAuth();
    const router = useRouter();
    const [email, setEmail] = useState<DetailedEmail | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isReplying, setIsReplying] = useState(false);
    const [replyContent, setReplyContent] = useState('');
    const [isSending, setIsSending] = useState(false);


    const [currentPriority, setCurrentPriority] = useState('');
    const [currentAssignee, setCurrentAssignee] = useState('');
    const [currentStatus, setCurrentStatus] = useState('');

    const priorities = [
        { value: 'Low', label: 'Low' },
        { value: 'Medium', label: 'Medium' },
        { value: 'High', label: 'High' },
        { value: 'Urgent', label: 'Urgent' },
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
    ];

    useEffect(() => {
        if (!loading && !user) {
        router.push('/login');
        }
    }, [user, loading, router]);


    const fetchEmail = useCallback(async () => {
        if (!isConfigured) {
            setError("Please configure your Microsoft Graph API credentials in Settings.");
            setIsLoading(false);
            return;
        }
        if (!id) return;

        setIsLoading(true);
        try {
            const detailedEmail = await getEmail(settings, id);
            setEmail(detailedEmail);
            setCurrentPriority(detailedEmail.priority);
            setCurrentAssignee(detailedEmail.assignee);
            setCurrentStatus(detailedEmail.status);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
            setError(errorMessage);
            toast({
                variant: "destructive",
                title: "Failed to load email.",
                description: errorMessage,
            });
        } finally {
            setIsLoading(false);
        }
    }, [id, settings, isConfigured, toast]);

    useEffect(() => {
        fetchEmail();
    }, [fetchEmail]);
    
    const handleUpdate = async (field: 'priority' | 'assignee' | 'status', value: string) => {
        if (!email) return;

        const originalState = {
            priority: currentPriority,
            assignee: currentAssignee,
            status: currentStatus,
        };

        // Optimistic UI update
        if (field === 'priority') setCurrentPriority(value);
        if (field === 'assignee') setCurrentAssignee(value);
        if (field === 'status') setCurrentStatus(value);
        
        const ticketIdToUpdate = email.conversation?.[0]?.id || email.id;

        const result = await updateTicket(ticketIdToUpdate, { [field]: value });

        if (!result.success) {
             if (field === 'priority') setCurrentPriority(originalState.priority);
             if (field === 'assignee') setCurrentAssignee(originalState.assignee);
             if (field === 'status') setCurrentStatus(originalState.status);

            toast({
                variant: 'destructive',
                title: 'Update Failed',
                description: result.error,
            });
        } else {
            toast({
                title: 'Ticket Updated',
                description: `The ${field} has been changed to ${value}.`,
            });
        }
    };


    const handleSendReply = async () => {
        if (!replyContent.trim()) {
            toast({ variant: "destructive", title: "Cannot send empty reply." });
            return;
        }
        setIsSending(true);
        try {
            const latestMessageId = email?.conversation?.length ? email.conversation[email.conversation.length - 1].id : email?.id;
            if(!latestMessageId) throw new Error("Could not determine message to reply to.");
            await replyToEmailAction(settings, latestMessageId, replyContent, email?.conversationId);
            toast({ title: "Reply Sent!", description: "Your reply has been sent successfully." });
            setReplyContent('');
            setIsReplying(false);
            await fetchEmail();
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

    const handleReplyClick = () => {
        setIsReplying(true);
    };

    const handleCancelReply = () => {
        setIsReplying(false);
        setReplyContent('');
    };

    
    const renderMessageCard = (message: DetailedEmail, isFirstInThread: boolean) => (
        <Card key={message.id} className="overflow-hidden">
            <CardHeader className="flex flex-row items-center gap-4 p-4 bg-muted/20 border-b">
                 <Avatar className="h-10 w-10">
                    <AvatarFallback>{message.sender?.[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 grid gap-1 text-sm">
                    <div className="font-semibold">{message.sender}</div>
                     <div className="text-xs text-muted-foreground">
                        To: {email?.sender === message.sender ? 'Me' : email?.sender}
                    </div>
                </div>
                <div className="text-xs text-muted-foreground text-right">
                    {format(parseISO(message.receivedDateTime), 'eee, MMM d, yyyy h:mm a')}
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                    {isFirstInThread && <h2 className="text-xl font-bold p-4 pb-0">{message.subject}</h2>}
                    {message.body.contentType === 'html' ? (
                        <EmailIframe htmlContent={message.body.content} />
                    ) : (
                        <pre className="whitespace-pre-wrap text-sm p-4">{message.body.content}</pre>
                    )}
                </div>
            </CardContent>
        </Card>
    );

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
    
    const handleMenuClick = (view: string) => {
        if(view === 'tickets' || view === '/') {
            router.push('/');
        } else {
            router.push(`/?view=${view}`); 
        }
    };

    return (
        <SidebarProvider>
            <div className="grid min-h-screen w-full bg-background text-foreground lg:grid-cols-[240px_1fr]">
                <Sidebar className="w-[240px] bg-card hidden lg:flex flex-col py-6">
                    <SidebarContent className="flex-grow flex flex-col">
                        <SidebarHeader className="mb-8 px-4">
                            <div className="flex items-center gap-2">
                                <Button variant="ghost" size="icon">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-command"><path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3z"/></svg>
                                </Button>
                                <span className="font-bold text-lg">Onecore</span>
                            </div>
                        </SidebarHeader>
                        <SidebarMenu className="flex flex-col gap-2 px-4">
                        <SidebarMenuItem>
                            <SidebarMenuButton onClick={() => handleMenuClick('compose')}>
                            <Pencil />
                            <span>Compose</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                        <SidebarMenuItem>
                            <SidebarMenuButton onClick={() => handleMenuClick('analytics')}>
                            <LayoutDashboard />
                            <span>Dashboard</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                        <SidebarMenuItem>
                            <SidebarMenuButton onClick={() => handleMenuClick('tickets')} isActive>
                            <List />
                            <span>Tickets</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                        <SidebarMenuItem>
                            <SidebarMenuButton onClick={() => handleMenuClick('clients')}>
                            <Users />
                            <span>Clients</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                        <SidebarMenuItem>
                            <SidebarMenuButton onClick={() => handleMenuClick('organization')}>
                            <Building2 />
                            <span>Organization</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                        <SidebarMenuItem>
                            <SidebarMenuButton onClick={() => handleMenuClick('settings')}>
                            <Settings />
                            <span>Settings</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarContent>
                    <SidebarFooter className="mt-auto p-4">
                        <div className="flex items-center gap-4">
                            <Avatar className="h-9 w-9">
                            <AvatarFallback>{user.email?.[0].toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                                <span className="font-medium text-sm">{user.email}</span>
                                <Button variant="link" size="sm" className="h-auto p-0 justify-start text-xs" onClick={handleLogout}>Log Out</Button>                            </div>
                        </div>
                    </SidebarFooter>
                </Sidebar>

                <main className="flex-1 flex flex-col min-w-0">
                     <Header>
                        <div className="flex items-center gap-4">
                            <Button variant="outline" size="icon" asChild>
                                <Link href="/">
                                    <ArrowLeft className="h-4 w-4" />
                                </Link>
                            </Button>
                            <h1 className="text-xl font-bold truncate">{email?.subject || "Ticket Details"}</h1>
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
                                    <div className="space-y-6">
                                        {email.conversation && email.conversation.length > 0 ? (
                                            email.conversation.map((msg, index) => renderMessageCard(msg, index === 0))
                                        ) : (
                                            renderMessageCard(email, true)
                                        )}
                                    </div>
                                    <div className="flex justify-between items-center mt-4">
                                        {!isReplying && (
                                            <Button onClick={handleReplyClick}>
                                                Reply
                                            </Button>
                                        )}
                                    </div>

                                    {isReplying && (
                                        <Card>
                                            <CardContent className="p-4 space-y-4">
                                                <Textarea 
                                                    placeholder="Type your reply here..."
                                                    className="min-h-[150px]"
                                                    value={replyContent}
                                                    onChange={(e) => setReplyContent(e.target.value)}
                                                />
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
                                            </CardContent>
                                        </Card>
                                    )}
                                </div>
                            )}
                        </div>
                        
                        <aside className="w-full lg:w-80 lg:border-l p-4 sm:p-6 lg:p-8 space-y-4 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto">
                            {isLoading && (
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
                            )}
                            {!isLoading && email && (
                                <Card>
                                    <CardHeader>
                                        <h2 className="text-lg font-bold">Properties</h2>
                                    </CardHeader>
                                    <CardContent className="space-y-4 text-sm">
                                        <div className="flex items-center justify-between">
                                            <span className="text-muted-foreground flex items-center gap-2"><User size={16} /> Requester</span>
                                            <span className="font-medium text-right">{email.sender}</span>
                                        </div>
                                        <Separator />
                                        <div className="flex items-center justify-between">
                                            <span className="text-muted-foreground flex items-center gap-2"><Calendar size={16} /> Date Submitted</span>
                                            <span className="font-medium">{format(parseISO(email.receivedDateTime), 'PPP')}</span>
                                        </div>
                                        <Separator />
                                        <div className="flex items-center justify-between">
                                            <span className="text-muted-foreground flex items-center gap-2"><Shield size={16} /> Priority</span>
                                            <Select value={currentPriority} onValueChange={(value) => handleUpdate('priority', value)}>
                                                <SelectTrigger className="h-auto border-0 bg-transparent shadow-none focus:ring-0 p-0 w-auto justify-end">
                                                    <SelectValue>
                                                        <Badge variant="outline">{currentPriority}</Badge>
                                                    </SelectValue>
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {priorities.map(p => (
                                                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <Separator />
                                        <div className="flex items-center justify-between">
                                            <span className="text-muted-foreground flex items-center gap-2"><CheckCircle size={16} /> Status</span>
                                            <Select value={currentStatus} onValueChange={(value) => handleUpdate('status', value)}>
                                                <SelectTrigger className="h-auto border-0 bg-transparent shadow-none focus:ring-0 p-0 w-auto justify-end">
                                                    <SelectValue>
                                                        <Badge variant="outline">{currentStatus}</Badge>
                                                    </SelectValue>
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {statuses.map(s => (
                                                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <Separator />
                                        <div className="flex items-center justify-between">
                                            <span className="text-muted-foreground flex items-center gap-2"><UserCheck size={16} /> Assignee</span>
                                            <Select value={currentAssignee} onValueChange={(value) => handleUpdate('assignee', value)}>
                                                <SelectTrigger className="h-auto border-0 bg-transparent shadow-none focus:ring-0 p-0 w-auto justify-end font-medium">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                {assignees.map(a => (
                                                        <SelectItem key={a} value={a}>{a}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </aside>
                    </div>
                </main>
            </div>
        </SidebarProvider>
    );
}

    