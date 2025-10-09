
"use client";

import { CompanyTicketsView } from "@/components/company-tickets-view";
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, useSidebar } from "@/components/ui/sidebar";
import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, List, Pencil, Archive, Users, Building2, Settings } from "lucide-react";


function CompanyTicketsPageContent({ companyId }: { companyId: string }) {
  const { user, userProfile, logout } = useAuth();
  const router = useRouter();
  const { setOpenMobile } = useSidebar();

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
                              <AvatarFallback>{userProfile?.name || user?.email}</AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                              <span className="font-medium text-sm">{userProfile?.name || user?.email}</span>
                              <Button variant="link" size="sm" className="h-auto p-0 justify-start text-xs" onClick={handleLogout}>Log Out</Button>
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
                              <SidebarMenuButton onClick={() => handleMenuClick('archive')}>
                                  <Archive className="text-orange-500" />
                                  <span>Archive</span>
                              </SidebarMenuButton>
                          </SidebarMenuItem>
                          <SidebarMenuItem>
                              <SidebarMenuButton onClick={() => handleMenuClick('clients')} isActive>
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
              </div>
          </Sidebar>

          <main className="flex-1 flex flex-col min-w-0 bg-muted">
              <CompanyTicketsView companyId={companyId} />
          </main>
      </div>
  )
}


export default function CompanyTicketsPage({ params }: { params: { id: string } }) {
  return (
    <SidebarProvider>
      <CompanyTicketsPageContent companyId={params.id} />
    </SidebarProvider>
  );
}

    