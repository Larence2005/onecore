
"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useAuth } from "@/providers/auth-provider";
import { getTicketsFromDB, getOrganizationMembers, getEmail, getActivityLog, updateMemberInOrganization } from "@/app/actions";
import type { Email, OrganizationMember, DetailedEmail, ActivityLog } from "@/app/actions";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { TicketItem } from "@/components/ticket-item";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal, ArrowLeft, Mail, Ticket, Home, Phone, Activity, Link as LinkIcon, Building, Pencil, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";
import Link from "next/link";
import { Header } from "./header";
import { SidebarProvider, Sidebar, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarHeader, SidebarFooter } from '@/components/ui/sidebar';
import { LayoutDashboard, List, Users, Building2, Settings, LogOut, Archive } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TimelineItem } from './timeline-item';
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { PropertyItem } from "./property-item";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from "./ui/dialog";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import Image from "next/image";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { isPast, isFuture, parseISO } from 'date-fns';

type SortOption = 'newest' | 'oldest' | 'upcoming' | 'overdue' | 'status';
type StatusFilter = 'all' | 'Open' | 'Pending' | 'Resolved' | 'Closed';


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
        const member = orgMembers.find(m => m.email.toLowerCase() === email.toLowerCase());
        
        if (!member) {
            throw new Error("Agent not found in your organization.");
        }
        
        setProfileData(member);
        setUpdatedName(member.name);
        setUpdatedEmail(member.email);
        setUpdatedAddress(member.address || '');
        setUpdatedMobile(member.mobile || '');
        setUpdatedLandline(member.landline || '');


        const allTickets = await getTicketsFromDB(userProfile.organizationId, { fetchAll: true });
        
        const tempAssignedTickets = allTickets.filter(ticket => ticket.assignee === member.uid);
        const tempCcTickets: Email[] = [];
        const tempBccTickets: Email[] = [];
        const tempForwardedActivities: ActivityLog[] = [];
        let tempResponseCount = 0;
        let allActivities: ActivityLog[] = [];


        for (const ticket of allTickets) {
            const detailedTicket = await getEmail(userProfile.organizationId, ticket.id);
            if (detailedTicket?.conversation) {
                let isCc = false;
                let isBcc = false;
                for (const message of detailedTicket.conversation) {
                    if (message.senderEmail?.toLowerCase() === email.toLowerCase()) {
                        tempResponseCount++;
                    }
                    if (message.ccRecipients?.some(r => r.emailAddress.address.toLowerCase() === email.toLowerCase())) {
                        isCc = true;
                    }
                    if (message.bccRecipients?.some(r => r.emailAddress.address.toLowerCase() === email.toLowerCase())) {
                        isBcc = true;
                    }
                }
                if (isCc) tempCcTickets.push(ticket);
                if (isBcc) tempBccTickets.push(ticket);
            }

            const activityLogs = await getActivityLog(userProfile.organizationId, ticket.id);
            activityLogs.forEach(log => {
                const activityWithTicketInfo = { ...log, ticketId: ticket.id, ticketSubject: ticket.subject };
                allActivities.push(activityWithTicketInfo);
                if (log.type === 'Forward' && log.details.toLowerCase().includes(email.toLowerCase())) {
                    tempForwardedActivities.push(activityWithTicketInfo);
                }
            });
        }
        
        setAssignedTickets(tempAssignedTickets);
        setCcTickets(tempCcTickets);
        setBccTickets(tempBccTickets);
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


    const handleLogout = async () => {
        try {
            await logout();
            router.push('/');
        } catch (error) {
            console.error("Failed to log out", error);
        }
    };
    
    const handleMenuClick = (view: string) => {
        if(view === 'tickets' || view === '/') {
            router.push('/dashboard');
        } else if (view === 'archive') {
            router.push('/archive');
        } else {
            router.push(`/dashboard?view=${view}`); 
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

    if (loading || !user) {
        return <div className="flex items-center justify-center min-h-screen"><p>Loading...</p></div>;
    }
    
    const isOwner = user?.uid === userProfile?.organizationOwnerUid;

    const renderActiveFilters = () => {
        if (activeTab === 'assigned') {
            return (
                <div className="flex items-center gap-2">
                    <Select value={sortOptions.assigned} onValueChange={(value) => handleSortChange('assigned', value as SortOption)}>
                        <SelectTrigger className="w-[180px]"><SelectValue placeholder="Sort by" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="newest">Newest</SelectItem>
                            <SelectItem value="oldest">Oldest</SelectItem>
                            <SelectItem value="upcoming">Upcoming Deadline</SelectItem>
                            <SelectItem value="overdue">Overdue</SelectItem>
                            <SelectItem value="status">Status</SelectItem>
                        </SelectContent>
                    </Select>
                    {sortOptions.assigned === 'status' && (
                        <Select value={statusFilters.assigned} onValueChange={(value) => handleStatusFilterChange('assigned', value as StatusFilter)}>
                            <SelectTrigger className="w-[120px]"><SelectValue placeholder="Filter status" /></SelectTrigger>
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
        }
        if (activeTab === 'cc') {
             return (
                <div className="flex items-center gap-2">
                    <Select value={sortOptions.cc} onValueChange={(value) => handleSortChange('cc', value as SortOption)}>
                         <SelectTrigger className="w-[180px]"><SelectValue placeholder="Sort by" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="newest">Newest</SelectItem>
                            <SelectItem value="oldest">Oldest</SelectItem>
                            <SelectItem value="upcoming">Upcoming Deadline</SelectItem>
                            <SelectItem value="overdue">Overdue</SelectItem>
                            <SelectItem value="status">Status</SelectItem>
                        </SelectContent>
                    </Select>
                    {sortOptions.cc === 'status' && (
                        <Select value={statusFilters.cc} onValueChange={(value) => handleStatusFilterChange('cc', value as StatusFilter)}>
                            <SelectTrigger className="w-[120px]"><SelectValue placeholder="Filter status" /></SelectTrigger>
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
        }
        if (activeTab === 'bcc') {
             return (
                <div className="flex items-center gap-2">
                    <Select value={sortOptions.bcc} onValueChange={(value) => handleSortChange('bcc', value as SortOption)}>
                         <SelectTrigger className="w-[180px]"><SelectValue placeholder="Sort by" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="newest">Newest</SelectItem>
                            <SelectItem value="oldest">Oldest</SelectItem>
                            <SelectItem value="upcoming">Upcoming Deadline</SelectItem>
                            <SelectItem value="overdue">Overdue</SelectItem>
                            <SelectItem value="status">Status</SelectItem>
                        </SelectContent>
                    </Select>
                    {sortOptions.bcc === 'status' && (
                        <Select value={statusFilters.bcc} onValueChange={(value) => handleStatusFilterChange('bcc', value as StatusFilter)}>
                            <SelectTrigger className="w-[120px]"><SelectValue placeholder="Filter status" /></SelectTrigger>
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
        }
        return null;
    };


  return (
    <SidebarProvider>
        <div className="grid min-h-screen w-full lg:grid-cols-[240px_1fr]">
            <Sidebar className="w-[240px] hidden lg:flex flex-col py-6 h-full">
                <div className="flex-grow flex flex-col">
                    <SidebarHeader className="p-4 flex flex-col gap-4">
                        <div className="flex items-center justify-center">
                            <Image src={`/navlogo.jpg?t=${new Date().getTime()}`} alt="Onecore Logo" width="120" height="60" />
                        </div>
                        <div className="flex items-center gap-4">
                            <Avatar className="h-9 w-9">
                            <AvatarFallback>{userProfile?.name?.[0].toUpperCase() || user.email?.[0].toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                                <span className="font-medium text-sm">{userProfile?.name || user.email}</span>
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

            <main className="flex-1 flex flex-col min-w-0">
                <Header>
                    <div className="flex items-center gap-4">
                            <Button variant="outline" size="icon" onClick={() => router.back()}>
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                        <h1 className="text-xl font-bold">Agent Profile</h1>
                    </div>
                </Header>
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
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
                                <Avatar className="h-20 w-20 text-3xl">
                                    <AvatarFallback>{profileData.name.charAt(0).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <h2 className="text-3xl font-bold">{profileData.name}</h2>
                                    <div className="flex items-center gap-2 text-muted-foreground mt-1">
                                        <Mail className="h-4 w-4" />
                                        <span>{profileData.email}</span>
                                    </div>
                                </div>
                            </div>
                            <Tabs defaultValue="assigned" value={activeTab} onValueChange={(value) => setActiveTab(value)} className="w-full">
                                <div className="flex justify-between items-center mb-4">
                                    <TabsList>
                                        <TabsTrigger value="assigned">Assigned ({assignedTickets.length})</TabsTrigger>
                                        <TabsTrigger value="cc">Cc'd On ({ccTickets.length})</TabsTrigger>
                                        <TabsTrigger value="bcc">Bcc'd On ({bccTickets.length})</TabsTrigger>
                                        <TabsTrigger value="forwarded">Forwarded To ({forwardedActivities.length})</TabsTrigger>
                                    </TabsList>
                                    {renderActiveFilters()}
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
            </main>
        </div>
    </SidebarProvider>
  );
}
