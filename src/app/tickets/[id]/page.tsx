
"use client";

import { useEffect, useState } from 'react';
import { useSettings } from '@/providers/settings-provider';
import { getEmail } from '@/app/actions';
import type { DetailedEmail } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal, ArrowLeft } from 'lucide-react';
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


function TicketDetailContent({ id }: { id: string }) {
    const { settings, isConfigured } = useSettings();
    const { toast } = useToast();
    const [email, setEmail] = useState<DetailedEmail | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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

    const styledHtmlContent = email?.body.contentType === 'html' 
        ? `<style>img { max-width: 100%; height: auto; }</style>${email.body.content}`
        : '';

    const pageTitle = email?.ticketNumber 
        ? `Ticket #${`${email.ticketNumber}`.padStart(6, '0')}`
        : 'Ticket Details';

    return (
        <div className="flex-1 flex flex-col min-w-0">
             <Header>
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" asChild>
                        <Link href="/">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <h1 className="text-xl font-bold">{pageTitle}</h1>
                </div>
            </Header>
            <div className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 space-y-4 overflow-y-auto">
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
                                From: {email.sender} | Received: {format(parseISO(email.receivedDateTime), 'PPP p')}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex-grow overflow-auto border rounded-md p-4 min-h-[60vh]">
                                {email.body.contentType === 'html' ? (
                                    <iframe srcDoc={styledHtmlContent} className="w-full h-full border-0 min-h-[inherit]" />
                                ) : (
                                    <pre className="whitespace-pre-wrap text-sm">{email.body.content}</pre>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                )}
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
        if(view === 'tickets') {
            router.push('/');
        } else {
            router.push('/'); 
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
