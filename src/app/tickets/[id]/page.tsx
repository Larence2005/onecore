
"use client";

import { useEffect, useState, useRef } from 'react';
import { useSettings } from '@/providers/settings-provider';
import { getEmail } from '@/app/actions';
import type { DetailedEmail } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal, ArrowLeft, User, Calendar, Shield, CheckCircle, UserCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useAuth } from '@/providers/auth-provider';
import { useRouter } from 'next/navigation';
import { SidebarProvider, Sidebar, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarHeader, SidebarFooter } from '@/components/ui/sidebar';
import { Header } from '@/components/header';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { LayoutDashboard, List, Users, Building2, Settings, Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';


function TicketDetailContent({ id }: { id: string }) {
    const { settings, isConfigured } = useSettings();
    const { toast } = useToast();
    const [email, setEmail] = useState<DetailedEmail | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    useEffect(() => {
        async function fetchEmail() {
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
        }

        fetchEmail();
    }, [id, settings, isConfigured, toast]);

    const handleIframeLoad = () => {
        if (iframeRef.current) {
            const body = iframeRef.current.contentWindow?.document.body;
            if (body) {
                // Set height to content height
                iframeRef.current.style.height = `${body.scrollHeight}px`;
                // Add mutation observer to handle dynamic content changes (e.g. images loading)
                const observer = new MutationObserver(() => {
                    if (iframeRef.current) {
                       iframeRef.current.style.height = `${iframeRef.current.contentWindow?.document.body.scrollHeight}px`;
                    }
                });
                observer.observe(body, { childList: true, subtree: true, attributes: true });
            }
        }
    };
    
    const styledHtmlContent = email?.body.contentType === 'html' 
        ? `<style>
                body { margin: 0; padding: 0; font-family: sans-serif; color: hsl(var(--foreground)); overflow: hidden; }
                img { max-width: 100% !important; height: auto !important; max-height: 400px; }
                * { max-width: 100%; }
           </style>${email.body.content}`
        : '';

    return (
        <div className="flex-1 flex flex-col min-w-0">
             <Header>
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" asChild>
                        <Link href="/">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <h1 className="text-xl font-bold">Ticket Details</h1>
                </div>
            </Header>
            <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto">
                <div className="flex-1 p-4 sm:p-6 lg:p-8 space-y-4">
                    {isLoading && (
                        <Card>
                            <CardHeader>
                                <Skeleton className="h-8 w-3/4" />
                                <Skeleton className="h-4 w-1/2" />
                            </CardHeader>
                            <CardContent>
                                <Skeleton className="h-64 w-full" />
                            </CardContent>
                        </Card>
                    )}

                    {error && (
                        <Alert variant="destructive">
                            <Terminal className="h-4 w-4" />
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {!isLoading && !error && email && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-2xl">{email.subject}</CardTitle>
                                <CardDescription>
                                    From: {email.sender} &bull; Received: {format(parseISO(email.receivedDateTime), 'PPP p')}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                 <div className="border rounded-md">
                                    {email.body.contentType === 'html' ? (
                                        <iframe 
                                            ref={iframeRef}
                                            srcDoc={styledHtmlContent} 
                                            className="w-full border-0" 
                                            onLoad={handleIframeLoad}
                                            scrolling="no"
                                        />
                                    ) : (
                                        <pre className="whitespace-pre-wrap text-sm p-4">{email.body.content}</pre>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
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
                                <CardTitle className="text-lg">Properties</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4 text-sm">
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground flex items-center gap-2"><User size={16} /> Sender</span>
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
                                    <Badge variant="outline">{email.priority}</Badge>
                                </div>
                                <Separator />
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground flex items-center gap-2"><CheckCircle size={16} /> Status</span>
                                     <Badge variant="outline">{email.status}</Badge>
                                </div>
                                <Separator />
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground flex items-center gap-2"><UserCheck size={16} /> Assignee</span>
                                    <span className="font-medium">{email.assignee}</span>
                                </div>
                            </CardContent>
                        </Card>
                     )}
                </aside>
            </div>
        </div>
    );
}


export default function TicketDetailPage({ params }: { params: { id: string } }) {
    const { user, loading, logout } = useAuth();
    const router = useRouter();
    
    useEffect(() => {
        if (!loading && !user) {
        router.push('/login');
        }
    }, [user, loading, router]);

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
                                <span className="font-bold text-lg">Mailflow</span>
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
                                <Button variant="link" size="sm" className="h-auto p-0 justify-start text-xs" onClick={handleLogout}>Log Out</Button>
                            </div>
                        </div>
                    </SidebarFooter>
                </Sidebar>

                <main className="flex-1 flex flex-col min-w-0">
                    <TicketDetailContent id={params.id} />
                </main>
            </div>
        </SidebarProvider>
    );
}
