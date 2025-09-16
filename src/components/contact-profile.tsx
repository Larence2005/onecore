
"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/providers/auth-provider";
import { getTicketsFromDB, getOrganizationMembers, getEmail, getCompanies, updateCompanyEmployee } from "@/app/actions";
import type { Email, OrganizationMember, DetailedEmail, ActivityLog, Company, Employee } from "@/app/actions";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { TicketItem } from "@/components/ticket-item";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal, ArrowLeft, Mail, Ticket, Forward, Users as UsersIcon, Building as BuildingIcon, Home, Phone, Pencil, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";
import Link from "next/link";
import { Header } from "./header";
import { SidebarProvider, Sidebar, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarHeader, SidebarFooter } from '@/components/ui/sidebar';
import { LayoutDashboard, List, Users, Building2, Settings, LogOut, Search, Archive } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TimelineItem } from './timeline-item';
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { PropertyItem } from "./property-item";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from "./ui/dialog";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import Image from "next/image";

interface ProfileData {
    name: string;
    email: string;
    address?: string;
    mobile?: string;
    landline?: string;
    companyId?: string;
    companyName?: string;
}

export function ContactProfile({ email }: { email: string }) {
  const { user, userProfile, loading, logout } = useAuth();
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  
  const [submittedTickets, setSubmittedTickets] = useState<Email[]>([]);
  const [ccTickets, setCcTickets] = useState<Email[]>([]);
  const [bccTickets, setBccTickets] = useState<Email[]>([]);
  const [forwardedActivities, setForwardedActivities] = useState<ActivityLog[]>([]);
  const [involvedTickets, setInvolvedTickets] = useState<Map<string, Email>>(new Map());
  const [isInternalMember, setIsInternalMember] = useState(false);

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

  useEffect(() => {
    if (!loading && !user) {
        router.push('/login');
    }
  }, [user, loading, router]);


  const fetchData = useCallback(async () => {
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
        setIsInternalMember(!!member);
        
        let foundProfile: ProfileData = { name: email, email };

        if (member) {
            foundProfile = { ...foundProfile, ...member };
        } else {
             const allCompanies = await getCompanies(userProfile.organizationId);
             for(const company of allCompanies) {
                const employeeDocRef = doc(db, 'organizations', userProfile.organizationId, 'companies', company.id, 'employees', email);
                const employeeDoc = await getDoc(employeeDocRef);
                if (employeeDoc.exists()) {
                    const employeeData = employeeDoc.data() as Employee;
                    foundProfile = {
                        ...employeeData,
                        companyId: company.id,
                        companyName: company.name
                    };
                    break;
                }
             }
        }
        
        setProfileData(foundProfile);
        setUpdatedName(foundProfile.name);
        setUpdatedEmail(foundProfile.email);
        setUpdatedAddress(foundProfile.address || '');
        setUpdatedMobile(foundProfile.mobile || '');
        setUpdatedLandline(foundProfile.landline || '');


        // Then, fetch all tickets to find where this contact was involved.
        const allTickets = await getTicketsFromDB(userProfile.organizationId, { fetchAll: true });
        
        const tempSubmittedTickets = allTickets.filter(ticket => ticket.senderEmail?.toLowerCase() === email.toLowerCase());
        const tempCcTickets: Email[] = [];
        const tempBccTickets: Email[] = [];
        const tempForwardedActivities: ActivityLog[] = [];
        const tempInvolvedTickets = new Map<string, Email>();

        for (const ticket of allTickets) {
            // Fetch full conversation to check recipients
            const detailedTicket = await getEmail(userProfile.organizationId, ticket.id);
            if (detailedTicket?.conversation) {
                let isCc = false;
                let isBcc = false;
                for (const message of detailedTicket.conversation) {
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

            // Check activity log for forwards
            const activityCollectionRef = collection(db, 'organizations', userProfile.organizationId, 'tickets', ticket.id, 'activity');
            const q = query(activityCollectionRef, where('type', '==', 'Forward'));
            const activitySnapshot = await getDocs(q);
            activitySnapshot.forEach(doc => {
                const log = doc.data() as Omit<ActivityLog, 'id'>;
                if (log.details.toLowerCase().includes(email.toLowerCase())) {
                    tempForwardedActivities.push({
                        id: doc.id, ...log, ticketId: ticket.id, ticketSubject: ticket.subject
                    });
                    tempInvolvedTickets.set(ticket.id, ticket);
                }
            });
        }
        
        setSubmittedTickets(tempSubmittedTickets);
        setCcTickets(tempCcTickets);
        setBccTickets(tempBccTickets);
        setForwardedActivities(tempForwardedActivities);
        setInvolvedTickets(tempInvolvedTickets);

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
    fetchData();
  }, [fetchData]);
  
   const handleUpdate = async () => {
    if (!profileData || !profileData.companyId || !userProfile?.organizationId) {
        toast({ variant: 'destructive', title: 'Update Failed', description: 'Cannot update contact without a company association.' });
        return;
    }
    setIsUpdating(true);
    try {
        await updateCompanyEmployee(userProfile.organizationId, profileData.companyId, profileData.email, {
            name: updatedName,
            email: updatedEmail,
            address: updatedAddress,
            mobile: updatedMobile,
            landline: updatedLandline,
        });
        toast({ title: "Contact Updated", description: "The contact's details have been updated." });
        await fetchData(); // Re-fetch data
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
        return <div className="flex items-center justify-center min-h-screen"><p>Loading...</p></div>;
    }
    
    const isOwner = user?.uid === userProfile?.organizationOwnerUid;


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
                 <SidebarHeader className="mt-auto p-4">
                    <div className="flex flex-col items-center justify-center gap-2">
                        <span className="text-xs text-muted-foreground">Product of</span>
                        <Image src="/navlogo.jpg" alt="Onecore Logo" />
                    </div>
                </SidebarHeader>
                </div>
            </Sidebar>

            <main className="flex-1 flex flex-col min-w-0">
                <Header>
                    <div className="flex items-center gap-4">
                            <Button variant="outline" size="icon" onClick={() => router.back()}>
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                        <h1 className="text-xl font-bold">Contact Profile</h1>
                    </div>
                </Header>
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-6 overflow-y-auto p-4 sm:p-6 lg:p-8">
                    {isLoading ? (
                        <div className="lg:col-span-2 xl:col-span-3 space-y-4">
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
                        <div className="lg:col-span-2 xl:col-span-3 space-y-6">
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
                            <Tabs defaultValue="submitted" className="w-full">
                                <TabsList className="mb-4">
                                    <TabsTrigger value="submitted">Submitted</TabsTrigger>
                                    <TabsTrigger value="cc">Cc'd On</TabsTrigger>
                                    <TabsTrigger value="bcc">Bcc'd On</TabsTrigger>
                                    <TabsTrigger value="forwarded">Forwarded To</TabsTrigger>
                                </TabsList>
                                <TabsContent value="submitted">
                                    <Card>
                                        <CardHeader>
                                            <CardTitle>Submitted Tickets</CardTitle>
                                            <CardDescription>Tickets created by {profileData.name}.</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            {submittedTickets.length > 0 ? (
                                                <ul className="space-y-0 border-t">
                                                    {submittedTickets.map((ticket) => (
                                                        <TicketItem key={ticket.id} email={ticket} isSelected={false} onSelect={() => {}} />
                                                    ))}
                                                </ul>
                                            ) : (
                                                <div className="text-center py-10 text-muted-foreground">No tickets found.</div>
                                            )}
                                        </CardContent>
                                    </Card>
                                </TabsContent>
                                <TabsContent value="cc">
                                    <Card>
                                        <CardHeader>
                                            <CardTitle>Tickets (Cc)</CardTitle>
                                            <CardDescription>Tickets where {profileData.name} was in the Cc field.</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            {ccTickets.length > 0 ? (
                                                <ul className="space-y-0 border-t">
                                                    {ccTickets.map((ticket) => (
                                                        <TicketItem key={ticket.id} email={ticket} isSelected={false} onSelect={() => {}} />
                                                    ))}
                                                </ul>
                                            ) : (
                                                <div className="text-center py-10 text-muted-foreground">No tickets found.</div>
                                            )}
                                        </CardContent>
                                    </Card>
                                </TabsContent>
                                <TabsContent value="bcc">
                                        <Card>
                                        <CardHeader>
                                            <CardTitle>Tickets (Bcc)</CardTitle>
                                            <CardDescription>Tickets where {profileData.name} was in the Bcc field.</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            {bccTickets.length > 0 ? (
                                                <ul className="space-y-0 border-t">
                                                    {bccTickets.map((ticket) => (
                                                        <TicketItem key={ticket.id} email={ticket} isSelected={false} onSelect={() => {}} />
                                                    ))}
                                                </ul>
                                            ) : (
                                                <div className="text-center py-10 text-muted-foreground">No tickets found.</div>
                                            )}
                                        </CardContent>
                                    </Card>
                                </TabsContent>
                                <TabsContent value="forwarded">
                                        <Card>
                                        <CardHeader>
                                            <CardTitle>Forwarded Messages</CardTitle>
                                            <CardDescription>Tickets that were forwarded to {profileData.name}.</CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
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
                                        </CardContent>
                                    </Card>
                                </TabsContent>
                            </Tabs>
                        </div>
                         <aside className="lg:col-span-1 xl:col-span-1 space-y-6">
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between">
                                    <CardTitle>Properties</CardTitle>
                                    {isOwner && profileData.companyId && (
                                        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                                            <DialogTrigger asChild>
                                                <Button variant="secondary" size="sm">
                                                    <Pencil className="mr-2 h-3 w-3" />
                                                    Edit
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent className="sm:max-w-2xl">
                                                <DialogHeader>
                                                    <DialogTitle>Edit Contact Properties</DialogTitle>
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
                                                    <Button onClick={handleUpdate} disabled={isUpdating}>
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
                                        {profileData.companyId && profileData.companyName && (
                                            <PropertyItem icon={BuildingIcon} label="Company">
                                                <Link href={`/clients/${profileData.companyId}`} className="font-semibold hover:underline">
                                                    {profileData.companyName}
                                                </Link>
                                            </PropertyItem>
                                        )}
                                        <PropertyItem icon={Home} label="Address" value={profileData.address} />
                                        <PropertyItem icon={Phone} label="Mobile" value={profileData.mobile} />
                                        <PropertyItem icon={Phone} label="Telephone" value={profileData.landline} />
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
