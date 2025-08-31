"use client";

import { useState } from 'react';
import { Header } from '@/components/header';
import { useAuth } from '@/providers/auth-provider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarInset } from '@/components/ui/sidebar';
import { ReadEmails } from '@/components/read-emails';
import { SendEmailForm } from '@/components/send-email-form';
import { SettingsForm } from '@/components/settings-form';
import { Inbox, Send, Settings, PanelLeft } from 'lucide-react';

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
  const { user, loading } = useAuth();
  const router = useRouter();
  const [activeView, setActiveView] = useState('inbox');

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
      <div className="flex flex-col min-h-screen">
        <Header />
        <div className="flex flex-1">
          <Sidebar>
            <SidebarContent>
              <SidebarMenu>
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
            </SidebarContent>
          </Sidebar>
          <main className="flex-1 container mx-auto px-4 py-8">
            {renderActiveView()}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
