
"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useAuth } from "@/providers/auth-provider";
import { getTicketsFromDB, getOrganizationMembers, getActivityLog, updateMemberInOrganization } from "@/app/actions";
import type { Email, OrganizationMember, DetailedEmail, ActivityLog } from "@/app/actions";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { TicketItem } from "@/components/ticket-item";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal, ArrowLeft, Mail, Ticket, Home, Phone, Activity, Link as LinkIcon, Building, Pencil, RefreshCw, LogOut, Lock } from "lucide-react";
import { Button } from "./ui/button";
import Link from "next/link";
import { Header } from "./header";
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, useSidebar, SidebarFooter } from '@/components/ui/sidebar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TimelineItem } from './timeline-item';
import { collection, query, where, getDocs, or, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { PropertyItem } from "./property-item";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from "./ui/dialog";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { isPast, isFuture, parseISO } from 'date-fns';
import Image from 'next/image';
import { LayoutDashboard, List, Archive, Users, Building2, Settings, PlusCircle } from 'lucide-react';


type SortOption = 'newest' | 'oldest' | 'upcoming' | 'overdue' | 'status';
type StatusFilter = 'all' | 'Open' | 'Pending' | 'Resolved' | 'Closed';


export function AgentProfilePageContent({ email }: { email: string }) {
    const { user, userProfile, logout } = useAuth();
    const router = useRouter();
    const { setOpenMobile } = useSidebar();
    const isClient = userProfile?.isClient === true;

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
        } else if (view === 'create-ticket') {
            router.push('/create-ticket');
        } else {
            router.push(`/dashboard?view=${view}`);
        }
        setOpenMobile(false);
    };

    return (
        <SidebarProvider>
            <div className="grid min-h-screen w-full lg:grid-cols-[220px_1fr]">
                <Sidebar>
                    <div className="flex-grow flex flex-col">
                        <SidebarHeader className="p-4 flex flex-col gap-4">
                            <div className="flex items-center justify-center">
                                <Image src="/quickdesk_logowithtext_nobg.png" alt="Quickdesk Logo" width="120" height="60" unoptimized />
                            </div>
                           {isClient ? (
                                 <div className="flex items-center gap-4">
                                    <Avatar className="h-9 w-9">
                                    <AvatarFallback>{userProfile?.name || user?.email}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex flex-col">
                                        <span className="font-medium text-sm">{userProfile?.name || user?.email}</span>
                                    </div>
                                </div>
                            ) : (
                                 <Link href={`/organization/members/${encodeURIComponent(userProfile?.email!)}`} className="flex items-center gap-4 group">
                                    <Avatar className="h-9 w-9">
                                    <AvatarFallback>{userProfile?.name || user?.email}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex flex-col">
                                        <span className="font-medium text-sm group-hover:underline">{userProfile?.name || user?.email}</span>
                                    </div>
                                </Link>
                            )}
                        </SidebarHeader>
                        <SidebarContent className="flex-grow">
                             <SidebarMenu className="flex flex-col gap-2 px-4">
                                {isClient ? (
                                    <>
                                        <SidebarMenuItem>
                                            <SidebarMenuButton onClick={() => handleMenuClick('tickets')}>
                                                <List className="text-green-500" />
                                                <span>Tickets</span>
                                            </SidebarMenuButton>
                                        </SidebarMenuItem>
                                        <SidebarMenuItem>
                                            <SidebarMenuButton onClick={() => handleMenuClick('create-ticket')}>
                                                <PlusCircle className="text-blue-500" />
                                                <span>Create Ticket</span>
                                            </SidebarMenuButton>
                                        </SidebarMenuItem>
                                    </>
                                ) : (
                                    <>
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
                                            <SidebarMenuButton onClick={() => handleMenuClick('clients')}>
                                            <Users className="text-pink-500" />
                                            <span>Clients</span>
                                            </SidebarMenuButton>
                                        </SidebarMenuItem>
                                        <SidebarMenuItem>
                                            <SidebarMenuButton onClick={() => handleMenuClick('organization')} isActive>
                                            <Building2 className="text-yellow-500" />
                                            <span>Organization</span>
                                            </SidebarMenuButton>
                                        </SidebarMenuItem>
                                    </>
                                )}
                                <SidebarMenuItem>
                                    <SidebarMenuButton onClick={() => handleMenuClick('settings')}>
                                    <Settings className="text-gray-500" />
                                    <span>Settings</span>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                                <SidebarMenuItem>
                                    <SidebarMenuButton onClick={handleLogout}>
                                        <LogOut className="text-red-500" />
                                        <span>Log Out</span>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            </SidebarMenu>
                        </SidebarContent>
                    </div>
                </Sidebar>

                <main className="flex-1 flex flex-col min-w-0 bg-muted">
                    <Header>
                        <div className="flex items-center gap-4">
                            <Button variant="outline" size="icon" onClick={() => router.back()}>
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                            <h1 className="text-xl font-bold">Agent Profile</h1>
                        </div>
                    </Header>
                    <AgentProfile email={email} />
                </main>
            </div>
        </SidebarProvider>
    );
}

