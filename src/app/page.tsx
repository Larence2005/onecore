
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { useRouter, useSearchParams } from 'next/navigation';
import { SidebarProvider, Sidebar, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarHeader, SidebarFooter, SidebarInset } from '@/components/ui/sidebar';
import { MainView } from '@/components/main-view';
import { LayoutDashboard, List, Users, Building2, Settings, LogOut, Search, Pencil } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/header';
import { cn } from '@/lib/utils';
import { TicketsFilter, FilterState } from '@/components/tickets-filter';
import type { Email } from '@/app/actions';
import { getTicketsFromDB, getLatestEmails } from '@/app/actions';
import { useSettings } from '@/providers/settings-provider';
import { useToast } from '@/hooks/use-toast';


type View = 'tickets' | 'analytics' | 'clients' | 'organization' | 'settings' | 'compose';

function HomePageContent() {
  const { user, loading, logout } = useAuth();
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

  const fetchEmails = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
        const dbEmails = await getTicketsFromDB();
        setEmails(dbEmails);
    } catch (dbError) {
        const dbErrorMessage = dbError instanceof Error ? dbError.message : "An unknown database error occurred.";
        setError(dbErrorMessage);
        setEmails([]);
    } finally {
        setIsLoading(false);
    }

    if (isConfigured) {
        try {
            await getLatestEmails(settings);
            const updatedDbEmails = await getTicketsFromDB();
            setEmails(updatedDbEmails);
        } catch (syncError) {
            const syncErrorMessage = syncError instanceof Error ? syncError.message : "An unknown sync error occurred.";
            toast({
                variant: "destructive",
                title: "Failed to sync with email server.",
                description: syncErrorMessage,
            });
        }
    }
  }, [settings, isConfigured, toast]);

  useEffect(() => {
    fetchEmails();
  }, [fetchEmails]);


  useEffect(() => {
    const view = searchParams.get('view') as View;
    if (view && ['tickets', 'analytics', 'clients', 'organization', 'settings', 'compose'].includes(view)) {
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
    router.push(`/?view=${view}`, { scroll: false });
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
        activeView === 'tickets' ? "lg:grid-cols-[240px_1fr_320px]" : "lg:grid-cols-[240px_1fr]"
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
          </Header>
          <MainView 
            activeView={activeView} 
            emails={emails}
            isLoading={isLoading}
            error={error}
            onRefresh={fetchEmails}
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
    <React.Suspense fallback={<div className="flex items-center justify-center min-h-screen"><p>Loading...</p></div>}>
      <HomePageContent />
    </React.Suspense>
  )
}
