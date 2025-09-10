
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useToast } from '@/hooks/use-toast';
import { createOrganization, getOrganizationMembers, addMemberToOrganization, updateMemberInOrganization, deleteMemberFromOrganization, updateOrganization } from '@/app/actions';
import type { OrganizationMember } from '@/app/actions';
import { RefreshCw, Users, Trash2, Pencil, UserPlus, AlertTriangle, Settings, MoreHorizontal, ChevronLeft, ChevronRight, Crown, User as UserIcon } from 'lucide-react';
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
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';


export function OrganizationView() {
    const { user, userProfile, loading, fetchUserProfile, logout } = useAuth();
    const { toast } = useToast();
    const [organizationName, setOrganizationName] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    
    const [members, setMembers] = useState<OrganizationMember[]>([]);
    const [isAddingMember, setIsAddingMember] = useState(false);
    const [newMemberName, setNewMemberName] = useState('');
    const [newMemberEmail, setNewMemberEmail] = useState('');

    const [editingMember, setEditingMember] = useState<OrganizationMember | null>(null);
    const [updatedName, setUpdatedName] = useState('');
    const [updatedEmail, setUpdatedEmail] = useState('');
    const [isUpdating, setIsUpdating] = useState(false);

    const [deletingMember, setDeletingMember] = useState<OrganizationMember | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    
    const [isAddMemberDialogOpen, setIsAddMemberDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
    
    const [updatedOrganizationName, setUpdatedOrganizationName] = useState(userProfile?.organizationName || '');
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
        setIsAddMemberDialogOpen(false);
    };

    const handleAddMember = async () => {
        if (!userProfile?.organizationId) {
            toast({ variant: 'destructive', title: 'Error', description: 'Organization not found.' });
            return;
        }
        if (!newMemberName.trim() || !newMemberEmail.trim()) {
            toast({ variant: 'destructive', title: 'All fields are required.' });
            return;
        }

        setIsAddingMember(true);
        try {
            await addMemberToOrganization(userProfile.organizationId, newMemberName, newMemberEmail);
            toast({ title: 'Member Added', description: `${newMemberName} has been invited to the organization.` });
            await fetchMembers();
            resetAddMemberForm();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            toast({ variant: 'destructive', title: 'Failed to Add Member', description: errorMessage });
        } finally {
            setIsAddingMember(false);
        }
    };
    
    const handleEditClick = (member: OrganizationMember) => {
        setEditingMember(member);
        setUpdatedName(member.name);
        setUpdatedEmail(member.email);
        setIsEditDialogOpen(true);
    };

    const handleUpdateMember = async () => {
        if (!editingMember || !userProfile?.organizationId) return;
        setIsUpdating(true);
        try {
            await updateMemberInOrganization(userProfile.organizationId, editingMember.email, updatedName, updatedEmail);
            toast({ title: "Member Updated", description: "The member's details have been updated." });
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
            toast({ title: 'Member Deleted', description: `${deletingMember.name} has been removed from the organization.` });
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

    const handleUpdateOrganization = async () => {
        if (!userProfile?.organizationId || !updatedOrganizationName.trim()) {
            toast({ variant: 'destructive', title: 'Error', description: 'Organization name cannot be empty.' });
            return;
        }
        setIsUpdatingOrg(true);
        try {
            await updateOrganization(userProfile.organizationId, updatedOrganizationName);
            await fetchUserProfile(user!);
            toast({ title: 'Organization Updated', description: `Organization name changed to "${updatedOrganizationName}".` });
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

    return (
        <div className="space-y-8 max-w-4xl w-full">
            <Card>
                <CardHeader className="flex flex-row items-start justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2"><Users /> {userProfile.organizationName || 'Your Organization'}</CardTitle>
                        <CardDescription>
                            Invite and manage your organization's members.
                        </CardDescription>
                    </div>
                     {isOwner && (
                        <div className="flex items-center gap-2">
                            <Dialog open={isAddMemberDialogOpen} onOpenChange={setIsAddMemberDialogOpen}>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <DialogTrigger asChild>
                                            <Button variant="outline" size="icon">
                                                <UserPlus className="h-4 w-4" />
                                            </Button>
                                        </DialogTrigger>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Add Member</p>
                                    </TooltipContent>
                                </Tooltip>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Add New Member</DialogTitle>
                                        <DialogDescription>
                                            Invite a new person to your organization. They will be able to sign up with their email.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="new-member-name">Name</Label>
                                            <Input id="new-member-name" value={newMemberName} onChange={(e) => setNewMemberName(e.target.value)} placeholder="John Doe" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="new-member-email">Email</Label>
                                            <Input id="new-member-email" type="email" value={newMemberEmail} onChange={(e) => setNewMemberEmail(e.target.value)} placeholder="john.d@example.com" />
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <DialogClose asChild>
                                            <Button type="button" variant="secondary" onClick={resetAddMemberForm}>Cancel</Button>
                                        </DialogClose>
                                        <Button onClick={handleAddMember} disabled={isAddingMember}>
                                            {isAddingMember && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                                            Add Member
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>

                             <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <DialogTrigger asChild>
                                            <Button variant="outline" size="icon">
                                                <Settings className="h-4 w-4" />
                                            </Button>
                                        </DialogTrigger>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Organization Settings</p>
                                    </TooltipContent>
                                </Tooltip>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Organization Settings</DialogTitle>
                                        <DialogDescription>Manage your organization's name.</DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-2 py-4">
                                        <Label htmlFor="org-update-name">Organization Name</Label>
                                        <Input
                                            id="org-update-name"
                                            value={updatedOrganizationName}
                                            onChange={(e) => setUpdatedOrganizationName(e.target.value)}
                                        />
                                    </div>
                                    <DialogFooter>
                                        <DialogClose asChild>
                                            <Button type="button" variant="secondary">Cancel</Button>
                                        </DialogClose>
                                        <Button onClick={handleUpdateOrganization} disabled={isUpdatingOrg || updatedOrganizationName === userProfile.organizationName}>
                                            {isUpdatingOrg && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                                            Save Changes
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>
                     )}
                </CardHeader>
                <CardContent>
                     <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Type</TableHead>
                                    {isOwner && <TableHead className="w-[50px]"><span className="sr-only">Actions</span></TableHead>}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedMembers.length > 0 ? paginatedMembers.map((member) => {
                                    const memberIsOwner = member.uid === userProfile.organizationOwnerUid;
                                    return (
                                        <TableRow key={member.email}>
                                            <TableCell className="font-medium">
                                                <Link href={`/assignees/${encodeURIComponent(member.email)}`} className="hover:underline">
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
                                            {isOwner && (
                                                <TableCell>
                                                    <Dialog open={isEditDialogOpen && editingMember?.email === member.email} onOpenChange={(isOpen) => { if (!isOpen) setEditingMember(null); setIsEditDialogOpen(isOpen); }}>
                                                        <AlertDialog open={deletingMember?.email === member.email} onOpenChange={(isOpen) => { if (!isOpen) setDeletingMember(null); }}>
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button variant="ghost" size="icon">
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
                                                                            <DropdownMenuItem onClick={() => handleDeleteClick(member)} onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive">
                                                                                <Trash2 className="mr-2 h-4 w-4" />
                                                                                Delete
                                                                            </DropdownMenuItem>
                                                                        </AlertDialogTrigger>
                                                                    )}
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                            <AlertDialogContent>
                                                                <AlertDialogHeader>
                                                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                                    <AlertDialogDescription>
                                                                        This action will delete {deletingMember?.name} and cannot be undone. This does not delete their user account, only removes them from the organization.
                                                                    </AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <AlertDialogFooter>
                                                                    <AlertDialogCancel onClick={() => setDeletingMember(null)}>Cancel</AlertDialogCancel>
                                                                    <AlertDialogAction onClick={handleDeleteMember} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                                                                        {isDeleting && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                                                                        Delete
                                                                    </AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                        <DialogContent>
                                                            <DialogHeader>
                                                                <DialogTitle>Edit Member</DialogTitle>
                                                            </DialogHeader>
                                                            <div className="space-y-4 py-4">
                                                                <div className="space-y-2">
                                                                    <Label htmlFor="update-name">Name</Label>
                                                                    <Input id="update-name" value={updatedName} onChange={(e) => setUpdatedName(e.target.value)} />
                                                                </div>
                                                                <div className="space-y-2">
                                                                    <Label htmlFor="update-email">Email</Label>
                                                                    <Input id="update-email" type="email" value={updatedEmail} onChange={(e) => setUpdatedEmail(e.target.value)} />
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
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    );
                                }) : (
                                    <TableRow>
                                        <TableCell colSpan={isOwner ? 4 : 3} className="h-24 text-center">
                                            No members found.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
                 <CardFooter className="flex items-center justify-between">
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
                </CardFooter>
            </Card>
        </div>
    );
}
