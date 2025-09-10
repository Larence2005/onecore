
"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { useRouter } from 'next/navigation';
import { SidebarProvider, Sidebar, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarHeader, SidebarFooter } from '@/components/ui/sidebar';
import { LayoutDashboard, List, Users, Building2, Settings, LogOut, Pencil, Archive, ArrowLeft, Ticket } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/header';
import Link from 'next/link';
import { getTicketsFromDB, getCompanyDetails } from '@/app/actions';
import type { Email, Company } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { TicketItem } from './ticket-item';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Alert, AlertTitle, AlertDescription } from './ui/alert';
import { Terminal } from 'lucide-react';

export function CompanyTicketsView({ companyId }: { companyId: string }) {
    const { user, userProfile, loading, logout } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [company, setCompany] = useState<Company | null>(null);
    const [tickets, setTickets] = useState<Email[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]);
    
    useEffect(() => {
        if (!userProfile?.organizationId) {
            if(!loading) setIsLoading(false);
            return;
        };

        const fetchData = async () => {
            setIsLoading(true);
            try {
                const [companyDetails, companyTickets] = await Promise.all([
                    getCompanyDetails(userProfile.organizationId!, companyId),
                    getTicketsFromDB(userProfile.organizationId!, { companyId: companyId, fetchAll: true })
                ]);
                
                if (!companyDetails) {
                    toast({ variant: 'destructive', title: 'Company not found' });
                    router.push('/?view=clients');
                    return;
                }

                setCompany(companyDetails);
                setTickets(companyTickets);
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
                toast({ variant: 'destructive', title: 'Failed to load company tickets', description: errorMessage });
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [userProfile, companyId, toast, router, loading]);

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
        return (
            <div className="flex items-center justify-center min-h-screen">
                <p>Loading...</p>
            </div>
        );
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
                                    <SidebarMenuButton onClick={() => handleMenuClick('clients')} isActive>
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
                             <Button variant="outline" size="icon" asChild>
                                <Link href="/?view=clients">
                                    <ArrowLeft className="h-4 w-4" />
                                </Link>
                            </Button>
                            {isLoading ? (
                                <Skeleton className="h-6 w-48" />
                            ) : (
                               <h1 className="text-xl font-bold truncate">{company?.name || 'Company Tickets'}</h1>
                            )}
                        </div>
                    </Header>
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
                        {isLoading ? (
                            <div className="space-y-4">
                                {[...Array(5)].map((_, i) => (
                                    <div key={i} className="p-4 border rounded-lg space-y-3">
                                        <Skeleton className="h-5 w-3/4 rounded-md" />
                                        <div className="flex items-center gap-2">
                                            <Skeleton className="h-4 w-24 rounded-md" />
                                            <Skeleton className="h-4 w-48 rounded-md" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : tickets.length > 0 ? (
                           <Card>
                                <CardHeader>
                                    <CardTitle>Tickets for {company?.name}</CardTitle>
                                    <CardDescription>A list of all tickets associated with this company.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <ul className="space-y-0 border-t">
                                        {tickets.map((ticket) => (
                                            <TicketItem 
                                                key={ticket.id} 
                                                email={ticket} 
                                                isSelected={false}
                                                onSelect={() => {}}
                                            />
                                        ))}
                                    </ul>
                                </CardContent>
                           </Card>
                        ) : (
                            <Alert>
                                <Ticket className="h-4 w-4" />
                                <AlertTitle>No Tickets Found</AlertTitle>
                                <AlertDescription>
                                    There are no tickets associated with {company?.name}.
                                </AlertDescription>
                            </Alert>
                        )}
                    </div>
                </main>
            </div>
        </SidebarProvider>
    );
}

