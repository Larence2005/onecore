

"use client";

import { useState } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { SidebarProvider, Sidebar, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarHeader, SidebarFooter } from '@/components/ui/sidebar';
import { MainView } from '@/components/main-view';
import { LayoutDashboard, List, Users, Building2, Settings, LogOut } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

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

  return (
    <SidebarProvider>
      <div className="grid lg:grid-cols-[auto_1fr] min-h-screen bg-background text-foreground">
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

        <MainView activeView={activeView} />
      </div>
    </SidebarProvider>
  );
}
