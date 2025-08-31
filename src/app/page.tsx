
"use client";

import { useState } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { SidebarProvider, Sidebar, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarHeader, SidebarFooter, RightSidebarTrigger } from '@/components/ui/sidebar';
import { ReadEmails } from '@/components/read-emails';
import { SettingsForm } from '@/components/settings-form';
import { LayoutDashboard, List, Users, Building2, Settings, LogOut, Filter, Tag, CircleAlert, CheckCircle2 } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Header } from '@/components/header';

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
        return <div className="flex flex-1 items-center justify-center text-muted-foreground w-full"><p>Analytics coming soon.</p></div>;
      case 'tickets':
        return <ReadEmails />;
      case 'clients':
        return <div className="flex flex-1 items-center justify-center text-muted-foreground w-full"><p>Clients coming soon.</p></div>;
      case 'organization':
        return <div className="flex flex-1 items-center justify-center text-muted-foreground w-full"><p>Organization coming soon.</p></div>;
      case 'settings':
        return <SettingsForm />;
      default:
        return <p>Select a view</p>;
    }
  };

  return (
    <SidebarProvider>
      <div className="grid md:grid-cols-[auto_1fr] lg:grid-cols-[auto_1fr_auto] min-h-screen bg-background text-foreground">
        <Sidebar className="w-64 border-r hidden md:block">
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

        <div className="flex-1 flex flex-col">
          <Header />
          <main className="flex-1 p-4 sm:p-6 md:p-8 flex justify-center">
              <div className="w-full max-w-4xl">
                {renderActiveView()}
              </div>
          </main>
        </div>
        
        {activeView === 'tickets' && (
          <aside className="hidden lg:block w-80 border-l p-4">
              <div className="flex items-center gap-2 mb-4">
                <Filter className="h-5 w-5" />
                <h2 className="text-lg font-headline font-bold">
                    Filters
                </h2>
              </div>
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Status</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center space-x-2">
                        <Checkbox id="status-open" />
                        <Label htmlFor="status-open" className="flex items-center gap-2"><CircleAlert className="text-destructive"/>Open</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Checkbox id="status-closed" />
                        <Label htmlFor="status-closed" className="flex items-center gap-2"><CheckCircle2 className="text-green-500"/>Closed</Label>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Priority</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center space-x-2">
                        <Checkbox id="priority-high" />
                        <Label htmlFor="priority-high">High</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Checkbox id="priority-medium" />
                        <Label htmlFor="priority-medium">Medium</Label>
                    </div>
                     <div className="flex items-center space-x-2">
                        <Checkbox id="priority-low" />
                        <Label htmlFor="priority-low">Low</Label>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Tags</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center space-x-2">
                        <Checkbox id="tag-bug" />
                        <Label htmlFor="tag-bug">Bug</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Checkbox id="tag-feature" />
                        <Label htmlFor="tag-feature">Feature Request</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Checkbox id="tag-billing" />
                        <Label htmlFor="tag-billing">Billing</Label>
                    </div>
                  </CardContent>
                </Card>
              </div>
          </aside>
        )}
      </div>
    </SidebarProvider>
  );
}
