
"use client";

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { useRouter } from 'next/navigation';
import { SidebarProvider, Sidebar, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarHeader, SidebarFooter } from '@/components/ui/sidebar';
import { LayoutDashboard, List, Users, Building2, Settings, LogOut, Pencil, Archive, ArrowLeft, Ticket, User, ChevronLeft, ChevronRight, Activity, Building, MapPin, Phone, Link as LinkIcon, RefreshCw, MoreHorizontal } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/header';
import Link from 'next/link';
import { getTicketsFromDB, getCompanyDetails, getCompanyEmployees, getCompanyActivityLogs, updateCompany, updateCompanyEmployee } from '@/app/actions';
import type { Email, Company, Employee, ActivityLog } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { TicketItem } from './ticket-item';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './ui/card';
import { Alert, AlertTitle, AlertDescription } from './ui/alert';
import { Terminal } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { isPast, isFuture, parseISO } from 'date-fns';
import { TimelineItem } from './timeline-item';
import { PropertyItem } from './property-item';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from "./ui/dialog";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import Image from 'next/image';

type SortOption = 'newest' | 'oldest' | 'upcoming' | 'overdue' | 'status';
type ActiveTab = 'tickets' | 'employees';


export function CompanyTicketsView({ companyId }: { companyId: string }) {
    const { user, userProfile, loading, logout } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [company, setCompany] = useState<Company | null>(null);
    const [tickets, setTickets] = useState<Email[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [activity, setActivity] = useState<ActivityLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [sortOption, setSortOption] = useState<SortOption>('newest');
    const [currentPage, setCurrentPage] = useState(1);
    const [ticketsPerPage, setTicketsPerPage] = useState(10);
    const [activeTab, setActiveTab] = useState<ActiveTab>('tickets');
    
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [updatedName, setUpdatedName] = useState('');
    const [updatedAddress, setUpdatedAddress] = useState('');
    const [updatedMobile, setUpdatedMobile] = useState('');
    const [updatedLandline, setUpdatedLandline] = useState('');
    const [updatedWebsite, setUpdatedWebsite] = useState('');

    const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
    const [isEditEmployeeDialogOpen, setIsEditEmployeeDialogOpen] = useState(false);
    const [isUpdatingEmployee, setIsUpdatingEmployee] = useState(false);
    const [updatedEmployeeName, setUpdatedEmployeeName] = useState('');
    const [updatedEmployeeEmail, setUpdatedEmployeeEmail] = useState('');
    const [updatedEmployeeAddress, setUpdatedEmployeeAddress] = useState('');
    const [updatedEmployeeMobile, setUpdatedEmployeeMobile] = useState('');
    const [updatedEmployeeLandline, setUpdatedEmployeeLandline] = useState('');



    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]);
    
    const fetchCompanyData = useCallback(async () => {
        if (!userProfile?.organizationId) {
            if(!loading) setIsLoading(false);
            return;
        };

        setIsLoading(true);
        try {
            const [companyDetails, companyTickets, companyEmployees, companyActivity] = await Promise.all([
                getCompanyDetails(userProfile.organizationId!, companyId),
                getTicketsFromDB(userProfile.organizationId!, { companyId: companyId, fetchAll: true }),
                getCompanyEmployees(userProfile.organizationId!, companyId),
                getCompanyActivityLogs(userProfile.organizationId!, companyId),
            ]);
            
            if (!companyDetails) {
                toast({ variant: 'destructive', title: 'Company not found' });
                router.push('/?view=clients');
                return;
            }

            setCompany(companyDetails);
            setTickets(companyTickets);
            setEmployees(companyEmployees);
            setActivity(companyActivity);
            
            setUpdatedName(companyDetails.name);
            setUpdatedAddress(companyDetails.address || '');
            setUpdatedMobile(companyDetails.mobile || '');
            setUpdatedLandline(companyDetails.landline || '');
            setUpdatedWebsite(companyDetails.website || '');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            toast({ variant: 'destructive', title: 'Failed to load company data', description: errorMessage });
        } finally {
            setIsLoading(false);
        }
    }, [userProfile, companyId, toast, router, loading]);

    useEffect(() => {
        fetchCompanyData();
    }, [fetchCompanyData]);
    
    const sortedTickets = useMemo(() => {
        let sorted = [...tickets];
        switch (sortOption) {
            case 'newest':
                sorted.sort((a, b) => new Date(b.receivedDateTime).getTime() - new Date(a.receivedDateTime).getTime());
                break;
            case 'oldest':
                sorted.sort((a, b) => new Date(a.receivedDateTime).getTime() - new Date(b.receivedDateTime).getTime());
                break;
            case 'upcoming':
                sorted = sorted
                    .filter(t => t.deadline && isFuture(parseISO(t.deadline)))
                    .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime());
                break;
            case 'overdue':
                 sorted = sorted
                    .filter(t => t.deadline && isPast(parseISO(t.deadline)) && !['Resolved', 'Closed'].includes(t.status))
                    .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime());
                break;
            case 'status':
                const statusOrder = { 'Open': 1, 'Pending': 2, 'Resolved': 3, 'Closed': 4, 'Archived': 5 };
                sorted.sort((a, b) => (statusOrder[a.status as keyof typeof statusOrder] || 99) - (statusOrder[b.status as keyof typeof statusOrder] || 99));
                break;
        }
        return sorted;
    }, [tickets, sortOption]);

    const paginatedTickets = useMemo(() => {
        const startIndex = (currentPage - 1) * ticketsPerPage;
        const endIndex = startIndex + ticketsPerPage;
        return sortedTickets.slice(startIndex, endIndex);
    }, [sortedTickets, currentPage, ticketsPerPage]);

    const totalPages = Math.ceil(sortedTickets.length / ticketsPerPage);

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
    
    const handleUpdateCompany = async () => {
        if (!company || !userProfile?.organizationId) return;
        setIsUpdating(true);
        try {
            const dataToUpdate = {
                name: updatedName,
                address: updatedAddress,
                mobile: updatedMobile,
                landline: updatedLandline,
                website: updatedWebsite,
            };
            await updateCompany(userProfile.organizationId, company.id, dataToUpdate);
            toast({ title: "Company Updated", description: "The company details have been updated." });
            await fetchCompanyData(); // Re-fetch data to reflect changes
            setIsEditDialogOpen(false);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            toast({ variant: 'destructive', title: "Update Failed", description: errorMessage });
        } finally {
            setIsUpdating(false);
        }
    };
    
    const handleEditEmployeeClick = (employee: Employee) => {
        setEditingEmployee(employee);
        setUpdatedEmployeeName(employee.name);
        setUpdatedEmployeeEmail(employee.email);
        setUpdatedEmployeeAddress(employee.address || '');
        setUpdatedEmployeeMobile(employee.mobile || '');
        setUpdatedEmployeeLandline(employee.landline || '');
        setIsEditEmployeeDialogOpen(true);
    };

    const handleUpdateEmployee = async () => {
        if (!editingEmployee || !company || !userProfile?.organizationId) return;
        setIsUpdatingEmployee(true);
        try {
            const employeeData: Employee = {
                name: updatedEmployeeName,
                email: updatedEmployeeEmail,
                address: updatedEmployeeAddress,
                mobile: updatedEmployeeMobile,
                landline: updatedEmployeeLandline,
            };
            await updateCompanyEmployee(userProfile.organizationId, company.id, editingEmployee.email, employeeData);
            toast({ title: "Employee Updated", description: "The employee's details have been updated." });
            await fetchCompanyData(); // Re-fetch all company data to reflect changes
            setIsEditEmployeeDialogOpen(false);
            setEditingEmployee(null);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            toast({ variant: 'destructive', title: "Update Failed", description: errorMessage });
        } finally {
            setIsUpdatingEmployee(false);
        }
    };

    if (loading || !user) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <p>Loading...</p>
            </div>
        );
    }
    
    const isOwner = user?.uid === userProfile?.organizationOwnerUid;

    const renderSidebarContent = () => {
        if (activeTab === 'tickets') {
            return (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Activity /> Activity
                        </CardTitle>
                        <CardDescription>Recent activity across all of {company?.name}'s tickets.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 max-h-[60vh] overflow-y-auto">
                        {activity.length > 0 ? (
                            activity.map((log) => (
                                <TimelineItem key={log.id} type={log.type} date={log.date} user={log.user}>
                                    <div className="flex flex-wrap items-center gap-x-2">
                                       <span>{log.details} on ticket</span> 
                                       <Link href={`/tickets/${log.ticketId}`} className="font-semibold hover:underline truncate" title={log.ticketSubject}>
                                            {log.ticketSubject}
                                       </Link>
                                    </div>
                                </TimelineItem>
                            ))
                        ) : (
                            <p className="text-sm text-muted-foreground text-center py-4">No activity found.</p>
                        )}
                    </CardContent>
                </Card>
            );
        }

        if (activeTab === 'employees') {
            return (
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>Company Properties</CardTitle>
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
                                        <DialogTitle>Edit Company Properties</DialogTitle>
                                        <DialogDescription>Update the details for {company?.name}.</DialogDescription>
                                    </DialogHeader>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
                                        <div className="space-y-2">
                                            <Label htmlFor="update-name">Name</Label>
                                            <Input id="update-name" value={updatedName} onChange={(e) => setUpdatedName(e.target.value)} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="update-website">Website</Label>
                                            <Input id="update-website" value={updatedWebsite} onChange={(e) => setUpdatedWebsite(e.target.value)} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="update-mobile">Mobile Number</Label>
                                            <Input id="update-mobile" value={updatedMobile} onChange={(e) => setUpdatedMobile(e.target.value)} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="update-landline">Landline</Label>
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
                                        <Button onClick={handleUpdateCompany} disabled={isUpdating}>
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
                            <PropertyItem icon={Building} label="Company Name" value={company?.name} />
                            <PropertyItem icon={Users} label="Total Employees" value={employees.length.toString()} />
                            <PropertyItem icon={Ticket} label="Total Tickets" value={tickets.length.toString()} />
                            <PropertyItem icon={MapPin} label="Address" value={company?.address} />
                            <PropertyItem icon={Phone} label="Mobile" value={company?.mobile} />
                            <PropertyItem icon={Phone} label="Landline" value={company?.landline} />
                            <PropertyItem icon={LinkIcon} label="Website" value={company?.website} isLink />
                        </dl>
                    </CardContent>
                </Card>
            );
        }

        return null;
    };


    return (
        <SidebarProvider>
            <div className="grid min-h-screen w-full lg:grid-cols-[240px_1fr]">
                <Sidebar className="w-[240px] hidden lg:flex flex-col py-6 h-full">
                    <div className="flex-grow flex flex-col">
                        <SidebarHeader className="mb-8 px-4">
                            <div className="flex items-center gap-2 bg-black p-2 rounded-md">
                                <Image src="/logo.png" alt="Onecore Logo" width={32} height={32} />
                            </div>
                        </SidebarHeader>
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
                    </div>
                </Sidebar>

                <main className="flex-1 flex flex-col min-w-0">
                    <Header>
                        <div className="flex items-center gap-4">
                             <Button variant="outline" size="icon" asChild>
                                <Link href="/?view=clients">
                                    <ArrowLeft className="h-4 w-4" />
                                </Link>
                            </Button>
                            {isLoading ? (
                                <Skeleton className="h-6 w-48" />
                            ) : (
                               <h1 className="text-xl font-bold truncate">{company?.name || 'Company Tickets'}</h1>
                            )}
                        </div>
                    </Header>
                    <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-6 overflow-y-auto p-4 sm:p-6 lg:p-8">
                         <div className="lg:col-span-2 xl:col-span-3">
                            {isLoading ? (
                                <div className="space-y-4">
                                    {[...Array(5)].map((_, i) => (
                                        <div key={i} className="p-4 border rounded-lg space-y-3">
                                            <Skeleton className="h-5 w-3/4 rounded-md" />
                                            <div className="flex items-center gap-2">
                                                <Skeleton className="h-4 w-24 rounded-md" />
                                                <Skeleton className="h-4 w-48 rounded-md" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <Tabs defaultValue="tickets" className="w-full" onValueChange={(value) => setActiveTab(value as ActiveTab)}>
                                    <TabsList className="mb-4">
                                        <TabsTrigger value="tickets">All Tickets</TabsTrigger>
                                        <TabsTrigger value="employees">Employees</TabsTrigger>
                                    </TabsList>
                                    <TabsContent value="tickets">
                                        <Card>
                                            <CardHeader className="flex flex-row items-center justify-between">
                                                <div>
                                                    <CardTitle>Tickets for {company?.name}</CardTitle>
                                                    <CardDescription>A list of all tickets associated with this company.</CardDescription>
                                                </div>
                                                <div className="w-[180px]">
                                                    <Select value={sortOption} onValueChange={(value) => setSortOption(value as SortOption)}>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Sort by" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="newest">Newest</SelectItem>
                                                            <SelectItem value="oldest">Oldest</SelectItem>
                                                            <SelectItem value="upcoming">Upcoming Deadline</SelectItem>
                                                            <SelectItem value="overdue">Overdue</SelectItem>
                                                            <SelectItem value="status">Status</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </CardHeader>
                                            <CardContent>
                                                {paginatedTickets.length > 0 ? (
                                                    <ul className="space-y-0 border-t">
                                                        {paginatedTickets.map((ticket) => (
                                                            <TicketItem 
                                                                key={ticket.id} 
                                                                email={ticket} 
                                                                isSelected={false}
                                                                onSelect={() => {}}
                                                            />
                                                        ))}
                                                    </ul>
                                                ) : (
                                                    <Alert>
                                                        <Ticket className="h-4 w-4" />
                                                        <AlertTitle>No Tickets Found</AlertTitle>
                                                        <AlertDescription>
                                                            There are no tickets matching the current criteria for {company?.name}.
                                                        </AlertDescription>
                                                    </Alert>
                                                )}
                                            </CardContent>
                                            {totalPages > 1 && (
                                                <CardFooter className="flex items-center justify-between pt-6">
                                                    <div className="text-sm text-muted-foreground">
                                                        Showing {Math.min(ticketsPerPage * currentPage, sortedTickets.length)} of {sortedTickets.length} tickets.
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm text-muted-foreground">Rows per page</span>
                                                            <Select value={String(ticketsPerPage)} onValueChange={(value) => { setTicketsPerPage(Number(value)); setCurrentPage(1); }}>
                                                                <SelectTrigger className="h-8 w-[70px]">
                                                                    <SelectValue placeholder={String(ticketsPerPage)} />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="10">10</SelectItem>
                                                                    <SelectItem value="25">25</SelectItem>
                                                                    <SelectItem value="50">50</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div className="text-sm text-muted-foreground">
                                                            Page {currentPage} of {totalPages}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                                                                <ChevronLeft className="h-4 w-4" />
                                                            </Button>
                                                            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                                                                <ChevronRight className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </CardFooter>
                                            )}
                                    </Card>
                                    </TabsContent>
                                    <TabsContent value="employees">
                                        <Card>
                                            <CardHeader>
                                                <CardTitle>Employees at {company?.name}</CardTitle>
                                                <CardDescription>A list of employees associated with this company.</CardDescription>
                                            </CardHeader>
                                            <CardContent>
                                                {employees.length > 0 ? (
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead>Name</TableHead>
                                                                <TableHead>Email</TableHead>
                                                                <TableHead className="text-right">Tickets Created</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {employees.map((employee) => (
                                                                <TableRow key={employee.email}>
                                                                    <TableCell className="font-medium">
                                                                        <Link href={`/contacts/${encodeURIComponent(employee.email)}`} className="hover:underline">
                                                                            {employee.name}
                                                                        </Link>
                                                                    </TableCell>
                                                                    <TableCell>{employee.email}</TableCell>
                                                                    <TableCell className="text-right">
                                                                        {tickets.filter(t => t.senderEmail?.toLowerCase() === employee.email.toLowerCase()).length}
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                ) : (
                                                    <Alert>
                                                        <User className="h-4 w-4" />
                                                        <AlertTitle>No Employees Found</AlertTitle>
                                                        <AlertDescription>
                                                            No employees have been associated with this company yet. Assigning a ticket from a new contact will add them automatically.
                                                        </AlertDescription>
                                                    </Alert>
                                                )}
                                            </CardContent>
                                        </Card>
                                    </TabsContent>
                                </Tabs>
                            )}
                        </div>
                        <aside className="lg:col-span-1 xl:col-span-1 space-y-6">
                            {isLoading ? (
                                 <Card>
                                    <CardHeader>
                                        <Skeleton className="h-6 w-1/2" />
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <Skeleton className="h-4 w-full" />
                                        <Skeleton className="h-4 w-full" />
                                        <Skeleton className="h-4 w-full" />
                                    </CardContent>
                                </Card>
                            ) : (
                                renderSidebarContent()
                            )}
                        </aside>
                    </div>
                </main>
            </div>
            
             <Dialog open={isEditEmployeeDialogOpen} onOpenChange={setIsEditEmployeeDialogOpen}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Edit Employee: {editingEmployee?.name}</DialogTitle>
                        <DialogDescription>Update the contact details for this employee.</DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
                        <div className="space-y-2">
                            <Label htmlFor="update-employee-name">Name</Label>
                            <Input id="update-employee-name" value={updatedEmployeeName} onChange={(e) => setUpdatedEmployeeName(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="update-employee-email">Email</Label>
                            <Input id="update-employee-email" type="email" value={updatedEmployeeEmail} onChange={(e) => setUpdatedEmployeeEmail(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="update-employee-mobile">Mobile Number</Label>
                            <Input id="update-employee-mobile" value={updatedEmployeeMobile} onChange={(e) => setUpdatedEmployeeMobile(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="update-employee-landline">Landline</Label>
                            <Input id="update-employee-landline" value={updatedEmployeeLandline} onChange={(e) => setUpdatedEmployeeLandline(e.target.value)} />
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                            <Label htmlFor="update-employee-address">Address</Label>
                            <Textarea id="update-employee-address" value={updatedEmployeeAddress} onChange={(e) => setUpdatedEmployeeAddress(e.target.value)} />
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="outline" onClick={() => setEditingEmployee(null)}>Cancel</Button>
                        </DialogClose>
                        <Button onClick={handleUpdateEmployee} disabled={isUpdatingEmployee}>
                            {isUpdatingEmployee && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                            Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </SidebarProvider>
    );
}
