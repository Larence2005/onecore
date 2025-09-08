
"use client"

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { useRouter } from 'next/navigation';
import { SidebarProvider, Sidebar, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarHeader, SidebarFooter } from '@/components/ui/sidebar';
import { MainView } from '@/components/main-view';
import { LayoutDashboard, List, Users, Building2, Settings, LogOut, Search, Pencil, Archive, ArrowLeft } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/header';
import Link from 'next/link';

export default function ArchivePage() {
    const { user, loading, logout } = useAuth();
    const router = useRouter();

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
            <div className="grid min-h-screen w-full bg-background text-foreground lg:grid-cols-[240px_1fr]">
                <Sidebar className="w-[240px] hidden lg:flex flex-col py-6">
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
                            <AvatarFallback>{user.email?.[0].toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                                <span className="font-medium text-sm">{user.email}</span>
                                <Button variant="link" size="sm" className="h-auto p-0 justify-start text-xs" onClick={handleLogout}>Log Out</Button>                            </div>
                        </div>
                    </SidebarFooter>
                    <SidebarContent className="flex-grow">
                        <SidebarMenu className="flex flex-col gap-2 px-4">
                            <SidebarMenuItem>
                                <SidebarMenuButton onClick={() => handleMenuClick('compose')}>
                                <Pencil />
                                <span>Compose</span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <SidebarMenuButton onClick={() => handleMenuClick('analytics')}>
                                <LayoutDashboard />
                                <span>Dashboard</span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <SidebarMenuButton onClick={() => handleMenuClick('tickets')}>
                                <List />
                                <span>Tickets</span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <SidebarMenuButton onClick={() => handleMenuClick('archive')} isActive>
                                    <Archive />
                                    <span>Archive</span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <SidebarMenuButton onClick={() => handleMenuClick('clients')}>
                                <Users />
                                <span>Clients</span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <SidebarMenuButton onClick={() => handleMenuClick('organization')}>
                                <Building2 />
                                <span>Organization</span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <SidebarMenuButton onClick={() => handleMenuClick('settings')}>
                                <Settings />
                                <span>Settings</span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarContent>
                </Sidebar>

                <main className="flex-1 flex flex-col min-w-0">
                    <Header>
                        <div className="flex items-center gap-4">
                             <Button variant="outline" size="icon" asChild>
                                <Link href="/">
                                    <ArrowLeft className="h-4 w-4" />
                                </Link>
                            </Button>
                            <h1 className="text-xl font-bold">Archived Tickets</h1>
                        </div>
                    </Header>
                    <MainView activeView="archive" />
                </main>
            </div>
        </SidebarProvider>
    );
}
