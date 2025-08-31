
"use client";

import { useState } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { SidebarProvider, Sidebar, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarHeader, SidebarFooter } from '@/components/ui/sidebar';
import { ReadEmails } from '@/components/read-emails';
import { SendEmailForm } from '@/components/send-email-form';
import { SettingsForm } from '@/components/settings-form';
import { LayoutDashboard, List, Users, Building2, Settings, LogOut, Mail } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

export default function Home() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [activeView, setActiveView] = useState('tickets');

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

  const renderActiveView = () => {
    switch (activeView) {
      case 'analytics':
        return <div className="flex flex-1 items-center justify-center text-muted-foreground"><p>Analytics coming soon.</p></div>;
      case 'tickets':
        return (
          <Tabs defaultValue="all">
            <TabsList>
              <TabsTrigger value="all">All Tickets</TabsTrigger>
              <TabsTrigger value="open">Open</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="resolved">Resolved</TabsTrigger>
              <TabsTrigger value="closed">Closed</TabsTrigger>
            </TabsList>
            <TabsContent value="all" className="flex flex-1 items-center justify-center text-muted-foreground pt-20">
              <p>There are no tickets in this category.</p>
            </TabsContent>
            <TabsContent value="open" className="flex flex-1 items-center justify-center text-muted-foreground pt-20">
              <p>There are no tickets in this category.</p>
            </TabsContent>
            <TabsContent value="pending" className="flex flex-1 items-center justify-center text-muted-foreground pt-20">
              <p>There are no tickets in this category.</p>
            </TabsContent>
            <TabsContent value="resolved" className="flex flex-1 items-center justify-center text-muted-foreground pt-20">
              <p>There are no tickets in this category.</p>
            </TabsContent>
            <TabsContent value="closed" className="flex flex-1 items-center justify-center text-muted-foreground pt-20">
              <p>There are no tickets in this category.</p>
            </TabsContent>
          </Tabs>
        );
      case 'clients':
        return <div className="flex flex-1 items-center justify-center text-muted-foreground"><p>Clients coming soon.</p></div>;
      case 'organization':
        return <div className="flex flex-1 items-center justify-center text-muted-foreground"><p>Organization coming soon.</p></div>;
      case 'settings':
        return <SettingsForm />;
      default:
        return <p>Select a view</p>;
    }
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-background text-foreground">
        <Sidebar className="w-64 border-r">
          <SidebarContent>
            <SidebarHeader>
              <div className="p-4">
                <h1 className="text-xl font-headline font-bold">
                    Mailflow Manager
                </h1>
              </div>
            </SidebarHeader>
            <SidebarMenu className="flex-grow px-4">
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => setActiveView('analytics')} isActive={activeView === 'analytics'}>
                  <LayoutDashboard />
                  Analytics
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => setActiveView('tickets')} isActive={activeView === 'tickets'}>
                  <List />
                  Tickets
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => setActiveView('clients')} isActive={activeView === 'clients'}>
                  <Users />
                  Clients
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => setActiveView('organization')} isActive={activeView === 'organization'}>
                  <Building2 />
                  Organization
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => setActiveView('settings')} isActive={activeView === 'settings'}>
                  <Settings />
                  Settings
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
            <SidebarFooter>
              <div className="flex items-center gap-3 p-3 border-t">
                <Avatar className="h-9 w-9">
                  <AvatarFallback>{user.email?.[0].toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 overflow-hidden">
                  <p className="text-sm font-medium truncate">{user.email?.split('@')[0]}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Log out">
                  <LogOut className="h-5 w-5" />
                </Button>
              </div>
            </SidebarFooter>
          </SidebarContent>
        </Sidebar>
        <main className="flex-1 p-8 flex flex-col">
            {renderActiveView()}
        </main>
      </div>
    </SidebarProvider>
  );
}
