

"use client";

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useToast } from '@/hooks/use-toast';
import { createOrganization, getOrganizationMembers, addMemberToOrganization, updateMemberInOrganization, deleteMemberFromOrganization, updateOrganization, sendVerificationEmail } from '@/app/actions';
import type { OrganizationMember } from '@/app/actions';
import { RefreshCw, Users, Trash2, Pencil, UserPlus, AlertTriangle, Settings, MoreHorizontal, ChevronLeft, ChevronRight, Crown, User as UserIcon, Mail, Send } from 'lucide-react';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Textarea } from './ui/textarea';
import { PropertyItem } from './property-item';
import { Building, MapPin, Phone, Link as LinkIcon } from 'lucide-react';


export function OrganizationView() {
    const { user, userProfile, loading, fetchUserProfile, logout } = useAuth();
    const { toast } = useToast();
    const [organizationName, setOrganizationName] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    
    const [members, setMembers] = useState<OrganizationMember[]>([]);
    const [isAddingMember, setIsAddingMember] = useState(false);
    const [newMemberName, setNewMemberName] = useState('');
    const [newMemberEmail, setNewMemberEmail] = useState('');
    const [newMemberAddress, setNewMemberAddress] = useState('');
    const [newMemberMobile, setNewMemberMobile] = useState('');
    const [newMemberLandline, setNewMemberLandline] = useState('');

    const [editingMember, setEditingMember] = useState<OrganizationMember | null>(null);
    const [updatedName, setUpdatedName] = useState('');
    const [updatedEmail, setUpdatedEmail] = useState('');
    const [updatedAddress, setUpdatedAddress] = useState('');
    const [updatedMobile, setUpdatedMobile] = useState('');
    const [updatedLandline, setUpdatedLandline] = useState('');

    const [isUpdating, setIsUpdating] = useState(false);
    const [deletingMember, setDeletingMember] = useState<OrganizationMember | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isSendingVerification, setIsSendingVerification] = useState<string | null>(null);
    
    const [isAddMemberDialogOpen, setIsAddMemberDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
    
    const [updatedOrganizationName, setUpdatedOrganizationName] = useState('');
    const [updatedOrgAddress, setUpdatedOrgAddress] = useState('');
    const [updatedOrgMobile, setUpdatedOrgMobile] = useState('');
    const [updatedOrgLandline, setUpdatedOrgLandline] = useState('');
    const [updatedOrgWebsite, setUpdatedOrgWebsite] = useState('');
    const [isUpdatingOrg, setIsUpdatingOrg] = useState(false);
    
    const [currentPage, setCurrentPage] = useState(1);
    const [membersPerPage, setMembersPerPage] = useState(10);


    const fetchMembers = async () => {
        if (userProfile?.organizationId) {
            const orgMembers = await getOrganizationMembers(userProfile.organizationId);
            setMembers(orgMembers);
        }
    };
    
    useEffect(() => {
        if (userProfile?.organizationId) {
            fetchMembers();
            setUpdatedOrganizationName(userProfile.organizationName || '');
            setUpdatedOrgAddress(userProfile.address || '');
            setUpdatedOrgMobile(userProfile.mobile || '');
            setUpdatedOrgLandline(userProfile.landline || '');
            setUpdatedOrgWebsite(userProfile.website || '');
        }
    }, [userProfile]);
    
    const paginatedMembers = useMemo(() => {
        const startIndex = (currentPage - 1) * membersPerPage;
        const endIndex = startIndex + membersPerPage;
        return members.slice(startIndex, endIndex);
    }, [members, currentPage, membersPerPage]);

    const totalPages = Math.ceil(members.length / membersPerPage);
    
    const resetAddMemberForm = () => {
        setNewMemberName('');
        setNewMemberEmail('');
        setNewMemberAddress('');
        setNewMemberMobile('');
        setNewMemberLandline('');
        setIsAddMemberDialogOpen(false);
    };

    const handleAddMember = async () => {
        if (!userProfile?.organizationId) {
            toast({ variant: 'destructive', title: 'Error', description: 'Organization not found.' });
            return;
        }
        if (!newMemberName.trim() || !newMemberEmail.trim()) {
            toast({ variant: 'destructive', title: 'Name and email are required.' });
            return;
        }

        setIsAddingMember(true);
        try {
            await addMemberToOrganization(userProfile.organizationId, newMemberName, newMemberEmail, newMemberAddress, newMemberMobile, newMemberLandline);
            toast({ title: 'Agent Added', description: `${newMemberName} has been invited to the organization.` });
            await fetchMembers();
            resetAddMemberForm();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            toast({ variant: 'destructive', title: 'Failed to Add Agent', description: errorMessage });
        } finally {
            setIsAddingMember(false);
        }
    };
    
    const handleEditClick = (member: OrganizationMember) => {
        setEditingMember(member);
        setUpdatedName(member.name);
        setUpdatedEmail(member.email);
        setUpdatedAddress(member.address || '');
        setUpdatedMobile(member.mobile || '');
        setUpdatedLandline(member.landline || '');
        setIsEditDialogOpen(true);
    };

    const handleUpdateMember = async () => {
        if (!editingMember || !userProfile?.organizationId) return;
        setIsUpdating(true);
        try {
            await updateMemberInOrganization(userProfile.organizationId, editingMember.email, updatedName, updatedEmail, updatedAddress, updatedMobile, updatedLandline);
            toast({ title: "Agent Updated", description: "The agent's details have been updated." });
            await fetchMembers();
            setIsEditDialogOpen(false);
            setEditingMember(null);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            toast({ variant: 'destructive', title: "Update Failed", description: errorMessage });
        } finally {
            setIsUpdating(false);
        }
    };
    
    const handleDeleteClick = (member: OrganizationMember) => {
        setDeletingMember(member);
    };

    const handleDeleteMember = async () => {
        if (!deletingMember || !userProfile?.organizationId) return;
        setIsDeleting(true);
        try {
            await deleteMemberFromOrganization(userProfile.organizationId, deletingMember.email);
            toast({ title: 'Agent Deleted', description: `${deletingMember.name} has been removed from the organization.` });
            await fetchMembers();
            setDeletingMember(null);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
            toast({ variant: 'destructive', title: 'Deletion Failed', description: errorMessage });
        } finally {
            setIsDeleting(false);
        }
    };

    const handleCreateOrganization = async () => {
        if (!user || !user.email) {
            toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in to create an organization.' });
            return;
        }
        if (!organizationName.trim()) {
            toast({ variant: 'destructive', title: 'Organization name is required.' });
            return;
        }
        setIsCreating(true);
        try {
            const userName = user.displayName || user.email;
            await createOrganization(organizationName, user.uid, userName, user.email);
            toast({ title: 'Organization Created', description: `The organization "${organizationName}" has been created successfully.` });
            await fetchUserProfile(user);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            toast({ variant: 'destructive', title: 'Creation Failed', description: errorMessage });
        } finally {
            setIsCreating(false);
        }
    };
    
    const handleSendVerification = async (email: string, name: string) => {
        if (!userProfile?.organizationId) return;

        setIsSendingVerification(email);
        try {
            await sendVerificationEmail(userProfile.organizationId, email, name);
            toast({ title: 'Verification Email Sent', description: `An invitation has been sent to ${email}.` });
            await fetchMembers(); // Re-fetch to get updated verificationSent status
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
            toast({ variant: 'destructive', title: 'Failed to Send', description: errorMessage });
        } finally {
            setIsSendingVerification(null);
        }
    };

    const handleUpdateOrganization = async () => {
        if (!userProfile?.organizationId || !updatedOrganizationName.trim()) {
            toast({ variant: 'destructive', title: 'Error', description: 'Organization name cannot be empty.' });
            return;
        }
        setIsUpdatingOrg(true);
        try {
            const dataToUpdate = {
                name: updatedOrganizationName,
                address: updatedOrgAddress,
                mobile: updatedOrgMobile,
                landline: updatedOrgLandline,
                website: updatedOrgWebsite,
            };
            await updateOrganization(userProfile.organizationId, dataToUpdate);
            await fetchUserProfile(user!);
            toast({ title: 'Organization Updated', description: `Organization details have been updated.` });
            setIsSettingsDialogOpen(false);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
            toast({ variant: 'destructive', title: 'Update Failed', description: errorMessage });
        } finally {
            setIsUpdatingOrg(false);
        }
    };
    
    if(loading) {
        return <p>Loading...</p>;
    }

    if (!userProfile?.organizationId) {
        return (
            <Card className="max-w-2xl w-full">
                <CardHeader>
                    <CardTitle className="font-headline">Create Organization</CardTitle>
                    <CardDescription>
                        You don't belong to an organization yet. Create one to get started.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="org-name">Organization Name</Label>
                        <Input 
                            id="org-name" 
                            placeholder="Your Company, Inc." 
                            value={organizationName}
                            onChange={(e) => setOrganizationName(e.target.value)}
                        />
                    </div>
                </CardContent>
                <CardFooter>
                     <Button onClick={handleCreateOrganization} disabled={isCreating}>
                        {isCreating && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                        Create Organization
                    </Button>
                </CardFooter>
            </Card>
        );
    }
    
    const isOwner = user?.uid === userProfile.organizationOwnerUid;

    const renderStatusBadge = (status: OrganizationMember['status']) => {
        switch (status) {
            case 'Registered':
                return <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300">Registered</Badge>;
            case 'Invited':
                return <Badge variant="destructive" className="bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">Invited</Badge>;
            case 'Uninvited':
                return <Badge variant="destructive">Uninvited</Badge>;
            default:
                return <Badge variant="outline">Unknown</Badge>;
        }
    };


    return (
        <AlertDialog open={!!deletingMember} onOpenChange={(isOpen) => !isOpen && setDeletingMember(null)}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto w-full">
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex justify-between items-start">
                        <div>
                            <h1 className="text-2xl font-bold">{userProfile.organizationName || 'Your Organization'}</h1>
                            <p className="text-muted-foreground">
                                Invite and manage your organization's agents.
                            </p>
                        </div>
                        {isOwner && (
                            <div className="flex items-center gap-2">
                                <Dialog open={isAddMemberDialogOpen} onOpenChange={setIsAddMemberDialogOpen}>
                                    <DialogTrigger asChild>
                                        <Button variant="default" size="sm">
                                            <UserPlus className="mr-2 h-4 w-4" />
                                            Add Agent
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-2xl">
                                        <DialogHeader>
                                            <DialogTitle>Add New Agent</DialogTitle>
                                            <DialogDescription>
                                                Invite a new agent to your organization. They will be able to sign up with their email.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
                                            <div className="space-y-2">
                                                <Label htmlFor="new-member-name">Name</Label>
                                                <Input id="new-member-name" value={newMemberName} onChange={(e) => setNewMemberName(e.target.value)} placeholder="John Doe" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="new-member-email">Email</Label>
                                                <Input id="new-member-email" type="email" value={newMemberEmail} onChange={(e) => setNewMemberEmail(e.target.value)} placeholder="john.d@example.com" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="new-member-mobile">Mobile Number</Label>
                                                <Input id="new-member-mobile" value={newMemberMobile} onChange={(e) => setNewMemberMobile(e.target.value)} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="new-member-landline">Telephone Number</Label>
                                                <Input id="new-member-landline" value={newMemberLandline} onChange={(e) => setNewMemberLandline(e.target.value)} />
                                            </div>
                                            <div className="space-y-2 sm:col-span-2">
                                                <Label htmlFor="new-member-address">Address</Label>
                                                <Textarea id="new-member-address" value={newMemberAddress} onChange={(e) => setNewMemberAddress(e.target.value)} placeholder="123 Main St..." />
                                            </div>
                                        </div>
                                        <DialogFooter>
                                            <DialogClose asChild>
                                                <Button type="button" variant="secondary" onClick={resetAddMemberForm}>Cancel</Button>
                                            </DialogClose>
                                            <Button onClick={handleAddMember} disabled={isAddingMember}>
                                                {isAddingMember && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                                                Add Agent
                                            </Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            </div>
                        )}
                    </div>
                    
                    <div>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Status</TableHead>
                                    {isOwner && <TableHead className="w-[100px]">Actions</TableHead>}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedMembers.length > 0 ? paginatedMembers.map((member) => {
                                    const memberIsOwner = member.uid === userProfile.organizationOwnerUid;
                                    return (
                                        <TableRow key={member.email}>
                                            <TableCell className="font-medium">
                                                <Link href={`/organization/members/${encodeURIComponent(member.email)}`} className="hover:underline">
                                                    {member.name}
                                                </Link>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">{member.email}</TableCell>
                                            <TableCell>
                                                {memberIsOwner ? (
                                                    <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300">
                                                        <Crown className="mr-1 h-3 w-3" />
                                                        Admin
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline">
                                                        <UserIcon className="mr-1 h-3 w-3" />
                                                        Agent
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {renderStatusBadge(member.status)}
                                            </TableCell>
                                            {isOwner && (
                                                <TableCell className="flex items-center gap-2">
                                                    {member.status === 'Uninvited' && (
                                                        <TooltipProvider>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Button 
                                                                        variant="ghost" 
                                                                        size="icon" 
                                                                        className="h-8 w-8"
                                                                        onClick={() => handleSendVerification(member.email, member.name)} 
                                                                        disabled={isSendingVerification === member.email}
                                                                    >
                                                                        {isSendingVerification === member.email ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                                                                    </Button>
                                                                </TooltipTrigger>
                                                                <TooltipContent>
                                                                    <p>Send verification email</p>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>
                                                    )}
                                                    {member.status === 'Invited' && (
                                                        <TooltipProvider>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Button 
                                                                        variant="ghost" 
                                                                        size="icon" 
                                                                        className="h-8 w-8"
                                                                        onClick={() => handleSendVerification(member.email, member.name)} 
                                                                        disabled={isSendingVerification === member.email}
                                                                    >
                                                                        {isSendingVerification === member.email ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                                                                    </Button>
                                                                </TooltipTrigger>
                                                                <TooltipContent>
                                                                    <p>Resend verification email</p>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>
                                                    )}
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                                                <MoreHorizontal className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem onClick={() => handleEditClick(member)}>
                                                                <Pencil className="mr-2 h-4 w-4" />
                                                                Edit
                                                            </DropdownMenuItem>
                                                            {!memberIsOwner && (
                                                                <AlertDialogTrigger asChild>
                                                                    <DropdownMenuItem onSelect={(e) => { e.preventDefault(); handleDeleteClick(member); }} className="text-destructive focus:text-destructive">
                                                                        <Trash2 className="mr-2 h-4 w-4" />
                                                                        Delete
                                                                    </DropdownMenuItem>
                                                                </AlertDialogTrigger>
                                                            )}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    );
                                }) : (
                                    <TableRow>
                                        <TableCell colSpan={isOwner ? 5 : 4} className="h-24 text-center">
                                            No agents found.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between pt-4">
                            <div className="text-sm text-muted-foreground">
                                Showing {Math.min(membersPerPage * currentPage, members.length)} of {members.length} members.
                            </div>
                            <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2">
                                    <span className="text-sm text-muted-foreground">Rows per page</span>
                                    <Select value={String(membersPerPage)} onValueChange={(value) => { setMembersPerPage(Number(value)); setCurrentPage(1); }}>
                                        <SelectTrigger className="h-8 w-[70px]">
                                            <SelectValue placeholder={String(membersPerPage)} />
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

                <div className="lg:col-span-1 space-y-6">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Properties</CardTitle>
                            {isOwner && (
                                <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
                                    <DialogTrigger asChild>
                                        <Button variant="secondary" size="sm">
                                            <Pencil className="mr-2 h-3 w-3" />
                                            Edit
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-2xl">
                                        <DialogHeader>
                                            <DialogTitle>Organization Settings</DialogTitle>
                                            <DialogDescription>Manage your organization's details.</DialogDescription>
                                        </DialogHeader>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
                                            <div className="space-y-2">
                                                <Label htmlFor="org-update-name">Organization Name</Label>
                                                <Input id="org-update-name" value={updatedOrganizationName} onChange={(e) => setUpdatedOrganizationName(e.target.value)} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="org-update-website">Website</Label>
                                                <Input id="org-update-website" value={updatedOrgWebsite} onChange={(e) => setUpdatedOrgWebsite(e.target.value)} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="org-update-mobile">Mobile Number</Label>
                                                <Input id="org-update-mobile" value={updatedOrgMobile} onChange={(e) => setUpdatedOrgMobile(e.target.value)} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="org-update-landline">Landline</Label>
                                                <Input id="org-update-landline" value={updatedOrgLandline} onChange={(e) => setUpdatedOrgLandline(e.target.value)} />
                                            </div>
                                            <div className="space-y-2 sm:col-span-2">
                                                <Label htmlFor="org-update-address">Address</Label>
                                                <Textarea id="org-update-address" value={updatedOrgAddress} onChange={(e) => setUpdatedOrgAddress(e.target.value)} />
                                            </div>
                                        </div>
                                        <DialogFooter>
                                            <DialogClose asChild>
                                                <Button type="button" variant="secondary">Cancel</Button>
                                            </DialogClose>
                                            <Button onClick={handleUpdateOrganization} disabled={isUpdatingOrg}>
                                                {isUpdatingOrg && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                                                Save Changes
                                            </Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            )}
                        </CardHeader>
                        <CardContent>
                            <dl className="grid grid-cols-1 gap-y-4">
                                <PropertyItem icon={Building} label="Organization Name" value={userProfile.organizationName} />
                                <PropertyItem icon={Users} label="Total Agents" value={members.length.toString()} />
                                <PropertyItem icon={MapPin} label="Address" value={userProfile.address} />
                                <PropertyItem icon={Phone} label="Mobile" value={userProfile.mobile} />
                                <PropertyItem icon={Phone} label="Landline" value={userProfile.landline} />
                                <PropertyItem icon={LinkIcon} label="Website" value={userProfile.website} isLink />
                            </dl>
                        </CardContent>
                    </Card>
                </div>
            </div>
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Edit Agent</DialogTitle>
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
                            <Button variant="outline" onClick={() => setEditingMember(null)}>Cancel</Button>
                        </DialogClose>
                        <Button onClick={handleUpdateMember} disabled={isUpdating}>
                            {isUpdating && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                            Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action will delete {deletingMember?.name} and cannot be undone. This does not delete their user account, only removes them from the organization.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteMember} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                        {isDeleting && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                        Delete
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