export function AgentProfile({ email }: { email: string }) {
  const { user, userProfile, loading, logout, fetchUserProfile } = useAuth();
  const [profileData, setProfileData] = useState<OrganizationMember | null>(null);
  
  const [assignedTickets, setAssignedTickets] = useState<Email[]>([]);
  const [ccTickets, setCcTickets] = useState<Email[]>([]);
  const [bccTickets, setBccTickets] = useState<Email[]>([]);
  const [forwardedActivities, setForwardedActivities] = useState<ActivityLog[]>([]);
  const [responseCount, setResponseCount] = useState(0);
  const [latestActivity, setLatestActivity] = useState<ActivityLog | null>(null);
  
  const [sortOptions, setSortOptions] = useState<{ assigned: SortOption, cc: SortOption, bcc: SortOption }>({
    assigned: 'newest',
    cc: 'newest',
    bcc: 'newest'
  });
  
  const [statusFilters, setStatusFilters] = useState<{ assigned: StatusFilter, cc: StatusFilter, bcc: StatusFilter }>({
    assigned: 'all',
    cc: 'all',
    bcc: 'all',
  });


  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();
  
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updatedName, setUpdatedName] = useState('');
  const [updatedEmail, setUpdatedEmail] = useState('');
  const [updatedAddress, setUpdatedAddress] = useState('');
  const [updatedMobile, setUpdatedMobile] = useState('');
  const [updatedLandline, setUpdatedLandline] = useState('');
  const [activeTab, setActiveTab] = useState('assigned');


  useEffect(() => {
    if (!loading && !user) {
        router.push('/');
    }
  }, [user, loading, router]);


  const fetchAgentData = useCallback(async () => {
    if (!user || !userProfile?.organizationId) {
        if(loading) return;
        setError("You must be part of an organization to view profiles.");
        setIsLoading(false);
        return;
    }

    setIsLoading(true);
    setError(null);
    try {
        const orgMembers = await getOrganizationMembers(userProfile.organizationId);
        let member = orgMembers.find(m => m.email.toLowerCase() === email.toLowerCase());
        
        if (!member) {
            // If viewing own profile and not found in members list (e.g., admin during setup)
            if (user.email?.toLowerCase() === email.toLowerCase()) {
                member = {
                    uid: user.uid,
                    name: userProfile.name || user.email!,
                    email: user.email!,
                    status: userProfile.status || 'Not Verified',
                    address: userProfile.address,
                    mobile: userProfile.mobile,
                    landline: userProfile.landline,
                };
            } else {
                 throw new Error("Agent not found or not fully registered in your organization.");
            }
        }
        
        const profile = member;
        
        setProfileData(profile as OrganizationMember);
        setUpdatedName(profile.name);
        setUpdatedEmail(profile.email);
        setUpdatedAddress(profile.address || '');
        setUpdatedMobile(profile.mobile || '');
        setUpdatedLandline(profile.landline || '');

        const allTickets = await getTicketsFromDB(userProfile.organizationId, { fetchAll: true });
        
        const memberEmails = new Set(orgMembers.filter(m => !m.isClient).map(m => m.email.toLowerCase()));
        
        const processTicketsWithLastReplier = async (tickets: Email[]): Promise<Email[]> => {
            return Promise.all(tickets.map(async (ticket) => {
                let lastReplier: 'agent' | 'client' | undefined = undefined;
                if(ticket.conversationId) {
                    const convDoc = await getDoc(doc(db, 'organizations', userProfile.organizationId!, 'conversations', ticket.conversationId));
                    if (convDoc.exists()) {
                        const messages = convDoc.data().messages as DetailedEmail[];
                        if (messages && messages.length > 0) {
                            const lastMessage = messages[messages.length - 1];
                            lastReplier = memberEmails.has(lastMessage.senderEmail?.toLowerCase() || '') ? 'agent' : 'client';
                        }
                    } else if (ticket.senderEmail && !memberEmails.has(ticket.senderEmail.toLowerCase())) {
                        lastReplier = 'client';
                    }
                }
                return { ...ticket, lastReplier };
            }));
        };

        const tempAssignedTickets = allTickets.filter(ticket => ticket.assignee === profile.uid);
        
        const conversationsRef = collection(db, 'organizations', userProfile.organizationId, 'conversations');
        
        let tempResponseCount = 0;
        const ccTicketIds = new Set<string>();
        const bccTicketIds = new Set<string>();
        
        const allConversationsSnapshot = await getDocs(conversationsRef);
        allConversationsSnapshot.forEach(doc => {
            const messages = doc.data().messages as DetailedEmail[] || [];
            messages.forEach(message => {
                if (message.senderEmail?.toLowerCase() === email.toLowerCase()) {
                    tempResponseCount++;
                }
                const conversationId = message.conversationId;
                if (!conversationId) return;

                const ticket = allTickets.find(t => t.conversationId === conversationId);
                if (!ticket) return;

                if (message.ccRecipients?.some(r => r.emailAddress.address.toLowerCase() === email.toLowerCase())) {
                    ccTicketIds.add(ticket.id);
                }
                if (message.bccRecipients?.some(r => r.emailAddress.address.toLowerCase() === email.toLowerCase())) {
                    bccTicketIds.add(ticket.id);
                }
            });
        });
        
        const tempCcTickets = allTickets.filter(t => ccTicketIds.has(t.id));
        const tempBccTickets = allTickets.filter(t => bccTicketIds.has(t.id));

        let allActivities: ActivityLog[] = [];
        for (const ticket of allTickets) {
             const activityLogs = await getActivityLog(userProfile.organizationId, ticket.id);
             allActivities.push(...activityLogs.map(log => ({ ...log, ticketId: ticket.id, ticketSubject: ticket.subject })));
        }

        const tempForwardedActivities = allActivities.filter(log => log.type === 'Forward' && log.details.toLowerCase().includes(email.toLowerCase()));

        setAssignedTickets(await processTicketsWithLastReplier(tempAssignedTickets));
        setCcTickets(await processTicketsWithLastReplier(tempCcTickets));
        setBccTickets(await processTicketsWithLastReplier(tempBccTickets));
        
        setForwardedActivities(tempForwardedActivities);
        setResponseCount(tempResponseCount);
        
        const userActivities = allActivities.filter(log => log.user.toLowerCase() === email.toLowerCase());
        if (userActivities.length > 0) {
             userActivities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
             setLatestActivity(userActivities[0]);
        }


    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
        setError(errorMessage);
        toast({
            variant: "destructive",
            title: "Failed to load profile.",
            description: errorMessage,
        });
    } finally {
        setIsLoading(false);
    }
  }, [user, userProfile, email, toast, loading]);

  useEffect(() => {
    if(!loading && user && userProfile) {
        fetchAgentData();
    }
  }, [loading, user, userProfile, fetchAgentData]);
  
    const handleUpdateMember = async () => {
        if (!profileData || !userProfile?.organizationId) return;
        setIsUpdating(true);
        try {
            await updateMemberInOrganization(userProfile.organizationId, profileData.email, updatedName, updatedEmail, updatedAddress, updatedMobile, updatedLandline);
            toast({ title: "Member Updated", description: "The agent's details have been updated." });
            
            await fetchAgentData(); // Re-fetch data to reflect changes
            
            // If the user is editing their own profile, also refresh the global userProfile state
            if(user && user.email === profileData.email) {
                await fetchUserProfile(user);
            }
            
            setIsEditDialogOpen(false);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            toast({ variant: 'destructive', title: "Update Failed", description: errorMessage });
        } finally {
            setIsUpdating(false);
        }
    };

    const sortAndFilterTickets = (tickets: Email[], sortOption: SortOption, statusFilter: StatusFilter): Email[] => {
        let processedTickets = [...tickets];

        if (sortOption === 'status' && statusFilter !== 'all') {
            processedTickets = processedTickets.filter(t => t.status === statusFilter);
        }

        switch (sortOption) {
            case 'newest':
                processedTickets.sort((a, b) => new Date(b.receivedDateTime).getTime() - new Date(a.receivedDateTime).getTime());
                break;
            case 'oldest':
                processedTickets.sort((a, b) => new Date(a.receivedDateTime).getTime() - new Date(b.receivedDateTime).getTime());
                break;
            case 'upcoming':
                processedTickets = processedTickets
                    .filter(t => t.deadline && isFuture(parseISO(t.deadline)))
                    .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime());
                break;
            case 'overdue':
                processedTickets = processedTickets
                    .filter(t => t.deadline && isPast(parseISO(t.deadline)) && !['Resolved', 'Closed'].includes(t.status))
                    .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime());
                break;
            case 'status':
                // If a specific status is chosen, we just use the filtered list.
                // If 'all' is chosen, sort by status order.
                if (statusFilter === 'all') {
                    const statusOrder = { 'Open': 1, 'Pending': 2, 'Resolved': 3, 'Closed': 4, 'Archived': 5 };
                    processedTickets.sort((a, b) => (statusOrder[a.status as keyof typeof statusOrder] || 99) - (statusOrder[b.status as keyof typeof statusOrder] || 99));
                }
                break;
        }
        return processedTickets;
    };

    const sortedAssignedTickets = useMemo(() => sortAndFilterTickets(assignedTickets, sortOptions.assigned, statusFilters.assigned), [assignedTickets, sortOptions.assigned, statusFilters.assigned]);
    const sortedCcTickets = useMemo(() => sortAndFilterTickets(ccTickets, sortOptions.cc, statusFilters.cc), [ccTickets, sortOptions.cc, statusFilters.cc]);
    const sortedBccTickets = useMemo(() => sortAndFilterTickets(bccTickets, sortOptions.bcc, statusFilters.cc), [bccTickets, sortOptions.bcc, statusFilters.cc]);
    
    const handleSortChange = (list: 'assigned' | 'cc' | 'bcc', value: SortOption) => {
        setSortOptions(prev => ({ ...prev, [list]: value }));
    };
    
    const handleStatusFilterChange = (list: 'assigned' | 'cc' | 'bcc', value: StatusFilter) => {
        setStatusFilters(prev => ({ ...prev, [list]: value }));
    };

    if (loading || !user || !userProfile) {
        return <div className="flex items-center justify-center min-h-screen"></div>;
    }
    
    const isOwner = user?.uid === userProfile?.organizationOwnerUid;
    const isViewingOwnProfile = user?.email?.toLowerCase() === email.toLowerCase();
    
    if (!loading && !isOwner && !isViewingOwnProfile) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <div className="bg-red-100 dark:bg-red-900/20 p-4 rounded-full">
                    <Lock className="h-12 w-12 text-red-500" />
                </div>
                <h2 className="mt-6 text-2xl font-bold">Access Denied</h2>
                <p className="mt-2 text-muted-foreground">You do not have permission to view this agent's profile.</p>
                <Button onClick={() => router.back()} className="mt-6">Go Back</Button>
            </div>
        );
    }

    const renderActiveFilters = () => {
        const currentList = activeTab as 'assigned' | 'cc' | 'bcc';
        const currentSort = sortOptions[currentList];
        const currentStatusFilter = statusFilters[currentList];

        return (
            <div className="flex items-center gap-2">
                <Select value={currentSort} onValueChange={(value) => handleSortChange(currentList, value as SortOption)}>
                    <SelectTrigger className="w-full sm:w-auto"><SelectValue placeholder="Sort by" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="newest">Newest</SelectItem>
                        <SelectItem value="oldest">Oldest</SelectItem>
                        <SelectItem value="upcoming">Upcoming Deadline</SelectItem>
                        <SelectItem value="overdue">Overdue</SelectItem>
                        <SelectItem value="status">Status</SelectItem>
                    </SelectContent>
                </Select>
                {currentSort === 'status' && (
                    <Select value={currentStatusFilter} onValueChange={(value) => handleStatusFilterChange(currentList, value as StatusFilter)}>
                        <SelectTrigger className="w-full sm:w-auto"><SelectValue placeholder="Filter status" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            <SelectItem value="Open">Open</SelectItem>
                            <SelectItem value="Pending">Pending</SelectItem>
                            <SelectItem value="Resolved">Resolved</SelectItem>
                            <SelectItem value="Closed">Closed</SelectItem>
                        </SelectContent>
                    </Select>
                )}
            </div>
        );
    };

  return (
    <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-6 overflow-y-auto p-4 sm:p-6 lg:p-8">
        {isLoading ? (
            <div className="space-y-4 lg:col-span-2 xl:col-span-3">
                <div className="flex items-center gap-4">
                    <Skeleton className="h-20 w-20 rounded-full" />
                    <div className="space-y-2">
                        <Skeleton className="h-7 w-48" />
                        <Skeleton className="h-5 w-64" />
                    </div>
                </div>
                 <Skeleton className="h-10 w-full" />
                <Skeleton className="h-96 w-full" />
            </div>
        ) : error ? (
                <Alert variant="destructive" className="max-w-2xl mx-auto lg:col-span-full">
                <Terminal className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        ) : profileData ? (
            <>
            <div className="space-y-6 lg:col-span-2 xl:col-span-3">
                <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16 text-2xl sm:h-20 sm:w-20 sm:text-3xl">
                        <AvatarFallback>{profileData.name}</AvatarFallback>
                    </Avatar>
                    <div>
                        <h2 className="text-2xl sm:text-3xl font-bold">{profileData.name}</h2>
                        <div className="flex items-center gap-2 text-muted-foreground mt-1">
                            <span>{profileData.email}</span>
                        </div>
                    </div>
                </div>
                <Tabs defaultValue="assigned" value={activeTab} onValueChange={(value) => setActiveTab(value)} className="w-full">
                    <div className="flex flex-col sm:flex-row sm:justify-between items-center mb-4 gap-4">
                        <TabsList className="hidden sm:inline-flex">
                            <TabsTrigger value="assigned">Assigned ({assignedTickets.length})</TabsTrigger>
                            <TabsTrigger value="cc">Cc'd On ({ccTickets.length})</TabsTrigger>
                            <TabsTrigger value="bcc">Bcc'd On ({bccTickets.length})</TabsTrigger>
                            <TabsTrigger value="forwarded">Forwarded To ({forwardedActivities.length})</TabsTrigger>
                        </TabsList>
                        
                        <div className="w-full sm:hidden flex items-center justify-between gap-2">
                            <div className="flex-1">
                                <Select value={activeTab} onValueChange={setActiveTab}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Select a category" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="assigned">Assigned ({assignedTickets.length})</SelectItem>
                                        <SelectItem value="cc">Cc'd On ({ccTickets.length})</SelectItem>
                                        <SelectItem value="bcc">Bcc'd On ({bccTickets.length})</SelectItem>
                                        <SelectItem value="forwarded">Forwarded To ({forwardedActivities.length})</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex-1">
                                {activeTab !== 'forwarded' && renderActiveFilters()}
                            </div>
                        </div>
                        
                        <div className="hidden sm:flex sm:w-auto sm:max-w-md">
                            {activeTab !== 'forwarded' && renderActiveFilters()}
                        </div>
                    </div>
                    <TabsContent value="assigned">
                        <div className="space-y-2">
                            <div className="border-t">
                                {sortedAssignedTickets.length > 0 ? (
                                    <ul className="space-y-0">
                                        {sortedAssignedTickets.map((ticket) => (
                                            <TicketItem key={ticket.id} email={ticket} isSelected={false} onSelect={() => {}} />
                                        ))}
                                    </ul>
                                ) : (
                                    <div className="text-center py-10 text-muted-foreground">No tickets found.</div>
                                )}
                            </div>
                        </div>
                    </TabsContent>
                    <TabsContent value="cc">
                        <div className="space-y-2">
                            <div className="border-t">
                                {sortedCcTickets.length > 0 ? (
                                    <ul className="space-y-0">
                                        {sortedCcTickets.map((ticket) => (
                                            <TicketItem key={ticket.id} email={ticket} isSelected={false} onSelect={() => {}} />
                                        ))}
                                    </ul>
                                ) : (
                                    <div className="text-center py-10 text-muted-foreground">No tickets found.</div>
                                )}
                            </div>
                        </div>
                    </TabsContent>
                    <TabsContent value="bcc">
                        <div className="space-y-2">
                            <div className="border-t">
                                {sortedBccTickets.length > 0 ? (
                                    <ul className="space-y-0">
                                        {sortedBccTickets.map((ticket) => (
                                            <TicketItem key={ticket.id} email={ticket} isSelected={false} onSelect={() => {}} />
                                        ))}
                                    </ul>
                                ) : (
                                    <div className="text-center py-10 text-muted-foreground">No tickets found.</div>
                                )}
                            </div>
                        </div>
                    </TabsContent>
                    <TabsContent value="forwarded">
                        <div className="space-y-2">
                            <h3 className="text-xl font-bold">Forwarded Messages</h3>
                            <p className="text-muted-foreground">Tickets that were forwarded to {profileData.name}.</p>
                            <div className="space-y-4 pt-4">
                                {forwardedActivities.length > 0 ? (
                                    forwardedActivities.map((log) => (
                                        <TimelineItem key={log.id} type="Forward" date={log.date} user={log.user}>
                                            <div className="flex flex-wrap items-center gap-x-2">
                                                <span>{log.details} on ticket</span> 
                                                <Link href={`/tickets/${log.ticketId}`} className="font-semibold hover:underline truncate" title={log.ticketSubject}>
                                                    {log.ticketSubject}
                                                </Link>
                                            </div>
                                        </TimelineItem>
                                    ))
                                ) : (
                                    <div className="text-center py-10 text-muted-foreground">No forwarded messages found.</div>
                                )}
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
            <aside className="space-y-6 lg:col-span-1 xl:col-span-1">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>About</CardTitle>
                            {isOwner && (
                                <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                                    <DialogTrigger asChild>
                                        <Button variant="secondary" size="sm">
                                            <Pencil className="mr-2 h-3 w-3" />
                                            Edit
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-2xl">
                                        <DialogHeader>
                                            <DialogTitle>Edit Agent Properties</DialogTitle>
                                            <DialogDescription>Update the details for {profileData.name}.</DialogDescription>
                                        </DialogHeader>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
                                            <div className="space-y-2">
                                                <Label htmlFor="update-name">Name</Label>
                                                <Input id="update-name" value={updatedName} onChange={(e) => setUpdatedName(e.target.value)} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="update-email">Email</Label>
                                                <Input id="update-email" type="email" value={updatedEmail} onChange={(e) => setUpdatedEmail(e.target.value)} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="update-mobile">Mobile Number</Label>
                                                <Input id="update-mobile" value={updatedMobile} onChange={(e) => setUpdatedMobile(e.target.value)} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="update-landline">Telephone Number</Label>
                                                <Input id="update-landline" value={updatedLandline} onChange={(e) => setUpdatedLandline(e.target.value)} />
                                            </div>
                                            <div className="space-y-2 sm:col-span-2">
                                                <Label htmlFor="update-address">Address</Label>
                                                <Textarea id="update-address" value={updatedAddress} onChange={(e) => setUpdatedAddress(e.target.value)} />
                                            </div>
                                        </div>
                                        <DialogFooter>
                                            <DialogClose asChild>
                                                <Button variant="outline">Cancel</Button>
                                            </DialogClose>
                                            <Button onClick={handleUpdateMember} disabled={isUpdating}>
                                                {isUpdating && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                                                Save Changes
                                            </Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            )}
                        </CardHeader>
                        <CardContent>
                            <dl className="grid grid-cols-1 gap-y-4">
                                <PropertyItem icon={Home} label="Address" value={profileData.address} />
                                <PropertyItem icon={Phone} label="Mobile" value={profileData.mobile} />
                                <PropertyItem icon={Phone} label="Telephone" value={profileData.landline} />
                                <PropertyItem icon={Ticket} label="Total Responses" value={responseCount} />
                                <dt className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                    <Activity className="h-4 w-4" />
                                    Latest Activity
                                </dt>
                                {latestActivity ? (
                                     <dd className="mt-1 text-sm text-foreground break-all">
                                        <TimelineItem type={latestActivity.type} date={latestActivity.date} user={latestActivity.user}>
                                            {latestActivity.details} on <Link href={`/tickets/${latestActivity.ticketId}`} className="font-semibold hover:underline">{latestActivity.ticketSubject}</Link>
                                        </TimelineItem>
                                     </dd>
                                ) : (
                                    <dd className="mt-1 text-sm text-foreground">N/A</dd>
                                )}
                            </dl>
                        </CardContent>
                    </Card>
                </aside>
            </>
        ) : null}
    </div>
  );
}
