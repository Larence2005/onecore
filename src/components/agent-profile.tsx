
"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/providers/auth-provider";
import { getTicketsFromDB, getOrganizationMembers } from "@/app/actions";
import type { Email, OrganizationMember } from "@/app/actions";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { TicketItem } from "@/components/ticket-item";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal, ArrowLeft, Mail, Ticket } from "lucide-react";
import { Button } from "./ui/button";
import Link from "next/link";
import { Header } from "./header";
import { SidebarProvider, Sidebar, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarHeader, SidebarFooter } from '@/components/ui/sidebar';
import { LayoutDashboard, List, Users, Building2, Settings, LogOut, Pencil, Archive } from 'lucide-react';


interface ProfileData {
    name: string;
    email: string;
}

export function AgentProfile({ email }: { email: string }) {
  const { user, userProfile, loading, logout } = useAuth();
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [submittedTickets, setSubmittedTickets] = useState<Email[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (!loading && !user) {
        router.push('/login');
    }
  }, [user, loading, router]);


  useEffect(() => {
    const fetchData = async () => {
        if (!user || !userProfile?.organizationId) {
            if(loading) return;
            setError("You must be part of an organization to view profiles.");
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            const orgMembers = await getOrganizationMembers(userProfile.organizationId);
            const member = orgMembers.find(m => m.email.toLowerCase() === email.toLowerCase());
            
            if (!member) {
                throw new Error("Agent not found in your organization.");
            }
            
            setProfileData({ name: member.name, email: member.email });

            const allTickets = await getTicketsFromDB(userProfile.organizationId, { fetchAll: true });
            
            const tempSubmittedTickets = allTickets.filter(ticket => ticket.senderEmail?.toLowerCase() === email.toLowerCase());
            setSubmittedTickets(tempSubmittedTickets);

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
            setError(errorMessage);
            toast({
                variant: "destructive",
                title: "Failed to load profile.",
                description: errorMessage,
            });
        } finally {
            setIsLoading(false);
        }
    };

    if(!loading && user && userProfile) {
        fetchData();
    }
  }, [user, userProfile, email, toast, loading]);

    const handleLogout = async () => {
        try {
            await logout();
            router.push('/login');
        } catch (error) {
            console.error("Failed to log out", error);
        }
    };
    
    const handleMenuClick = (view: string) => {
        if(view === 'tickets' || view === '/') {
            router.push('/');
        } else if (view === 'archive') {
            router.push('/archive');
        } else {
            router.push(`/?view=${view}`); 
        }
    };

    if (loading || !user) {
        return <div className="flex items-center justify-center min-h-screen"><p>Loading...</p></div>;
    }


  return (
    <SidebarProvider>
        <div className="grid min-h-screen w-full lg:grid-cols-[240px_1fr]">
            <Sidebar className="w-[240px] hidden lg:flex flex-col py-6 h-full">
                <div className="flex-grow flex flex-col">
                <SidebarHeader className="mb-8 px-4">
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-command"><path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3z"/></svg>
                        </Button>
                        <span className="font-bold text-lg">Onecore</span>
                    </div>
                </SidebarHeader>
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
                            <SidebarMenuButton onClick={() => handleMenuClick('tickets')}>
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
                            <SidebarMenuButton onClick={() => handleMenuClick('organization')} isActive>
                            <Building2 className="text-yellow-500" />
                            <span>Organization</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                        <SidebarMenuItem>
                            <SidebarMenuButton onClick={() => handleMenuClick('settings')}>
                            <Settings className="text-gray-500" />
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
                            <Button variant="outline" size="icon" onClick={() => router.back()}>
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                        <h1 className="text-xl font-bold">Agent Profile</h1>
                    </div>
                </Header>
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
                    {isLoading ? (
                        <div className="space-y-4">
                            <div className="flex items-center gap-4">
                                <Skeleton className="h-20 w-20 rounded-full" />
                                <div className="space-y-2">
                                    <Skeleton className="h-7 w-48" />
                                    <Skeleton className="h-5 w-64" />
                                </div>
                            </div>
                            <Skeleton className="h-96 w-full" />
                        </div>
                    ) : error ? (
                            <Alert variant="destructive" className="max-w-2xl mx-auto">
                            <Terminal className="h-4 w-4" />
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    ) : profileData ? (
                        <div className="space-y-6">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
                                <Avatar className="h-20 w-20 text-3xl">
                                    <AvatarFallback>{profileData.name.charAt(0).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <h2 className="text-3xl font-bold">{profileData.name}</h2>
                                    <div className="flex items-center gap-2 text-muted-foreground mt-1">
                                        <Mail className="h-4 w-4" />
                                        <span>{profileData.email}</span>
                                    </div>
                                </div>
                            </div>
                            <Card>
                                <CardHeader>
                                    <CardTitle>Submitted Tickets</CardTitle>
                                    <CardDescription>Tickets created by {profileData.name}.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {submittedTickets.length > 0 ? (
                                        <ul className="space-y-0 border-t">
                                            {submittedTickets.map((ticket) => (
                                                <TicketItem key={ticket.id} email={ticket} isSelected={false} onSelect={() => {}} />
                                            ))}
                                        </ul>
                                    ) : (
                                        <div className="text-center py-10 text-muted-foreground">
                                            <Ticket className="mx-auto h-8 w-8 mb-2" />
                                            No tickets found.
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    ) : null}
                </div>
            </main>
        </div>
    </SidebarProvider>
  );
}

