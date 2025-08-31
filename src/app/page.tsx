
"use client";

import { useState } from 'react';
import { Header } from '@/components/header';
import { useAuth } from '@/providers/auth-provider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { SidebarProvider, Sidebar, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarHeader, SidebarFooter } from '@/components/ui/sidebar';
import { ReadEmails } from '@/components/read-emails';
import { SendEmailForm } from '@/components/send-email-form';
import { SettingsForm } from '@/components/settings-form';
import { Inbox, Send, Settings, Mail, LogOut } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

export interface Email {
    id: string;
    subject: string;
    sender: string;
}

export interface NewEmail {
    recipient: string;
    subject: string;
    body: string;
}

export default function Home() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [activeView, setActiveView] = useState('inbox');

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
      case 'inbox':
        return <ReadEmails />;
      case 'compose':
        return <SendEmailForm />;
      case 'settings':
        return <SettingsForm />;
      default:
        return <ReadEmails />;
    }
  };

  return (
    <SidebarProvider>
      <div className="flex flex-col min-h-screen bg-muted/40">
        <Header />
        <div className="flex flex-1">
            <Sidebar className="w-64 border-r">
                <SidebarContent>
                    <SidebarHeader>
                        <div className="flex items-center p-2">
                            <Mail className="h-7 w-7 text-primary" />
                            <h1 className="ml-3 text-xl font-headline font-bold text-foreground">
                                Mailflow Manager
                            </h1>
                        </div>
                    </SidebarHeader>
                    <SidebarMenu className="flex-grow">
                        <SidebarMenuItem>
                            <SidebarMenuButton onClick={() => setActiveView('inbox')} isActive={activeView === 'inbox'}>
                                <Inbox />
                                Inbox
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                        <SidebarMenuItem>
                            <SidebarMenuButton onClick={() => setActiveView('compose')} isActive={activeView === 'compose'}>
                                <Send />
                                Compose
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
            <main className="flex-1 p-8">
                {renderActiveView()}
            </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
