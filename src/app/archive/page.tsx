
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
import Image from 'next/image';

export default function ArchivePage() {
    const { user, userProfile, loading, logout } = useAuth();
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
            <div className="grid min-h-screen w-full lg:grid-cols-[240px_1fr]">
                <Sidebar className="w-[240px] hidden lg:flex flex-col py-6 h-full">
                    <div className="flex-grow flex flex-col">
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
                                    <SidebarMenuButton onClick={() => handleMenuClick('analytics')}>
                                    <LayoutDashboard className="text-purple-500" />
                                    <span>Dashboard</span>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                                <SidebarMenuItem>
                                    <SidebarMenuButton onClick={() => handleMenuClick('tickets')}>
                                    <List className="text-green-500" />
                                    <span>Tickets</span>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                                <SidebarMenuItem>
                                    <SidebarMenuButton onClick={() => handleMenuClick('compose')}>
                                    <Pencil className="text-blue-500" />
                                    <span>Compose</span>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                                <SidebarMenuItem>
                                    <SidebarMenuButton onClick={() => handleMenuClick('archive')} isActive>
                                        <Archive className="text-orange-500" />
                                        <span>Archive</span>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                                <SidebarMenuItem>
                                    <SidebarMenuButton onClick={() => handleMenuClick('clients')}>
                                    <Users className="text-pink-500" />
                                    <span>Clients</span>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                                <SidebarMenuItem>
                                    <SidebarMenuButton onClick={() => handleMenuClick('organization')}>
                                    <Building2 className="text-yellow-500" />
                                    <span>Organization</span>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                                <SidebarMenuItem>
                                    <SidebarMenuButton onClick={() => handleMenuClick('settings')}>
                                    <Settings className="text-gray-500" />
                                    <span>Settings</span>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            </SidebarMenu>
                        </SidebarContent>
                        <SidebarHeader className="mt-auto p-4">
                            <div className="flex flex-col items-center justify-center gap-2">
                                <span className="text-xs text-muted-foreground">Product of</span>
                                <Image src={`/navlogo.jpg?t=${new Date().getTime()}`} alt="Onecore Logo" width="120" height="60" />
                            </div>
                        </SidebarHeader>
                    </div>
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
