

"use client";

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { useRouter } from 'next/navigation';
import { SidebarProvider, Sidebar, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarHeader, SidebarFooter } from '@/components/ui/sidebar';
import { LayoutDashboard, List, Users, Building2, Settings, LogOut, Pencil, Archive, ArrowLeft, Ticket, User, ChevronLeft, ChevronRight, Activity, Building, MapPin, Phone, Link as LinkIcon, RefreshCw, MoreHorizontal, UserPlus, Trash2 } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/header';
import Link from 'next/link';
import { getTicketsFromDB, getCompanyDetails, getCompanyEmployees, getCompanyActivityLogs, updateCompany, updateCompanyEmployee, addEmployeeToCompany, deleteCompanyEmployee } from '@/app/actions';
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
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from './ui/dropdown-menu';
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from './ui/alert-dialog';

type SortOption = 'newest' | 'oldest' | 'upcoming' | 'overdue' | 'status';
type StatusFilter = 'all' | 'Open' | 'Pending' | 'Resolved' | 'Closed';
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
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
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

    const [isAddEmployeeDialogOpen, setIsAddEmployeeDialogOpen] = useState(false);
    const [isAddingEmployee, setIsAddingEmployee] = useState(false);
    const [newEmployeeName, setNewEmployeeName] = useState('');
    const [newEmployeeEmail, setNewEmployeeEmail] = useState('');
    const [newEmployeeAddress, setNewEmployeeAddress] = useState('');
    const [newEmployeeMobile, setNewEmployeeMobile] = useState('');
    const [newEmployeeLandline, setNewEmployeeLandline] = useState('');
    
    const [deletingEmployee, setDeletingEmployee] = useState<Employee | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);



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
                const statusOrder = { 'Open': 1, 'Pending': 2, 'Resolved': 3, 'Closed': 4, 'Archived': 5 };
                processedTickets.sort((a, b) => (statusOrder[a.status as keyof typeof statusOrder] || 99) - (statusOrder[b.status as keyof typeof statusOrder] || 99));
                break;
        }
        return processedTickets;
    }, [tickets, sortOption, statusFilter]);

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

    const handleAddEmployee = async () => {
        if (!company || !userProfile?.organizationId) return;
        if (!newEmployeeName.trim() || !newEmployeeEmail.trim()) {
            toast({ variant: 'destructive', title: "Name and email are required" });
            return;
        }

        setIsAddingEmployee(true);
        try {
            const newEmployee: Employee = {
                name: newEmployeeName,
                email: newEmployeeEmail,
                address: newEmployeeAddress,
                mobile: newEmployeeMobile,
                landline: newEmployeeLandline,
            };
            await addEmployeeToCompany(userProfile.organizationId, company.id, newEmployee);
            toast({ title: "Employee Added", description: `${newEmployeeName} has been added to ${company.name}.` });
            await fetchCompanyData();
            setIsAddEmployeeDialogOpen(false);
            setNewEmployeeName('');
            setNewEmployeeEmail('');
            setNewEmployeeAddress('');
            setNewEmployeeMobile('');
            setNewEmployeeLandline('');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            toast({ variant: 'destructive', title: "Failed to add employee", description: errorMessage });
        } finally {
            setIsAddingEmployee(false);
        }
    };
    
    const handleDeleteClick = (employee: Employee) => {
        setDeletingEmployee(employee);
    };

    const handleDeleteEmployee = async () => {
        if (!deletingEmployee || !company || !userProfile?.organizationId) return;
        setIsDeleting(true);
        try {
            await deleteCompanyEmployee(userProfile.organizationId, company.id, deletingEmployee.email);
            toast({ title: 'Employee Deleted', description: `${deletingEmployee.name} has been removed.` });
            await fetchCompanyData();
            setDeletingEmployee(null);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
            toast({ variant: 'destructive', title: 'Deletion Failed', description: errorMessage });
        } finally {
            setIsDeleting(false);
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
                 <div className="space-y-6">
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
                                <Image src={`/navlogo.jpg?t=${new Date().getTime()}`} alt="Onecore Logo" width="120" height="60" />
                            </div>
                        </SidebarHeader>
                    </div>
                </Sidebar>

                <main className="flex-1 flex flex-col min-w-0">
                    <Tabs defaultValue="tickets" value={activeTab} onValueChange={(value) => setActiveTab(value as ActiveTab)}>
                        <Header>
                            <div className="flex items-center gap-4">
                                <Button variant="outline" size="icon" asChild>
                                    <Link href="/?view=clients">
                                        <ArrowLeft className="h-4 w-4" />
                                    </Link>
                                </Button>
                                <TabsList>
                                    <TabsTrigger value="tickets">All Tickets</TabsTrigger>
                                    <TabsTrigger value="employees">Employees</TabsTrigger>
                                </TabsList>
                            </div>
                        </Header>
                        <div className="grid flex-1 grid-cols-1 gap-6 overflow-y-auto p-4 sm:p-6 lg:grid-cols-3 lg:p-8 xl:grid-cols-4">
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
                                    <>
                                        <TabsContent value="tickets">
                                            <div className="space-y-4">
                                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                                    <div>
                                                        <h2 className="text-xl font-bold">Tickets for {company?.name}</h2>
                                                        <p className="text-muted-foreground">A list of all tickets associated with this company.</p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Select value={sortOption} onValueChange={(value) => setSortOption(value as SortOption)}>
                                                            <SelectTrigger className="w-full sm:w-[180px]">
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
                                                        {sortOption === 'status' && (
                                                            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
                                                                <SelectTrigger className="w-full sm:w-[120px]">
                                                                    <SelectValue placeholder="Filter status" />
                                                                </SelectTrigger>
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
                                                </div>
                                                <div>
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
                                                </div>
                                                {totalPages > 1 && (
                                                    <div className="flex items-center justify-between pt-6 border-t">
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
                                                    </div>
                                                )}
                                            </div>
                                        </TabsContent>
                                        <TabsContent value="employees">
                                             <div>
                                                <div className="flex justify-between items-center mb-4">
                                                    <div>
                                                        <h2 className="text-xl font-bold">Employees at {company?.name}</h2>
                                                        <p className="text-muted-foreground">A list of employees associated with this company.</p>
                                                    </div>
                                                    {isOwner && (
                                                        <Dialog open={isAddEmployeeDialogOpen} onOpenChange={setIsAddEmployeeDialogOpen}>
                                                            <DialogTrigger asChild>
                                                                <Button size="sm">
                                                                    <UserPlus className="mr-2 h-4 w-4" />
                                                                    Add Employee
                                                                </Button>
                                                            </DialogTrigger>
                                                            <DialogContent className="sm:max-w-2xl">
                                                                <DialogHeader>
                                                                    <DialogTitle>Add New Employee</DialogTitle>
                                                                    <DialogDescription>Enter the details for the new employee.</DialogDescription>
                                                                </DialogHeader>
                                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
                                                                    <div className="space-y-2">
                                                                        <Label htmlFor="new-employee-name">Name</Label>
                                                                        <Input id="new-employee-name" value={newEmployeeName} onChange={(e) => setNewEmployeeName(e.target.value)} />
                                                                    </div>
                                                                    <div className="space-y-2">
                                                                        <Label htmlFor="new-employee-email">Email</Label>
                                                                        <Input id="new-employee-email" type="email" value={newEmployeeEmail} onChange={(e) => setNewEmployeeEmail(e.target.value)} />
                                                                    </div>
                                                                    <div className="space-y-2">
                                                                        <Label htmlFor="new-employee-mobile">Mobile Number</Label>
                                                                        <Input id="new-employee-mobile" value={newEmployeeMobile} onChange={(e) => setNewEmployeeMobile(e.target.value)} />
                                                                    </div>
                                                                    <div className="space-y-2">
                                                                        <Label htmlFor="new-employee-landline">Landline</Label>
                                                                        <Input id="new-employee-landline" value={newEmployeeLandline} onChange={(e) => setNewEmployeeLandline(e.target.value)} />
                                                                    </div>
                                                                    <div className="space-y-2 sm:col-span-2">
                                                                        <Label htmlFor="new-employee-address">Address</Label>
                                                                        <Textarea id="new-employee-address" value={newEmployeeAddress} onChange={(e) => setNewEmployeeAddress(e.target.value)} />
                                                                    </div>
                                                                </div>
                                                                <DialogFooter>
                                                                    <DialogClose asChild>
                                                                        <Button variant="outline">Cancel</Button>
                                                                    </DialogClose>
                                                                    <Button onClick={handleAddEmployee} disabled={isAddingEmployee}>
                                                                        {isAddingEmployee && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                                                                        Save Employee
                                                                    </Button>
                                                                </DialogFooter>
                                                            </DialogContent>
                                                        </Dialog>
                                                    )}
                                                </div>
                                                
                                                {employees.length > 0 ? (
                                                    <div className="border-t">
                                                        <Table>
                                                            <TableHeader>
                                                                <TableRow>
                                                                    <TableHead>Name</TableHead>
                                                                    <TableHead>Email</TableHead>
                                                                    <TableHead>Tickets</TableHead>
                                                                    {isOwner && <TableHead className="w-[50px] text-right">Actions</TableHead>}
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
                                                                        <TableCell>
                                                                            {tickets.filter(t => t.senderEmail?.toLowerCase() === employee.email.toLowerCase()).length}
                                                                        </TableCell>
                                                                        {isOwner && (
                                                                            <TableCell className="text-right">
                                                                                <AlertDialog open={deletingEmployee?.email === employee.email} onOpenChange={(isOpen) => { if (!isOpen) setDeletingEmployee(null); }}>
                                                                                    <DropdownMenu>
                                                                                        <DropdownMenuTrigger asChild>
                                                                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                                                                                <MoreHorizontal className="h-4 w-4" />
                                                                                            </Button>
                                                                                        </DropdownMenuTrigger>
                                                                                        <DropdownMenuContent align="end">
                                                                                            <DropdownMenuItem onClick={() => handleEditEmployeeClick(employee)}>
                                                                                                <Pencil className="mr-2 h-4 w-4" />
                                                                                                Edit
                                                                                            </DropdownMenuItem>
                                                                                            <AlertDialogTrigger asChild>
                                                                                                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive">
                                                                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                                                                    Delete
                                                                                                </DropdownMenuItem>
                                                                                            </AlertDialogTrigger>
                                                                                        </DropdownMenuContent>
                                                                                    </DropdownMenu>
                                                                                    <AlertDialogContent>
                                                                                        <AlertDialogHeader>
                                                                                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                                                            <AlertDialogDescription>
                                                                                                This action will delete {deletingEmployee?.name} and cannot be undone.
                                                                                            </AlertDialogDescription>
                                                                                        </AlertDialogHeader>
                                                                                        <AlertDialogFooter>
                                                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                                            <AlertDialogAction onClick={handleDeleteEmployee} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                                                                                                {isDeleting && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                                                                                                Delete
                                                                                            </AlertDialogAction>
                                                                                        </AlertDialogFooter>
                                                                                    </AlertDialogContent>
                                                                                </AlertDialog>
                                                                            </TableCell>
                                                                        )}
                                                                    </TableRow>
                                                                ))}
                                                            </TableBody>
                                                        </Table>
                                                    </div>
                                                ) : (
                                                    <Alert>
                                                        <User className="h-4 w-4" />
                                                        <AlertTitle>No Employees Found</AlertTitle>
                                                        <AlertDescription>
                                                        No employees have been associated with this company yet. You can add one manually.
                                                        </AlertDescription>
                                                    </Alert>
                                                )}
                                            </div>
                                        </TabsContent>
                                    </>
                                )}
                            </div>
                            <aside className="lg:col-span-1">
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
                    </Tabs>
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
