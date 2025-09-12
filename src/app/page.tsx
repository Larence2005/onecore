
"use client";

import React, { useState, useEffect, useCallback, useTransition } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { useRouter, useSearchParams } from 'next/navigation';
import { SidebarProvider, Sidebar, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarHeader, SidebarFooter, SidebarInset } from '@/components/ui/sidebar';
import { MainView } from '@/components/main-view';
import { LayoutDashboard, List, Users, Building2, Settings, LogOut, Search, Pencil, Archive } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/header';
import { cn } from '@/lib/utils';
import { TicketsFilter, FilterState } from '@/components/tickets-filter';
import type { Email, DetailedEmail, Company } from '@/app/actions';
import { getLatestEmails, getCompanies, fetchAndStoreFullConversation } from '@/app/actions';
import { useSettings } from '@/providers/settings-provider';
import { useToast } from '@/hooks/use-toast';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Image from 'next/image';


type View = 'tickets' | 'analytics' | 'clients' | 'organization' | 'settings' | 'compose' | 'archive';

function HomePageContent() {
  const { user, userProfile, loading, logout } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeView, setActiveView] = useState<View>('analytics');
  const [isNavigating, setIsNavigating] = useState(false);
  
  const { settings, isConfigured } = useSettings();
  const { toast } = useToast();
  const [emails, setEmails] = useState<Email[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<FilterState>({
    search: '',
    agents: [],
    groups: [],
    statuses: [],
    priorities: [],
    types: [],
    tags: '',
    created: 'any',
  });

  const syncLatestEmails = useCallback(async () => {
    if (isConfigured && userProfile?.organizationId) {
        try {
            await getLatestEmails(settings, userProfile.organizationId);
        } catch (syncError) {
            // Silently fail, error is logged in the action
        }
    }
  }, [settings, isConfigured, userProfile?.organizationId]);

  useEffect(() => {
    if (!user || !userProfile || !userProfile.organizationId) return;

    setIsLoading(true);
    
    const ticketsCollectionRef = collection(db, 'organizations', userProfile.organizationId, 'tickets');
    const q = query(ticketsCollectionRef, where('status', '!=', 'Archived'));
    
    let companyMap = new Map<string, string>();

    const setupListener = async () => {
        try {
            const companies = await getCompanies(userProfile.organizationId!);
            companyMap = new Map(companies.map(c => [c.id, c.name]));
        } catch(e) {
            console.error("Could not fetch companies for ticket list", e);
        }

        const unsubscribe = onSnapshot(q, async (querySnapshot) => {
            setError(null);
            const ticketsFromDb: Email[] = await Promise.all(querySnapshot.docs.map(async (ticketDoc) => {
                const data = ticketDoc.data();
                let lastReplier: 'agent' | 'client' | undefined = undefined;

                if (data.conversationId && user.email && userProfile.organizationId) {
                    try {
                        const conversationDocRef = doc(db, 'organizations', userProfile.organizationId, 'conversations', data.conversationId);
                        const conversationDoc = await getDoc(conversationDocRef);
                        if (conversationDoc.exists()) {
                            const conversationData = conversationDoc.data();
                            const messages = conversationData.messages as DetailedEmail[];
                            if (messages && messages.length > 0) {
                                const lastMessage = messages[messages.length - 1];
                                if(lastMessage.senderEmail?.toLowerCase() === user.email.toLowerCase()) {
                                    lastReplier = 'agent';
                                } else {
                                    lastReplier = 'client';
                                }
                            }
                        }
                    } catch (e) {
                        console.error("Could not determine last replier for ticket", ticketDoc.id, e);
                    }
                }
                
                return {
                    id: ticketDoc.id,
                    subject: data.title || 'No Subject',
                    sender: data.sender || 'Unknown Sender',
                    senderEmail: data.senderEmail || 'Unknown Email',
                    bodyPreview: data.bodyPreview || '',
                    receivedDateTime: data.receivedDateTime || new Date().toISOString(),
                    priority: data.priority || 'Low',
                    assignee: data.assignee || 'Unassigned',
                    status: data.status || 'Open',
                    type: data.type || 'Incident',
                    conversationId: data.conversationId,
                    tags: data.tags || [],
                    deadline: data.deadline,
                    closedAt: data.closedAt,
                    lastReplier: lastReplier,
                    ticketNumber: data.ticketNumber,
                    companyId: data.companyId,
                    companyName: data.companyId ? companyMap.get(data.companyId) : undefined,
                };
            }));

            ticketsFromDb.sort((a, b) => new Date(b.receivedDateTime).getTime() - new Date(a.receivedDateTime).getTime());
            setEmails(ticketsFromDb);
            setIsLoading(false);
        }, (err) => {
            const dbErrorMessage = err instanceof Error ? err.message : "An unknown database error occurred.";
            setError(dbErrorMessage);
            setEmails([]);
            setIsLoading(false);
        });

        return unsubscribe;
    };
    
    const unsubscribePromise = setupListener();
    
    syncLatestEmails();
    const intervalId = setInterval(syncLatestEmails, 30000);

    return () => {
      unsubscribePromise.then(unsub => unsub && unsub());
      clearInterval(intervalId);
    }
  }, [user, userProfile, syncLatestEmails]);


  useEffect(() => {
    const view = searchParams.get('view') as View;
    if (view && ['tickets', 'analytics', 'clients', 'organization', 'settings', 'compose', 'archive'].includes(view)) {
      setActiveView(view);
    }
    setIsNavigating(false);
  }, [searchParams]);

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error("Failed to log out", error);
    }
  };
  
  const handleViewChange = (view: View) => {
    if (view !== activeView) {
        setIsNavigating(true);
    }
    setActiveView(view);
    if (view === 'archive') {
      router.push('/archive');
    } else if (view === 'clients') {
      router.push(`/?view=clients`);
    } else {
      router.push(`/?view=${view}`, { scroll: false });
    }
  }

  const onApplyFilters = useCallback((newFilters: FilterState) => {
    setFilters(newFilters);
  }, []);

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
          <p>Loading...</p>
      </div>
    );
  }
  
  return (
    <SidebarProvider>
      <div className={cn(
        "grid min-h-screen w-full",
        activeView === 'tickets' ? "lg:grid-cols-[240px_1fr_280px]" : "lg:grid-cols-[240px_1fr]"
      )}>
        <Sidebar className="w-[240px] hidden lg:flex flex-col py-6 h-full">
            <SidebarHeader className="mb-8 px-4">
              <div className="flex items-center justify-center">
                <Image src="/navlogo.jpg" alt="Onecore Logo" width={100} height={100} />
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
                  <SidebarMenuButton onClick={() => handleViewChange('analytics')} isActive={activeView === 'analytics'}>
                    <LayoutDashboard className="text-purple-500" />
                    <span>Dashboard</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={() => handleViewChange('tickets')} isActive={activeView === 'tickets'}>
                    <List className="text-green-500" />
                    <span>Tickets</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={() => handleViewChange('compose')} isActive={activeView === 'compose'}>
                    <Pencil className="text-blue-500" />
                    <span>Compose</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                    <SidebarMenuButton onClick={() => handleViewChange('archive')} isActive={activeView === 'archive'}>
                        <Archive className="text-orange-500" />
                        <span>Archive</span>
                    </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={() => handleViewChange('clients')} isActive={activeView === 'clients'}>
                    <Users className="text-pink-500" />
                    <span>Clients</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={() => handleViewChange('organization')} isActive={activeView === 'organization'}>
                    <Building2 className="text-yellow-500" />
                    <span>Organization</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={() => handleViewChange('settings')} isActive={activeView === 'settings'}>
                    <Settings className="text-gray-500" />
                    <span>Settings</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarContent>
        </Sidebar>

        <main className="flex-1 flex flex-col min-w-0">
          <Header>
            {activeView === 'tickets' && (
              <div className="flex items-center gap-4">
                <h1 className="text-xl font-bold">Tickets</h1>
              </div>
            )}
            {activeView === 'compose' && <h1 className="text-xl font-bold">Compose</h1>}
            {activeView === 'analytics' && <h1 className="text-xl font-bold">Dashboard</h1>}
            {activeView === 'clients' && <h1 className="text-xl font-bold">Clients</h1>}
            {activeView === 'organization' && <h1 className="text-xl font-bold">Organization</h1>}
            {activeView === 'settings' && <h1 className="text-xl font-bold">Settings</h1>}
            {activeView === 'archive' && <h1 className="text-xl font-bold">Archive</h1>}
          </Header>
          {isNavigating ? (
            <div className="flex flex-1 items-center justify-center">
                <p>Loading...</p>
            </div>
          ) : (
            <MainView 
                activeView={activeView} 
                emails={emails}
                isLoading={isLoading}
                error={error}
                onRefresh={syncLatestEmails}
                filters={filters}
            />
          )}
        </main>
        
        {activeView === 'tickets' && <TicketsFilter onApplyFilters={onApplyFilters} />}
      </div>
    </SidebarProvider>
  );
}

export default function Home() {
  return (
      <HomePageContent />
  )
}
