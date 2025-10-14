
"use client"

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { useRouter } from 'next/navigation';
import { SidebarProvider, Sidebar, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarHeader, SidebarFooter, useSidebar } from '@/components/ui/sidebar';
import { MainView } from '@/components/main-view';
import { LayoutDashboard, List, Users, Building2, Settings, LogOut, Search, Pencil, Archive, ArrowLeft } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/header';
import Link from 'next/link';
import Image from 'next/image';

function ArchivePageContent() {
    const { user, userProfile, loading, logout } = useAuth();
    const router = useRouter();
    const { setOpenMobile } = useSidebar();

    useEffect(() => {
        if (!loading && !user) {
            router.push('/');
        }
    }, [user, loading, router]);
    
    const handleLogout = async () => {
        try {
            await logout();
            router.push('/');
        } catch (error) {
            console.error("Failed to log out", error);
        }
    };
    
    const handleMenuClick = (view: string) => {
        if (view === 'archive') {
            router.push('/archive');
        } else {
            router.push(`/dashboard?view=${view}`); 
        }
        setOpenMobile(false);
    };


    if (loading || !user) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                
            </div>
        );
    }

    return (
        <div className="grid min-h-screen w-full lg:grid-cols-[220px_1fr]">
            <Sidebar>
                <div className="flex-grow flex flex-col">
                    <SidebarHeader className="p-4 flex flex-col gap-4">
                        <div className="flex items-center justify-center">
                            <Image src="/quickdesk_logowithtext_nobg.png" alt="Quickdesk Logo" width="120" height="60" unoptimized />
                        </div>
                        <div className="flex items-center gap-4">
                            <Avatar className="h-9 w-9">
                            <AvatarFallback>{userProfile?.name || user.email}</AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                                <span className="font-medium text-sm">{userProfile?.name || user.email}</span>
                            </div>
                        </div>
                    </SidebarHeader>
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
                    <SidebarFooter className="p-4 mt-auto">
                        <SidebarMenu>
                            <SidebarMenuItem>
                                <SidebarMenuButton onClick={handleLogout}>
                                    <LogOut className="text-red-500" />
                                    <span>Log Out</span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarFooter>
                </div>
            </Sidebar>

            <main className="flex-1 flex flex-col min-w-0">
                <Header>
                    <div className="flex items-center gap-4">
                         <Button variant="outline" size="icon" asChild>
                            <Link href="/dashboard">
                                <ArrowLeft className="h-4 w-4" />
                            </Link>
                        </Button>
                        <h1 className="text-xl font-bold">Archived Tickets</h1>
                    </div>
                </Header>
                <MainView activeView="archive" />
            </main>
        </div>
    );
}


export default function ArchivePage() {
    return (
        <SidebarProvider>
            <ArchivePageContent />
        </SidebarProvider>
    );
}
