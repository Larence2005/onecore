
"use client";

import { useState } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { SidebarProvider, Sidebar, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarHeader, SidebarFooter } from '@/components/ui/sidebar';
import { ReadEmails } from '@/components/read-emails';
import { SettingsForm } from '@/components/settings-form';
import { LayoutDashboard, List, Users, Building2, Settings, LogOut, Search } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
      <div className="grid lg:grid-cols-[auto_1fr_auto] min-h-screen bg-background text-foreground">
        <Sidebar className="w-14 border-r hidden lg:flex flex-col items-center py-6">
          <SidebarContent className="flex-grow flex flex-col items-center">
            <SidebarHeader className="mb-8">
                <Button variant="ghost" size="icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-command"><path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3z"/></svg>
                </Button>
            </SidebarHeader>
            <SidebarMenu className="flex flex-col items-center gap-2">
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => setActiveView('analytics')} isActive={activeView === 'analytics'} variant="ghost" size="icon">
                  <LayoutDashboard />
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => setActiveView('tickets')} isActive={activeView === 'tickets'} variant="ghost" size="icon">
                  <List />
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => setActiveView('clients')} isActive={activeView === 'clients'} variant="ghost" size="icon">
                  <Users />
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => setActiveView('organization')} isActive={activeView === 'organization'} variant="ghost" size="icon">
                  <Building2 />
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => setActiveView('settings')} isActive={activeView === 'settings'} variant="ghost" size="icon">
                  <Settings />
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter className="mt-auto">
            <div className="flex flex-col items-center gap-4">
                <Avatar className="h-9 w-9">
                  <AvatarFallback>{user.email?.[0].toUpperCase()}</AvatarFallback>
                </Avatar>
                <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Log out">
                  <LogOut />
                </Button>
            </div>
          </SidebarFooter>
        </Sidebar>

        <div className="flex flex-col min-w-0">
            <Header />
            <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
              {renderActiveView()}
            </main>
        </div>
          
        {activeView === 'tickets' && (
        <aside className="hidden xl:block w-80 border-l">
            <div className="sticky top-0 h-screen overflow-y-auto p-4">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold">Filters</h2>
                    <Button variant="link" size="sm">Show applied filters</Button>
                </div>
            <div className="space-y-6">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search fields" className="pl-9" />
                </div>

                <Card>
                <CardHeader className="p-4">
                    <CardTitle className="text-base">Agents Include</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                    <Select>
                    <SelectTrigger>
                        <SelectValue placeholder="Any agent" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="agent1">Agent 1</SelectItem>
                        <SelectItem value="agent2">Agent 2</SelectItem>
                    </SelectContent>
                    </Select>
                </CardContent>
                </Card>

                <Card>
                <CardHeader className="p-4">
                    <CardTitle className="text-base">Groups Include</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                    <Select>
                    <SelectTrigger>
                        <SelectValue placeholder="Any group" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="group1">Group 1</SelectItem>
                        <SelectItem value="group2">Group 2</SelectItem>
                    </SelectContent>
                    </Select>
                </CardContent>
                </Card>

                <Card>
                <CardHeader className="p-4">
                    <CardTitle className="text-base">Created</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                    <Select>
                    <SelectTrigger>
                        <SelectValue placeholder="Last 30 days" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="30d">Last 30 days</SelectItem>
                        <SelectItem value="7d">Last 7 days</SelectItem>
                        <SelectItem value="24h">Last 24 hours</SelectItem>
                    </SelectContent>
                    </Select>
                </CardContent>
                </Card>
                <Card>
                <CardHeader className="p-4">
                    <CardTitle className="text-base">Closed at</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                    <Select>
                    <SelectTrigger>
                        <SelectValue placeholder="Any time" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="any">Any time</SelectItem>
                    </SelectContent>
                    </Select>
                </CardContent>
                </Card>
                <Card>
                <CardHeader className="p-4">
                    <CardTitle className="text-base">Resolved at</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                    <Select>
                    <SelectTrigger>
                        <SelectValue placeholder="Any time" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="any">Any time</SelectItem>
                    </SelectContent>
                    </Select>
                </CardContent>
                </Card>

            </div>
            </div>
        </aside>
        )}
      </div>
    </SidebarProvider>
  );
}
