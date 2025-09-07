
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
import type { Email, DetailedEmail } from '@/app/actions';
import { getLatestEmails, getTicketsFromDB, fetchAndStoreFullConversation } from '@/app/actions';
import { useSettings } from '@/providers/settings-provider';
import { useToast } from '@/hooks/use-toast';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';


type View = 'tickets' | 'analytics' | 'clients' | 'organization' | 'settings' | 'compose' | 'archive';

function HomePageContent() {
  const { user, userProfile, loading, logout } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeView, setActiveView] = useState<View>('tickets');
  
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
            const syncErrorMessage = syncError instanceof Error ? syncError.message : "An unknown sync error occurred.";
            console.error("Failed to sync emails:", syncErrorMessage);
            // Optionally, show a non-intrusive toast
            toast({
                variant: "destructive",
                title: "Email Sync Failed",
                description: "Could not fetch the latest emails from the server.",
            });
        }
    }
  }, [settings, isConfigured, toast, userProfile?.organizationId]);

  useEffect(() => {
    if (!user || !userProfile || !userProfile.organizationId) return;

    setIsLoading(true);
    
    const ticketsCollectionRef = collection(db, 'organizations', userProfile.organizationId, 'tickets');
    let q;

    // If the user is the owner of the org, they see all tickets.
    // Otherwise, they only see tickets assigned to them.
    if(userProfile.uid === userProfile.organizationOwnerUid) {
        q = query(ticketsCollectionRef, where('status', '!=', 'Archived'));
    } else {
        q = query(ticketsCollectionRef, where('status', '!=', 'Archived'), where('assignee', '==', user.email));
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
                ticketNumber: data.ticketNumber
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

    // Initial sync for org owners only
    if(userProfile.uid === userProfile.organizationOwnerUid){
        syncLatestEmails();
    }
    
    // Set up interval for subsequent syncs for org owners
    const intervalId = userProfile.uid === userProfile.organizationOwnerUid ? setInterval(syncLatestEmails, 30000) : null;

    return () => {
      unsubscribe();
      if(intervalId) clearInterval(intervalId);
    }
  }, [user, userProfile, syncLatestEmails]);


  useEffect(() => {
    const view = searchParams.get('view') as View;
    if (view && ['tickets', 'analytics', 'clients', 'organization', 'settings', 'compose', 'archive'].includes(view)) {
      setActiveView(view);
    }
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
    setActiveView(view);
    if (view === 'archive') {
      router.push('/archive');
    } else if (view === 'clients') {
      router.push(`/?view=clients`);
    } else {
      router.push(`/?view=${view}`, { scroll: false });
    }
  }

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
          <p>Loading...</p>
      </div>
    );
  }
  
  const onApplyFilters = useCallback((newFilters: FilterState) => {
    setFilters(newFilters);
  }, []);


  return (
    <SidebarProvider>
      <div className={cn(
        "grid min-h-screen w-full bg-background text-foreground",
        activeView === 'tickets' ? "lg:grid-cols-[240px_1fr_280px]" : "lg:grid-cols-[240px_1fr]"
      )}>
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
                <SidebarMenuButton onClick={() => handleViewChange('compose')} isActive={activeView === 'compose'}>
                  <Pencil />
                  <span>Compose</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => handleViewChange('analytics')} isActive={activeView === 'analytics'}>
                  <LayoutDashboard />
                   <span>Dashboard</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => handleViewChange('tickets')} isActive={activeView === 'tickets'}>
                  <List />
                   <span>Tickets</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                  <SidebarMenuButton onClick={() => handleViewChange('archive')} isActive={activeView === 'archive'}>
                      <Archive />
                      <span>Archive</span>
                  </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => handleViewChange('clients')} isActive={activeView === 'clients'}>
                  <Users />
                   <span>Clients</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => handleViewChange('organization')} isActive={activeView === 'organization'}>
                  <Building2 />
                   <span>Organization</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => handleViewChange('settings')} isActive={activeView === 'settings'}>
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
          <MainView 
            activeView={activeView} 
            emails={emails}
            isLoading={isLoading}
            error={error}
            onRefresh={syncLatestEmails}
            filters={filters}
          />
        </main>
        
        {activeView === 'tickets' && <TicketsFilter onApplyFilters={onApplyFilters} />}
      </div>
    </SidebarProvider>
  );
}

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
          <p>Loading...</p>
      </div>
    );
  }

  return (
      <HomePageContent />
  )
}

    
